const { pool } = require('../config/db');
const { getClientIp } = require('../utils/ip');

async function authRequired(req, res, next) {
  try {
    const ip = getClientIp(req);
    const bannedIp = await pool.query('SELECT ip FROM banned_ips WHERE ip = $1', [ip]);
    if (bannedIp.rows.length) return res.status(403).json({ ok: false, error: 'Esta IP está baneada' });

    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) return res.status(401).json({ ok: false, error: 'No autorizado' });

    const result = await pool.query(
      `SELECT users.id, users.username, users.role, users.banned, users.banned_reason
       FROM sessions
       JOIN users ON users.id = sessions.user_id
       WHERE sessions.token = $1`,
      [token]
    );

    if (!result.rows.length) return res.status(401).json({ ok: false, error: 'Sesión inválida' });

    const user = result.rows[0];
    if (user.banned) return res.status(403).json({ ok: false, error: user.banned_reason || 'Tu cuenta está baneada' });

    await pool.query('UPDATE users SET last_ip = $1 WHERE id = $2', [ip, user.id]);

    req.user = user;
    req.token = token;
    req.clientIp = ip;
    next();
  } catch (err) {
    next(err);
  }
}

function adminRequired(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ ok: false, error: 'Solo administradores' });
  }
  next();
}

module.exports = { authRequired, adminRequired };
