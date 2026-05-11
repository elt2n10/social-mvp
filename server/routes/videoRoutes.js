const express = require('express');
const db = require('../database');
const { auth, notBlocked } = require('../middleware/auth');
const upload = require('../middleware/upload');
const router = express.Router();

function mapVideo(row) {
  return { ...row, likes: Number(row.likes || 0), likedByMe: Boolean(row.likedByMe), comments: row.comments ? JSON.parse(row.comments) : [] };
}

router.get('/', auth, (req, res) => {
  const videos = db.prepare(`
    SELECT v.*, u.username authorName, u.avatar authorAvatar,
      (SELECT COUNT(*) FROM video_likes l WHERE l.videoId = v.id) likes,
      EXISTS(SELECT 1 FROM video_likes l WHERE l.videoId = v.id AND l.userId = ?) likedByMe,
      COALESCE((SELECT json_group_array(json_object('id', c.id, 'text', c.text, 'createdAt', c.createdAt, 'authorName', cu.username))
        FROM video_comments c JOIN users cu ON cu.id = c.authorId WHERE c.videoId = v.id ORDER BY c.id ASC), '[]') comments
    FROM videos v JOIN users u ON u.id = v.authorId
    ORDER BY v.id DESC
  `).all(req.user.id).map(mapVideo);
  res.json(videos);
});

router.post('/', auth, notBlocked, upload.single('video'), (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'Загрузи видео' });
  if (!req.file.mimetype.startsWith('video/')) return res.status(400).json({ message: 'Нужен видеофайл' });
  const r = db.prepare('INSERT INTO videos (authorId, videoUrl, description) VALUES (?, ?, ?)').run(req.user.id, `/uploads/${req.file.filename}`, req.body.description || '');
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
  db.prepare('INSERT INTO video_comments (videoId, authorId, text) VALUES (?, ?, ?)').run(req.params.id, req.user.id, text);
  res.json({ ok: true });
});

router.get('/user/:id', auth, (req, res) => {
  const videos = db.prepare(`
    SELECT v.*, u.username authorName, u.avatar authorAvatar,
      (SELECT COUNT(*) FROM video_likes l WHERE l.videoId = v.id) likes,
      EXISTS(SELECT 1 FROM video_likes l WHERE l.videoId = v.id AND l.userId = ?) likedByMe,
      COALESCE((SELECT json_group_array(json_object('id', c.id, 'text', c.text, 'createdAt', c.createdAt, 'authorName', cu.username))
        FROM video_comments c JOIN users cu ON cu.id = c.authorId WHERE c.videoId = v.id), '[]') comments
    FROM videos v JOIN users u ON u.id = v.authorId
    WHERE v.authorId = ? ORDER BY v.id DESC
  `).all(req.user.id, req.params.id).map(mapVideo);
  res.json(videos);
});

module.exports = router;
