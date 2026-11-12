import { checkDb, getLastCloudSyncAt } from '../db.js';

export function getHealthStatus() {
  const dbOk = checkDb();
  const last_cloud_sync_at = dbOk ? getLastCloudSyncAt() : null;
  return {
    status: dbOk ? 'ok' : 'error',
    db: dbOk,
    last_cloud_sync_at,
  };
}

export function handleHealth(_req, res) {
  const body = getHealthStatus();
  const statusCode = body.db ? 200 : 503;
  const payload = JSON.stringify(body);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(payload),
  });
  res.end(payload);
}

export const routes = [
  { method: 'GET', path: '/health', auth: false, handler: handleHealth },
  { method: 'GET', path: '/api/v1/health', auth: true, handler: handleHealth },
];

export function register(router) {
  for (const route of routes) {
    router.add(route.method, route.path, route.handler, { auth: route.auth });
  }
}

export default register;
