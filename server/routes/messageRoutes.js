const express = require('express');
const db = require('../database');
const { auth, notBlocked } = require('../middleware/auth');
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

router.get('/with/:userId', auth, (req, res) => {
  const other = Number(req.params.userId);
  const rows = db.prepare(`
    SELECT * FROM messages
    WHERE (fromUserId = ? AND toUserId = ?) OR (fromUserId = ? AND toUserId = ?)
    ORDER BY id ASC
  `).all(req.user.id, other, other, req.user.id);
  db.prepare('UPDATE messages SET isRead = 1 WHERE fromUserId = ? AND toUserId = ?').run(other, req.user.id);
  res.json(rows);
});

router.post('/send', auth, notBlocked, (req, res) => {
  const { toUserId, text } = req.body;
  if (!toUserId || !String(text || '').trim()) return res.status(400).json({ message: 'Пустое сообщение' });
  const user = db.prepare('SELECT id, isBlocked FROM users WHERE id = ?').get(toUserId);
  if (!user) return res.status(404).json({ message: 'Пользователь не найден' });
  const r = db.prepare('INSERT INTO messages (fromUserId, toUserId, text) VALUES (?, ?, ?)').run(req.user.id, toUserId, text.trim());
  res.json({ id: r.lastInsertRowid });
});

module.exports = router;
