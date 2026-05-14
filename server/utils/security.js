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
  for (let i = 0; i < length; i++) code += crypto.randomInt(0, 10);
  return code;
}

async function hashSecret(value) {
  return bcrypt.hash(String(value), 10);
}

async function compareSecret(value, hash) {
  if (!value || !hash) return false;
  return bcrypt.compare(String(value), hash);
}

function createCaptchaQuestion() {
  const a = crypto.randomInt(2, 10);
  const b = crypto.randomInt(2, 10);
  const ops = ['+', '-'];
  const op = ops[crypto.randomInt(0, ops.length)];
  const answer = op === '+' ? a + b : Math.max(a, b) - Math.min(a, b);
  const question = op === '+' ? `${a} + ${b}` : `${Math.max(a, b)} - ${Math.min(a, b)}`;
  return { question, answer: String(answer) };
}

module.exports = { isDevEmail, maskEmail, createCode, hashSecret, compareSecret, createCaptchaQuestion };
