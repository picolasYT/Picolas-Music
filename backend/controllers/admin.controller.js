const bcrypt = require('bcryptjs');
const { pool } = require('../config/db');
const { getClientIp } = require('../utils/ip');

function maskHash(hash = '') {
  if (!hash) return '';
  return `${hash.slice(0, 18)}...${hash.slice(-8)}`;
}

async function stats(req, res) {
  const [users, playlists, favorites, bannedUsers, bannedIps, latest] = await Promise.all([
    pool.query('SELECT COUNT(*)::int AS count FROM users'),
    pool.query('SELECT COUNT(*)::int AS count FROM playlists'),
    pool.query('SELECT COUNT(*)::int AS count FROM favorites'),
    pool.query('SELECT COUNT(*)::int AS count FROM users WHERE banned = true'),
    pool.query('SELECT COUNT(*)::int AS count FROM banned_ips'),
    pool.query(`SELECT id, username, role, created_ip AS "createdIp", created_at AS "createdAt"
                FROM users ORDER BY created_at DESC LIMIT 8`)
  ]);

  res.json({
    ok: true,
    stats: {
      users: users.rows[0].count,
      playlists: playlists.rows[0].count,
      favorites: favorites.rows[0].count,
      bannedUsers: bannedUsers.rows[0].count,
      bannedIps: bannedIps.rows[0].count
    },
    latestUsers: latest.rows
  });
}

async function listUsers(req, res) {
  const result = await pool.query(`
    SELECT
      u.id,
      u.username,
      u.role,
      u.password_hash AS "passwordHash",
      u.created_ip AS "createdIp",
      u.last_ip AS "lastIp",
      u.banned,
      u.banned_reason AS "bannedReason",
      u.banned_at AS "bannedAt",
      u.last_login_at AS "lastLoginAt",
      u.created_at AS "createdAt",
      COUNT(DISTINCT f.id)::int AS "favoritesCount",
      COUNT(DISTINCT p.id)::int AS "playlistsCount"
    FROM users u
    LEFT JOIN favorites f ON f.user_id = u.id
    LEFT JOIN playlists p ON p.user_id = u.id
    GROUP BY u.id
    ORDER BY u.created_at DESC
  `);

  const users = result.rows.map(user => ({
    ...user,
    passwordHash: maskHash(user.passwordHash)
  }));

  res.json({ ok: true, users });
}

async function listLogs(req, res) {
  const result = await pool.query(`
    SELECT id, user_id AS "userId", username, ip, action, created_at AS "createdAt"
    FROM auth_logs
    ORDER BY created_at DESC
    LIMIT 100
  `);
  res.json({ ok: true, logs: result.rows });
}

async function banUser(req, res) {
  const userId = Number(req.params.id);
  const reason = String(req.body.reason || 'Baneado por admin').slice(0, 250);

  const result = await pool.query(
    `UPDATE users SET banned = true, banned_reason = $1, banned_at = NOW()
     WHERE id = $2
     RETURNING id, username, banned, banned_reason AS "bannedReason"`,
    [reason, userId]
  );

  if (!result.rows.length) return res.status(404).json({ ok: false, error: 'Usuario no encontrado' });

  await pool.query('DELETE FROM sessions WHERE user_id = $1', [userId]);
  res.json({ ok: true, user: result.rows[0] });
}

async function unbanUser(req, res) {
  const userId = Number(req.params.id);
  const result = await pool.query(
    `UPDATE users SET banned = false, banned_reason = NULL, banned_at = NULL
     WHERE id = $1
     RETURNING id, username, banned`,
    [userId]
  );

  if (!result.rows.length) return res.status(404).json({ ok: false, error: 'Usuario no encontrado' });
  res.json({ ok: true, user: result.rows[0] });
}

async function resetPassword(req, res) {
  const userId = Number(req.params.id);
  const password = String(req.body.password || '');
  if (password.length < 4) return res.status(400).json({ ok: false, error: 'La contraseña debe tener mínimo 4 caracteres' });

  const passwordHash = await bcrypt.hash(password, 10);
  const result = await pool.query(
    `UPDATE users SET password_hash = $1 WHERE id = $2
     RETURNING id, username, password_hash AS "passwordHash"`,
    [passwordHash, userId]
  );

  if (!result.rows.length) return res.status(404).json({ ok: false, error: 'Usuario no encontrado' });
  await pool.query('DELETE FROM sessions WHERE user_id = $1', [userId]);
  res.json({ ok: true, user: { ...result.rows[0], passwordHash: maskHash(result.rows[0].passwordHash) } });
}

async function banIp(req, res) {
  const ip = String(req.body.ip || '').trim();
  const reason = String(req.body.reason || 'IP baneada por admin').slice(0, 250);
  if (!ip) return res.status(400).json({ ok: false, error: 'Falta IP' });

  const result = await pool.query(
    `INSERT INTO banned_ips (ip, reason)
     VALUES ($1, $2)
     ON CONFLICT (ip) DO UPDATE SET reason = EXCLUDED.reason
     RETURNING id, ip, reason, created_at AS "createdAt"`,
    [ip, reason]
  );
  res.json({ ok: true, bannedIp: result.rows[0] });
}

async function unbanIp(req, res) {
  const ip = decodeURIComponent(req.params.ip || '');
  await pool.query('DELETE FROM banned_ips WHERE ip = $1', [ip]);
  res.json({ ok: true });
}

async function listBannedIps(req, res) {
  const result = await pool.query('SELECT id, ip, reason, created_at AS "createdAt" FROM banned_ips ORDER BY created_at DESC');
  res.json({ ok: true, bannedIps: result.rows });
}

async function currentIp(req, res) {
  res.json({ ok: true, ip: getClientIp(req) });
}

module.exports = {
  stats,
  listUsers,
  listLogs,
  banUser,
  unbanUser,
  resetPassword,
  banIp,
  unbanIp,
  listBannedIps,
  currentIp
};
