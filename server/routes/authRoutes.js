const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const db = require('../database');
const { auth } = require('../middleware/auth');
const {
  isDevEmail,
  maskEmail,
  createCode,
  hashSecret,
  compareSecret,
  createCaptchaQuestion,
  normalizeCaptcha
} = require('../utils/security');
const { sendVerificationEmail } = require('../utils/email');

const router = express.Router();
const EMAIL_CODE_LIFETIME_MIN = 15;
const EMAIL_RESEND_COOLDOWN_MS = 60_000;

function publicUser(user) {
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName || user.username,
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

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function normalizeUsername(username) {
  return String(username || '').trim().replace(/^@+/, '').toLowerCase();
}

function normalizeDisplayName(displayName, username) {
  const clean = String(displayName || '').trim();
  return (clean || username).slice(0, 40);
}

function canSendEmailCode(user) {
  if (!user.lastEmailCodeAt) return true;
  return Date.now() - new Date(user.lastEmailCodeAt).getTime() >= EMAIL_RESEND_COOLDOWN_MS;
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

  try {
    const mail = await sendVerificationEmail(user.email, code);
    return {
      sent: Boolean(mail.sent),
      debugCode: mail.debugCode,
      mailError: mail.sent ? '' : (mail.reason || '')
    };
  } catch (err) {
    console.error('[YVED EMAIL SEND ERROR]', err.message);
    return {
      sent: false,
      debugCode: process.env.EMAIL_DEBUG_CODE === 'true' ? code : undefined,
      mailError: err.message || 'Не удалось отправить письмо'
    };
  }
}

async function verifyCaptcha(captchaId, captchaAnswer) {
  const id = String(captchaId || '');
  const answer = normalizeCaptcha(captchaAnswer);

  const row = db.prepare('SELECT * FROM captcha_challenges WHERE id = ?').get(id);
  if (!row || row.used) return false;
  if (new Date(row.expiresAt).getTime() < Date.now()) return false;

  const ok = await compareSecret(answer, row.answerHash);
  if (ok) db.prepare('UPDATE captcha_challenges SET used = 1 WHERE id = ?').run(row.id);
  return ok;
}

function verificationPayload(user, mailInfo, extraMessage = '') {
  return {
    requiresEmailVerification: true,
    email: user.email,
    maskedEmail: maskEmail(user.email),
    mailSent: Boolean(mailInfo?.sent),
    debugCode: mailInfo?.debugCode,
    mailError: mailInfo?.mailError || '',
    message: extraMessage || 'Аккаунт создан. Подтверди почту.'
  };
}

router.get('/captcha', async (req, res, next) => {
  try {
    db.prepare('DELETE FROM captcha_challenges WHERE expiresAt < ? OR used = 1').run(new Date(Date.now() - 60_000).toISOString());

    const { question, answer } = createCaptchaQuestion();
    const id = crypto.randomUUID();
    const hash = await hashSecret(answer);
    const expiresAt = new Date(Date.now() + 10 * 60_000).toISOString();

    db.prepare('INSERT INTO captcha_challenges (id, answerHash, expiresAt) VALUES (?, ?, ?)').run(id, hash, expiresAt);

    res.json({ captchaId: id, question });
  } catch (e) {
    next(e);
  }
});

router.post('/check-invite', (req, res) => {
  const enabled = db.prepare("SELECT value FROM site_config WHERE key = 'inviteEnabled'").get()?.value === 'true';
  if (!enabled) return res.json({ ok: true });
  const { invite } = req.body;
  res.json({ ok: invite === process.env.INVITE_CODE });
});

router.post('/register', async (req, res, next) => {
  try {
    const username = normalizeUsername(req.body.username);
    const displayName = normalizeDisplayName(req.body.displayName || req.body.name, username);
    const email = normalizeEmail(req.body.email);
    const password = String(req.body.password || '');
    const captchaId = req.body.captchaId;
    const captchaAnswer = req.body.captchaAnswer || req.body.captcha || req.body.code || req.body.captchaCode;

    if (!username || !email || !password || !displayName) return res.status(400).json({ message: 'Заполни все поля' });
    if (!(await verifyCaptcha(captchaId, captchaAnswer))) return res.status(400).json({ message: 'Капча решена неверно или устарела' });
    if (!/^[a-zA-Z0-9_а-яА-ЯёЁ.-]{3,24}$/.test(username)) return res.status(400).json({ message: 'Username 3-24 символа, без странных знаков' });
    if (!/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({ message: 'Некорректный email' });
    if (password.length < 6) return res.status(400).json({ message: 'Пароль минимум 6 символов' });

    const usernameUser = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
    const emailUser = db.prepare('SELECT * FROM users WHERE email = ?').get(email);

    if (usernameUser && usernameUser.email !== email) {
      return res.status(409).json({ message: 'Такой username уже есть' });
    }

    if (emailUser) {
      if (emailUser.isEmailVerified) {
        return res.status(409).json({ message: 'Пользователь с таким email уже есть' });
      }

      let mailInfo = { sent: false, mailError: '' };
      if (canSendEmailCode(emailUser)) {
        mailInfo = await createAndSendEmailCode(emailUser);
      } else {
        mailInfo.mailError = 'Код уже был отправлен. Новый код можно запросить через минуту.';
      }

      return res.status(200).json(verificationPayload(
        emailUser,
        mailInfo,
        'Аккаунт уже создан, но почта ещё не подтверждена. Введи код подтверждения.'
      ));
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const result = db.prepare(`
      INSERT INTO users (username, displayName, email, passwordHash, isEmailVerified)
      VALUES (?, ?, ?, ?, 0)
    `).run(username, displayName, email, passwordHash);

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(result.lastInsertRowid);
    const mailInfo = await createAndSendEmailCode(user);

    res.json(verificationPayload(user, mailInfo));
  } catch (e) {
    next(e);
  }
});

router.post('/verify-email', async (req, res, next) => {
  try {
    const email = normalizeEmail(req.body.email);
    const code = String(req.body.code || '').trim();

    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (!user) return res.status(404).json({ message: 'Аккаунт не найден' });
    if (user.isEmailVerified) return res.json({ token: signToken(user), user: publicUser(user) });
    if (!user.emailVerifyCodeHash || !user.emailVerifyExpiresAt) return res.status(400).json({ message: 'Код не создан. Запроси новый код.' });
    if (new Date(user.emailVerifyExpiresAt).getTime() < Date.now()) return res.status(400).json({ message: 'Код истёк. Запроси новый.' });

    const ok = await compareSecret(code, user.emailVerifyCodeHash);
    if (!ok) return res.status(400).json({ message: 'Неверный код подтверждения' });

    db.prepare(`
      UPDATE users
      SET isEmailVerified = 1,
          emailVerifyCodeHash = '',
          emailVerifyExpiresAt = '',
          lastEmailCodeAt = ''
      WHERE id = ?
    `).run(user.id);

    const fresh = db.prepare('SELECT * FROM users WHERE id = ?').get(user.id);
    res.json({ token: signToken(fresh), user: publicUser(fresh) });
  } catch (e) {
    next(e);
  }
});

router.post('/resend-verification', async (req, res, next) => {
  try {
    const email = normalizeEmail(req.body.email);
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);

    if (!user) return res.status(404).json({ message: 'Аккаунт не найден' });
    if (user.isEmailVerified) return res.json({ ok: true, alreadyVerified: true });

    if (!canSendEmailCode(user)) {
      return res.status(429).json({ message: 'Новый код можно запросить через минуту' });
    }

    const mailInfo = await createAndSendEmailCode(user);
    res.json({
      ok: true,
      maskedEmail: maskEmail(user.email),
      mailSent: Boolean(mailInfo.sent),
      debugCode: mailInfo.debugCode,
      mailError: mailInfo.mailError || ''
    });
  } catch (e) {
    next(e);
  }
});

router.post('/login', async (req, res) => {
  const loginRaw = String(req.body.login || '').trim();
  const login = loginRaw.replace(/^@+/, '').toLowerCase();
  const password = String(req.body.password || '');

  const user = db.prepare('SELECT * FROM users WHERE LOWER(username) = ? OR LOWER(email) = ?').get(login, login);
  if (!user) return res.status(401).json({ message: 'Неверный логин или пароль' });

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return res.status(401).json({ message: 'Неверный логин или пароль' });
  if (user.isBlocked) return res.status(403).json({ message: 'Аккаунт заблокирован' });

  if (!user.isEmailVerified) {
    return res.status(403).json({
      message: 'Сначала подтверди почту',
      needsEmailVerification: true,
      email: user.email,
      maskedEmail: maskEmail(user.email)
    });
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
