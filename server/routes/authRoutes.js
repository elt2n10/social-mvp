const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const db = require('../database');
const { auth } = require('../middleware/auth');
const { isDevEmail, maskEmail, createCode, hashSecret, compareSecret, createCaptchaQuestion } = require('../utils/security');
const { sendVerificationEmail } = require('../utils/email');

const router = express.Router();
const EMAIL_CODE_LIFETIME_MIN = 15;

const captcha = captchas.get(captchaId);

if (!captcha || captcha.expiresAt < Date.now()) {
  return res.status(400).json({ message: 'Капча устарела' });
}

if (String(captchaAnswer || '').trim().toLowerCase() !== captcha.answer) {
  return res.status(400).json({ message: 'Капча введена неверно' });
}

captchas.delete(captchaId);

function publicUser(user) {
  return {
    id: user.id,
    username: user.username,
    maskedEmail: maskEmail(user.email),
    avatar: user.avatar,
    description: user.description,
    coverUrl: user.coverUrl || '',
    profileColor: user.profileColor || '',
    isBlocked: Boolean(user.isBlocked),
    isEmailVerified: Boolean(user.isEmailVerified),
    isDev: isDevEmail(user.email),
    createdAt: user.createdAt
  };
}

function signToken(user) {
  return jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: '180d' });
}

async function createAndSendEmailCode(user) {
  const code = createCode(6);
  const hash = await hashSecret(code);
  const expires = new Date(Date.now() + EMAIL_CODE_LIFETIME_MIN * 60_000).toISOString();
  db.prepare(`
    UPDATE users
    SET emailVerifyCodeHash = ?, emailVerifyExpiresAt = ?, lastEmailCodeAt = ?
    WHERE id = ?
  `).run(hash, expires, new Date().toISOString(), user.id);
  const mail = await sendVerificationEmail(user.email, code);
  const debugCode = process.env.EMAIL_DEBUG_CODE === 'true' ? code : undefined;
  return { sent: mail.sent, debugCode };
}

async function verifyCaptcha(captchaId, captchaAnswer) {
  const row = db.prepare('SELECT * FROM captcha_challenges WHERE id = ?').get(String(captchaId || ''));
  if (!row || row.used) return false;
  if (new Date(row.expiresAt).getTime() < Date.now()) return false;
  const ok = await compareSecret(String(captchaAnswer || '').trim(), row.answerHash);
  if (ok) db.prepare('UPDATE captcha_challenges SET used = 1 WHERE id = ?').run(row.id);
  return ok;
}

router.get('/captcha', (req, res) => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';

  for (let i = 0; i < 5; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }

  const captchaId = crypto.randomUUID();

  captchas.set(captchaId, {
    answer: code.toLowerCase(),
    expiresAt: Date.now() + 5 * 60 * 1000
  });

  res.json({
    captchaId,
    question: code
  });
});

router.post('/check-invite', (req, res) => {
  const enabled = db.prepare("SELECT value FROM site_config WHERE key = 'inviteEnabled'").get()?.value === 'true';
  if (!enabled) return res.json({ ok: true });
  const { invite } = req.body;
  res.json({ ok: invite === process.env.INVITE_CODE });
});

router.post('/register', async (req, res, next) => {
  try {
    const { username, email, password, captchaId, captchaAnswer } = req.body;
    if (!username || !email || !password) return res.status(400).json({ message: 'Заполни все поля' });
    if (!(await verifyCaptcha(captchaId, captchaAnswer))) return res.status(400).json({ message: 'Капча решена неверно' });
    if (!/^[a-zA-Z0-9_а-яА-ЯёЁ.-]{3,24}$/.test(username)) return res.status(400).json({ message: 'Username 3-24 символа, без странных знаков' });
    if (!/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({ message: 'Некорректный email' });
    if (password.length < 6) return res.status(400).json({ message: 'Пароль минимум 6 символов' });
    const exists = db.prepare('SELECT id FROM users WHERE username = ? OR email = ?').get(username, email.toLowerCase());
    if (exists) return res.status(409).json({ message: 'Такой username или email уже есть' });

    const passwordHash = await bcrypt.hash(password, 12);
    const result = db.prepare(`
      INSERT INTO users (username, email, passwordHash, isEmailVerified)
      VALUES (?, ?, ?, 0)
    `).run(username.trim(), email.trim().toLowerCase(), passwordHash);
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(result.lastInsertRowid);
    const mailInfo = await createAndSendEmailCode(user);

    res.json({
      requiresEmailVerification: true,
      email: user.email,
      maskedEmail: maskEmail(user.email),
      mailSent: mailInfo.sent,
      debugCode: mailInfo.debugCode
    });
  } catch (e) { next(e); }
});

router.post('/verify-email', async (req, res, next) => {
  try {
    const { email, code } = req.body;
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(String(email || '').trim().toLowerCase());
    if (!user) return res.status(404).json({ message: 'Аккаунт не найден' });
    if (user.isEmailVerified) return res.json({ token: signToken(user), user: publicUser(user) });
    if (!user.emailVerifyCodeHash || !user.emailVerifyExpiresAt) return res.status(400).json({ message: 'Код не создан' });
    if (new Date(user.emailVerifyExpiresAt).getTime() < Date.now()) return res.status(400).json({ message: 'Код истёк. Запроси новый.' });
    const ok = await compareSecret(String(code || '').trim(), user.emailVerifyCodeHash);
    if (!ok) return res.status(400).json({ message: 'Неверный код подтверждения' });
    db.prepare(`
      UPDATE users SET isEmailVerified = 1, emailVerifyCodeHash = '', emailVerifyExpiresAt = '' WHERE id = ?
    `).run(user.id);
    const fresh = db.prepare('SELECT * FROM users WHERE id = ?').get(user.id);
    res.json({ token: signToken(fresh), user: publicUser(fresh) });
  } catch (e) { next(e); }
});

router.post('/resend-verification', async (req, res, next) => {
  try {
    const { email } = req.body;
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(String(email || '').trim().toLowerCase());
    if (!user) return res.status(404).json({ message: 'Аккаунт не найден' });
    if (user.isEmailVerified) return res.json({ ok: true, alreadyVerified: true });
    if (user.lastEmailCodeAt && Date.now() - new Date(user.lastEmailCodeAt).getTime() < 60_000) {
      return res.status(429).json({ message: 'Новый код можно запросить через минуту' });
    }
    const mailInfo = await createAndSendEmailCode(user);
    res.json({ ok: true, maskedEmail: maskEmail(user.email), mailSent: mailInfo.sent, debugCode: mailInfo.debugCode });
  } catch (e) { next(e); }
});

router.post('/login', async (req, res) => {
  const { login, password } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE username = ? OR email = ?').get(login, String(login || '').trim().toLowerCase());
  if (!user) return res.status(401).json({ message: 'Неверный логин или пароль' });
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return res.status(401).json({ message: 'Неверный логин или пароль' });
  if (user.isBlocked) return res.status(403).json({ message: 'Аккаунт заблокирован' });
  if (!user.isEmailVerified) {
    return res.status(403).json({ message: 'Сначала подтверди почту', needsEmailVerification: true, email: user.email, maskedEmail: maskEmail(user.email) });
  }
  res.json({ token: signToken(user), user: publicUser(user) });
});

router.get('/me', auth, (req, res) => res.json({ user: publicUser(req.user) }));

router.put('/password', auth, async (req, res) => {
  const { oldPassword, newPassword } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  const ok = await bcrypt.compare(oldPassword || '', user.passwordHash);
  if (!ok) return res.status(400).json({ message: 'Старый пароль неверный' });
  if (!newPassword || newPassword.length < 6) return res.status(400).json({ message: 'Новый пароль минимум 6 символов' });
  const hash = await bcrypt.hash(newPassword, 12);
  db.prepare('UPDATE users SET passwordHash = ? WHERE id = ?').run(hash, req.user.id);
  res.json({ message: 'Пароль изменён' });
});

router.delete('/me', auth, (req, res) => {
  db.prepare('DELETE FROM users WHERE id = ?').run(req.user.id);
  res.json({ message: 'Аккаунт удалён' });
});

module.exports = router;
