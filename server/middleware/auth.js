const jwt = require('jsonwebtoken');
const db = require('../database');
const { isDevEmail } = require('../utils/security');

function auth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ message: 'Нужна авторизация' });
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = db.prepare(`
      SELECT id, username, email, avatar, description, coverUrl, profileColor, isBlocked, isEmailVerified, createdAt
      FROM users WHERE id = ?
    `).get(payload.id);
    if (!user) return res.status(401).json({ message: 'Пользователь не найден' });
    req.user = user;
    next();
  } catch {
    res.status(401).json({ message: 'Неверный токен' });
  }
}

function notBlocked(req, res, next) {
  if (req.user?.isBlocked) return res.status(403).json({ message: 'Аккаунт заблокирован' });
  if (req.user && !req.user.isEmailVerified) return res.status(403).json({ message: 'Сначала подтверди почту' });
  next();
}

function devOnly(req, res, next) {
  // Первый способ: отдельный devToken после пароля/почты.
  const token = req.headers['x-dev-token'];
  if (token) {
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      if (payload?.dev) return next();
    } catch {}
  }

  // Второй способ: dev-доступ по email из DEV_EMAILS, но только если пользователь авторизован.
  if (req.user?.email && isDevEmail(req.user.email)) return next();

  return res.status(403).json({ message: 'Нет доступа разработчика' });
}

module.exports = { auth, notBlocked, devOnly };
