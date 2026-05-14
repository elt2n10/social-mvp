function createRateLimit({ windowMs = 60_000, max = 30, keyPrefix = 'rl' } = {}) {
  const hits = new Map();

  return function rateLimit(req, res, next) {
    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip || req.socket?.remoteAddress || 'unknown';
    const key = `${keyPrefix}:${ip}`;
    const now = Date.now();
    const current = hits.get(key) || { count: 0, resetAt: now + windowMs };

    if (now > current.resetAt) {
      current.count = 0;
      current.resetAt = now + windowMs;
    }

    current.count += 1;
    hits.set(key, current);

    if (current.count > max) {
      return res.status(429).json({ message: 'Слишком много запросов. Попробуй позже.' });
    }

    next();
  };
}

module.exports = { createRateLimit };
