const express = require('express');
const jwt = require('jsonwebtoken');
const db = require('../database');
const { auth, devOnly } = require('../middleware/auth');
const upload = require('../middleware/upload');
const { getConfig } = require('./siteRoutes');
const { isDevEmail } = require('../utils/security');
const { saveUploadedFile } = require('../utils/storage');
const { getForbiddenWords, setForbiddenWords, addForbiddenWord, deleteForbiddenWord } = require('../utils_moderation');
const router = express.Router();

router.post('/login', (req, res) => {
  const { password } = req.body;
  // Настоящий пароль берётся только из .env / Render Environment Variables.
  if (password && password === process.env.DEV_PASSWORD) {
    const devToken = jwt.sign({ dev: true, role: 'developer' }, process.env.JWT_SECRET, { expiresIn: '8h' });
    return res.json({ devAccess: true, devToken });
  }
  res.status(403).json({ message: 'Неверный пароль разработчика' });
});


router.post('/email-login', auth, (req, res) => {
  if (!isDevEmail(req.user.email)) return res.status(403).json({ message: 'Эта почта не является dev-почтой' });
  const devToken = jwt.sign({ dev: true, role: 'developer', userId: req.user.id }, process.env.JWT_SECRET, { expiresIn: '8h' });
  res.json({ devAccess: true, devToken });
});

router.get('/stats', auth, devOnly, (req, res) => {
  res.json({
    users: db.prepare('SELECT COUNT(*) count FROM users').get().count,
    posts: db.prepare('SELECT COUNT(*) count FROM posts WHERE isHidden = 0').get().count,
    hiddenPosts: db.prepare('SELECT COUNT(*) count FROM posts WHERE isHidden = 1').get().count,
    videos: db.prepare('SELECT COUNT(*) count FROM videos WHERE isHidden = 0').get().count,
    hiddenVideos: db.prepare('SELECT COUNT(*) count FROM videos WHERE isHidden = 1').get().count,
    reports: db.prepare('SELECT COUNT(*) count FROM reports').get().count,
    stickers: db.prepare('SELECT COUNT(*) count FROM stickers WHERE isHidden = 0').get().count,
    moderationLogs: db.prepare('SELECT COUNT(*) count FROM moderation_logs').get().count
  });
});

router.get('/users', auth, devOnly, (req, res) => {
  const users = db.prepare('SELECT id, username, email, avatar, coverUrl, description, isBlocked, isEmailVerified, createdAt FROM users ORDER BY id DESC LIMIT 200').all()
    .map(u => ({ ...u, email: u.email, isBlocked: Boolean(u.isBlocked), isEmailVerified: Boolean(u.isEmailVerified), isDev: isDevEmail(u.email) }));
  res.json(users);
});

router.get('/recent/posts', auth, devOnly, (req, res) => {
  const rows = db.prepare(`
    SELECT p.id, p.text, p.imageUrl, p.isHidden, p.createdAt, u.username authorName,
      COALESCE((SELECT json_group_array(imageUrl) FROM (SELECT pi.imageUrl FROM post_images pi WHERE pi.postId = p.id ORDER BY pi.position ASC)), '[]') imageUrls
    FROM posts p JOIN users u ON u.id = p.authorId
    ORDER BY p.id DESC LIMIT 40
  `).all().map(p => ({ ...p, isHidden: Boolean(p.isHidden), imageUrls: JSON.parse(p.imageUrls || '[]') }));
  res.json(rows);
});

router.get('/recent/videos', auth, devOnly, (req, res) => {
  const rows = db.prepare(`
    SELECT v.id, v.description, v.videoUrl, v.isHidden, v.createdAt, u.username authorName
    FROM videos v JOIN users u ON u.id = v.authorId
    ORDER BY v.id DESC LIMIT 40
  `).all().map(v => ({ ...v, isHidden: Boolean(v.isHidden) }));
  res.json(rows);
});

router.put('/posts/:id/hide', auth, devOnly, (req, res) => {
  db.prepare('UPDATE posts SET isHidden = 1 WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

router.put('/posts/:id/restore', auth, devOnly, (req, res) => {
  db.prepare('UPDATE posts SET isHidden = 0 WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

router.delete('/posts/:id', auth, devOnly, (req, res) => {
  db.prepare('DELETE FROM posts WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

router.put('/videos/:id/hide', auth, devOnly, (req, res) => {
  db.prepare('UPDATE videos SET isHidden = 1 WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

router.put('/videos/:id/restore', auth, devOnly, (req, res) => {
  db.prepare('UPDATE videos SET isHidden = 0 WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

router.delete('/videos/:id', auth, devOnly, (req, res) => {
  db.prepare('DELETE FROM videos WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

router.put('/users/:id/block', auth, devOnly, (req, res) => {
  db.prepare('UPDATE users SET isBlocked = 1 WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

router.put('/users/:id/unblock', auth, devOnly, (req, res) => {
  db.prepare('UPDATE users SET isBlocked = 0 WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

router.delete('/users/:id', auth, devOnly, (req, res) => {
  const userId = Number(req.params.id);
  if (userId === req.user.id) return res.status(400).json({ message: 'Нельзя удалить свой аккаунт из dev-панели' });
  db.prepare('DELETE FROM users WHERE id = ?').run(userId);
  res.json({ ok: true });
});

router.put('/users/:id/avatar/clear', auth, devOnly, (req, res) => {
  db.prepare("UPDATE users SET avatar = '' WHERE id = ?").run(req.params.id);
  res.json({ ok: true });
});

router.put('/users/:id/cover/clear', auth, devOnly, (req, res) => {
  db.prepare("UPDATE users SET coverUrl = '' WHERE id = ?").run(req.params.id);
  res.json({ ok: true });
});

router.post('/users/:id/badges', auth, devOnly, upload.single('badge'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'Загрузи картинку бейджа' });
    const title = String(req.body.title || 'badge').slice(0, 40);
    const imageUrl = await saveUploadedFile(req.file, 'yved/badges');
    const r = db.prepare('INSERT INTO user_badges (userId, imageUrl, title) VALUES (?, ?, ?)').run(req.params.id, imageUrl, title);
    res.json({ ok: true, id: r.lastInsertRowid, imageUrl, title });
  } catch(e) { next(e); }
});

router.delete('/badges/:id', auth, devOnly, (req, res) => {
  db.prepare('DELETE FROM user_badges WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});


router.get('/stickers', auth, devOnly, (req, res) => {
  const stickers = db.prepare('SELECT id, name, imageUrl, isHidden, createdAt FROM stickers ORDER BY id DESC LIMIT 120').all()
    .map(s => ({ ...s, isHidden: Boolean(s.isHidden) }));
  res.json(stickers);
});

router.post('/stickers', auth, devOnly, upload.single('sticker'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'Загрузи картинку стикера' });
    const name = String(req.body.name || 'sticker').trim().slice(0, 40) || 'sticker';
    const imageUrl = await saveUploadedFile(req.file, 'yved/stickers');
    const r = db.prepare('INSERT INTO stickers (name, imageUrl) VALUES (?, ?)').run(name, imageUrl);
    res.json({ ok: true, id: r.lastInsertRowid, name, imageUrl });
  } catch (e) { next(e); }
});

router.put('/stickers/:id/hide', auth, devOnly, (req, res) => {
  db.prepare('UPDATE stickers SET isHidden = 1 WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

router.put('/stickers/:id/restore', auth, devOnly, (req, res) => {
  db.prepare('UPDATE stickers SET isHidden = 0 WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

router.delete('/stickers/:id', auth, devOnly, (req, res) => {
  db.prepare('DELETE FROM stickers WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});


router.get('/moderation/words', auth, devOnly, (req, res) => {
  res.json(getForbiddenWords());
});

router.put('/moderation/words', auth, devOnly, (req, res) => {
  const raw = Array.isArray(req.body.words)
    ? req.body.words
    : String(req.body.words || '').split(/[\n,]/g);
  res.json(setForbiddenWords(raw));
});

router.post('/moderation/words', auth, devOnly, (req, res) => {
  res.json(addForbiddenWord(req.body.word));
});

router.delete('/moderation/words/:id', auth, devOnly, (req, res) => {
  res.json(deleteForbiddenWord(req.params.id));
});

router.get('/moderation/logs', auth, devOnly, (req, res) => {
  const rows = db.prepare(`
    SELECT ml.*, u.username authorName, u.displayName authorDisplayName
    FROM moderation_logs ml
    LEFT JOIN users u ON u.id = ml.authorId
    ORDER BY ml.id DESC LIMIT 120
  `).all();
  res.json(rows);
});


router.get('/reports', auth, devOnly, (req, res) => {
  const reports = db.prepare(`
    SELECT r.*, reporter.username reporterUsername, reporter.displayName reporterDisplayName, reporter.email reporterEmail
    FROM reports r
    LEFT JOIN users reporter ON reporter.id = r.fromUserId
    ORDER BY r.id DESC LIMIT 200
  `).all();

  const mapTarget = (r) => {
    let targetAuthor = null;
    let targetText = '';
    try {
      if (r.targetType === 'post') {
        const row = db.prepare(`SELECT p.text, u.username, u.displayName, u.email FROM posts p LEFT JOIN users u ON u.id = p.authorId WHERE p.id = ?`).get(r.targetId);
        if (row) { targetAuthor = row; targetText = row.text || ''; }
      } else if (r.targetType === 'video') {
        const row = db.prepare(`SELECT v.description text, u.username, u.displayName, u.email FROM videos v LEFT JOIN users u ON u.id = v.authorId WHERE v.id = ?`).get(r.targetId);
        if (row) { targetAuthor = row; targetText = row.text || ''; }
      } else if (r.targetType === 'profile') {
        const row = db.prepare(`SELECT description text, username, displayName, email FROM users WHERE id = ?`).get(r.targetId);
        if (row) { targetAuthor = row; targetText = row.text || ''; }
      } else if (r.targetType === 'comment') {
        const row = db.prepare(`SELECT c.text, u.username, u.displayName, u.email FROM comments c LEFT JOIN users u ON u.id = c.authorId WHERE c.id = ?`).get(r.targetId);
        if (row) { targetAuthor = row; targetText = row.text || ''; }
      } else if (r.targetType === 'video_comment') {
        const row = db.prepare(`SELECT vc.text, u.username, u.displayName, u.email FROM video_comments vc LEFT JOIN users u ON u.id = vc.authorId WHERE vc.id = ?`).get(r.targetId);
        if (row) { targetAuthor = row; targetText = row.text || ''; }
      }
    } catch {}
    return {
      ...r,
      targetText: String(targetText || '').slice(0, 260),
      targetAuthorUsername: targetAuthor?.username || '',
      targetAuthorDisplayName: targetAuthor?.displayName || '',
      targetAuthorEmail: targetAuthor?.email || ''
    };
  };

  res.json(reports.map(mapTarget));
});

router.get('/backup', auth, devOnly, (req, res) => {
  const backup = {
    exportedAt: new Date().toISOString(),
    users: db.prepare('SELECT id, username, email, avatar, description, coverUrl, profileColor, isBlocked, createdAt FROM users').all(),
    posts: db.prepare('SELECT * FROM posts').all(),
    post_images: db.prepare('SELECT * FROM post_images').all(),
    comments: db.prepare('SELECT * FROM comments').all(),
    videos: db.prepare('SELECT * FROM videos').all(),
    video_comments: db.prepare('SELECT * FROM video_comments').all(),
    follows: db.prepare('SELECT * FROM follows').all(),
    profile_likes: db.prepare('SELECT * FROM profile_likes').all(),
    activity_events: db.prepare('SELECT * FROM activity_events').all(),
    user_badges: db.prepare('SELECT * FROM user_badges').all(),
    stickers: db.prepare('SELECT * FROM stickers').all(),
    forbidden_words: db.prepare('SELECT * FROM forbidden_words').all(),
    moderation_logs: db.prepare('SELECT * FROM moderation_logs').all(),
    reports: db.prepare('SELECT * FROM reports').all(),
    site_config: db.prepare('SELECT * FROM site_config').all()
  };
  res.json(backup);
});

router.get('/config', auth, devOnly, (req, res) => {
  res.json(getConfig());
});

router.put('/config', auth, devOnly, upload.fields([{ name: 'logo', maxCount: 1 }, { name: 'favicon', maxCount: 1 }]), async (req, res, next) => {
  try {
    const allowedKeys = [
      'siteName', 'siteTheme', 'accentColor', 'secondColor', 'backgroundColor', 'cardColor',
      'textColor', 'mutedColor', 'borderColor', 'sidebarColor', 'inputColor', 'dangerColor',
      'buttonRadius', 'soundsEnabled', 'animationsEnabled', 'inviteEnabled', 'stickers'
    ];
    const update = db.prepare('INSERT INTO site_config (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value');
    for (const key of allowedKeys) {
      if (req.body[key] !== undefined) update.run(key, String(req.body[key]));
    }
    if (req.files?.logo?.[0]) update.run('logoUrl', await saveUploadedFile(req.files.logo[0], 'yved/site'));
    if (req.files?.favicon?.[0]) update.run('faviconUrl', await saveUploadedFile(req.files.favicon[0], 'yved/site'));
    res.json(getConfig());
  } catch(e) { next(e); }
});

module.exports = router;
