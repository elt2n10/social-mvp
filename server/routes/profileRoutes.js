const express = require('express');
const db = require('../database');
const { auth, notBlocked } = require('../middleware/auth');
const upload = require('../middleware/upload');
const { checkText } = require('../utils_moderation');
const { saveUploadedFile } = require('../utils/storage');
const router = express.Router();

function profilePayload(user, meId) {
  const id = Number(user.id);
  const isMe = id === Number(meId);
  const followersCount = db.prepare('SELECT COUNT(*) count FROM follows WHERE followingId = ?').get(id).count;
  const followingCount = db.prepare('SELECT COUNT(*) count FROM follows WHERE followerId = ?').get(id).count;
  const isFollowing = !isMe && Boolean(db.prepare('SELECT 1 FROM follows WHERE followerId = ? AND followingId = ?').get(meId, id));
  const followsMe = !isMe && Boolean(db.prepare('SELECT 1 FROM follows WHERE followerId = ? AND followingId = ?').get(id, meId));
  return { ...user, isBlocked: Boolean(user.isBlocked), isMe, followersCount, followingCount, isFollowing, followsMe, isFriend: isFollowing && followsMe };
}

router.get('/:id', auth, (req, res) => {
  const user = db.prepare('SELECT id, username, email, avatar, description, coverUrl, profileColor, isBlocked, createdAt FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ message: 'Пользователь не найден' });
  res.json(profilePayload(user, req.user.id));
});

router.post('/:id/follow', auth, notBlocked, (req, res) => {
  const targetId = Number(req.params.id);
  if (!targetId || targetId === Number(req.user.id)) return res.status(400).json({ message: 'Нельзя подписаться на себя' });
  const target = db.prepare('SELECT id FROM users WHERE id = ?').get(targetId);
  if (!target) return res.status(404).json({ message: 'Пользователь не найден' });
  db.prepare('INSERT OR IGNORE INTO follows (followerId, followingId) VALUES (?, ?)').run(req.user.id, targetId);
  const isFriend = Boolean(db.prepare('SELECT 1 FROM follows WHERE followerId = ? AND followingId = ?').get(targetId, req.user.id));
  res.json({ ok: true, isFollowing: true, isFriend });
});

router.delete('/:id/follow', auth, notBlocked, (req, res) => {
  const targetId = Number(req.params.id);
  db.prepare('DELETE FROM follows WHERE followerId = ? AND followingId = ?').run(req.user.id, targetId);
  res.json({ ok: true, isFollowing: false, isFriend: false });
});

router.put('/me', auth, notBlocked, upload.fields([{ name: 'avatar', maxCount: 1 }, { name: 'cover', maxCount: 1 }]), async (req, res, next) => {
  try {
    const username = (req.body.username || req.user.username).trim();
    const description = req.body.description ?? req.user.description;
    const profileColor = req.body.profileColor ?? req.user.profileColor ?? '';
    const moderation = checkText(description);
    if (!moderation.ok) return res.status(400).json({ message: 'Описание не сохранено: ' + moderation.reason });
    const avatar = req.files?.avatar?.[0] ? await saveUploadedFile(req.files.avatar[0], 'yved/avatars') : req.user.avatar;
    const coverUrl = req.files?.cover?.[0] ? await saveUploadedFile(req.files.cover[0], 'yved/covers') : req.user.coverUrl;

    db.prepare('UPDATE users SET username = ?, description = ?, avatar = ?, coverUrl = ?, profileColor = ? WHERE id = ?')
      .run(username, description.slice(0, 800), avatar, coverUrl, profileColor, req.user.id);
    const user = db.prepare('SELECT id, username, email, avatar, description, coverUrl, profileColor, isBlocked, createdAt FROM users WHERE id = ?').get(req.user.id);
    res.json(profilePayload(user, req.user.id));
  } catch (e) {
    if (e && e.code === 'SQLITE_CONSTRAINT_UNIQUE') return res.status(409).json({ message: 'Такое имя уже занято' });
    next(e);
  }
});

module.exports = router;
