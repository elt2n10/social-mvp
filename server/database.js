const Database = require('better-sqlite3');
require('dotenv').config();

const db = new Database(process.env.DATABASE_FILE || './database.sqlite');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL UNIQUE,
  passwordHash TEXT NOT NULL,
  avatar TEXT DEFAULT '',
  description TEXT DEFAULT '',
  coverUrl TEXT DEFAULT '',
  profileColor TEXT DEFAULT '',
  isBlocked INTEGER DEFAULT 0,
  createdAt TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  authorId INTEGER NOT NULL,
  text TEXT DEFAULT '',
  imageUrl TEXT DEFAULT '',
  isHidden INTEGER DEFAULT 0,
  moderationStatus TEXT DEFAULT 'approved',
  moderationReason TEXT DEFAULT '',
  createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(authorId) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS post_images (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  postId INTEGER NOT NULL,
  imageUrl TEXT NOT NULL,
  position INTEGER DEFAULT 0,
  createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(postId) REFERENCES posts(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS post_likes (
  postId INTEGER NOT NULL,
  userId INTEGER NOT NULL,
  PRIMARY KEY(postId, userId),
  FOREIGN KEY(postId) REFERENCES posts(id) ON DELETE CASCADE,
  FOREIGN KEY(userId) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  postId INTEGER NOT NULL,
  authorId INTEGER NOT NULL,
  text TEXT NOT NULL,
  createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(postId) REFERENCES posts(id) ON DELETE CASCADE,
  FOREIGN KEY(authorId) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  fromUserId INTEGER NOT NULL,
  toUserId INTEGER NOT NULL,
  text TEXT NOT NULL,
  isRead INTEGER DEFAULT 0,
  createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(fromUserId) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY(toUserId) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS videos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  authorId INTEGER NOT NULL,
  videoUrl TEXT NOT NULL,
  description TEXT DEFAULT '',
  isHidden INTEGER DEFAULT 0,
  moderationStatus TEXT DEFAULT 'approved',
  moderationReason TEXT DEFAULT '',
  createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(authorId) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS video_likes (
  videoId INTEGER NOT NULL,
  userId INTEGER NOT NULL,
  PRIMARY KEY(videoId, userId),
  FOREIGN KEY(videoId) REFERENCES videos(id) ON DELETE CASCADE,
  FOREIGN KEY(userId) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS video_comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  videoId INTEGER NOT NULL,
  authorId INTEGER NOT NULL,
  text TEXT NOT NULL,
  createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(videoId) REFERENCES videos(id) ON DELETE CASCADE,
  FOREIGN KEY(authorId) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS site_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS follows (
  followerId INTEGER NOT NULL,
  followingId INTEGER NOT NULL,
  createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(followerId, followingId),
  FOREIGN KEY(followerId) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY(followingId) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  targetType TEXT NOT NULL,
  targetId INTEGER NOT NULL,
  fromUserId INTEGER,
  reason TEXT DEFAULT '',
  createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(fromUserId) REFERENCES users(id) ON DELETE SET NULL
);
`);

function tableColumns(table) {
  return db.prepare(`PRAGMA table_info(${table})`).all().map(c => c.name);
}

function addColumnIfMissing(table, column, sql) {
  const cols = tableColumns(table);
  if (!cols.includes(column)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${sql}`);
}

// Безопасные миграции: добавляют новые поля, но не удаляют старые данные.
addColumnIfMissing('users', 'coverUrl', "coverUrl TEXT DEFAULT ''");
addColumnIfMissing('users', 'profileColor', "profileColor TEXT DEFAULT ''");
addColumnIfMissing('posts', 'isHidden', 'isHidden INTEGER DEFAULT 0');
addColumnIfMissing('posts', 'moderationStatus', "moderationStatus TEXT DEFAULT 'approved'");
addColumnIfMissing('posts', 'moderationReason', "moderationReason TEXT DEFAULT ''");
addColumnIfMissing('videos', 'isHidden', 'isHidden INTEGER DEFAULT 0');
addColumnIfMissing('videos', 'moderationStatus', "moderationStatus TEXT DEFAULT 'approved'");
addColumnIfMissing('videos', 'moderationReason', "moderationReason TEXT DEFAULT ''");

const defaultConfig = {
  siteName: 'Yved',
  logoUrl: '',
  faviconUrl: '/favicon.svg',
  accentColor: '#7c3cff',
  secondColor: '#2aa7ff',
  backgroundColor: '#090a10',
  cardColor: '#11131d',
  buttonRadius: '14',
  soundsEnabled: 'true',
  animationsEnabled: 'true',
  inviteEnabled: 'false',
  stickers: '😀,😂,😎,🔥,💜,👍,❤️,😭,😡,🎉'
};

const insertConfig = db.prepare('INSERT OR IGNORE INTO site_config (key, value) VALUES (?, ?)');
for (const [key, value] of Object.entries(defaultConfig)) insertConfig.run(key, String(value));

// Индексы ускоряют ленту, профили и сообщения.
db.exec(`
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_posts_created ON posts(createdAt);
CREATE INDEX IF NOT EXISTS idx_posts_author ON posts(authorId);
CREATE INDEX IF NOT EXISTS idx_post_images_post ON post_images(postId, position);
CREATE INDEX IF NOT EXISTS idx_messages_pair ON messages(fromUserId, toUserId, createdAt);
CREATE INDEX IF NOT EXISTS idx_videos_created ON videos(createdAt);
CREATE INDEX IF NOT EXISTS idx_videos_author ON videos(authorId);
CREATE INDEX IF NOT EXISTS idx_follows_following ON follows(followingId);
CREATE INDEX IF NOT EXISTS idx_follows_follower ON follows(followerId);
`);

module.exports = db;
