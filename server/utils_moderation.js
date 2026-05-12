const blockedWords = [
  '18+', 'порно', 'porn', 'xxx', 'nude', 'нюдс', 'голая', 'голый', 'секс'
];

function checkText(text = '') {
  const low = String(text).toLowerCase();
  const found = blockedWords.find(w => low.includes(w));
  if (found) {
    return { ok: false, reason: `Подозрительный контент: ${found}` };
  }
  return { ok: true, reason: '' };
}

module.exports = { checkText };
