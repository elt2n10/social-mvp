const express = require('express');
const db = require('../database');
const { auth } = require('../middleware/auth');

const router = express.Router();

const ALLOWED_TARGETS = new Set(['post', 'video', 'profile', 'comment', 'video_comment']);

function cleanReason(reason = '') {
  return String(reason || '').trim().slice(0, 500);
}

router.post('/', auth, (req, res) => {
  const targetType = String(req.body.targetType || '').trim();
  const targetId = Number(req.body.targetId || 0);
  const reason = cleanReason(req.body.reason || 'Жалоба пользователя');

  if (!ALLOWED_TARGETS.has(targetType)) {
    return res.status(400).json({ message: 'Неверный тип жалобы' });
  }
  if (!targetId) {
    return res.status(400).json({ message: 'Не указан объект жалобы' });
  }

  const duplicate = db.prepare(`
    SELECT id FROM reports
    WHERE fromUserId = ? AND targetType = ? AND targetId = ?
    ORDER BY id DESC LIMIT 1
  `).get(req.user.id, targetType, targetId);

  if (duplicate) {
    return res.json({ ok: true, duplicate: true, message: 'Жалоба уже отправлена' });
  }

  const r = db.prepare(`
    INSERT INTO reports (targetType, targetId, fromUserId, reason)
    VALUES (?, ?, ?, ?)
  `).run(targetType, targetId, req.user.id, reason);

  res.json({ ok: true, id: r.lastInsertRowid });
});

module.exports = router;
