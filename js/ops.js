// ------------------------------------------------------------------
//  IronStorm — weekly operations and the live command briefing
//  Everything here is derived from existing local progress + presence,
//  so the briefing works for guests and offline commanders too.
// ------------------------------------------------------------------

import { weekKey, weekNumber, daysLeft, weekPoints, lifetimePoints, tierFor, tierProgress } from './season.js';
import { MODES } from './modes.js';
import { MUTATORS } from './rooms.js';
import { TANKS, TANK_ORDER, SKINS, SKIN_ORDER, xpForLevel } from './tanks.js';

export const OPERATIONS = [
  {
    id: 'ashfall', name: 'OPERATION ASHFALL', tag: 'HOLD THE BURN LINE',
    brief: 'King of the Hill is burning. Win the central zone and keep it.',
    mode: 'koth', mutator: '', metric: 'wins', target: 3, reward: 260, accent: '#e8c96a',
  },
  {
    id: 'blacktide', name: 'OPERATION BLACK TIDE', tag: 'BREAK THE COLUMN',
    brief: 'Team Battle under heavy armour. Push the line, whatever it costs.',
    mode: 'team', mutator: 'armoured', metric: 'wins', target: 2, reward: 320, accent: '#7fb0d0',
  },
  {
    id: 'ironveil', name: 'OPERATION IRON VEIL', tag: 'DISAPPEAR IN THE SMOKE',
    brief: 'Deathmatch in the fog. Every kill you land counts toward the veil.',
    mode: 'deathmatch', mutator: '', metric: 'kills', target: 18, reward: 280, accent: '#9b8cd6',
  },
  {
    id: 'coldfront', name: 'OPERATION COLD FRONT', tag: 'SURVIVE THE SWEEP',
    brief: 'Survival rotation. Complete battles while the waves keep coming.',
    mode: 'survival', mutator: '', metric: 'matches', target: 2, reward: 300, accent: '#8fb6ff',
  },
  {
    id: 'redhorizon', name: 'OPERATION RED HORIZON', tag: 'NO COVER, NO MERCY',
    brief: 'Rapid Fire deathmatch. Every reload is a suggestion.',
    mode: 'deathmatch', mutator: 'rapid', metric: 'kills', target: 20, reward: 340, accent: '#e0806a',
  },
  {
    id: 'duststorm', name: 'OPERATION DUST STORM', tag: 'TAKE THE OPEN GROUND',
    brief: 'King of the Hill in the dust. Control the hill, control the sector.',
    mode: 'koth', mutator: 'chaos', metric: 'matches', target: 3, reward: 360, accent: '#d9b45c',
  },
];

export const COALITION_TARGET = 12000;

const inWeek = (at, week) => {
  try { return weekKey(new Date(at)) === week; } catch { return false; }
};

export function operationFor(date = new Date()) {
  const week = weekKey(date);
  const index = Math.max(0, (weekNumber(week) - 1) % OPERATIONS.length);
  return { ...OPERATIONS[index], week, index };
}

export function operationState(local, date = new Date()) {
  const op = operationFor(date);
  const history = local?.history || [];
  let progress = 0;
  for (const m of history) {
    if (!inWeek(m.at, op.week) || m.mode !== op.mode) continue;
    if (op.mutator && m.mutator !== op.mutator) continue;
    if (op.metric === 'wins' && !m.won) continue;
    progress += op.metric === 'kills' ? (m.kills | 0) : 1;
  }
  const claimed = !!local?.operations?.claims?.[op.week];
  return {
    ...op,
    progress: Math.min(op.target, progress),
    pct: Math.min(1, progress / Math.max(1, op.target)),
    complete: progress >= op.target,
    claimed,
    claimable: progress >= op.target && !claimed,
    mutatorName: op.mutator ? (MUTATORS[op.mutator]?.name || op.mutator.toUpperCase()) : 'STANDARD',
  };
}

export function claimOperation(local, date = new Date()) {
  const st = operationState(local, date);
  if (!st.claimable) return { ok: false, why: st.claimed ? 'Already claimed' : 'Objective incomplete' };
  local.operations = local.operations || { claims: {}, badges: [] };
  local.operations.claims = local.operations.claims || {};
  local.operations.badges = local.operations.badges || [];
  local.operations.claims[st.week] = Date.now();
  local.salvage = (local.salvage | 0) + st.reward;
  const badge = `${st.id}:${st.week}`;
  if (!local.operations.badges.includes(badge)) local.operations.badges.push(badge);
  return { ok: true, operation: st, reward: st.reward };
}

// Live coalition goal: weekly points carried by everyone currently in
// the lobby, plus the local commander's own contribution.
export function coalitionGoal(lobby, local) {
  let points = weekPoints(local?.weekly || {});
  if (lobby && typeof lobby.values === 'function') {
    for (const m of lobby.values()) points += Math.max(0, m?.wp | 0);
  }
  return { points, target: COALITION_TARGET, pct: Math.min(1, points / COALITION_TARGET) };
}

export function crateState(profile) {
  const last = profile?.lastDaily || 0;
  const left = Math.max(0, 20 * 60 * 60 * 1000 - (Date.now() - last));
  return { ready: left <= 0, msLeft: left, pct: left <= 0 ? 1 : 1 - left / (20 * 60 * 60 * 1000) };
}

export function formatDuration(ms) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h) return `${h}H ${String(m).padStart(2, '0')}M`;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function featuredMode(date = new Date()) {
  const ids = ['deathmatch', 'team', 'koth', 'survival'];
  const start = Date.UTC(date.getUTCFullYear(), 0, 0);
  const day = Math.floor((Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) - start) / 86400000);
  return MODES[ids[day % ids.length]];
}

export function nextRequisition(profile) {
  if (!profile) return null;
  const level = profile.level | 0;
  const tank = TANK_ORDER.map((id) => TANKS[id])
    .filter((t) => !profile.owned?.includes(t.id) && t.unlock > level)
    .sort((a, b) => a.unlock - b.unlock)[0];
  const skin = SKIN_ORDER.map((id) => SKINS[id])
    .filter((s) => !profile.ownedSkins?.includes(s.id) && s.unlock > level)
    .sort((a, b) => a.unlock - b.unlock)[0];
  const item = tank || skin;
  if (!item) return null;
  const start = xpForLevel(level);
  const end = xpForLevel(item.unlock);
  return {
    kind: tank ? 'VEHICLE' : 'CAMOUFLAGE',
    name: item.name,
    unlock: item.unlock,
    need: Math.max(0, end - (profile.xp | 0)),
    pct: Math.min(1, Math.max(0, ((profile.xp | 0) - start) / Math.max(1, end - start))),
  };
}

export function contractRows(profile) {
  const c = profile?.contracts;
  if (!c) return [];
  const defs = [
    ['DESTROY 8 TANKS', c.kills | 0, 8, 400],
    ['WIN 2 BATTLES', c.wins | 0, 2, 350],
    ['COMPLETE 4 MATCHES', c.matches | 0, 4, 250],
  ];
  const claimed = c.claimed || [];
  return defs.map(([name, have, target, reward], i) => ({
    name, have: Math.min(have, target), target, reward,
    complete: have >= target, claimed: claimed.includes(i),
  }));
}

export function briefingSnapshot({ profile, local, lobby, rooms, date = new Date() }) {
  const op = operationState(local, date);
  const coop = coalitionGoal(lobby, local);
  const season = tierProgress(weekPoints(local?.weekly || {}));
  const tier = tierFor(lifetimePoints(profile || {}));
  const featured = featuredMode(date);
  const online = lobby ? (typeof lobby.size === 'number' ? lobby.size : 0) : 0;
  const list = Array.isArray(rooms) ? rooms : [];
  const roomNames = new Set(list.map((r) => r.room).filter(Boolean));
  const counts = new Map();
  for (const r of list) if (r.room) counts.set(r.room, (counts.get(r.room) || 0) + 1);
  const busiest = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
  return {
    online: online + (profile ? 1 : 0),
    openRooms: roomNames.size,
    activeRoom: busiest ? { key: busiest[0], players: busiest[1], meta: list.find((r) => r.room === busiest[0]) } : null,
    operation: op,
    coalition: coop,
    season,
    tier,
    featured,
    next: nextRequisition(profile),
    crate: crateState(profile),
    contracts: contractRows(profile),
    daysLeft: daysLeft(date),
    week: weekNumber(weekKey(date)),
  };
}
