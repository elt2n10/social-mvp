const express = require('express');
const db = require('../database');
const { auth, notBlocked } = require('../middleware/auth');
const upload = require('../middleware/upload');
const { checkText } = require('../utils_moderation');
const router = express.Router();

function mapVideo(row) {
  return { ...row, isHidden: Boolean(row.isHidden), likes: Number(row.likes || 0), likedByMe: Boolean(row.likedByMe), comments: row.comments ? JSON.parse(row.comments) : [] };
}

router.get('/', auth, (req, res) => {
  const limit = Math.min(Math.max(Number(req.query.limit) || 12, 1), 30);
  const offset = Math.max(Number(req.query.offset) || 0, 0);
  const videos = db.prepare(`
    SELECT v.*, u.username authorName, u.avatar authorAvatar,
      (SELECT COUNT(*) FROM video_likes l WHERE l.videoId = v.id) likes,
      EXISTS(SELECT 1 FROM video_likes l WHERE l.videoId = v.id AND l.userId = ?) likedByMe,
      COALESCE((SELECT json_group_array(json_object('id', c.id, 'text', c.text, 'createdAt', c.createdAt, 'authorName', cu.username, 'authorId', cu.id))
        FROM video_comments c JOIN users cu ON cu.id = c.authorId WHERE c.videoId = v.id ORDER BY c.id ASC), '[]') comments
    FROM videos v JOIN users u ON u.id = v.authorId
    WHERE v.isHidden = 0
    ORDER BY v.id DESC
    LIMIT ? OFFSET ?
  `).all(req.user.id, limit, offset).map(mapVideo);
  res.json(videos);
});

router.post('/', auth, notBlocked, upload.single('video'), (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'Загрузи видео' });
  if (!req.file.mimetype.startsWith('video/')) return res.status(400).json({ message: 'Нужен видеофайл' });
  const description = req.body.description || '';
  const moderation = checkText(description);
  if (!moderation.ok) return res.status(400).json({ message: 'Видео не опубликовано: ' + moderation.reason });
  const r = db.prepare('INSERT INTO videos (authorId, videoUrl, description, moderationStatus) VALUES (?, ?, ?, ?)').run(req.user.id, `/uploads/${req.file.filename}`, description.slice(0, 600), 'approved');
  res.json({ id: r.lastInsertRowid });
});

router.post('/:id/like', auth, notBlocked, (req, res) => {
  const exists = db.prepare('SELECT 1 FROM video_likes WHERE videoId = ? AND userId = ?').get(req.params.id, req.user.id);
  if (exists) db.prepare('DELETE FROM video_likes WHERE videoId = ? AND userId = ?').run(req.params.id, req.user.id);
  else db.prepare('INSERT OR IGNORE INTO video_likes (videoId, userId) VALUES (?, ?)').run(req.params.id, req.user.id);
  res.json({ ok: true });
});

router.post('/:id/comments', auth, notBlocked, (req, res) => {
  const text = (req.body.text || '').trim();
  if (!text) return res.status(400).json({ message: 'Комментарий пустой' });
  const moderation = checkText(text);
  if (!moderation.ok) return res.status(400).json({ message: 'Комментарий не отправлен: ' + moderation.reason });
  db.prepare('INSERT INTO video_comments (videoId, authorId, text) VALUES (?, ?, ?)').run(req.params.id, req.user.id, text.slice(0, 1000));
  res.json({ ok: true });
});

router.get('/user/:id', auth, (req, res) => {
  const videos = db.prepare(`
    SELECT v.*, u.username authorName, u.avatar authorAvatar,
      (SELECT COUNT(*) FROM video_likes l WHERE l.videoId = v.id) likes,
      EXISTS(SELECT 1 FROM video_likes l WHERE l.videoId = v.id AND l.userId = ?) likedByMe,
      COALESCE((SELECT json_group_array(json_object('id', c.id, 'text', c.text, 'createdAt', c.createdAt, 'authorName', cu.username, 'authorId', cu.id))
        FROM video_comments c JOIN users cu ON cu.id = c.authorId WHERE c.videoId = v.id), '[]') comments
    FROM videos v JOIN users u ON u.id = v.authorId
    WHERE v.authorId = ? AND v.isHidden = 0 ORDER BY v.id DESC LIMIT 40
  `).all(req.user.id, req.params.id).map(mapVideo);
  res.json(videos);
});

module.exports = router;
