const express = require('express');
const db = require('../database');
const { auth, notBlocked } = require('../middleware/auth');
const upload = require('../middleware/upload');
const { checkText, rejectByModeration } = require('../utils_moderation');
const { saveUploadedFile } = require('../utils/storage');
const { createActivity } = require('../utils/activity');
const router = express.Router();

function profilePayload(user, meId) {
  const id = Number(user.id);
  const isMe = id === Number(meId);
  const followersCount = db.prepare('SELECT COUNT(*) count FROM follows WHERE followingId = ?').get(id).count;
  const followingCount = db.prepare('SELECT COUNT(*) count FROM follows WHERE followerId = ?').get(id).count;
  const profileLikes = db.prepare('SELECT COUNT(*) count FROM profile_likes WHERE profileId = ?').get(id).count;
  const contentLikes =
    db.prepare('SELECT COUNT(*) count FROM post_likes l JOIN posts p ON p.id = l.postId WHERE p.authorId = ?').get(id).count +
    db.prepare('SELECT COUNT(*) count FROM video_likes l JOIN videos v ON v.id = l.videoId WHERE v.authorId = ?').get(id).count;
  const isFollowing = !isMe && Boolean(db.prepare('SELECT 1 FROM follows WHERE followerId = ? AND followingId = ?').get(meId, id));
  const followsMe = !isMe && Boolean(db.prepare('SELECT 1 FROM follows WHERE followerId = ? AND followingId = ?').get(id, meId));
  const likedProfile = !isMe && Boolean(db.prepare('SELECT 1 FROM profile_likes WHERE profileId = ? AND userId = ?').get(id, meId));
  const badges = db.prepare('SELECT id, imageUrl, title FROM user_badges WHERE userId = ? ORDER BY id DESC LIMIT 8').all(id);
  const { email, ...safeUser } = user;
  return {
    ...safeUser,
    maskedEmail: email ? email.replace(/^(.).+(@.+)$/, '$1***$2') : '',
    handle: '@' + String(user.username || '').replace(/^@+/, ''),
    isBlocked: Boolean(user.isBlocked),
    isMe,
    followersCount,
    followingCount,
    profileLikes,
    contentLikes,
    popularity: profileLikes + contentLikes,
    likedProfile,
    isFollowing,
    followsMe,
    isFriend: isFollowing && followsMe,
    badges
  };
}


router.get('/:id', auth, (req, res) => {
  const user = db.prepare('SELECT id, username, displayName, email, avatar, description, coverUrl, profileColor, isBlocked, createdAt FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ message: 'Пользователь не найден' });
  res.json(profilePayload(user, req.user.id));
});

router.post('/:id/follow', auth, notBlocked, (req, res) => {
  const targetId = Number(req.params.id);
  if (!targetId || targetId === Number(req.user.id)) return res.status(400).json({ message: 'Нельзя подписаться на себя' });
  const target = db.prepare('SELECT id FROM users WHERE id = ?').get(targetId);
  if (!target) return res.status(404).json({ message: 'Пользователь не найден' });
  const before = db.prepare('SELECT 1 FROM follows WHERE followerId = ? AND followingId = ?').get(req.user.id, targetId);
  db.prepare('INSERT OR IGNORE INTO follows (followerId, followingId) VALUES (?, ?)').run(req.user.id, targetId);
  const isFriend = Boolean(db.prepare('SELECT 1 FROM follows WHERE followerId = ? AND followingId = ?').get(targetId, req.user.id));
  if (!before) createActivity({ userId: targetId, actorId: req.user.id, type: isFriend ? 'friend' : 'follow', targetType: 'profile', targetId, text: isFriend ? 'теперь ваш друг' : 'подписался на вас' });
  res.json({ ok: true, isFollowing: true, isFriend });
});

router.delete('/:id/follow', auth, notBlocked, (req, res) => {
  const targetId = Number(req.params.id);
  db.prepare('DELETE FROM follows WHERE followerId = ? AND followingId = ?').run(req.user.id, targetId);
  res.json({ ok: true, isFollowing: false, isFriend: false });
});

router.post('/:id/like', auth, notBlocked, (req, res) => {
  const targetId = Number(req.params.id);
  if (!targetId || targetId === Number(req.user.id)) return res.status(400).json({ message: 'Нельзя лайкнуть свой профиль' });
  const target = db.prepare('SELECT id FROM users WHERE id = ?').get(targetId);
  if (!target) return res.status(404).json({ message: 'Пользователь не найден' });
  const exists = db.prepare('SELECT 1 FROM profile_likes WHERE profileId = ? AND userId = ?').get(targetId, req.user.id);
  if (exists) {
    db.prepare('DELETE FROM profile_likes WHERE profileId = ? AND userId = ?').run(targetId, req.user.id);
    return res.json({ ok: true, likedProfile: false });
  }
  db.prepare('INSERT OR IGNORE INTO profile_likes (profileId, userId) VALUES (?, ?)').run(targetId, req.user.id);
  createActivity({ userId: targetId, actorId: req.user.id, type: 'profile_like', targetType: 'profile', targetId, text: 'лайкнул ваш профиль' });
  res.json({ ok: true, likedProfile: true });
});

router.put('/me', auth, notBlocked, upload.fields([{ name: 'avatar', maxCount: 1 }, { name: 'cover', maxCount: 1 }]), async (req, res, next) => {
  try {
    const username = String(req.body.username || req.user.username || '').trim().replace(/^@+/, '').toLowerCase();
    const displayName = String(req.body.displayName || req.body.name || req.user.displayName || req.user.username || '').trim();
    const description = req.body.description ?? req.user.description;
    const profileColor = req.body.profileColor ?? req.user.profileColor ?? '';
    if (!/^[a-zA-Z0-9_]{3,24}$/.test(username)) return res.status(400).json({ message: '@username: 3-24 символа, только латиница, цифры и _' });
    if (displayName.length < 2 || displayName.length > 40) return res.status(400).json({ message: 'Имя должно быть от 2 до 40 символов' });
    const moderation = checkText(description);
    if (!moderation.ok) return rejectByModeration(res, db, { userId: req.user.id, targetType: 'profile_description', targetId: req.user.id, text: description, reason: moderation.reason, matched: moderation.matched, publicMessage: 'Описание не сохранено' });
    const avatar = req.files?.avatar?.[0] ? await saveUploadedFile(req.files.avatar[0], 'yved/avatars') : req.user.avatar;
    const coverUrl = req.files?.cover?.[0] ? await saveUploadedFile(req.files.cover[0], 'yved/covers') : req.user.coverUrl;

    db.prepare('UPDATE users SET username = ?, displayName = ?, description = ?, avatar = ?, coverUrl = ?, profileColor = ? WHERE id = ?')
      .run(username, displayName, description.slice(0, 800), avatar, coverUrl, profileColor, req.user.id);
    const user = db.prepare('SELECT id, username, displayName, email, avatar, description, coverUrl, profileColor, isBlocked, createdAt FROM users WHERE id = ?').get(req.user.id);
    res.json(profilePayload(user, req.user.id));
  } catch (e) {
    if (e && e.code === 'SQLITE_CONSTRAINT_UNIQUE') return res.status(409).json({ message: 'Такой @username уже занят' });
    next(e);
  }
});

module.exports = router;
