const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { pool } = require('../config/db');
const { getClientIp } = require('../utils/ip');

function validUsername(username) {
  return /^[a-zA-Z0-9_.-]{3,24}$/.test(username);
}

function publicUser(user) {
  return {
    id: user.id,
    username: user.username,
    role: user.role || 'user',
    banned: !!user.banned
  };
}

async function isIpBanned(ip) {
  const result = await pool.query('SELECT ip, reason FROM banned_ips WHERE ip = $1', [ip]);
  return result.rows[0] || null;
}

async function logAuth({ userId = null, username = '', ip = '', action }) {
  await pool.query(
    'INSERT INTO auth_logs (user_id, username, ip, action) VALUES ($1,$2,$3,$4)',
    [userId, username, ip, action]
  );
}

async function register(req, res) {
  try {
    const ip = getClientIp(req);
    const bannedIp = await isIpBanned(ip);
    if (bannedIp) return res.status(403).json({ ok: false, error: 'Esta IP está baneada' });

    let { username, password } = req.body;
    username = String(username || '').trim().toLowerCase();
    password = String(password || '');

    if (!validUsername(username)) {
      return res.status(400).json({ ok: false, error: 'El usuario debe tener 3 a 24 caracteres: letras, números, _, . o -' });
    }
    if (password.length < 4) {
      return res.status(400).json({ ok: false, error: 'La contraseña debe tener mínimo 4 caracteres' });
    }

    const exists = await pool.query('SELECT id FROM users WHERE username = $1', [username]);
    if (exists.rows.length) return res.status(409).json({ ok: false, error: 'Ese usuario ya existe' });

    const passwordHash = await bcrypt.hash(password, 10);
    const userResult = await pool.query(
      `INSERT INTO users (username, password_hash, created_ip, last_ip, role)
       VALUES ($1, $2, $3, $3, 'user')
       RETURNING id, username, role, banned`,
      [username, passwordHash, ip]
    );

    const user = userResult.rows[0];
    await logAuth({ userId: user.id, username, ip, action: 'register' });

    const token = crypto.randomBytes(32).toString('hex');
    await pool.query('INSERT INTO sessions (token, user_id) VALUES ($1, $2)', [token, user.id]);

    res.status(201).json({ ok: true, token, user: publicUser(user) });
  } catch (err) {
    console.error('Error register:', err);
    res.status(500).json({ ok: false, error: 'No se pudo crear la cuenta' });
  }
}

async function login(req, res) {
  try {
    const ip = getClientIp(req);
    const bannedIp = await isIpBanned(ip);
    if (bannedIp) return res.status(403).json({ ok: false, error: 'Esta IP está baneada' });

    let { username, password } = req.body;
    username = String(username || '').trim().toLowerCase();
    password = String(password || '');

    const userResult = await pool.query(
      'SELECT id, username, password_hash, role, banned, banned_reason FROM users WHERE username = $1',
      [username]
    );
    if (!userResult.rows.length) {
      await logAuth({ username, ip, action: 'login_failed' });
      return res.status(401).json({ ok: false, error: 'Usuario o contraseña incorrectos' });
    }

    const user = userResult.rows[0];
    if (user.banned) {
      await logAuth({ userId: user.id, username, ip, action: 'login_banned' });
      return res.status(403).json({ ok: false, error: user.banned_reason || 'Tu cuenta está baneada' });
    }

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) {
      await logAuth({ userId: user.id, username, ip, action: 'login_failed' });
      return res.status(401).json({ ok: false, error: 'Usuario o contraseña incorrectos' });
    }

    await pool.query('UPDATE users SET last_ip = $1, last_login_at = NOW() WHERE id = $2', [ip, user.id]);
    await logAuth({ userId: user.id, username, ip, action: 'login' });

    const token = crypto.randomBytes(32).toString('hex');
    await pool.query('INSERT INTO sessions (token, user_id) VALUES ($1, $2)', [token, user.id]);
    res.json({ ok: true, token, user: publicUser(user) });
  } catch (err) {
    console.error('Error login:', err);
    res.status(500).json({ ok: false, error: 'No se pudo iniciar sesión' });
  }
}

async function me(req, res) {
  res.json({ ok: true, user: publicUser(req.user) });
}

async function logout(req, res) {
  await pool.query('DELETE FROM sessions WHERE token = $1', [req.token]);
  res.json({ ok: true });
}

module.exports = { register, login, me, logout, publicUser };
