import crypto from 'node:crypto';

function safeEquals(a, b) {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

export function extractToken(req) {
  const headers = req?.headers || {};
  const authHeader = headers['authorization'] || headers['Authorization'];
  if (typeof authHeader === 'string') {
    const match = authHeader.match(/^Bearer\s+(.+)$/i);
    if (match) return match[1].trim();
  }
  const apiKeyHeader = headers['x-api-key'] || headers['X-API-Key'];
  if (typeof apiKeyHeader === 'string' && apiKeyHeader.trim()) {
    return apiKeyHeader.trim();
  }
  return null;
}

export function isAuthenticated(req) {
  const configuredKey = (process.env.API_KEY || '').trim();
  if (!configuredKey) return true;
  const provided = extractToken(req);
  if (!provided) return false;
  return safeEquals(provided, configuredKey);
}

export function authMiddleware(req, res, next) {
  if (isAuthenticated(req)) {
    if (typeof next === 'function') return next();
    return true;
  }
  if (res && !res.writableEnded) {
    const payload = JSON.stringify({ error: 'Unauthorized' });
    res.writeHead(401, {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Length': Buffer.byteLength(payload),
    });
    res.end(payload);
  }
  return false;
}

export { authMiddleware as requireAuth, isAuthenticated as verifyApiKey };
export default authMiddleware;
