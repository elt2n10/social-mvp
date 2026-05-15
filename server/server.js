require('dotenv').config();
require('./database');

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const { createRateLimit } = require('./middleware/rateLimit');

const app = express();
const PORT = process.env.PORT || 4000;

function normalizeOrigin(url = '') {
  return String(url).trim().replace(/\/$/, '');
}

const clientUrl = normalizeOrigin(process.env.CLIENT_URL || 'http://localhost:5173');
const allowedOrigins = new Set([
  clientUrl,
  'http://localhost:5173',
  'http://127.0.0.1:5173'
]);

app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(cors({
  origin(origin, callback) {
    if (!origin) return callback(null, true);
    const clean = normalizeOrigin(origin);
    if (allowedOrigins.has(clean) || clean.endsWith('.vercel.app')) return callback(null, true);
    return callback(new Error('CORS blocked: ' + origin));
  }
}));
app.use(express.json({ limit: '1mb' }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use('/api/auth', createRateLimit({ windowMs: 60_000, max: 45, keyPrefix: 'auth' }), require('./routes/authRoutes'));
app.use('/api/posts', require('./routes/postRoutes'));
app.use('/api/videos', require('./routes/videoRoutes'));
app.use('/api/messages', require('./routes/messageRoutes'));
app.use('/api/profile', require('./routes/profileRoutes'));
app.use('/api/dev', createRateLimit({ windowMs: 60_000, max: 80, keyPrefix: 'dev' }), require('./routes/devRoutes'));
app.use('/api/site', require('./routes/siteRoutes'));
app.use('/api/live', require('./routes/liveRoutes'));
app.use('/api/activity', require('./routes/activityRoutes'));

app.get('/api/health', (_, res) => res.json({ ok: true, app: 'Yved' }));

app.use((err, req, res, next) => {
  console.error(err.message);
  if (err.message === 'Запрещённый тип файла') return res.status(400).json({ message: err.message });
  if (err.message && err.message.startsWith('CORS blocked')) return res.status(403).json({ message: 'CORS blocked' });
  res.status(500).json({ message: 'Ошибка сервера' });
});

app.listen(PORT, () => console.log(`Yved server started: http://localhost:${PORT}`));
