// Phase 2: enriched workout endpoints.
import { query, queryOne } from '../db.js';
import {
  buildEnrichedWorkout,
  buildLatestSummary,
  loadSamples,
  loadRoute,
  downsample,
  formatSamplePoints,
} from '../transforms/enriched.js';

function resolveWorkoutById(workoutId) {
  if (workoutId == null) return null;
  const byText = queryOne('SELECT * FROM workouts WHERE workout_id = ?', String(workoutId));
  if (byText) return byText;
  const byPk = Number.isInteger(Number(workoutId))
    ? queryOne('SELECT * FROM workouts WHERE id = ?', Number(workoutId))
    : null;
  return byPk ?? null;
}

function workoutError(res, ctx) {
  ctx.sendError(404, 'Workout not found');
}

export function handleWorkoutsList(req, res, ctx) {
  const { sendJson, sendError } = ctx;
  const q = ctx.query || req.query || {};
  const limit = Math.min(Math.max(parseInt(q.limit, 10) || 50, 1), 200);
  const offset = Math.max(parseInt(q.offset, 10) || 0, 0);

  const where = [];
  const params = [];
  if (q.type) {
    where.push('workout_type = ?');
    params.push(q.type);
  }
  if (q.from) {
    where.push('start_time >= ?');
    params.push(q.from);
  }
  if (q.to) {
    where.push('start_time <= ?');
    params.push(q.to);
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const total = queryOne(`SELECT COUNT(*) AS c FROM workouts ${whereSql}`, ...params)?.c ?? 0;
  const items = query(
    `SELECT workout_id, workout_type, start_time, end_time, distance_meters, calories,
            avg_hr, max_hr, sample_count, gps_available
     FROM workouts ${whereSql}
     ORDER BY start_time DESC LIMIT ? OFFSET ?`,
    ...params,
    limit,
    offset,
  );

  sendJson(200, {
    total,
    limit,
    offset,
    items: items.map((r) => ({
      id: r.workout_id,
      workout_id: r.workout_id,
      type: r.workout_type,
      start_time: r.start_time,
      duration: null, // kept light in the list; details on :id
      distance_m: r.distance_meters,
      calories: r.calories,
      avg_hr: r.avg_hr,
      max_hr: r.max_hr,
      sample_count: r.sample_count,
      gps_available: Boolean(r.gps_available),
    })),
  });
}

export function handleLatestWorkout(_req, res, ctx) {
  const w = queryOne('SELECT * FROM workouts ORDER BY start_time DESC, id DESC LIMIT 1');
  if (!w) return ctx.sendError(404, 'No workouts found');
  ctx.sendJson(200, buildLatestSummary(w));
}

export function handleLatestEnriched(_req, res, ctx) {
  const w = queryOne('SELECT * FROM workouts ORDER BY start_time DESC, id DESC LIMIT 1');
  if (!w) return ctx.sendError(404, 'No workouts found');
  ctx.sendJson(200, buildEnrichedWorkout(w));
}

export function handleWorkoutDetail(req, _res, ctx) {
  const w = resolveWorkoutById(ctx.params.id);
  if (!w) return workoutError(_res, ctx);
  ctx.sendJson(200, {
    id: w.workout_id,
    workout_id: w.workout_id,
    type: w.workout_type,
    start_time: w.start_time,
    start_time_local: w.start_time,
    end_time: w.end_time,
    distance_m: w.distance_meters,
    calories: w.calories,
    avg_hr: w.avg_hr,
    max_hr: w.max_hr,
    min_hr: w.min_hr,
    training_load: w.training_load,
    vo2max: w.vo2max,
    gps_available: Boolean(w.gps_available),
    sample_count: w.sample_count,
    has_samples: w.sample_count > 0,
  });
}

export function handleWorkoutEnriched(req, _res, ctx) {
  const w = resolveWorkoutById(ctx.params.id);
  if (!w) return workoutError(_res, ctx);
  ctx.sendJson(200, buildEnrichedWorkout(w));
}

// ?interval=5s / ?interval=5 / ?interval=5000ms
function parseIntervalMs(raw) {
  if (raw == null || raw === '') return 0;
  const s = String(raw).trim().toLowerCase();
  const numMatch = s.match(/^(\d+(?:\.\d+)?)\s*(ms|s|sec|secs|seconds|m|min)?$/);
  if (!numMatch) return 0;
  const n = parseFloat(numMatch[1]);
  const unit = numMatch[2];
  if (Number.isNaN(n) || n < 1) return 0;
  if (unit === 'ms') return n;
  const factor = unit == null || unit === 's' || unit.startsWith('sec') ? 1000 : 60 * 1000;
  return Math.round(n * factor);
}

export function handleWorkoutSamples(req, res, ctx) {
  const w = resolveWorkoutById(ctx.params.id);
  if (!w) return ctx.sendError(404, 'Workout not found');

  const intervalMs = parseIntervalMs(ctx.query?.interval);
  const raw = loadSamples(w.workout_id);
  const points =
    intervalMs > 0 ? downsample(raw, intervalMs / 1000) : raw;
  const formatted = formatSamplePoints(points);

  ctx.sendJson(200, {
    workout_id: w.workout_id,
    interval_ms: intervalMs || null,
    raw_count: raw.length,
    count: points.length,
    samples: formatted,
  });
}

export function handleWorkoutRoute(req, _res, ctx) {
  const w = resolveWorkoutById(ctx.params.id);
  if (!w) return ctx.sendError(404, 'Workout not found');
  const route = loadRoute(w.workout_id);
  ctx.sendJson(200, {
    workout_id: w.workout_id,
    gps_available: Boolean(w.gps_available),
    points: route,
  });
}

// Route mount table. Paths relative to /api/v1 (server auto-registers both
// the bare path and the BASE_PATH-prefixed path).
export const routes = [
  { method: 'GET', path: '/workouts', handler: handleWorkoutsList },
  { method: 'GET', path: '/workouts/latest', handler: handleLatestWorkout },
  { method: 'GET', path: '/workouts/latest/enriched', handler: handleLatestEnriched },
  { method: 'GET', path: '/workouts/:id/enriched', handler: handleWorkoutEnriched },
  { method: 'GET', path: '/workouts/:id/samples', handler: handleWorkoutSamples },
  { method: 'GET', path: '/workouts/:id/route', handler: handleWorkoutRoute },
  { method: 'GET', path: '/workouts/:id', handler: handleWorkoutDetail },
];

export function register(router) {
  for (const route of routes) {
    router.add(route.method, route.path, route.handler);
  }
}

export default register;
