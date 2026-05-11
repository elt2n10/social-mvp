const express = require('express');
const db = require('../database');
const { auth, devOnly } = require('../middleware/auth');
const router = express.Router();

router.post('/login', auth, (req, res) => {
  const { password } = req.body;
  // Настоящий пароль берётся только из .env на сервере.
  if (password && password === process.env.DEV_PASSWORD) return res.json({ devAccess: true });
  res.status(403).json({ message: 'Неверный пароль разработчика' });
});

router.get('/stats', auth, devOnly, (req, res) => {
  res.json({
    users: db.prepare('SELECT COUNT(*) count FROM users').get().count,
    posts: db.prepare('SELECT COUNT(*) count FROM posts').get().count,
    videos: db.prepare('SELECT COUNT(*) count FROM videos').get().count
  });
});

router.get('/users', auth, devOnly, (req, res) => {
  const users = db.prepare('SELECT id, username, email, avatar, description, isBlocked, createdAt FROM users ORDER BY id DESC').all()
    .map(u => ({ ...u, isBlocked: Boolean(u.isBlocked) }));
  res.json(users);
});

router.delete('/posts/:id', auth, devOnly, (req, res) => {
  db.prepare('DELETE FROM posts WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

router.delete('/videos/:id', auth, devOnly, (req, res) => {
  db.prepare('DELETE FROM videos WHERE id = ?').run(req.params.id);
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

module.exports = router;
