const express = require('express');
const db = require('../database');
const { auth, notBlocked } = require('../middleware/auth');
const upload = require('../middleware/upload');
const { saveUploadedFile } = require('../utils/storage');
const { createActivity } = require('../utils/activity');
const router = express.Router();

function ensureGroupMember(groupId, userId) {
  return db.prepare('SELECT role FROM message_group_members WHERE groupId = ? AND userId = ?').get(groupId, userId);
}

router.get('/users/search', auth, (req, res) => {
  const q = `%${req.query.q || ''}%`;
  const users = db.prepare(`
    SELECT id, username, displayName, avatar, description FROM users
    WHERE id != ? AND (username LIKE ? OR email LIKE ?)
    ORDER BY username LIMIT 20
  `).all(req.user.id, q, q);
  res.json(users);
});

router.get('/dialogs', auth, (req, res) => {
  const privateRows = db.prepare(`
    SELECT 'user' type, u.id, COALESCE(NULLIF(u.displayName, ''), u.username) name, u.username, u.displayName, u.avatar, '' color,
      (SELECT text FROM messages m WHERE (m.fromUserId = u.id AND m.toUserId = ?) OR (m.fromUserId = ? AND m.toUserId = u.id) ORDER BY m.id DESC LIMIT 1) lastMessage,
      (SELECT createdAt FROM messages m WHERE (m.fromUserId = u.id AND m.toUserId = ?) OR (m.fromUserId = ? AND m.toUserId = u.id) ORDER BY m.id DESC LIMIT 1) lastAt
    FROM users u
    WHERE u.id IN (
      SELECT CASE WHEN fromUserId = ? THEN toUserId ELSE fromUserId END FROM messages WHERE fromUserId = ? OR toUserId = ?
    )
  `).all(req.user.id, req.user.id, req.user.id, req.user.id, req.user.id, req.user.id, req.user.id);

  const groupRows = db.prepare(`
    SELECT 'group' type, g.id, g.name, '' username, g.avatar, g.color,
      (SELECT text FROM message_group_messages gm WHERE gm.groupId = g.id ORDER BY gm.id DESC LIMIT 1) lastMessage,
      (SELECT createdAt FROM message_group_messages gm WHERE gm.groupId = g.id ORDER BY gm.id DESC LIMIT 1) lastAt
    FROM message_groups g
    JOIN message_group_members mem ON mem.groupId = g.id
    WHERE mem.userId = ?
  `).all(req.user.id);

  res.json([...privateRows, ...groupRows].sort((a, b) => String(b.lastAt || '').localeCompare(String(a.lastAt || ''))));
});

router.get('/unread-count', auth, (req, res) => {
  const privateCount = db.prepare('SELECT COUNT(*) count FROM messages WHERE toUserId = ? AND isRead = 0').get(req.user.id).count;
  // Для групп пока считаем только личные непрочитанные, потому что у групповых сообщений нет per-user read state.
  res.json({ count: privateCount });
});

router.get('/stickers', auth, (req, res) => {
  const stickers = db.prepare('SELECT id, name, imageUrl FROM stickers WHERE isHidden = 0 ORDER BY id DESC LIMIT 80').all();
  res.json(stickers);
});

router.get('/groups', auth, (req, res) => {
  const rows = db.prepare(`
    SELECT g.*, mem.role,
      (SELECT COUNT(*) FROM message_group_members WHERE groupId = g.id) memberCount
    FROM message_groups g
    JOIN message_group_members mem ON mem.groupId = g.id
    WHERE mem.userId = ?
    ORDER BY g.id DESC
  `).all(req.user.id);
  res.json(rows);
});

router.post('/groups', auth, notBlocked, async (req, res) => {
  const name = String(req.body.name || '').trim().slice(0, 40);
  const color = String(req.body.color || '#7c3cff').trim().slice(0, 24);
  const memberIds = Array.isArray(req.body.memberIds) ? req.body.memberIds.map(Number).filter(Boolean) : [];
  if (!name) return res.status(400).json({ message: 'Название группы обязательно' });
  const tx = db.transaction(() => {
    const r = db.prepare('INSERT INTO message_groups (ownerId, name, color) VALUES (?, ?, ?)').run(req.user.id, name, color);
    const groupId = r.lastInsertRowid;
    const add = db.prepare('INSERT OR IGNORE INTO message_group_members (groupId, userId, role) VALUES (?, ?, ?)');
    add.run(groupId, req.user.id, 'admin');
    for (const id of memberIds.slice(0, 50)) {
      if (id !== req.user.id) add.run(groupId, id, 'member');
    }
    return groupId;
  });
  const groupId = tx();
  res.json({ ok: true, id: groupId });
});

router.put('/groups/:groupId', auth, notBlocked, upload.single('avatar'), async (req, res, next) => {
  try {
    const groupId = Number(req.params.groupId);
    const member = ensureGroupMember(groupId, req.user.id);
    if (!member || member.role !== 'admin') return res.status(403).json({ message: 'Нет доступа к настройкам группы' });
    const group = db.prepare('SELECT * FROM message_groups WHERE id = ?').get(groupId);
    if (!group) return res.status(404).json({ message: 'Группа не найдена' });

    const name = String(req.body.name || group.name).trim().slice(0, 40);
    const color = String(req.body.color || group.color || '#7c3cff').trim().slice(0, 24);
    const description = String(req.body.description || group.description || '').trim().slice(0, 240);
    const avatar = req.file ? await saveUploadedFile(req.file, 'yved/groups') : group.avatar;
    db.prepare('UPDATE message_groups SET name = ?, color = ?, description = ?, avatar = ? WHERE id = ?').run(name, color, description, avatar, groupId);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

router.post('/groups/:groupId/members', auth, notBlocked, (req, res) => {
  const groupId = Number(req.params.groupId);
  const member = ensureGroupMember(groupId, req.user.id);
  if (!member || member.role !== 'admin') return res.status(403).json({ message: 'Нет доступа' });
  const userId = Number(req.body.userId);
  const user = db.prepare('SELECT id FROM users WHERE id = ?').get(userId);
  if (!user) return res.status(404).json({ message: 'Пользователь не найден' });
  db.prepare('INSERT OR IGNORE INTO message_group_members (groupId, userId, role) VALUES (?, ?, ?)').run(groupId, userId, 'member');
  res.json({ ok: true });
});

router.delete('/groups/:groupId/members/:userId', auth, (req, res) => {
  const groupId = Number(req.params.groupId);
  const userId = Number(req.params.userId);
  const member = ensureGroupMember(groupId, req.user.id);
  if (!member) return res.status(403).json({ message: 'Нет доступа' });
  if (member.role !== 'admin' && req.user.id !== userId) return res.status(403).json({ message: 'Нет доступа' });
  if (userId === req.user.id && member.role === 'admin') {
    const admins = db.prepare("SELECT COUNT(*) count FROM message_group_members WHERE groupId = ? AND role = 'admin'").get(groupId).count;
    if (admins <= 1) return res.status(400).json({ message: 'Нельзя выйти: нужен хотя бы один админ' });
  }
  db.prepare('DELETE FROM message_group_members WHERE groupId = ? AND userId = ?').run(groupId, userId);
  res.json({ ok: true });
});

router.get('/with/:userId', auth, (req, res) => {
  const other = Number(req.params.userId);
  const beforeId = Number(req.query.beforeId || 0);
  const limit = Math.min(Math.max(Number(req.query.limit) || 80, 20), 120);
  const params = beforeId ? [req.user.id, other, other, req.user.id, beforeId, limit] : [req.user.id, other, other, req.user.id, limit];
  const whereBefore = beforeId ? 'AND id < ?' : '';
  const rows = db.prepare(`
    SELECT messages.*, users.username authorName, users.displayName authorDisplayName, users.avatar authorAvatar FROM messages
    LEFT JOIN users ON users.id = messages.fromUserId
    WHERE ((fromUserId = ? AND toUserId = ?) OR (fromUserId = ? AND toUserId = ?)) ${whereBefore}
    ORDER BY messages.id DESC LIMIT ?
  `).all(...params).reverse();
  db.prepare('UPDATE messages SET isRead = 1 WHERE fromUserId = ? AND toUserId = ?').run(other, req.user.id);
  res.json(rows);
});

router.get('/groups/:groupId/messages', auth, (req, res) => {
  const groupId = Number(req.params.groupId);
  if (!ensureGroupMember(groupId, req.user.id)) return res.status(403).json({ message: 'Нет доступа к группе' });
  const beforeId = Number(req.query.beforeId || 0);
  const limit = Math.min(Math.max(Number(req.query.limit) || 80, 20), 120);
  const params = beforeId ? [groupId, beforeId, limit] : [groupId, limit];
  const whereBefore = beforeId ? 'AND gm.id < ?' : '';
  const rows = db.prepare(`
    SELECT gm.*, u.username authorName, u.displayName authorDisplayName, u.avatar authorAvatar
    FROM message_group_messages gm
    LEFT JOIN users u ON u.id = gm.fromUserId
    WHERE gm.groupId = ? ${whereBefore}
    ORDER BY gm.id DESC LIMIT ?
  `).all(...params).reverse();
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
    createActivity(toUserId, req.user.id, 'message', 'message', r.lastInsertRowid, 'отправил стикер');
    return res.json({ id: r.lastInsertRowid });
  }

  const clean = String(text || '').trim();
  if (!clean) return res.status(400).json({ message: 'Пустое сообщение' });
  const r = db.prepare(`
    INSERT INTO messages (fromUserId, toUserId, text, messageType, stickerUrl)
    VALUES (?, ?, ?, 'text', '')
  `).run(req.user.id, toUserId, clean.slice(0, 2000));
  createActivity(toUserId, req.user.id, 'message', 'message', r.lastInsertRowid, clean.slice(0, 80));
  res.json({ id: r.lastInsertRowid });
});

router.post('/groups/:groupId/send', auth, notBlocked, (req, res) => {
  const groupId = Number(req.params.groupId);
  if (!ensureGroupMember(groupId, req.user.id)) return res.status(403).json({ message: 'Нет доступа к группе' });
  const { text, stickerId } = req.body;

  if (stickerId) {
    const sticker = db.prepare('SELECT id, name, imageUrl FROM stickers WHERE id = ? AND isHidden = 0').get(stickerId);
    if (!sticker) return res.status(404).json({ message: 'Стикер не найден' });
    const r = db.prepare(`
      INSERT INTO message_group_messages (groupId, fromUserId, text, messageType, stickerUrl)
      VALUES (?, ?, ?, 'sticker', ?)
    `).run(groupId, req.user.id, sticker.name || 'sticker', sticker.imageUrl);
    const members = db.prepare('SELECT userId FROM message_group_members WHERE groupId = ? AND userId != ?').all(groupId, req.user.id);
    for (const m of members) createActivity(m.userId, req.user.id, 'group_message', 'group', groupId, 'отправил стикер в группе');
    return res.json({ id: r.lastInsertRowid });
  }

  const clean = String(text || '').trim();
  if (!clean) return res.status(400).json({ message: 'Пустое сообщение' });
  const r = db.prepare(`
    INSERT INTO message_group_messages (groupId, fromUserId, text, messageType, stickerUrl)
    VALUES (?, ?, ?, 'text', '')
  `).run(groupId, req.user.id, clean.slice(0, 2000));
  const members = db.prepare('SELECT userId FROM message_group_members WHERE groupId = ? AND userId != ?').all(groupId, req.user.id);
  for (const m of members) createActivity(m.userId, req.user.id, 'group_message', 'group', groupId, clean.slice(0, 80));
  res.json({ id: r.lastInsertRowid });
});

module.exports = router;
