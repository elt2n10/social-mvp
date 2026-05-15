const db = require('../database');

function createActivity({ userId, actorId, type, targetType = '', targetId = null, text = '' }) {
  const to = Number(userId);
  const from = actorId == null ? null : Number(actorId);
  if (!to || (from && to === from)) return;
  db.prepare(`
    INSERT INTO activity_events (userId, actorId, type, targetType, targetId, text)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(to, from, type, targetType, targetId, text);
}

module.exports = { createActivity };
