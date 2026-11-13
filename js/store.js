// Player state: guest save in localStorage, account saves in Supabase.
// Everything the UI reads goes through `state.profile`, which has the same
// shape for both modes.

import { SAVE_KEY, SETTINGS_KEY, DEFAULT_SETTINGS } from './config.js';
import { storage, uuid } from './util.js';
import { TANKS, SKINS, levelForXp } from './tanks.js';

export const state = {
  mode: 'guest',          // 'guest' | 'account'
  uid: null,
  profile: null,
  settings: { ...DEFAULT_SETTINGS },
  catalog: {},            // tankId -> { price, unlock_level }
  lastReport: null,
};

const DEFAULT_UPGRADES = { engine: 0, armor: 0, firepower: 0, reload: 0, tracks: 0 };

function guestName() {
  // GUEST#### — matches the "saved on this device" identity shown in the menu
  return 'GUEST' + Math.floor(1000 + Math.random() * 9000);
}

export function newGuestProfile() {
  return {
    username: guestName(),
    credits: 500,
    level: 1,
    xp: 0,
    tank: 'sherman',
    owned: ['sherman'],
    skin: 'olive',
    ownedSkins: ['olive'],
    lastDaily: 0,
    contracts: { day: todayKey(), mode: featuredModeFor(), kills: 0, wins: 0, matches: 0, claimed: [] },
    upgrades: { ...DEFAULT_UPGRADES },
    kills: 0,
    deaths: 0,
    matches: 0,
    wins: 0,
    bestScore: 0,
    bestKills: 0,
  };
}

// Map a public.profiles row into the client shape.
export function fromRow(row) {
  return {
    username: row.username,
    credits: row.credits ?? 0,
    level: row.level ?? levelForXp(row.xp ?? 0),
    xp: row.xp ?? 0,
    tank: row.tank_id || 'sherman',
    owned: Array.isArray(row.owned_tanks) && row.owned_tanks.length ? row.owned_tanks : ['sherman'],
    skin: row.skin || 'olive',
    ownedSkins: Array.isArray(row.owned_skins) && row.owned_skins.length ? row.owned_skins : ['olive'],
    lastDaily: row.last_daily ? Date.parse(row.last_daily) || 0 : 0,
    contracts: row.contracts || null,
    upgrades: { ...DEFAULT_UPGRADES, ...(row.upgrades || {}) },
    kills: row.kills ?? 0,
    deaths: row.deaths ?? 0,
    matches: row.matches ?? 0,
    wins: row.wins ?? 0,
    bestScore: row.best_score ?? 0,
    bestKills: row.best_kills ?? row.best_score ?? 0,
  };
}

export function save() {
  if (state.mode !== 'guest' || !state.profile) return;
  storage.set(SAVE_KEY, state.profile);
}

export function loadSettings() {
  state.settings = { ...DEFAULT_SETTINGS, ...storage.get(SETTINGS_KEY, {}) };
  return state.settings;
}
export function saveSettings(s) {
  state.settings = { ...state.settings, ...s };
  storage.set(SETTINGS_KEY, state.settings);
}

export function startGuest() {
  const existing = storage.get(SAVE_KEY, null);
  const p = existing && existing.username ? existing : newGuestProfile();
  state.mode = 'guest';
  state.uid = 'guest:' + (storage.get('ironstorm.guestid', null) || uuid());
  storage.set('ironstorm.guestid', state.uid);
  state.profile = { ...newGuestProfile(), ...p };
  save();
  return state.profile;
}

export function startAccount(uid, row) {
  state.mode = 'account';
  state.uid = uid;
  state.profile = fromRow(row);
  return state.profile;
}

export function logoutLocal() {
  state.mode = 'guest';
  state.uid = null;
  state.profile = null;
}

export function equipTankLocal(id) {
  if (!state.profile.owned.includes(id)) return false;
  state.profile.tank = id;
  save();
  return true;
}

export function buyTankLocal(id) {
  const p = state.profile;
  const t = TANKS[id];
  if (!t || p.owned.includes(id)) return { ok: false, why: 'Already owned' };
  if (p.level < t.unlock) return { ok: false, why: `Unlocks at level ${t.unlock}` };
  const price = state.catalog[id]?.price ?? t.price;
  if (p.credits < price) return { ok: false, why: 'Not enough credits' };
  p.credits -= price;
  p.owned.push(id);
  p.tank = id;
  save();
  return { ok: true };
}

export function buySkinLocal(id) {
  const p = state.profile;
  const s = SKINS[id];
  if (!s || p.ownedSkins.includes(id)) return { ok: false, why: 'Already owned' };
  if (p.level < s.unlock) return { ok: false, why: `Unlocks at level ${s.unlock}` };
  if (p.credits < s.price) return { ok: false, why: 'Not enough credits' };
  p.credits -= s.price;
  p.ownedSkins.push(id);
  p.skin = id;
  save();
  return { ok: true };
}

export function equipSkinLocal(id) {
  if (!state.profile.ownedSkins.includes(id)) return false;
  state.profile.skin = id;
  save();
  return true;
}

const DAILY_COOLDOWN = 20 * 60 * 60 * 1000;

export function dailyState() {
  const last = state.profile?.lastDaily || 0;
  const left = Math.max(0, DAILY_COOLDOWN - (Date.now() - last));
  return { ready: left <= 0, nextAt: last + DAILY_COOLDOWN, msLeft: left };
}

export function claimDailyLocal() {
  const st = dailyState();
  if (!st.ready) return { ok: false, why: 'Crate already opened', msLeft: st.msLeft };
  const reward = Math.floor(120 + Math.random() * 140);
  state.profile.credits += reward;
  state.profile.lastDaily = Date.now();
  save();
  return { ok: true, reward };
}

export function buyUpgradeLocal(key) {
  const p = state.profile;
  const lvl = p.upgrades[key] | 0;
  if (lvl >= 5) return { ok: false, why: 'Fully upgraded' };
  const cost = Math.round(160 * Math.pow(lvl + 1, 1.4));
  if (p.credits < cost) return { ok: false, why: 'Not enough credits' };
  p.credits -= cost;
  p.upgrades[key] = lvl + 1;
  save();
  return { ok: true };
}

export function applyMatchRewards({ kills, deaths, score, won, credits, xp, mode }) {
  const p = state.profile;
  p.credits += credits;
  p.xp += xp;
  p.kills += kills;
  p.deaths += deaths;
  p.matches += 1;
  if (won) p.wins += 1;
  p.bestScore = Math.max(p.bestScore, score);
  p.bestKills = Math.max(p.bestKills, kills);
  p.level = levelForXp(p.xp);
  bumpContracts({ kills, won, mode });
  save();
}

export function updateSettingsFromProfile() {}

// ----------------------------------------------------------------
//  Daily contracts
// ----------------------------------------------------------------
export const CONTRACT_DEFS = [
  { key: 'kills', target: 8, reward: 400, title: 'DESTROY 8 TANKS', sub: 'in today’s featured warzone ({mode})' },
  { key: 'wins', target: 2, reward: 350, title: 'WIN 2 BATTLES', sub: 'any warzone' },
  { key: 'matches', target: 4, reward: 250, title: 'COMPLETE 4 MATCHES', sub: 'any warzone' },
];

const MODE_IDS = ['deathmatch', 'team', 'koth', 'survival'];

export function todayKey(d = new Date()) {
  return d.toISOString().slice(0, 10);
}

export function featuredModeFor(d = new Date()) {
  const start = Date.UTC(d.getUTCFullYear(), 0, 0);
  const day = Math.floor((Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - start) / 86400000);
  return MODE_IDS[day % 4];
}

export function ensureContracts() {
  const p = state.profile;
  if (!p) return null;
  const day = todayKey();
  if (!p.contracts || p.contracts.day !== day) {
    p.contracts = { day, mode: featuredModeFor(), kills: 0, wins: 0, matches: 0, claimed: [] };
    save();
  }
  p.contracts.claimed = p.contracts.claimed || [];
  return p.contracts;
}

function bumpContracts({ kills, won, mode }) {
  const c = ensureContracts();
  if (!c) return;
  c.matches = (c.matches || 0) + 1;
  if (won) c.wins = (c.wins || 0) + 1;
  if (mode === c.mode) c.kills = (c.kills || 0) + (kills || 0);
  save();
}

export function claimContractLocal(index) {
  const c = ensureContracts();
  const def = CONTRACT_DEFS[index];
  if (!c || !def) return { ok: false, why: 'Unknown contract' };
  if ((c.claimed || []).includes(index)) return { ok: false, why: 'Already claimed' };
  if ((c[def.key] || 0) < def.target) return { ok: false, why: 'Contract not complete' };
  c.claimed.push(index);
  state.profile.credits += def.reward;
  save();
  return { ok: true, reward: def.reward };
}

export function unlockRankCrateLocal() {
  if (!state.profile) return;
  state.profile.lastDaily = 0;
  save();
}
