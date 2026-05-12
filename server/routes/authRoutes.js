const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../database');
const { auth } = require('../middleware/auth');

const router = express.Router();

function publicUser(user) {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    avatar: user.avatar,
    description: user.description,
    coverUrl: user.coverUrl || '',
    profileColor: user.profileColor || '',
    isBlocked: Boolean(user.isBlocked),
    createdAt: user.createdAt
  };
}

router.post('/check-invite', (req, res) => {
  const enabled = db.prepare("SELECT value FROM site_config WHERE key = 'inviteEnabled'").get()?.value === 'true';
  if (!enabled) return res.json({ ok: true });
  const { invite } = req.body;
  res.json({ ok: invite === process.env.INVITE_CODE });
});

router.post('/register', async (req, res) => {
  const { username, email, password } = req.body;
  if (!username || !email || !password) return res.status(400).json({ message: 'Заполни все поля' });
  if (!/^[a-zA-Z0-9_а-яА-ЯёЁ.-]{3,24}$/.test(username)) return res.status(400).json({ message: 'Username 3-24 символа, без странных знаков' });
  if (!/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({ message: 'Некорректный email' });
  if (password.length < 6) return res.status(400).json({ message: 'Пароль минимум 6 символов' });
  const exists = db.prepare('SELECT id FROM users WHERE username = ? OR email = ?').get(username, email);
  if (exists) return res.status(409).json({ message: 'Такой username или email уже есть' });
  const passwordHash = await bcrypt.hash(password, 10);
  const result = db.prepare('INSERT INTO users (username, email, passwordHash) VALUES (?, ?, ?)').run(username, email, passwordHash);
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(result.lastInsertRowid);
  const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: '30d' });
  res.json({ token, user: publicUser(user) });
});

router.post('/login', async (req, res) => {
  const { login, password } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE username = ? OR email = ?').get(login, login);
  if (!user) return res.status(401).json({ message: 'Неверный логин или пароль' });
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return res.status(401).json({ message: 'Неверный логин или пароль' });
  if (user.isBlocked) return res.status(403).json({ message: 'Аккаунт заблокирован' });
  const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: '30d' });
  res.json({ token, user: publicUser(user) });
});

router.get('/me', auth, (req, res) => res.json({ user: publicUser(req.user) }));

router.put('/password', auth, async (req, res) => {
  const { oldPassword, newPassword } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  const ok = await bcrypt.compare(oldPassword || '', user.passwordHash);
  if (!ok) return res.status(400).json({ message: 'Старый пароль неверный' });
  if (!newPassword || newPassword.length < 6) return res.status(400).json({ message: 'Новый пароль минимум 6 символов' });
  const hash = await bcrypt.hash(newPassword, 10);
  db.prepare('UPDATE users SET passwordHash = ? WHERE id = ?').run(hash, req.user.id);
  res.json({ message: 'Пароль изменён' });
});

router.delete('/me', auth, (req, res) => {
  db.prepare('DELETE FROM users WHERE id = ?').run(req.user.id);
  res.json({ message: 'Аккаунт удалён' });
});

module.exports = router;
