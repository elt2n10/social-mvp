const express = require('express');
const db = require('../database');
const { auth, notBlocked } = require('../middleware/auth');
const upload = require('../middleware/upload');
const { checkPublicText, moderateImageFile, rejectByModeration } = require('../utils_moderation');
const { saveUploadedFile } = require('../utils/storage');
const { createActivity } = require('../utils/activity');
const router = express.Router();

const MAX_POST_TEXT = 500;
const MAX_POST_IMAGES = 10;

function parseJsonArray(value) {
  try {
    const arr = value ? JSON.parse(value) : [];
    return Array.isArray(arr) ? arr.filter(Boolean) : [];
  } catch {
    return [];
  }
}

function mapPost(row) {
  const extraImages = parseJsonArray(row.imageUrls);
  const images = Array.from(new Set([...(row.imageUrl ? [row.imageUrl] : []), ...extraImages].filter(Boolean)));
  return {
    ...row,
    imageUrls: images,
    isHidden: Boolean(row.isHidden),
    likes: Number(row.likes || 0),
    likedByMe: Boolean(row.likedByMe),
    comments: row.comments ? JSON.parse(row.comments) : []
  };
}

const selectPostSql = `
  SELECT p.*, u.username authorName, u.displayName authorDisplayName, u.avatar authorAvatar,
    (SELECT COUNT(*) FROM post_likes l WHERE l.postId = p.id) likes,
    EXISTS(SELECT 1 FROM post_likes l WHERE l.postId = p.id AND l.userId = ?) likedByMe,
    COALESCE((SELECT json_group_array(imageUrl) FROM (SELECT pi.imageUrl FROM post_images pi WHERE pi.postId = p.id ORDER BY pi.position ASC)), '[]') imageUrls,
    COALESCE((SELECT json_group_array(json_object('id', c.id, 'text', c.text, 'createdAt', c.createdAt, 'authorName', cu.username, 'authorDisplayName', cu.displayName, 'authorId', cu.id))
      FROM comments c JOIN users cu ON cu.id = c.authorId WHERE c.postId = p.id ORDER BY c.id ASC), '[]') comments
  FROM posts p JOIN users u ON u.id = p.authorId
`;

router.get('/', auth, (req, res) => {
  const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 50);
  const offset = Math.max(Number(req.query.offset) || 0, 0);
  const posts = db.prepare(`
    ${selectPostSql}
    WHERE p.isHidden = 0
    ORDER BY p.id DESC
    LIMIT ? OFFSET ?
  `).all(req.user.id, limit, offset).map(mapPost);
  res.json(posts);
});

router.post('/', auth, notBlocked, upload.any(), async (req, res, next) => {
  try {
    const text = String(req.body.text || '').slice(0, MAX_POST_TEXT);
    const moderation = await checkPublicText(text, { authorId: req.user.id, targetType: 'post' });
    if (!moderation.ok) return rejectByModeration(res, db, { userId: req.user.id, targetType: 'post', text, reason: moderation.reason, matched: moderation.matched, publicMessage: 'Пост не опубликован' });

    const imageFiles = (Array.isArray(req.files) ? req.files : [])
      .filter(file => file.mimetype && file.mimetype.startsWith('image/'))
      .slice(0, MAX_POST_IMAGES);

    for (const file of imageFiles) {
      const imageModeration = await moderateImageFile(file);
      if (!imageModeration.ok) {
        return rejectByModeration(res, db, { userId: req.user.id, targetType: 'post_image', text: file.originalname, reason: imageModeration.reason, matched: imageModeration.matched, publicMessage: 'Фото не прошло модерацию' });
      }
    }

    if (!text.trim() && imageFiles.length === 0) return res.status(400).json({ message: 'Добавь текст или фото' });

    const imageUrls = [];
    for (const file of imageFiles) imageUrls.push(await saveUploadedFile(file, 'yved/posts'));

    const firstImage = imageUrls[0] || '';
    const transaction = db.transaction(() => {
      const r = db.prepare('INSERT INTO posts (authorId, text, imageUrl, moderationStatus) VALUES (?, ?, ?, ?)').run(req.user.id, text, firstImage, 'approved');
      const insertImage = db.prepare('INSERT INTO post_images (postId, imageUrl, position) VALUES (?, ?, ?)');
      imageUrls.forEach((url, index) => insertImage.run(r.lastInsertRowid, url, index));
      return r.lastInsertRowid;
    });

    const id = transaction();
    res.json({ id, imageCount: imageUrls.length });
  } catch (e) { next(e); }
});

router.post('/:id/like', auth, notBlocked, (req, res) => {
  const postId = Number(req.params.id);
  const post = db.prepare('SELECT id, authorId FROM posts WHERE id = ?').get(postId);
  if (!post) return res.status(404).json({ message: 'Пост не найден' });
  const exists = db.prepare('SELECT 1 FROM post_likes WHERE postId = ? AND userId = ?').get(postId, req.user.id);
  if (exists) db.prepare('DELETE FROM post_likes WHERE postId = ? AND userId = ?').run(postId, req.user.id);
  else {
    db.prepare('INSERT OR IGNORE INTO post_likes (postId, userId) VALUES (?, ?)').run(postId, req.user.id);
    createActivity({ userId: post.authorId, actorId: req.user.id, type: 'post_like', targetType: 'post', targetId: postId, text: 'лайкнул ваш пост' });
  }
  res.json({ ok: true });
});

router.post('/:id/comments', auth, notBlocked, async (req, res) => {
  const postId = Number(req.params.id);
  const post = db.prepare('SELECT id, authorId FROM posts WHERE id = ?').get(postId);
  if (!post) return res.status(404).json({ message: 'Пост не найден' });
  const text = (req.body.text || '').trim();
  if (!text) return res.status(400).json({ message: 'Комментарий пустой' });
  const moderation = await checkPublicText(text, { authorId: req.user.id, targetType: 'post_comment', targetId: postId });
  if (!moderation.ok) return rejectByModeration(res, db, { userId: req.user.id, targetType: 'post_comment', targetId: postId, text, reason: moderation.reason, matched: moderation.matched, publicMessage: 'Комментарий не отправлен' });
  db.prepare('INSERT INTO comments (postId, authorId, text) VALUES (?, ?, ?)').run(postId, req.user.id, text.slice(0, 1000));
  createActivity({ userId: post.authorId, actorId: req.user.id, type: 'post_comment', targetType: 'post', targetId: postId, text: 'прокомментировал ваш пост' });
  res.json({ ok: true });
});

router.get('/user/:id', auth, (req, res) => {
  const limit = Math.min(Math.max(Number(req.query.limit) || 30, 1), 60);
  const posts = db.prepare(`
    ${selectPostSql}
    WHERE p.authorId = ? AND p.isHidden = 0 ORDER BY p.id DESC LIMIT ?
  `).all(req.user.id, req.params.id, limit).map(mapPost);
  res.json(posts);
});

module.exports = router;
