const express = require('express');
const db = require('../database');
const { auth, devOnly } = require('../middleware/auth');
const upload = require('../middleware/upload');
const { getConfig } = require('./siteRoutes');
const router = express.Router();

router.post('/login', auth, (req, res) => {
  const { password } = req.body;
  // Настоящий пароль берётся только из .env / Render Environment Variables.
  if (password && password === process.env.DEV_PASSWORD) return res.json({ devAccess: true });
  res.status(403).json({ message: 'Неверный пароль разработчика' });
});

router.get('/stats', auth, devOnly, (req, res) => {
  res.json({
    users: db.prepare('SELECT COUNT(*) count FROM users').get().count,
    posts: db.prepare('SELECT COUNT(*) count FROM posts WHERE isHidden = 0').get().count,
    hiddenPosts: db.prepare('SELECT COUNT(*) count FROM posts WHERE isHidden = 1').get().count,
    videos: db.prepare('SELECT COUNT(*) count FROM videos WHERE isHidden = 0').get().count,
    hiddenVideos: db.prepare('SELECT COUNT(*) count FROM videos WHERE isHidden = 1').get().count,
    reports: db.prepare('SELECT COUNT(*) count FROM reports').get().count
  });
});

router.get('/users', auth, devOnly, (req, res) => {
  const users = db.prepare('SELECT id, username, email, avatar, description, isBlocked, createdAt FROM users ORDER BY id DESC LIMIT 200').all()
    .map(u => ({ ...u, isBlocked: Boolean(u.isBlocked) }));
  res.json(users);
});

router.get('/recent/posts', auth, devOnly, (req, res) => {
  const rows = db.prepare(`
    SELECT p.id, p.text, p.imageUrl, p.isHidden, p.createdAt, u.username authorName
    FROM posts p JOIN users u ON u.id = p.authorId
    ORDER BY p.id DESC LIMIT 30
  `).all().map(p => ({ ...p, isHidden: Boolean(p.isHidden) }));
  res.json(rows);
});

router.get('/recent/videos', auth, devOnly, (req, res) => {
  const rows = db.prepare(`
    SELECT v.id, v.description, v.videoUrl, v.isHidden, v.createdAt, u.username authorName
    FROM videos v JOIN users u ON u.id = v.authorId
    ORDER BY v.id DESC LIMIT 30
  `).all().map(v => ({ ...v, isHidden: Boolean(v.isHidden) }));
  res.json(rows);
});

router.put('/posts/:id/hide', auth, devOnly, (req, res) => {
  db.prepare('UPDATE posts SET isHidden = 1 WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

router.put('/posts/:id/restore', auth, devOnly, (req, res) => {
  db.prepare('UPDATE posts SET isHidden = 0 WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

router.delete('/posts/:id', auth, devOnly, (req, res) => {
  // В MVP безопаснее скрывать, а не удалять навсегда.
  db.prepare('UPDATE posts SET isHidden = 1 WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

router.put('/videos/:id/hide', auth, devOnly, (req, res) => {
  db.prepare('UPDATE videos SET isHidden = 1 WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

router.put('/videos/:id/restore', auth, devOnly, (req, res) => {
  db.prepare('UPDATE videos SET isHidden = 0 WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

router.delete('/videos/:id', auth, devOnly, (req, res) => {
  db.prepare('UPDATE videos SET isHidden = 1 WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

router.put('/users/:id/block', auth, devOnly, (req, res) => {
  db.prepare('UPDATE users SET isBlocked = 1 WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

router.put('/users/:id/unblock', auth, devOnly, (req, res) => {
  db.prepare('UPDATE users SET isBlocked = 0 WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

router.get('/config', auth, devOnly, (req, res) => {
  res.json(getConfig());
});

router.put('/config', auth, devOnly, upload.fields([{ name: 'logo', maxCount: 1 }, { name: 'favicon', maxCount: 1 }]), (req, res) => {
  const allowedKeys = [
    'siteName', 'accentColor', 'secondColor', 'backgroundColor', 'cardColor',
    'buttonRadius', 'soundsEnabled', 'animationsEnabled', 'inviteEnabled'
  ];
  const update = db.prepare('INSERT INTO site_config (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value');
  for (const key of allowedKeys) {
    if (req.body[key] !== undefined) update.run(key, String(req.body[key]));
  }
  if (req.files?.logo?.[0]) update.run('logoUrl', `/uploads/${req.files.logo[0].filename}`);
  if (req.files?.favicon?.[0]) update.run('faviconUrl', `/uploads/${req.files.favicon[0].filename}`);
  res.json(getConfig());
});

module.exports = router;
