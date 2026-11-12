// Pace/duration formatters. Node stdlib only.

// Format a duration in seconds as "HH:MM:SS" (omits hours when < 60 min).
export function formatDuration(totalSeconds) {
  if (totalSeconds == null || Number.isNaN(totalSeconds)) return null;
  const s = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(sec).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${m}:${ss}`;
}

// Format seconds into a human string: "48 min 12 s", "2 h 05 min", "45 s".
export function formatDurationHuman(totalSeconds) {
  if (totalSeconds == null || Number.isNaN(totalSeconds)) return null;
  const s = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h} h ${String(m).padStart(2, '0')} min`;
  if (m > 0) return sec > 0 ? `${m} min ${sec} s` : `${m} min`;
  return `${sec} s`;
}

// Pace in min/km ("M:SS /km"). distanceKm <= 0 or duration 0 -> null.
export function formatPaceMinPerKm(distanceKm, durationSeconds) {
  if (
    distanceKm == null ||
    durationSeconds == null ||
    distanceKm <= 0 ||
    durationSeconds <= 0
  ) {
    return null;
  }
  const totalMin = durationSeconds / 60 / distanceKm;
  const m = Math.floor(totalMin);
  const s = Math.round((totalMin - m) * 60);
  const mm = s === 60 ? m + 1 : m;
  const ss = s === 60 ? 0 : s;
  return `${mm}:${String(ss).padStart(2, '0')} /km`;
}

// Distance meters -> {m, km, miles} rounded for display.
export function formatDistance(meters) {
  if (meters == null || Number.isNaN(meters)) return null;
  const km = meters / 1000;
  return {
    m: Math.round(meters),
    km: Math.round(km * 100) / 100,
    miles: Math.round((km * 0.621371) * 100) / 100,
  };
}

export default {
  formatDuration,
  formatDurationHuman,
  formatPaceMinPerKm,
  formatDistance,
};
