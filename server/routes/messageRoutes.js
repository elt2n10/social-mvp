const express = require('express');
const db = require('../database');
const { auth, notBlocked } = require('../middleware/auth');
const { checkText } = require('../utils_moderation');
const router = express.Router();

router.get('/users/search', auth, (req, res) => {
  const q = `%${req.query.q || ''}%`;
  const users = db.prepare(`
    SELECT id, username, avatar, description FROM users
    WHERE id != ? AND (username LIKE ? OR email LIKE ?)
    ORDER BY username LIMIT 20
  `).all(req.user.id, q, q);
  res.json(users);
});

router.get('/dialogs', auth, (req, res) => {
  const rows = db.prepare(`
    SELECT u.id, u.username, u.avatar,
      (SELECT text FROM messages m WHERE (m.fromUserId = u.id AND m.toUserId = ?) OR (m.fromUserId = ? AND m.toUserId = u.id) ORDER BY m.id DESC LIMIT 1) lastMessage,
      (SELECT createdAt FROM messages m WHERE (m.fromUserId = u.id AND m.toUserId = ?) OR (m.fromUserId = ? AND m.toUserId = u.id) ORDER BY m.id DESC LIMIT 1) lastAt
    FROM users u
    WHERE u.id IN (
      SELECT CASE WHEN fromUserId = ? THEN toUserId ELSE fromUserId END FROM messages WHERE fromUserId = ? OR toUserId = ?
    )
    ORDER BY lastAt DESC
  `).all(req.user.id, req.user.id, req.user.id, req.user.id, req.user.id, req.user.id, req.user.id);
  res.json(rows);
});

router.get('/stickers', auth, (req, res) => {
  const stickers = db.prepare('SELECT id, name, imageUrl FROM stickers WHERE isHidden = 0 ORDER BY id DESC LIMIT 80').all();
  res.json(stickers);
});

router.get('/with/:userId', auth, (req, res) => {
  const other = Number(req.params.userId);
  const beforeId = Number(req.query.beforeId || 0);
  const limit = Math.min(Math.max(Number(req.query.limit) || 80, 20), 120);
  const params = beforeId ? [req.user.id, other, other, req.user.id, beforeId, limit] : [req.user.id, other, other, req.user.id, limit];
  const whereBefore = beforeId ? 'AND id < ?' : '';
  const rows = db.prepare(`
    SELECT * FROM messages
    WHERE ((fromUserId = ? AND toUserId = ?) OR (fromUserId = ? AND toUserId = ?)) ${whereBefore}
    ORDER BY id DESC LIMIT ?
  `).all(...params).reverse();
  db.prepare('UPDATE messages SET isRead = 1 WHERE fromUserId = ? AND toUserId = ?').run(other, req.user.id);
  res.json(rows);
});

router.post('/send', auth, notBlocked, (req, res) => {
  const { toUserId, text, stickerId } = req.body;
  const user = db.prepare('SELECT id, isBlocked FROM users WHERE id = ?').get(toUserId);
  if (!user) return res.status(404).json({ message: 'Пользователь не найден' });

  if (stickerId) {
    const sticker = db.prepare('SELECT id, name, imageUrl FROM stickers WHERE id = ? AND isHidden = 0').get(stickerId);
    if (!sticker) return res.status(404).json({ message: 'Стикер не найден' });
    const r = db.prepare(`
      INSERT INTO messages (fromUserId, toUserId, text, messageType, stickerUrl)
      VALUES (?, ?, ?, 'sticker', ?)
    `).run(req.user.id, toUserId, sticker.name || 'sticker', sticker.imageUrl);
    return res.json({ id: r.lastInsertRowid });
  }

  const clean = String(text || '').trim();
  if (!clean) return res.status(400).json({ message: 'Пустое сообщение' });
  const moderation = checkText(clean);
  if (!moderation.ok) return res.status(400).json({ message: 'Сообщение не отправлено: ' + moderation.reason });
  const r = db.prepare(`
    INSERT INTO messages (fromUserId, toUserId, text, messageType, stickerUrl)
    VALUES (?, ?, ?, 'text', '')
  `).run(req.user.id, toUserId, clean.slice(0, 2000));
  res.json({ id: r.lastInsertRowid });
});

module.exports = router;
