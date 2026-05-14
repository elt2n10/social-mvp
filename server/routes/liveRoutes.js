const express = require('express');
const db = require('../database');
const { auth } = require('../middleware/auth');
const router = express.Router();

router.post('/heartbeat', auth, (req, res) => {
  db.prepare(`
    INSERT INTO online_status (userId, lastSeen) VALUES (?, ?)
    ON CONFLICT(userId) DO UPDATE SET lastSeen = excluded.lastSeen
  `).run(req.user.id, new Date().toISOString());
  res.json({ ok: true });
});

router.get('/summary', auth, (req, res) => {
  const since = new Date(Date.now() - 2 * 60_000).toISOString();
  const onlineCount = db.prepare('SELECT COUNT(*) count FROM online_status WHERE lastSeen > ?').get(since).count;
  const latestPostId = db.prepare('SELECT COALESCE(MAX(id), 0) id FROM posts WHERE isHidden = 0').get().id;
  const latestVideoId = db.prepare('SELECT COALESCE(MAX(id), 0) id FROM videos WHERE isHidden = 0').get().id;
  const latestMessageId = db.prepare('SELECT COALESCE(MAX(id), 0) id FROM messages WHERE toUserId = ? OR fromUserId = ?').get(req.user.id, req.user.id).id;
  res.json({ onlineCount, latestPostId, latestVideoId, latestMessageId, serverTime: new Date().toISOString() });
});

module.exports = router;
