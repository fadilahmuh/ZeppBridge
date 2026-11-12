import { queryAll, queryOne, formatIsoUtc, formatLocalTime } from '../db.js';

const TZ = process.env.TZ || 'Asia/Jakarta';

// ponytail: single-day pivot cached per request; add a real cache only if daily_metrics scans get slow.
function todayStr() {
  return formatLocalTime(new Date(), TZ).slice(0, 10);
}

function pivotDay(date) {
  const rows = queryAll(
    `SELECT metric, value, unit, source_scope FROM daily_metrics WHERE date = ?`,
    date
  );
  const out = {};
  for (const r of rows) {
    if (out[r.metric] !== undefined) continue; // first value wins per metric
    out[r.metric] = { value: r.value, unit: r.unit, source_scope: r.source_scope };
  }
  return out;
}

function metricValue(metrics, key) {
  const m = metrics?.[key];
  if (!m) return null;
  return { value: m.value, unit: m.unit };
}

export function getTodayDashboard() {
  const date = todayStr();
  const metrics = pivotDay(date);

  const steps = metricValue(metrics, 'steps');
  const calories = metricValue(metrics, 'active_calories');

  const sleep = queryOne(
    `SELECT score, duration_minutes, deep_minutes, light_minutes, rem_minutes, awake_minutes, start_time, end_time
     FROM sleep_sessions
     WHERE start_time < ? AND start_time >= datetime('now', ?)
     ORDER BY start_time DESC LIMIT 1`,
    `${date}T23:59:59`, '-12 hours'
  );
  // ponytail: 30-hour back-window approximates "last night"; upgrade to local-day boundary join with sleep date if it proves wrong.
  const lastSleep = sleep
    ? {
        score: sleep.score,
        duration_minutes: sleep.duration_minutes,
        deep_minutes: sleep.deep_minutes,
        light_minutes: sleep.light_minutes,
        rem_minutes: sleep.rem_minutes,
        awake_minutes: sleep.awake_minutes,
        start_time: formatIsoUtc(sleep.start_time),
        end_time: formatIsoUtc(sleep.end_time),
      }
    : null;

  const latestValue = (key) => {
    const r = queryOne(
      `SELECT value, date FROM daily_metrics WHERE metric = ? ORDER BY date DESC LIMIT 1`,
      key
    );
    return r ? { value: r.value, unit: null, date: r.date, as_of: formatLocalTime(r.date, TZ) } : null;
  };

  const latestWorkout = queryOne(
    `SELECT workout_type, start_time, end_time, distance_meters, calories,
            avg_hr, max_hr, training_load, vo2max
     FROM workouts ORDER BY start_time DESC LIMIT 1`
  );

  const hrvSample = queryOne(
    `SELECT value, timestamp FROM metric_samples WHERE metric = 'hrv_rmssd' ORDER BY timestamp DESC LIMIT 1`
  );

  return {
    date,
    local_date: date,
    generated_at: formatIsoUtc(new Date()),
    steps: steps?.value ?? null,
    steps_goal: metricValue(metrics, 'step_goal')?.value ?? null,
    active_calories: calories?.value ?? null,
    calorie_goal: metricValue(metrics, 'calorie_goal')?.value ?? null,
    last_night_sleep: lastSleep,
    readiness: latestValue('readiness'),
    hrv: latestValue('hrv_readiness'),
    hrv_baseline: latestValue('hrv_baseline'),
    resting_hr: metricValue(metrics, 'resting_hr') ?? latestValue('resting_hr'),
    hrv_sample_latest: hrvSample
      ? { value: hrvSample.value, at: formatIsoUtc(hrvSample.timestamp), local_at: formatLocalTime(hrvSample.timestamp, TZ) }
      : null,
    last_workout: latestWorkout
      ? {
          workout_type: latestWorkout.workout_type,
          start_time: formatIsoUtc(latestWorkout.start_time),
          end_time: formatIsoUtc(latestWorkout.end_time),
          local_start: formatLocalTime(latestWorkout.start_time, TZ),
          duration_minutes: Math.round(
            (new Date(latestWorkout.end_time) - new Date(latestWorkout.start_time)) / 60000
          ),
          distance_meters: latestWorkout.distance_meters,
          calories: latestWorkout.calories,
          avg_hr: latestWorkout.avg_hr,
          max_hr: latestWorkout.max_hr,
          training_load: latestWorkout.training_load,
          vo2max: latestWorkout.vo2max,
        }
      : null,
  };
}

export function getDailyRange(from, to) {
  const days = [];
  const cursor = new Date(`${from}T00:00:00Z`);
  const end = new Date(`${to}T00:00:00Z`);
  while (cursor <= end) {
    days.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  const rows = queryAll(
    `SELECT date, metric, value, unit FROM daily_metrics WHERE date >= ? AND date <= ?`,
    from, to
  );
  const byDate = new Map();
  for (const d of days) byDate.set(d, { date: d });
  for (const r of rows) {
    const row = byDate.get(r.date);
    if (!row) continue;
    if (row[r.metric] === undefined) row[r.metric] = r.value;
    row[`_unit_${r.metric}`] = r.unit;
  }
  return days.map((d) => {
    const row = byDate.get(d);
    const out = { date: d, local_date: d, metrics: {} };
    for (const [k, v] of Object.entries(row)) {
      if (k === 'date') continue;
      if (k.startsWith('_unit_')) continue;
      out.metrics[k] = v;
    }
    return out;
  });
}

export function getSleepSessions(limit = 30, since = null) {
  const sql = `
    SELECT ss.sleep_id, ss.start_time, ss.end_time, ss.score, ss.duration_minutes,
           ss.deep_minutes, ss.light_minutes, ss.rem_minutes, ss.awake_minutes,
           ss.wake_count, ss.rem_available, ss.deep_available, ss.light_available, ss.awake_available
    FROM sleep_sessions ss
    ${since ? 'WHERE ss.start_time >= ?' : ''}
    ORDER BY ss.start_time DESC LIMIT ?`;
  const rows = since
    ? queryAll(sql, since, limit)
    : queryAll(sql.replace('WHERE ss.start_time >= ?', ''), limit);
  const out = [];
  for (const r of rows) {
    out.push({
      sleep_id: r.sleep_id,
      start_time: formatIsoUtc(r.start_time),
      end_time: formatIsoUtc(r.end_time),
      local_start: formatLocalTime(r.start_time, TZ),
      score: r.score,
      duration_minutes: r.duration_minutes,
      stages: {
        deep: r.deep_minutes,
        light: r.light_minutes,
        rem: r.rem_minutes,
        awake: r.awake_minutes,
      },
      stage_availability: {
        deep: r.deep_available,
        light: r.light_available,
        rem: r.rem_available,
        awake: r.awake_available,
      },
      wake_count: r.wake_count,
    });
  }
  return out;
}

export function getReadiness(limit = 7) {
  const keys = ['readiness', 'physical_charge', 'mental_charge', 'hybrid_charge', 'hrv_readiness', 'rhr_readiness'];
  const rows = queryAll(
    `SELECT date, metric, value FROM daily_metrics
     WHERE metric IN ('readiness','physical_charge','mental_charge','hybrid_charge','hrv_readiness','rhr_readiness')
     ORDER BY date DESC LIMIT ?`,
    limit * keys.length
  );
  const series = {};
  for (const r of rows) {
    (series[r.metric] ??= []).push({ date: r.date, value: r.value });
  }
  for (const k of Object.keys(series)) series[k].reverse();
  const hrvTrend = queryAll(
    `SELECT date, value FROM daily_metrics WHERE metric = 'hrv_readiness' ORDER BY date DESC LIMIT ?`,
    14
  ).reverse();
  const latest = (metric) => series[metric]?.[0] ?? null;
  return {
    days: series,
    hrv_trend: hrvTrend,
    latest: {
      recovery: latest('readiness'),
      physical_charge: latest('physical_charge'),
      mental_charge: latest('mental_charge'),
      hybrid_charge: latest('hybrid_charge'),
      hrv: latest('hrv_readiness'),
      rhr: latest('rhr_readiness'),
    },
  };
}

export function getPersonalBests() {
  const records = [];
  const bestDistance = queryAll(
    `SELECT workout_type, MAX(distance_meters) AS best, MIN(start_time) AS first_at, COUNT(*) AS attempts
     FROM workouts WHERE distance_meters > 0 GROUP BY workout_type`
  );
  for (const r of bestDistance) {
    records.push({
      category: 'distance',
      workout_type: r.workout_type,
      value: r.best,
      unit: 'meters',
      attempts: r.attempts,
      achieved_at: formatIsoUtc(queryOne(
        `SELECT start_time FROM workouts WHERE workout_type = ? AND distance_meters = ? ORDER BY start_time DESC LIMIT 1`,
        r.workout_type, r.best
      ).start_time),
    });
  }
  const bestCalories = queryAll(
    `SELECT workout_type, MAX(calories) AS best FROM workouts WHERE calories > 0 GROUP BY workout_type`
  );
  for (const r of bestCalories) {
    records.push({
      category: 'calories',
      workout_type: r.workout_type,
      value: r.best,
      unit: 'kcal',
      attempts: null,
      achieved_at: formatIsoUtc(queryOne(
        `SELECT start_time FROM workouts WHERE workout_type = ? AND calories = ? ORDER BY start_time DESC LIMIT 1`,
        r.workout_type, r.best
      ).start_time),
    });
  }
  const bestVo2 = queryOne(`SELECT MAX(vo2max) AS best, MIN(start_time) AS at FROM workouts WHERE vo2max > 0`);
  if (bestVo2?.best != null) {
    records.push({ category: 'vo2max', value: bestVo2.best, unit: 'ml/kg/min', achieved_at: formatIsoUtc(bestVo2.at) });
  }
  const bestHr = queryOne(`SELECT MAX(max_hr) AS best FROM workouts WHERE max_hr > 0`);
  if (bestHr?.best != null) {
    records.push({ category: 'max_hr', value: bestHr.best, unit: 'bpm' });
  }
  const pbSteps = queryOne(`SELECT MAX(value) AS best, MIN(date) AS at FROM daily_metrics WHERE metric = 'steps'`);
  if (pbSteps?.best != null) {
    records.push({ category: 'steps', value: pbSteps.best, unit: 'steps', achieved_at: formatLocalTime(pbSteps.at, TZ) });
  }
  return records;
}

export function getAvailableMetrics() {
  const fromDaily = queryAll(
    `SELECT metric, COUNT(*) AS samples, MIN(date) AS from_date, MAX(date) AS to_date, MAX(unit) AS unit
     FROM daily_metrics GROUP BY metric ORDER BY metric`
  );
  const fromSamples = queryAll(
    `SELECT metric, COUNT(*) AS samples, MIN(timestamp) AS from_ts, MAX(timestamp) AS to_ts, MAX(unit) AS unit
     FROM metric_samples GROUP BY metric ORDER BY metric`
  );
  return {
    daily_metrics: fromDaily.map((r) => ({
      metric: r.metric,
      samples: r.samples,
      range: { from: r.from_date, to: r.to_date },
      unit: r.unit,
      source: 'daily_metrics',
    })),
    metric_samples: fromSamples.map((r) => ({
      metric: r.metric,
      samples: r.samples,
      range: { from: formatIsoUtc(r.from_ts), to: formatIsoUtc(r.to_ts) },
      unit: r.unit,
      source: 'metric_samples',
    })),
  };
}
