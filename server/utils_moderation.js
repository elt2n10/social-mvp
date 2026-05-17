const db = require('./database');

const DEFAULT_BLOCKED_WORDS = [
  '18+', 'порно', 'porn', 'xxx', 'nude', 'нюдс', 'голая', 'голый', 'секс'
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

module.exports = {
  checkText,
  getForbiddenWords,
  setForbiddenWords,
  addForbiddenWord,
  deleteForbiddenWord,
  logModeration
};
