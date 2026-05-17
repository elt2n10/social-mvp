const DEFAULT_BAD_WORDS = [
  '18+', 'порно', 'porn', 'xxx', 'nsfw', 'эротик', 'наркот', 'спам',
  'казино', 'ставки', 'букмекер', 'скам', 'взлом', 'фишинг'
];

function normalizeText(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .trim();
}

function getBadWords() {
  const fromEnv = String(process.env.MODERATION_BAD_WORDS || '')
    .split(',')
    .map(w => w.trim())
    .filter(Boolean);
  return [...DEFAULT_BAD_WORDS, ...fromEnv].map(normalizeText);
}

function checkText(text, options = {}) {
  const raw = String(text || '');
  const value = normalizeText(raw);
  const maxLength = Number(options.maxLength || 3000);

  if (!value) return { ok: true, action: 'allow', reason: '' };

  if (raw.length > maxLength) {
    return {
      ok: false,
      action: 'block',
      severity: 'medium',
      reason: `текст слишком длинный: максимум ${maxLength} символов`,
      matched: 'length'
    };
  }

  const repeated = /(.)\1{12,}/.test(value);
  if (repeated) {
    return {
      ok: false,
      action: 'block',
      severity: 'low',
      reason: 'слишком много повторяющихся символов',
      matched: 'repeat'
    };
  }

  const links = raw.match(/https?:\/\//gi) || [];
  if (links.length > 3) {
    return {
      ok: false,
      action: 'block',
      severity: 'medium',
      reason: 'слишком много ссылок',
      matched: 'links'
    };
  }

  for (const word of getBadWords()) {
    if (word && value.includes(word)) {
      return {
        ok: false,
        action: 'block',
        severity: 'high',
        reason: 'бот-модератор нашёл запрещённый или подозрительный контент',
        matched: word
      };
    }
  }

  return { ok: true, action: 'allow', reason: '' };
}

function logModeration(db, payload) {
  try {
    if (!db || !payload) return;
    db.prepare(`
      INSERT INTO moderation_logs
        (userId, targetType, targetId, action, reason, matched, textPreview, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      payload.userId || null,
      payload.targetType || '',
      payload.targetId || null,
      payload.action || 'block',
      payload.reason || '',
      payload.matched || '',
      String(payload.text || '').slice(0, 240),
      new Date().toISOString()
    );
  } catch (err) {
    console.error('[YVED MODERATION LOG ERROR]', err.message);
  }
}

function rejectByModeration(res, db, payload) {
  logModeration(db, payload);
  return res.status(400).json({
    message: (payload.publicMessage || 'Контент заблокирован ботом-модератором') + (payload.reason ? ': ' + payload.reason : '')
  });
}

module.exports = {
  checkText,
  logModeration,
  rejectByModeration
};
