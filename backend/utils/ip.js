function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) return String(forwarded).split(',')[0].trim();
  return String(req.headers['x-real-ip'] || req.socket?.remoteAddress || req.ip || 'unknown');
}

module.exports = { getClientIp };
