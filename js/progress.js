// ------------------------------------------------------------------
//  Local career ledger
//  Battle history, per-vehicle records, streaks, the weekly season
//  counter and the salvage wallet live here, scoped to the signed-in
//  commander. Keeping it local means guests and accounts behave the
//  same and no database migration is needed.
// ------------------------------------------------------------------

import { storage } from './util.js';
import { state } from './store.js';
import { evaluateMedals } from './medals.js';
import { emptyWeek, weekKey, weekPoints, TIERS, seasonReward } from './season.js';
import { COSMETIC_KEYS_BASE } from './cosmetics.js';
import { emptyRanked } from './ranked.js';

const KEY = (uid) => `ironstorm.local.v1:${uid}`;
const HISTORY_MAX = 20;

export function blankLocal() {
  return {
    salvage: 0,
    medals: {},
    bestStreak: 0,
    bestKills: 0,
    bestWave: 0,
    bestAccuracy: 0,
    flawless: 0,
    modeWins: {},
    maps: {},
    mutators: {},
    hosted: 0,
    tankStats: {},
    history: [],
    weekly: emptyWeek(),
    bestWeek: { points: 0, week: '' },
    seasonClaims: {},
    seasonPayout: null,
    ranked: emptyRanked(),
    cosmetics: { owned: COSMETIC_KEYS_BASE.slice(), emblem: 'none', trail: 'none', killfx: 'none' },
  };
}

function merge(raw) {
  const base = blankLocal();
  if (!raw || typeof raw !== 'object') return base;
  return {
    ...base,
    ...raw,
    medals: { ...(raw.medals || {}) },
    modeWins: { ...(raw.modeWins || {}) },
    maps: { ...(raw.maps || {}) },
    mutators: { ...(raw.mutators || {}) },
    tankStats: { ...(raw.tankStats || {}) },
    history: Array.isArray(raw.history) ? raw.history.slice(0, HISTORY_MAX) : [],
    weekly: { ...base.weekly, ...(raw.weekly || {}) },
    bestWeek: { ...base.bestWeek, ...(raw.bestWeek || {}) },
    seasonClaims: { ...(raw.seasonClaims || {}) },
    ranked: raw.ranked || base.ranked,
    cosmetics: {
      ...base.cosmetics,
      ...(raw.cosmetics || {}),
      owned: Array.isArray(raw.cosmetics?.owned) && raw.cosmetics.owned.length
        ? raw.cosmetics.owned
        : base.cosmetics.owned,
    },
  };
}

// Roll the weekly counter over when the clock passes Monday 00:00 UTC.
function rollWeek(local) {
  const wk = weekKey();
  if (local.weekly.week === wk) return false;
  const points = weekPoints(local.weekly);
  if (points > (local.bestWeek.points | 0)) {
    local.bestWeek = { points, week: local.weekly.week };
    // Best-week payout: one final thank-you when the ladder rolls over.
    const payout = Math.min(500, Math.floor(points / 10));
    if (payout > 0) {
      local.salvage = (local.salvage | 0) + payout;
      local.seasonPayout = { week: local.weekly.week, salvage: payout, points };
    }
  }
  local.weekly = { ...emptyWeek(), week: wk };
  return true;
}

export function loadLocal(uid = state.uid) {
  if (!uid) return blankLocal();
  const local = merge(storage.get(KEY(uid), null));
  const rolled = rollWeek(local);
  state.local = local;
  if (rolled) saveLocal(uid, local);
  return local;
}

export function saveLocal(uid = state.uid, local = state.local) {
  if (!uid || !local) return;
  storage.set(KEY(uid), local);
}

export function patchLocal(patch) {
  Object.assign(state.local, patch);
  saveLocal();
}

function tankRecord(local, id) {
  if (!local.tankStats[id]) {
    local.tankStats[id] = { kills: 0, deaths: 0, matches: 0, wins: 0, shots: 0, hits: 0 };
  }
  return local.tankStats[id];
}

// Called once per finished battle, before the report is shown.
// Returns the salvage earned and any medals unlocked by this battle.
export function noteMatch(data, meta = {}) {
  const local = state.local || loadLocal();
  rollWeek(local);
  const profile = state.profile;
  const tank = meta.tank || profile?.tank || 'sherman';
  const mode = data.mode || 'deathmatch';
  const accuracy = Math.max(0, Math.min(100, data.accuracy | 0));
  const kills = Math.max(0, data.kills | 0);
  const deaths = Math.max(0, data.deaths | 0);
  const won = !!data.won;

  local.bestStreak = Math.max(local.bestStreak | 0, data.bestStreak | 0);
  local.bestKills = Math.max(local.bestKills | 0, kills);
  local.bestWave = Math.max(local.bestWave | 0, data.wave | 0);
  if (kills > 0) local.bestAccuracy = Math.max(local.bestAccuracy | 0, accuracy);
  if (won && kills >= 5 && deaths === 0) local.flawless = (local.flawless | 0) + 1;

  const rec = tankRecord(local, tank);
  rec.kills += kills;
  rec.deaths += deaths;
  rec.matches += 1;
  rec.wins += won ? 1 : 0;
  rec.hits += data.hits | 0;
  rec.shots += data.shots | 0;

  if (won) local.modeWins[mode] = (local.modeWins[mode] | 0) + 1;
  if (meta.map) local.maps[meta.map] = (local.maps[meta.map] | 0) + 1;
  if (meta.mutator) local.mutators[meta.mutator] = (local.mutators[meta.mutator] | 0) + 1;
  if (meta.host) local.hosted = (local.hosted | 0) + 1;

  local.weekly.kills += kills;
  local.weekly.wins += won ? 1 : 0;
  local.weekly.matches += 1;
  local.weekly.score += Math.max(0, data.score | 0);
  local.weekly.points = weekPoints(local.weekly);

  local.history.unshift({
    at: Date.now(),
    mode,
    modeName: data.modeName || '',
    room: data.room?.name || '',
    map: meta.map || '',
    mutator: meta.mutator || '',
    tank,
    kills,
    deaths,
    score: Math.max(0, data.score | 0),
    won,
    accuracy,
    seconds: Math.max(0, data.seconds | 0),
    credits: Math.max(0, data.earned?.credits | 0),
    xp: Math.max(0, data.earned?.xp | 0),
  });
  if (local.history.length > HISTORY_MAX) local.history.length = HISTORY_MAX;

  // Battle pay: a steady trickle of salvage, plus a bonus for winning.
  let salvage = 4 + kills * 2 + (won ? 12 : 0) + Math.min(30, Math.floor((data.score | 0) / 300));
  const medals = evaluateMedals({ profile, local });
  for (const medal of medals) {
    local.medals[medal.id] = Date.now();
    salvage += medal.salvage;
  }
  local.salvage = (local.salvage | 0) + salvage;
  saveLocal();
  return { salvage, medals, weekly: local.weekly };
}

// Claim the one-time salvage/cosmetic reward for a weekly tier.
export function claimSeasonReward(tierId) {
  const local = state.local || loadLocal();
  const tier = TIERS.find((x) => x.id === tierId);
  const reward = seasonReward(tierId);
  if (!tier || !reward) return { ok: false, why: 'Unknown tier' };
  const points = weekPoints(local.weekly);
  if (points < tier.min) return { ok: false, why: `Reach ${tier.name} first` };
  if (local.seasonClaims[tierId]) return { ok: false, why: 'Already claimed' };
  local.seasonClaims[tierId] = Date.now();
  local.salvage = (local.salvage | 0) + (reward.salvage | 0);
  if (reward.cosmetic && !local.cosmetics.owned.includes(reward.cosmetic)) {
    local.cosmetics.owned.push(reward.cosmetic);
  }
  saveLocal();
  return { ok: true, reward };
}

export function careerTotals(local = state.local) {
  const history = local?.history || [];
  const tanks = local?.tankStats || {};
  const total = Object.values(tanks).reduce(
    (acc, t) => {
      acc.kills += t.kills | 0;
      acc.deaths += t.deaths | 0;
      acc.matches += t.matches | 0;
      acc.wins += t.wins | 0;
      acc.shots += t.shots | 0;
      acc.hits += t.hits | 0;
      return acc;
    },
    { kills: 0, deaths: 0, matches: 0, wins: 0, shots: 0, hits: 0 }
  );
  const shots = total.shots;
  return {
    ...total,
    accuracy: shots ? Math.round((total.hits / shots) * 100) : 0,
    kd: total.deaths ? total.kills / total.deaths : total.kills,
    bestKills: local?.bestKills | 0,
    bestStreak: local?.bestStreak | 0,
    salvage: local?.salvage | 0,
    history,
  };
}
