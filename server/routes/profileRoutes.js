const express = require('express');
const db = require('../database');
const { auth, notBlocked } = require('../middleware/auth');
const upload = require('../middleware/upload');
const { checkText } = require('../utils_moderation');
const router = express.Router();

router.get('/:id', auth, (req, res) => {
  const user = db.prepare('SELECT id, username, email, avatar, description, coverUrl, profileColor, isBlocked, createdAt FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ message: 'Пользователь не найден' });
  res.json({ ...user, isBlocked: Boolean(user.isBlocked), isMe: Number(req.params.id) === req.user.id });
});

router.put('/me', auth, notBlocked, upload.fields([{ name: 'avatar', maxCount: 1 }, { name: 'cover', maxCount: 1 }]), (req, res) => {
  const username = (req.body.username || req.user.username).trim();
  const description = req.body.description ?? req.user.description;
  const profileColor = req.body.profileColor ?? req.user.profileColor ?? '';
  const moderation = checkText(description);
  if (!moderation.ok) return res.status(400).json({ message: 'Описание не сохранено: ' + moderation.reason });
  const avatar = req.files?.avatar?.[0] ? `/uploads/${req.files.avatar[0].filename}` : req.user.avatar;
  const coverUrl = req.files?.cover?.[0] ? `/uploads/${req.files.cover[0].filename}` : req.user.coverUrl;
  try {
    db.prepare('UPDATE users SET username = ?, description = ?, avatar = ?, coverUrl = ?, profileColor = ? WHERE id = ?')
      .run(username, description.slice(0, 800), avatar, coverUrl, profileColor, req.user.id);
    const user = db.prepare('SELECT id, username, email, avatar, description, coverUrl, profileColor, isBlocked, createdAt FROM users WHERE id = ?').get(req.user.id);
    res.json({ ...user, isBlocked: Boolean(user.isBlocked) });
  } catch {
    res.status(409).json({ message: 'Такое имя уже занято' });
  }
});

module.exports = router;
