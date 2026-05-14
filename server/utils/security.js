const bcrypt = require('bcryptjs');
const crypto = require('crypto');

function isDevEmail(email) {
  const list = String(process.env.DEV_EMAILS || '')
    .split(',')
    .map(e => e.trim().toLowerCase())
    .filter(Boolean);

  return list.includes(String(email || '').trim().toLowerCase());
}

function maskEmail(email = '') {
  const [name, domain] = String(email).split('@');

  if (!name || !domain) return '';

  const visible = name.length <= 2 ? name[0] : `${name[0]}${name[name.length - 1]}`;
  return `${visible}${'*'.repeat(Math.max(name.length - visible.length, 2))}@${domain}`;
}

function createCode(length = 6) {
  let code = '';

  for (let i = 0; i < length; i++) {
    code += crypto.randomInt(0, 10);
  }

  return code;
}

async function hashSecret(value) {
  return bcrypt.hash(String(value), 10);
}

async function compareSecret(value, hash) {
  if (!value || !hash) return false;
  return bcrypt.compare(String(value), hash);
}

// Капча с рандомными символами.
// Убраны похожие символы: O, 0, I, 1, чтобы пользователю было проще вводить.
function createCaptchaQuestion() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';

  for (let i = 0; i < 5; i++) {
    code += chars[crypto.randomInt(0, chars.length)];
  }

  return {
    question: code,
    answer: code.toLowerCase()
  };
}

module.exports = {
  isDevEmail,
  maskEmail,
  createCode,
  hashSecret,
  compareSecret,
  createCaptchaQuestion
};
