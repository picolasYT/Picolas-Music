const { pool } = require('../config/db');

function normalizeSong(body) {
  return {
    songId: String(body.songId || body.id || body.videoId || '').trim(),
    videoId: String(body.videoId || body.songId || body.id || '').trim(),
    title: String(body.title || 'Sin título').trim(),
    artist: String(body.artist || 'Desconocido').trim(),
    cover: String(body.cover || '/assets/img/default-cover.svg').trim(),
    duration: String(body.duration || '').trim()
  };
}

async function listFavorites(req, res) {
  const result = await pool.query(
    `SELECT song_id AS "songId", video_id AS "videoId", title, artist, cover, duration, created_at AS "createdAt"
     FROM favorites WHERE user_id = $1 ORDER BY created_at DESC`,
    [req.user.id]
  );
  res.json({ ok: true, favorites: result.rows });
}

async function addFavorite(req, res) {
  const song = normalizeSong(req.body);
  if (!song.songId || !song.videoId) return res.status(400).json({ ok: false, error: 'Falta videoId' });

  const result = await pool.query(
    `INSERT INTO favorites (user_id, song_id, title, artist, cover, video_id, duration)
     VALUES ($1,$2,$3,$4,$5,$6,$7)
     ON CONFLICT (user_id, song_id) DO UPDATE SET title = EXCLUDED.title
     RETURNING song_id AS "songId", video_id AS "videoId", title, artist, cover, duration, created_at AS "createdAt"`,
    [req.user.id, song.songId, song.title, song.artist, song.cover, song.videoId, song.duration]
  );
  res.status(201).json({ ok: true, favorite: result.rows[0] });
}

async function removeFavorite(req, res) {
  await pool.query('DELETE FROM favorites WHERE user_id = $1 AND song_id = $2', [req.user.id, req.params.songId]);
  res.json({ ok: true });
}

module.exports = { listFavorites, addFavorite, removeFavorite };
