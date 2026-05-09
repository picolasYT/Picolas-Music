const { Pool } = require('pg');

if (!process.env.DATABASE_URL) {
  console.warn('ADVERTENCIA: falta DATABASE_URL. En Render agregá la Internal Database URL de Postgres.');
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL && !process.env.DATABASE_URL.includes('localhost')
    ? { rejectUnauthorized: false }
    : false
});

async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username VARCHAR(40) UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    );

    ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'user';
    ALTER TABLE users ADD COLUMN IF NOT EXISTS created_ip TEXT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS last_ip TEXT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS banned BOOLEAN DEFAULT false;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS banned_reason TEXT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS banned_at TIMESTAMP;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP;

    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS favorites (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      song_id TEXT NOT NULL,
      title TEXT NOT NULL,
      artist TEXT,
      cover TEXT,
      video_id TEXT NOT NULL,
      duration TEXT,
      created_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(user_id, song_id)
    );

    CREATE TABLE IF NOT EXISTS playlists (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      name VARCHAR(80) NOT NULL,
      description TEXT DEFAULT '',
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS playlist_songs (
      id SERIAL PRIMARY KEY,
      playlist_id INTEGER REFERENCES playlists(id) ON DELETE CASCADE,
      song_id TEXT NOT NULL,
      title TEXT NOT NULL,
      artist TEXT,
      cover TEXT,
      video_id TEXT NOT NULL,
      duration TEXT,
      created_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(playlist_id, song_id)
    );

    CREATE TABLE IF NOT EXISTS banned_ips (
      id SERIAL PRIMARY KEY,
      ip TEXT UNIQUE NOT NULL,
      reason TEXT DEFAULT '',
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS auth_logs (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      username TEXT,
      ip TEXT,
      action TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);

  const adminUsername = String(process.env.ADMIN_USERNAME || '').trim().toLowerCase();
  if (adminUsername) {
    await pool.query('UPDATE users SET role = $1 WHERE username = $2', ['admin', adminUsername]);
  }
}

module.exports = { pool, initDb };
