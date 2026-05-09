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

async function listPlaylists(req, res) {
  const result = await pool.query(
    `SELECT p.id, p.name, p.description, p.created_at AS "createdAt",
      COALESCE(json_agg(json_build_object(
        'songId', ps.song_id,
        'videoId', ps.video_id,
        'title', ps.title,
        'artist', ps.artist,
        'cover', ps.cover,
        'duration', ps.duration
      ) ORDER BY ps.created_at DESC) FILTER (WHERE ps.id IS NOT NULL), '[]') AS songs
     FROM playlists p
     LEFT JOIN playlist_songs ps ON ps.playlist_id = p.id
     WHERE p.user_id = $1
     GROUP BY p.id
     ORDER BY p.created_at DESC`,
    [req.user.id]
  );
  res.json({ ok: true, playlists: result.rows });
}

async function createPlaylist(req, res) {
  const name = String(req.body.name || '').trim().slice(0, 80);
  const description = String(req.body.description || '').trim().slice(0, 200);
  if (!name) return res.status(400).json({ ok: false, error: 'Poné un nombre para la playlist' });

  const result = await pool.query(
    'INSERT INTO playlists (user_id, name, description) VALUES ($1,$2,$3) RETURNING id, name, description, created_at AS "createdAt"',
    [req.user.id, name, description]
  );
  res.status(201).json({ ok: true, playlist: { ...result.rows[0], songs: [] } });
}

async function deletePlaylist(req, res) {
  await pool.query('DELETE FROM playlists WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
  res.json({ ok: true });
}

async function addSong(req, res) {
  const song = normalizeSong(req.body);
  if (!song.songId || !song.videoId) return res.status(400).json({ ok: false, error: 'Falta videoId' });

  const owned = await pool.query('SELECT id FROM playlists WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
  if (!owned.rows.length) return res.status(404).json({ ok: false, error: 'Playlist no encontrada' });

  const result = await pool.query(
    `INSERT INTO playlist_songs (playlist_id, song_id, title, artist, cover, video_id, duration)
     VALUES ($1,$2,$3,$4,$5,$6,$7)
     ON CONFLICT (playlist_id, song_id) DO UPDATE SET title = EXCLUDED.title
     RETURNING song_id AS "songId", video_id AS "videoId", title, artist, cover, duration, created_at AS "createdAt"`,
    [req.params.id, song.songId, song.title, song.artist, song.cover, song.videoId, song.duration]
  );
  res.status(201).json({ ok: true, song: result.rows[0] });
}

async function removeSong(req, res) {
  const owned = await pool.query('SELECT id FROM playlists WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
  if (!owned.rows.length) return res.status(404).json({ ok: false, error: 'Playlist no encontrada' });

  await pool.query('DELETE FROM playlist_songs WHERE playlist_id = $1 AND song_id = $2', [req.params.id, req.params.songId]);
  res.json({ ok: true });
}

module.exports = { listPlaylists, createPlaylist, deletePlaylist, addSong, removeSong };
