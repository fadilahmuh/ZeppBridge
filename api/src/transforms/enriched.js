// Phase 2: transform raw DB rows into the enriched workout shape
// (top-level keys match api/example_data.json:
//  core_execution / environmental_terrain / readiness_stress / ...).
import { query, queryOne, formatIsoUtc, formatLocalTime } from '../db.js';
import { formatDuration, formatDurationHuman, formatPaceMinPerKm, formatDistance } from '../utils/pace.js';

// PRD §5.4: raw Zepp sentinel values that must be treated as "no data".
const SENTINEL_ALT_MAX = 40732.3;
const SENTINEL_ALT_MIN = -39999.1;
// Plausible altitude clamp band (m) for user-level terrain data.
const ALT_MAX = 12000;
const ALT_MIN = -450;

function cleanAltitude(value) {
  if (value == null || Number.isNaN(value)) return null;
  if (value <= SENTINEL_ALT_MIN + 1 || value >= SENTINEL_ALT_MAX - 1) return null;
  if (value > ALT_MAX || value < ALT_MIN) return null;
  return Math.round(value * 100) / 100;
}

function cleanGainLoss(value) {
  if (value == null || Number.isNaN(value)) return null;
  if (Math.abs(value) > 5000) return null; // gain/loss sentinel magnitude guard
  return Math.round(value * 10) / 10;
}

function numOrNull(v) {
  return v == null || Number.isNaN(v) ? null : v;
}

function hrStats(workout) {
  const avg = workout.avg_hr;
  const max = workout.max_hr;
  const min = workout.min_hr;
  if (avg == null && max == null && min == null) return null;
  const out = {
    avg: numOrNull(avg),
    max: numOrNull(max),
    min: numOrNull(min),
  };
  if (out.min != null && out.max != null) {
    out.range = out.max - out.min;
  }
  return out;
}

function workoutSplits(workoutId) {
  const rows = query(
    `SELECT split_index, start_time, end_time, distance_m, duration_seconds,
            pace_min_per_km, avg_hr, max_hr, elevation_gain_m, elevation_loss_m
     FROM workout_splits WHERE workout_id = ? ORDER BY split_index`,
    workoutId,
  );
  if (!rows.length) return [];
  return rows.map((r) => {
    const km = r.distance_m / 1000;
    const pace = formatPaceMinPerKm(km, r.duration_seconds);
    return {
      index: r.split_index,
      start_time: formatIsoUtc(r.start_time),
      start_time_local: formatLocalTime(r.start_time),
      duration_seconds: r.duration_seconds,
      duration: formatDuration(r.duration_seconds),
      distance_m: r.distance_m,
      pace: pace != null ? { min_per_km: r.pace_min_per_km, display: pace } : null,
      avg_hr: r.avg_hr,
      max_hr: r.max_hr,
      elevation_gain_m: cleanGainLoss(r.elevation_gain_m),
      elevation_loss_m: cleanGainLoss(r.elevation_loss_m),
    };
  });
}

const ZONE_NAMES = ['Zone 1 (Recovery)', 'Zone 2 (Endurance)', 'Zone 3 (Tempo)', 'Zone 4 (Threshold)', 'Zone 5 (Max Effort)'];

function hrZones(workoutId) {
  const rows = query(
    `SELECT zone_index, upper_bound_bpm, seconds FROM workout_hr_zones
     WHERE workout_id = ? ORDER BY zone_index`,
    workoutId,
  );
  const out = rows.map((r) => ({
    zone: r.zone_index + 1,
    label: ZONE_NAMES[r.zone_index] ?? `Zone ${r.zone_index + 1}`,
    upper_bound_bpm: r.upper_bound_bpm,
    seconds: r.seconds,
  }));
  const totalSeconds = out.reduce((acc, z) => acc + z.seconds, 0);
  if (totalSeconds > 0) {
    for (const z of out) {
      z.percent = Math.round((z.seconds / totalSeconds) * 1000) / 10;
    }
  }
  return out;
}

function priorSleep(workoutStartTime) {
  // Previous-night sleep: session within the 36 h window preceding the workout.
  const startMs = Date.parse(workoutStartTime);
  if (Number.isNaN(startMs)) return null;
  const cutoffMs = startMs - 36 * 3600 * 1000;
  const row = queryOne(
    `SELECT sleep_id, start_time, end_time, score, duration_minutes,
            deep_minutes, light_minutes, rem_minutes, awake_minutes,
            wake_count
     FROM sleep_sessions s
     WHERE s.start_time < ? AND s.end_time >= ?
     ORDER BY s.start_time DESC LIMIT 1`,
    workoutStartTime,
    new Date(cutoffMs).toISOString(),
  );
  if (!row) return null;
  const rhr = queryOne(
    `SELECT value FROM daily_metrics WHERE date = ? AND metric = 'resting_hr'`,
    new Date(cutoffMs).toISOString().slice(0, 10),
  );
  return {
    sleep_id: row.sleep_id,
    start_time: formatIsoUtc(row.start_time),
    end_time: formatIsoUtc(row.end_time),
    score: row.score,
    duration_minutes: row.duration_minutes,
    stages: {
      deep_minutes: row.deep_minutes,
      light_minutes: row.light_minutes,
      rem_minutes: row.rem_minutes,
      awake_minutes: row.awake_minutes,
    },
    wake_count: row.wake_count,
    resting_hr: rhr?.value ?? null,
  };
}

function readinessForDate(dateStr) {
  const rows = query(
    `SELECT metric, value FROM daily_metrics WHERE date = ?
     AND metric IN ('readiness','hrv_readiness','hrv_rmsd','biocharge','physical_charge','mental_charge','stress')`,
    dateStr,
  );
  const byMetric = Object.fromEntries(rows.map((r) => [r.metric, r.value]));
  return {
    date: dateStr,
    readiness_score: numOrNull(byMetric.readiness),
    hrv_rmsd: numOrNull(byMetric.hrv_rmsd ?? byMetric.sleep_hrv),
    physical_charge: numOrNull(byMetric.physical_charge),
    mental_charge: numOrNull(byMetric.mental_charge),
    biocharge: numOrNull(byMetric.biocharge),
    stress: numOrNull(byMetric.stress),
  };
}

// --- core builders -------------------------------------------------------

export function loadWorkoutBasic(workoutId) {
  const w = queryOne(
    `SELECT * FROM workouts WHERE workout_id = ?`,
    workoutId,
  );
  if (!w) return null;
  return w;
}

export function buildCoreExecution(w) {
  const startMs = Date.parse(w.start_time);
  const endMs = Date.parse(w.end_time);
  const durationSeconds =
    Number.isNaN(startMs) || Number.isNaN(endMs)
      ? null
      : Math.round((endMs - startMs) / 1000);
  const splits = workoutSplits(w.workout_id);
  const zones = hrZones(w.workout_id);
  const distance = w.distance_meters && w.distance_meters > 0 ? formatDistance(w.distance_meters) : null;

  const core = {
    workout_id: w.workout_id,
    type: w.workout_type,
    start_time: formatIsoUtc(w.start_time),
    start_time_local: formatLocalTime(w.start_time),
    end_time: formatIsoUtc(w.end_time),
    duration_seconds: durationSeconds,
    duration: formatDurationHuman(durationSeconds),
    distance: distance,
    calories: w.calories,
    training_load: w.training_load,
    avg_hr: w.avg_hr,
    max_hr: w.max_hr,
    hr: hrStats(w),
    cadence_spm: {
      avg: w.avg_cadence_spm,
      max: w.max_cadence_spm,
    },
    stride_cm: w.avg_stride_cm,
    splits,
    hr_zones: zones,
  };

  if (distance?.km && durationSeconds) {
    core.pace = { min_per_km: durationSeconds / 60 / distance.km, display: formatPaceMinPerKm(distance.km, durationSeconds) };
  }
  return core;
}

export function buildEnvironmentalTerrain(w) {
  return {
    elevation_gain_m: cleanGainLoss(w.elevation_gain_m),
    elevation_loss_m: cleanGainLoss(w.elevation_loss_m),
    min_altitude_m: cleanAltitude(w.min_altitude_m),
    max_altitude_m: cleanAltitude(w.max_altitude_m),
    gps_available: Boolean(w.gps_available),
  };
}

export function buildReadinessStress(w) {
  const dateStr = new Date(Date.parse(w.start_time)).toISOString().slice(0, 10);
  const sleep = priorSleep(w.start_time);
  const readiness = readinessForDate(dateStr);
  return {
    prior_night_sleep: sleep,
    day_readiness: readiness,
  };
}

export function buildLatestSummary(w) {
  const startMs = Date.parse(w.start_time);
  const endMs = Date.parse(w.end_time);
  const durationSeconds =
    Number.isNaN(startMs) || Number.isNaN(endMs)
      ? null
      : Math.round((endMs - startMs) / 1000);
  const core = buildCoreExecution(w);
  return {
    ...core,
    environmental_terrain: buildEnvironmentalTerrain(w),
    readiness_stress: buildReadinessStress(w),
  };
}

const SPORT_NAMES = {
  run: 'Outdoor Running',
  trail_running: 'Trail Running',
  treadmill: 'Treadmill',
  walking: 'Outdoor Walking',
  ride: 'Outdoor Cycling',
  strength: 'Strength Training',
  padel: 'Padel',
  badminton: 'Badminton',
};

export function buildEnrichedWorkout(w) {
  const sportName = SPORT_NAMES[w.workout_type] || w.workout_type || 'Workout';
  const trackIdNum = Number(w.workout_id);
  return {
    track_id: Number.isFinite(trackIdNum) ? trackIdNum : w.workout_id,
    title: sportName,
    sport_type: w.zepp_type ?? null,
    sport_name: sportName,
    start_time: formatIsoUtc(w.start_time),
    start_time_local: formatLocalTime(w.start_time),
    core_execution: buildCoreExecution(w),
    environmental_terrain: buildEnvironmentalTerrain(w),
    readiness_stress: buildReadinessStress(w),
  };
}

// --- samples / route -----------------------------------------------------

const SAMPLE_FIELDS = `timestamp, heart_rate, pace, speed, cadence, altitude, distance_m`;

export function loadSamples(workoutId) {
  const rows = query(
    `SELECT ${SAMPLE_FIELDS} FROM workout_samples WHERE workout_id = ? ORDER BY timestamp`,
    workoutId,
  );
  return rows;
}

export function downsample(samples, intervalSeconds) {
  if (intervalSeconds <= 0 || !samples.length) return samples;
  const baseMs = Date.parse(samples[0].timestamp);
  if (Number.isNaN(baseMs)) return samples;
  const stepMs = intervalSeconds * 1000;
  const out = [];
  let nextIndex = 0;
  for (let i = 0; i < samples.length; i++) {
    const idx = Math.floor((Date.parse(samples[i].timestamp) - baseMs) / stepMs);
    if (idx >= nextIndex) {
      out.push(samples[i]);
      nextIndex = idx + 1;
    }
  }
  return out;
}

export function formatSamplePoints(samples) {
  return samples.map((s) => {
    const point = {
      timestamp: formatIsoUtc(s.timestamp),
      t: (Date.parse(s.timestamp) - Date.parse(samples[0]?.timestamp ?? s.timestamp)) / 1000,
      hr: s.heart_rate,
      pace: s.pace != null ? Math.round(s.pace * 1000) / 1000 : null,
      cadence: s.cadence != null && s.cadence > 0 ? s.cadence : null,
      altitude: cleanAltitude(s.altitude),
    };
    return point;
  });
}

export function loadRoute(workoutId) {
  const points = query(
    `SELECT latitude, longitude, altitude, timestamp FROM route_points
     WHERE workout_id = ? ORDER BY timestamp`,
    workoutId,
  );
  return points.map((p) => ({
    lat: p.latitude,
    lng: p.longitude,
    alt: cleanAltitude(p.altitude),
    t: formatIsoUtc(p.timestamp),
  }));
}
