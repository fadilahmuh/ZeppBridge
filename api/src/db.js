import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

process.env.TZ ||= 'Asia/Jakarta';

const SRC_DIR = path.dirname(fileURLToPath(import.meta.url));
const API_DIR = path.resolve(SRC_DIR, '..');
const REPO_DIR = path.resolve(API_DIR, '..');

// ponytail: single read-only SQLite handle per process; switch to worker pool only if concurrent heavy analytical queries block event loop.
let dbInstance = null;
let activeDbPath = null;
const stmtCache = new Map();

const WRITE_SQL_RE =
  /\b(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|REPLACE|TRUNCATE|ATTACH|DETACH|VACUUM|REINDEX|BEGIN|COMMIT|ROLLBACK|SAVEPOINT|RELEASE)\b/i;

export function resolveDbPath(rawPath = process.env.DB_PATH || 'zepp.db') {
  const candidates = [
    path.resolve(rawPath),
    path.resolve(API_DIR, rawPath),
    path.resolve(REPO_DIR, rawPath),
    path.resolve(API_DIR, 'zepp.db'),
  ];
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }
  return path.resolve(rawPath);
}

export function assertSelectOnly(sql) {
  if (typeof sql !== 'string' || !sql.trim()) {
    throw new Error('SQL query must be a non-empty string');
  }
  const stripped = sql
    .replace(/--.*$/gm, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .trim();
  if (!/^(SELECT|WITH)\b/i.test(stripped) || WRITE_SQL_RE.test(stripped)) {
    throw new Error('Read-only violation: only SELECT queries are permitted');
  }
  return stripped;
}

export function getDb() {
  const targetPath = resolveDbPath();
  if (!dbInstance || activeDbPath !== targetPath) {
    stmtCache.clear();
    dbInstance = new DatabaseSync(targetPath, { readOnly: true });
    activeDbPath = targetPath;
  }
  return dbInstance;
}

export function prepare(sql) {
  assertSelectOnly(sql);
  const handle = getDb();
  let stmt = stmtCache.get(sql);
  if (!stmt) {
    stmt = handle.prepare(sql);
    stmtCache.set(sql, stmt);
  }
  return stmt;
}

function bindArgs(params) {
  if (params.length === 1 && Array.isArray(params[0])) {
    return params[0];
  }
  return params;
}

export function query(sql, ...params) {
  return prepare(sql).all(...bindArgs(params));
}

export const queryAll = query;

export function queryOne(sql, ...params) {
  return prepare(sql).get(...bindArgs(params)) ?? null;
}

export const get = queryOne;

export function getAppMeta(key) {
  const row = queryOne('SELECT value FROM app_meta WHERE key = ?', key);
  return row ? row.value : null;
}

export function getLastCloudSyncAt() {
  return getAppMeta('last_cloud_sync_at');
}

export function checkDb() {
  try {
    const row = queryOne('SELECT 1 AS ok');
    return row?.ok === 1;
  } catch {
    return false;
  }
}

export function formatIsoUtc(input) {
  if (input === null || input === undefined || input === '') return null;
  const date = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(date.getTime())) return String(input);
  return date.toISOString().replace('.000Z', 'Z');
}

export function formatLocalTime(input, timeZone = process.env.TZ || 'Asia/Jakarta') {
  if (input === null || input === undefined || input === '') return null;
  const date = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(date.getTime())) return String(input);
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(date);
  const map = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  const hour = map.hour === '24' ? '00' : map.hour;
  return `${map.year}-${map.month}-${map.day} ${hour}:${map.minute}:${map.second}`;
}

export const db = new Proxy(
  {},
  {
    get(_target, prop) {
      const handle = getDb();
      const val = handle[prop];
      return typeof val === 'function' ? val.bind(handle) : val;
    },
  }
);

export default {
  db,
  getDb,
  resolveDbPath,
  assertSelectOnly,
  prepare,
  query,
  queryAll,
  queryOne,
  get,
  getAppMeta,
  getLastCloudSyncAt,
  checkDb,
  formatIsoUtc,
  formatLocalTime,
};
