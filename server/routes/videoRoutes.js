const express = require('express');
const db = require('../database');
const { auth, notBlocked } = require('../middleware/auth');
const upload = require('../middleware/upload');
const { checkPublicText, moderateImageFile, rejectByModeration } = require('../utils_moderation');
const { saveUploadedFile } = require('../utils/storage');
const { createActivity } = require('../utils/activity');
const router = express.Router();
const MAX_VIDEO_SECONDS = 60;

function mapVideo(row) {
  return { ...row, isHidden: Boolean(row.isHidden), likes: Number(row.likes || 0), likedByMe: Boolean(row.likedByMe), comments: row.comments ? JSON.parse(row.comments) : [] };
}

router.get('/', auth, (req, res) => {
  const limit = Math.min(Math.max(Number(req.query.limit) || 12, 1), 30);
  const offset = Math.max(Number(req.query.offset) || 0, 0);
  const videos = db.prepare(`
    SELECT v.*, u.username authorName, u.displayName authorDisplayName, u.avatar authorAvatar,
      (SELECT COUNT(*) FROM video_likes l WHERE l.videoId = v.id) likes,
      EXISTS(SELECT 1 FROM video_likes l WHERE l.videoId = v.id AND l.userId = ?) likedByMe,
      COALESCE((SELECT json_group_array(json_object('id', c.id, 'text', c.text, 'createdAt', c.createdAt, 'authorName', cu.username, 'authorDisplayName', cu.displayName, 'authorId', cu.id))
        FROM video_comments c JOIN users cu ON cu.id = c.authorId WHERE c.videoId = v.id ORDER BY c.id ASC), '[]') comments
    FROM videos v JOIN users u ON u.id = v.authorId
    WHERE v.isHidden = 0
    ORDER BY v.id DESC
    LIMIT ? OFFSET ?
  `).all(req.user.id, limit, offset).map(mapVideo);
  res.json(videos);
});

router.post('/', auth, notBlocked, upload.single('video'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'Загрузи видео' });
    if (!req.file.mimetype.startsWith('video/')) return res.status(400).json({ message: 'Нужен видеофайл' });

    const duration = Number(req.body.duration || 0);
    if (duration && duration > MAX_VIDEO_SECONDS + 0.25) {
      return res.status(400).json({ message: 'Видео должно быть не длиннее 1 минуты' });
    }

    const description = req.body.description || '';
    const moderation = await checkPublicText(description, { authorId: req.user.id, targetType: 'video' });
    // Видео напрямую не отправляем в AI на 512 МБ сервере: проверяем описание. Для медиа используем фото/аватарки; видео позже можно проверять через превью-кадр/Cloudinary.
    if (!moderation.ok) return rejectByModeration(res, db, { userId: req.user.id, targetType: 'video', text: description, reason: moderation.reason, matched: moderation.matched, publicMessage: 'Видео не опубликовано' });
    const videoUrl = await saveUploadedFile(req.file, 'yved/videos');
    const r = db.prepare('INSERT INTO videos (authorId, videoUrl, description, moderationStatus) VALUES (?, ?, ?, ?)').run(req.user.id, videoUrl, description.slice(0, 600), 'approved');
    res.json({ id: r.lastInsertRowid });
  } catch(e) { next(e); }
});

router.post('/:id/like', auth, notBlocked, (req, res) => {
  const videoId = Number(req.params.id);
  const video = db.prepare('SELECT id, authorId FROM videos WHERE id = ?').get(videoId);
  if (!video) return res.status(404).json({ message: 'Видео не найдено' });
  const exists = db.prepare('SELECT 1 FROM video_likes WHERE videoId = ? AND userId = ?').get(videoId, req.user.id);
  if (exists) db.prepare('DELETE FROM video_likes WHERE videoId = ? AND userId = ?').run(videoId, req.user.id);
  else {
    db.prepare('INSERT OR IGNORE INTO video_likes (videoId, userId) VALUES (?, ?)').run(videoId, req.user.id);
    createActivity({ userId: video.authorId, actorId: req.user.id, type: 'video_like', targetType: 'video', targetId: videoId, text: 'лайкнул ваше видео' });
  }
  res.json({ ok: true });
});

router.post('/:id/comments', auth, notBlocked, async (req, res) => {
  const videoId = Number(req.params.id);
  const video = db.prepare('SELECT id, authorId FROM videos WHERE id = ?').get(videoId);
  if (!video) return res.status(404).json({ message: 'Видео не найдено' });
  const text = (req.body.text || '').trim();
  if (!text) return res.status(400).json({ message: 'Комментарий пустой' });
  const moderation = await checkPublicText(text, { authorId: req.user.id, targetType: 'video_comment', targetId: videoId });
  if (!moderation.ok) return rejectByModeration(res, db, { userId: req.user.id, targetType: 'video_comment', targetId: videoId, text, reason: moderation.reason, matched: moderation.matched, publicMessage: 'Комментарий не отправлен' });
  db.prepare('INSERT INTO video_comments (videoId, authorId, text) VALUES (?, ?, ?)').run(videoId, req.user.id, text.slice(0, 1000));
  createActivity({ userId: video.authorId, actorId: req.user.id, type: 'video_comment', targetType: 'video', targetId: videoId, text: 'прокомментировал ваше видео' });
  res.json({ ok: true });
});

router.get('/user/:id', auth, (req, res) => {
  const videos = db.prepare(`
    SELECT v.*, u.username authorName, u.displayName authorDisplayName, u.avatar authorAvatar,
      (SELECT COUNT(*) FROM video_likes l WHERE l.videoId = v.id) likes,
      EXISTS(SELECT 1 FROM video_likes l WHERE l.videoId = v.id AND l.userId = ?) likedByMe,
      COALESCE((SELECT json_group_array(json_object('id', c.id, 'text', c.text, 'createdAt', c.createdAt, 'authorName', cu.username, 'authorDisplayName', cu.displayName, 'authorId', cu.id))
        FROM video_comments c JOIN users cu ON cu.id = c.authorId WHERE c.videoId = v.id), '[]') comments
    FROM videos v JOIN users u ON u.id = v.authorId
    WHERE v.authorId = ? AND v.isHidden = 0 ORDER BY v.id DESC LIMIT 40
  `).all(req.user.id, req.params.id).map(mapVideo);
  res.json(videos);
});

module.exports = router;
