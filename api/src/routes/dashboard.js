import {
  getTodayDashboard,
  getDailyRange,
  getSleepSessions,
  getReadiness,
  getPersonalBests,
  getAvailableMetrics,
} from '../transforms/dashboard.js';

function parseRange(query, sendError, sendJson) {
  const from = query.from;
  const to = query.to;
  const re = /^\d{4}-\d{2}-\d{2}$/;
  if (!from || !to || !re.test(from) || !re.test(to) || from > to) {
    return sendError(400, 'Invalid or missing from/to (YYYY-MM-DD, from <= to)');
  }
  const days = (new Date(to) - new Date(from)) / 86400000;
  if (days > 365) return sendError(400, 'Range exceeds 365 days');
  return { from, to };
}

function handleToday(_req, _res, { sendJson }) {
  return sendJson(200, getTodayDashboard());
}

function handleDaily(_req, _res, { query, sendJson, sendError }) {
  const range = parseRange(query, sendError, sendJson);
  if (!range) return;
  return sendJson(200, { from: range.from, to: range.to, days: getDailyRange(range.from, range.to) });
}

function handleSleep(_req, _res, { query, sendJson }) {
  const limit = Math.min(Number(query.limit) || 30, 500);
  const since = query.since ? (query.since.length === 10 ? `${query.since}T00:00:00Z` : query.since) : null;
  return sendJson(200, getSleepSessions(limit, since));
}

function handleReadiness(_req, _res, { query, sendJson }) {
  const limit = Math.min(Number(query.days) || 7, 30);
  return sendJson(200, getReadiness(limit));
}

function handlePbs(_req, _res, { sendJson }) {
  return sendJson(200, { personal_bests: getPersonalBests() });
}

function handleAvailableMetrics(_req, _res, { sendJson }) {
  return sendJson(200, getAvailableMetrics());
}

export function register(router) {
  router.get('/api/v1/dashboard/today', handleToday);
  router.get('/api/v1/daily', handleDaily);
  router.get('/api/v1/sleep', handleSleep);
  router.get('/api/v1/readiness', handleReadiness);
  router.get('/api/v1/stats/pbs', handlePbs);
  router.get('/api/v1/metrics/available', handleAvailableMetrics);
}

export default register;
