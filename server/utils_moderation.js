const db = require('./database');

const DEFAULT_BLOCKED_WORDS = [
  'аборт',
  'абьюз',
  'алаху акбар',
  'алкоголизм',
  'алкоголь',
  'без вложений',
  'бомба',
  'быстрый доход',
  'быстрый заработок',
  'вагина',
  'взаимные комментарии',
  'взаимные лайки',
  'взрыв',
  'выйти из бедности',
  'гарантированный доход',
  'гей',
  'голый',
  'деньги',
  'еблан',
  'за подписку',
  'заработать за день',
  'избить',
  'казино',
  'колесо фортуны',
  'кража',
  'легкие деньги',
  'лесбиянка',
  'лотерея',
  'накрутка',
  'насилие',
  'негр',
  'никаких усилий',
  'пиар',
  'пидор',
  'пизда',
  'разбомбить',
  'розыгрыш',
  'секс',
  'ставки',
  'суицид',
  'терроризм',
  'убийство',
  'убить',
  'удвоить доход',
  'украсть',
  'финансовая свобода',
  'хакнуть',
  'хуй',
  'член',
  'эротика'
];

db.exec(`
CREATE TABLE IF NOT EXISTS forbidden_words (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  word TEXT UNIQUE NOT NULL,
  createdAt TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS moderation_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  targetType TEXT NOT NULL,
  targetId INTEGER DEFAULT 0,
  authorId INTEGER DEFAULT 0,
  text TEXT DEFAULT '',
  reason TEXT DEFAULT '',
  action TEXT DEFAULT 'blocked',
  createdAt TEXT DEFAULT CURRENT_TIMESTAMP
);
`);

const insertDefault = db.prepare('INSERT OR IGNORE INTO forbidden_words (word) VALUES (?)');
for (const word of DEFAULT_BLOCKED_WORDS) insertDefault.run(word);

function normalizeWord(word = '') {
  return String(word || '').trim().toLowerCase();
}

function getForbiddenWords() {
  return db.prepare('SELECT id, word, createdAt FROM forbidden_words ORDER BY word ASC').all();
}

function getForbiddenWordList() {
  return getForbiddenWords().map(w => normalizeWord(w.word)).filter(Boolean);
}

function setForbiddenWords(words = []) {
  const clean = [...new Set(words.map(normalizeWord).filter(Boolean))].slice(0, 500);
  const tx = db.transaction(() => {
    db.prepare('DELETE FROM forbidden_words').run();
    const insert = db.prepare('INSERT OR IGNORE INTO forbidden_words (word) VALUES (?)');
    for (const word of clean) insert.run(word);
  });
  tx();
  return getForbiddenWords();
}

function addForbiddenWord(word) {
  const clean = normalizeWord(word);
  if (!clean) throw new Error('Пустое слово');
  if (clean.length > 60) throw new Error('Слишком длинное слово');
  db.prepare('INSERT OR IGNORE INTO forbidden_words (word) VALUES (?)').run(clean);
  return getForbiddenWords();
}

function deleteForbiddenWord(id) {
  db.prepare('DELETE FROM forbidden_words WHERE id = ?').run(id);
  return getForbiddenWords();
}

function logModeration({ targetType, targetId = 0, authorId = 0, text = '', reason = '', action = 'blocked' }) {
  try {
    db.prepare(`
      INSERT INTO moderation_logs (targetType, targetId, authorId, text, reason, action)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(targetType, targetId, authorId, String(text || '').slice(0, 500), reason, action);
  } catch {}
}

function checkText(text = '', meta = {}) {
  const original = String(text || '');
  const low = original.toLowerCase();
  const found = getForbiddenWordList().find(w => w && low.includes(w));

  if (found) {
    const reason = `Запрещённое слово: ${found}`;
    logModeration({ ...meta, text: original, reason, action: 'blocked' });
    return { ok: false, reason };
  }

  return { ok: true, reason: '' };
}

function moderationProvider() {
  return String(process.env.MODERATION_PROVIDER || '').trim().toLowerCase();
}

function openAiEnabled() {
  return moderationProvider() === 'openai' && Boolean(process.env.OPENAI_API_KEY);
}

async function callOpenAiModeration(input) {
  if (!openAiEnabled()) return { ok: true, skipped: true };
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Number(process.env.MODERATION_TIMEOUT_MS || 8000));
  try {
    const response = await fetch('https://api.openai.com/v1/moderations', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODERATION_MODEL || 'omni-moderation-latest',
        input
      })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      console.error('[YVED MODERATION API ERROR]', data.error?.message || response.statusText);
      return { ok: true, skipped: true, reason: 'Внешняя модерация недоступна' };
    }
    const result = data.results?.[0];
    if (result?.flagged) {
      const categories = Object.entries(result.categories || {})
        .filter(([, value]) => Boolean(value))
        .map(([key]) => key)
        .join(', ');
      return { ok: false, reason: `AI-модерация: ${categories || 'подозрительный контент'}`, matched: categories || 'ai' };
    }
    return { ok: true };
  } catch (err) {
    console.error('[YVED MODERATION API ERROR]', err.message);
    return { ok: true, skipped: true, reason: 'Внешняя модерация недоступна' };
  } finally {
    clearTimeout(timeout);
  }
}

async function moderateTextWithAi(text) {
  const value = String(text || '').trim();
  if (!value || !openAiEnabled()) return { ok: true };
  return callOpenAiModeration(value);
}

async function moderateImageFile(file) {
  if (!file || !openAiEnabled()) return { ok: true };
  try {
    const fs = require('fs');
    const ext = String(file.mimetype || 'image/jpeg').split('/')[1] || 'jpeg';
    const base64 = fs.readFileSync(file.path).toString('base64');
    const dataUrl = `data:${file.mimetype || 'image/jpeg'};base64,${base64}`;
    return await callOpenAiModeration([{ type: 'image_url', image_url: { url: dataUrl } }]);
  } catch (err) {
    console.error('[YVED IMAGE MODERATION ERROR]', err.message);
    return { ok: true, skipped: true };
  }
}

async function checkPublicText(text = '', meta = {}) {
  const local = checkText(text, meta);
  if (!local.ok) return local;
  const ai = await moderateTextWithAi(text);
  if (!ai.ok) {
    logModeration({ ...meta, text, reason: ai.reason, action: 'blocked' });
    return ai;
  }
  return { ok: true, reason: '' };
}

function rejectByModeration(res, dbInstance, payload = {}) {
  const reason = payload.reason || 'Контент не прошёл модерацию';
  try {
    const database = dbInstance || db;
    database.prepare(`
      INSERT INTO moderation_logs (userId, targetType, targetId, action, reason, matched, textPreview)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      payload.userId || payload.authorId || 0,
      payload.targetType || 'unknown',
      payload.targetId || 0,
      'block',
      reason,
      payload.matched || '',
      String(payload.text || '').slice(0, 500)
    );
  } catch {}
  return res.status(400).json({ message: payload.publicMessage || 'Контент не прошёл модерацию', moderationReason: reason });
}

module.exports = {
  checkText,
  checkPublicText,
  moderateImageFile,
  rejectByModeration,
  getForbiddenWords,
  setForbiddenWords,
  addForbiddenWord,
  deleteForbiddenWord,
  logModeration
};
