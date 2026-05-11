const express = require('express');
const db = require('../database');
const { auth, notBlocked } = require('../middleware/auth');
const upload = require('../middleware/upload');
const router = express.Router();

router.get('/:id', auth, (req, res) => {
  const user = db.prepare('SELECT id, username, email, avatar, description, isBlocked, createdAt FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ message: 'Пользователь не найден' });
  res.json({ ...user, isBlocked: Boolean(user.isBlocked) });
});

router.put('/me', auth, notBlocked, upload.single('avatar'), (req, res) => {
  const username = (req.body.username || req.user.username).trim();
  const description = req.body.description ?? req.user.description;
  const avatar = req.file ? `/uploads/${req.file.filename}` : req.user.avatar;
  try {
    db.prepare('UPDATE users SET username = ?, description = ?, avatar = ? WHERE id = ?').run(username, description, avatar, req.user.id);
    const user = db.prepare('SELECT id, username, email, avatar, description, isBlocked, createdAt FROM users WHERE id = ?').get(req.user.id);
    res.json(user);
  } catch {
    res.status(409).json({ message: 'Такое имя уже занято' });
  }
});

module.exports = router;
