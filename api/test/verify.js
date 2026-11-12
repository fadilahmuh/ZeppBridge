import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const API_DIR = path.resolve(TEST_DIR, '..');
const MAIN_WORKTREE_API = 'C:/laragon/www/ZeppBridge/api';

function resolveFixture(filename, envOverride) {
  const candidates = [
    envOverride ? path.resolve(envOverride) : null,
    path.resolve(API_DIR, filename),
    path.resolve(MAIN_WORKTREE_API, filename),
  ].filter(Boolean);
  for (const c of candidates) {
    if (existsSync(c)) return c;
  }
  throw new Error(`Fixture not found: ${filename} (checked ${candidates.join(', ')})`);
}

const dbPath = resolveFixture('zepp.db', process.env.DB_PATH);
const examplePath = resolveFixture('example_data.json');

process.env.DB_PATH = dbPath;
process.env.TZ ||= 'Asia/Jakarta';
delete process.env.API_KEY;

const { createServer } = await import('../src/server.js');
const { getDb, query } = await import('../src/db.js');

const { server } = await createServer();
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const { port } = server.address();
const baseUrl = `http://127.0.0.1:${port}`;

let failures = 0;

async function check(name, fn) {
  try {
    await fn();
    console.log(`PASS: ${name}`);
  } catch (err) {
    failures++;
    console.error(`FAIL: ${name} — ${err?.message || err}`);
  }
}

try {
  let workoutId = null;

  await check('GET /health returns 200 and status:"ok"', async () => {
    const res = await fetch(`${baseUrl}/health`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.status, 'ok');
    assert.equal(body.db, true);
  });

  await check('GET /api/v1/workouts?limit=1 returns workout array (>=0 items) without 500', async () => {
    const res = await fetch(`${baseUrl}/api/v1/workouts?limit=1`);
    assert.equal(res.status, 200);
    const body = await res.json();
    const items = Array.isArray(body) ? body : body?.items;
    assert.ok(Array.isArray(items) && items.length >= 0, 'Expected items array');
    workoutId = items[0]?.workout_id ?? items[0]?.id ?? '1793485609';
  });

  await check('GET /api/v1/workouts/:id/enriched matches top-level keys of example_data.json', async () => {
    assert.ok(workoutId, 'No workout id available');
    const expectedKeys = Object.keys(JSON.parse(readFileSync(examplePath, 'utf8'))).sort();
    const res = await fetch(`${baseUrl}/api/v1/workouts/${encodeURIComponent(workoutId)}/enriched`);
    assert.equal(res.status, 200);
    const body = await res.json();
    const actualKeys = Object.keys(body).sort();
    assert.deepEqual(actualKeys, expectedKeys);
  });

  await check('GET /api/v1/ai/context?days=7 markdown contains zeppbridge.ai_task', async () => {
    const res = await fetch(`${baseUrl}/api/v1/ai/context?days=7`);
    assert.equal(res.status, 200);
    const text = await res.text();
    assert.ok(text.includes('zeppbridge.ai_task'), 'Missing zeppbridge.ai_task in markdown');
  });

  await check('GET /api/v1/dashboard/today returns 200', async () => {
    const res = await fetch(`${baseUrl}/api/v1/dashboard/today`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(body && typeof body === 'object');
  });

  await check('Auth middleware returns 401 when API_KEY is set and header is missing', async () => {
    process.env.API_KEY = 'verify-test-secret';
    try {
      const res = await fetch(`${baseUrl}/api/v1/dashboard/today`);
      assert.equal(res.status, 401);
    } finally {
      delete process.env.API_KEY;
    }
  });

  await check('Read-only DB guarantee blocks SQL writes at query guard and SQLite engine level', async () => {
    assert.throws(
      () => query("INSERT INTO app_meta (key, value) VALUES ('_ro_test', '1')"),
      /Read-only violation/i,
    );
    assert.throws(
      () => getDb().exec('CREATE TABLE _ro_verify_test (id INTEGER)'),
      /readonly/i,
    );
  });
} finally {
  await new Promise((resolve) => server.close(resolve));
}

if (failures > 0) {
  console.error(`\nVerification failed (${failures} check(s) failed).`);
  process.exit(1);
}
console.log('\nAll verification checks passed.');
