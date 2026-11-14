// ------------------------------------------------------------------
//  Seasons — a weekly ladder clock plus the rank tiers shown beside
//  a commander's callsign. Seasons are computed from the local battle
//  ledger, so they work for guests and accounts alike.
// ------------------------------------------------------------------

export const TIERS = [
  { id: 'bronze', name: 'BRONZE', min: 0, color: '#b07a4e', tint: 'rgba(176,122,78,.16)' },
  { id: 'silver', name: 'SILVER', min: 450, color: '#b9c6cc', tint: 'rgba(185,198,204,.16)' },
  { id: 'gold', name: 'GOLD', min: 1300, color: '#e8c96a', tint: 'rgba(232,201,106,.16)' },
  { id: 'platinum', name: 'PLATINUM', min: 2800, color: '#7fd8d0', tint: 'rgba(127,216,208,.16)' },
  { id: 'diamond', name: 'DIAMOND', min: 5200, color: '#8fb6ff', tint: 'rgba(143,182,255,.16)' },
];

export const POINTS = { win: 120, kill: 6, match: 10 };

// One-time rewards at each weekly rank. Cosmetics are keyed like the
// salvage shop, so claiming an already-owned item simply pays salvage.
export const SEASON_REWARDS = {
  bronze: { salvage: 75 },
  silver: { salvage: 150 },
  gold: { salvage: 300, cosmetic: 'emblem:laurel' },
  platinum: { salvage: 500, cosmetic: 'trail:gilded' },
  diamond: { salvage: 800, cosmetic: 'killfx:nova' },
};

export const seasonReward = (tierId) => SEASON_REWARDS[tierId] || null;

export function weekKey(d = new Date()) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((date - yearStart) / 86400000 + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

export const weekNumber = (key = weekKey()) => Number(String(key).split('-W')[1]) || 1;

// Monday 00:00 UTC following the current week.
export function weekEndsAt(d = new Date()) {
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + (8 - day));
  return date.getTime();
}

export function daysLeft(d = new Date()) {
  return Math.max(0, Math.ceil((weekEndsAt(d) - d.getTime()) / 86400000));
}

export function emptyWeek(d = new Date()) {
  return { week: weekKey(d), kills: 0, wins: 0, matches: 0, score: 0, points: 0 };
}

export function weekPoints(w = {}) {
  return (w.points | 0) ||
    (w.wins | 0) * POINTS.win + (w.kills | 0) * POINTS.kill + (w.matches | 0) * POINTS.match;
}

export function lifetimePoints(p = {}) {
  return (p.wins | 0) * POINTS.win + (p.kills | 0) * POINTS.kill + (p.matches | 0) * POINTS.match;
}

export function tierFor(points = 0) {
  let tier = TIERS[0];
  for (const t of TIERS) if (points >= t.min) tier = t;
  return tier;
}

export function nextTier(points = 0) {
  return TIERS.find((t) => t.min > points) || null;
}

export function tierProgress(points = 0) {
  const cur = tierFor(points);
  const next = nextTier(points);
  if (!next) return { tier: cur, next: null, pct: 1, need: 0 };
  const span = Math.max(1, next.min - cur.min);
  return { tier: cur, next, pct: Math.min(1, (points - cur.min) / span), need: next.min - points };
}

// A compact emblem used beside names in the leaderboard and menu.
export function tierGlyph(tierId) {
  return {
    bronze: '◆', silver: '◆', gold: '★', platinum: '✦', diamond: '❖',
  }[tierId] || '◆';
}
