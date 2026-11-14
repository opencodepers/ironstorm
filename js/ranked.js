// ------------------------------------------------------------------
//  Ranked ladder — local MMR with placements. A server table would be
//  better, but the anon key cannot create one, so rating lives in the
//  same per-commander ledger as the career record.
// ------------------------------------------------------------------

export const PLACEMENTS = 5;
export const START_RATING = 1000;

export const RANK_REWARDS = { silver: 100, gold: 250, platinum: 500, diamond: 900 };

export const RANK_TIERS = [
  { id: 'bronze', name: 'BRONZE', min: 0, color: '#b07a4e' },
  { id: 'silver', name: 'SILVER', min: 950, color: '#b9c6cc' },
  { id: 'gold', name: 'GOLD', min: 1150, color: '#e8c96a' },
  { id: 'platinum', name: 'PLATINUM', min: 1350, color: '#7fd8d0' },
  { id: 'diamond', name: 'DIAMOND', min: 1600, color: '#8fb6ff' },
];

const monthKey = (d = new Date()) => d.toISOString().slice(0, 7);

export function emptyRanked(d = new Date()) {
  return {
    rating: START_RATING, best: START_RATING, played: 0, wins: 0,
    placements: PLACEMENTS, month: monthKey(d), history: [],
  };
}

export function rankedState(local) {
  if (!local.ranked) local.ranked = emptyRanked();
  const r = local.ranked;
  if (r.month !== monthKey()) {
    // Soft reset: keep your best, return to the placement queue.
    const carry = Math.round(START_RATING + (r.rating - START_RATING) * 0.4);
    local.ranked = {
      ...emptyRanked(), best: Math.max(r.best || 0, r.rating),
      rating: carry, month: monthKey(),
    };
  }
  return local.ranked;
}

export function rankTier(rating = START_RATING) {
  let tier = RANK_TIERS[0];
  for (const t of RANK_TIERS) if (rating >= t.min) tier = t;
  return tier;
}

export function rankProgress(rating = START_RATING) {
  const tier = rankTier(rating);
  const next = RANK_TIERS.find((t) => t.min > rating) || null;
  if (!next) return { tier, next: null, pct: 1, need: 0 };
  return {
    tier, next,
    pct: Math.max(0, Math.min(1, (rating - tier.min) / Math.max(1, next.min - tier.min))),
    need: next.min - rating,
  };
}

const clampRating = (n) => Math.max(0, Math.min(2400, Math.round(n)));

// Delta rewards winning by a margin and punishes being routed, with
// wider swings during placements.
export function ratingDelta(data, placements = false) {
  const kills = Math.max(0, data.kills | 0);
  const deaths = Math.max(0, data.deaths | 0);
  const margin = kills - deaths;
  if (data.won) {
    const base = placements ? 34 : 20;
    return Math.max(8, Math.round(base + margin * 1.5 + Math.min(6, (data.score | 0) / 700)));
  }
  const base = placements ? 26 : 17;
  return -Math.max(6, Math.round(base + Math.max(0, -margin) * 1.4));
}

export function applyRankedMatch(local, data) {
  const r = rankedState(local);
  const beforeTier = rankTier(r.rating);
  const placement = r.placements > 0;
  r.played += 1;
  if (data.won) r.wins += 1;
  if (placement) r.placements = Math.max(0, r.placements - 1);
  const delta = ratingDelta(data, placement);
  r.rating = clampRating(r.rating + delta);
  r.best = Math.max(r.best, r.rating);
  r.history.unshift({
    at: Date.now(), won: !!data.won, kills: data.kills | 0,
    deaths: data.deaths | 0, delta, rating: r.rating, placement,
  });
  if (r.history.length > 10) r.history.length = 10;
  const afterTier = rankTier(r.rating);
  let promotion = null;
  if (afterTier.min > beforeTier.min && RANK_REWARDS[afterTier.id]) {
    promotion = { tier: afterTier, salvage: RANK_REWARDS[afterTier.id] };
    local.salvage = (local.salvage | 0) + promotion.salvage;
  }
  return { rating: r.rating, delta, placement, placementsLeft: r.placements, tier: afterTier, promotion };
}

export function rankedRoomName(local) {
  const tier = rankTier(rankedState(local).rating);
  return `RANKED ${tier.name}`;
}
