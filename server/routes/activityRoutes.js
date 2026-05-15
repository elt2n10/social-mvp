const express = require('express');
const db = require('../database');
const { auth } = require('../middleware/auth');

const router = express.Router();

router.get('/', auth, (req, res) => {
  const limit = Math.min(Math.max(Number(req.query.limit) || 40, 1), 100);
  const rows = db.prepare(`
    SELECT a.*, u.username actorName, u.avatar actorAvatar
    FROM activity_events a
    LEFT JOIN users u ON u.id = a.actorId
    WHERE a.userId = ?
    ORDER BY a.id DESC
    LIMIT ?
  `).all(req.user.id, limit).map(row => ({ ...row, isRead: Boolean(row.isRead) }));
  res.json(rows);
});

router.get('/unread-count', auth, (req, res) => {
  const count = db.prepare('SELECT COUNT(*) count FROM activity_events WHERE userId = ? AND isRead = 0').get(req.user.id).count;
  res.json({ count });
});

router.put('/read-all', auth, (req, res) => {
  db.prepare('UPDATE activity_events SET isRead = 1 WHERE userId = ?').run(req.user.id);
  res.json({ ok: true });
});

module.exports = router;
