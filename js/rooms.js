// ------------------------------------------------------------------
//  Arena rooms — one channel per warzone + server name. Each room is
//  keyed by mode and slugged name, so typing the same name lands two
//  players in the same match. Nothing here talks to Supabase; the live
//  occupancy list comes from net.js's room directory.
// ------------------------------------------------------------------

export const ROOM_CAPACITY = 12;
export const DEFAULT_ROOM = 'ALPHA';

// ------------------------------------------------------------------
//  Mutators — room-wide handling modifiers chosen by the host.
// ------------------------------------------------------------------
export const MUTATORS = {
  standard: {
    id: 'standard', name: 'STANDARD', tag: 'FACTORY BALANCE', color: '#8fe86b',
    blurb: 'Stock damage, armour, reload and speed.',
    hp: 1, damage: 1, reload: 1, speed: 1, accel: 1, shellSpeed: 1, spread: 1,
  },
  rapid: {
    id: 'rapid', name: 'RAPID FIRE', tag: 'HALF RELOAD', color: '#ffd35a',
    blurb: 'Reloads twice as fast, shells hit softer.',
    hp: 1, damage: 0.8, reload: 0.5, speed: 1.05, accel: 1.05, shellSpeed: 1, spread: 1.2,
  },
  armoured: {
    id: 'armoured', name: 'ARMOURED', tag: 'HEAVY PLATING', color: '#7fb0d0',
    blurb: 'Half again the hull, traded for mobility.',
    hp: 1.5, damage: 0.95, reload: 1.1, speed: 0.88, accel: 0.88, shellSpeed: 1, spread: 1,
  },
  sniper: {
    id: 'sniper', name: 'SNIPER', tag: 'LONG GUN', color: '#c8a0ff',
    blurb: 'Hard-hitting fast shells and a long reload.',
    hp: 0.85, damage: 1.8, reload: 1.55, speed: 1, accel: 1, shellSpeed: 1.3, spread: 0.55,
  },
  chaos: {
    id: 'chaos', name: 'CHAOS', tag: 'NO RULES', color: '#e0806a',
    blurb: 'Everything turned up: fast, fragile and loud.',
    hp: 1.15, damage: 1.25, reload: 0.7, speed: 1.15, accel: 1.15, shellSpeed: 1.1, spread: 1.35,
  },
};

export const MUTATOR_ORDER = ['standard', 'rapid', 'armoured', 'sniper', 'chaos'];

export const WEATHERS = ['random', 'clear', 'rain', 'fog', 'dusk'];
export const ROOM_LIMITS = [15, 25, 40];
export const ROOM_BOTS = [null, 0, 3, 6, 9];

// Bot skill profiles: aim error, reaction, fire discipline, speed and
// damage. Hosts pick one for the whole room.
export const BOT_LEVELS = {
  recruit: {
    id: 'recruit', name: 'RECRUIT', tag: 'FORGIVING', color: '#8fbf5f',
    err: 0.3, react: 1.25, fire: 0.5, speed: 0.78, damage: 0.65, retreat: 0.5,
  },
  regular: {
    id: 'regular', name: 'REGULAR', tag: 'STANDARD', color: '#e8c96a',
    err: 0.16, react: 0.65, fire: 0.7, speed: 0.92, damage: 0.9, retreat: 0.8,
  },
  veteran: {
    id: 'veteran', name: 'VETERAN', tag: 'RUTHLESS', color: '#e0806a',
    err: 0.07, react: 0.32, fire: 0.92, speed: 1, damage: 1.05, retreat: 0.95,
  },
};
export const BOT_LEVEL_ORDER = ['recruit', 'regular', 'veteran'];

export const RULE_DEFAULTS = {
  mutator: 'standard',
  map: 'rotate',
  bots: null,
  difficulty: 'regular',
  weather: 'random',
  limit: null,
};

// Never trust a rule set that came over the wire.
export function ruleSet(raw) {
  const src = raw && typeof raw === 'object' ? raw : {};
  const mutator = MUTATORS[src.mutator] ? src.mutator : 'standard';
  const bots = ROOM_BOTS.includes(src.bots) ? src.bots : null;
  const weather = WEATHERS.includes(src.weather) ? src.weather : 'random';
  const limit = ROOM_LIMITS.includes(src.limit) ? src.limit : null;
  const map = typeof src.map === 'string' ? src.map : 'rotate';
  const difficulty = BOT_LEVELS[src.difficulty] ? src.difficulty : 'regular';
  const passcode = String(src.passcode || '').replace(/[^A-Z0-9_-]/gi, '').slice(0, 12).toUpperCase();
  const privateRoom = !!src.private || !!passcode;
  return { mutator, map, bots, difficulty, weather, limit, private: privateRoom, passcode: privateRoom ? passcode : '' };
}

export function mutateStats(stats, mutatorId) {
  const m = MUTATORS[mutatorId] || MUTATORS.standard;
  if (m.id === 'standard') return stats;
  return {
    ...stats,
    hp: Math.round(stats.hp * m.hp),
    speed: stats.speed * m.speed,
    accel: stats.accel * m.accel,
    damage: +(stats.damage * m.damage).toFixed(1),
    reload: +(stats.reload * m.reload).toFixed(3),
    shellSpeed: Math.round(stats.shellSpeed * m.shellSpeed),
    spread: +(stats.spread * m.spread).toFixed(4),
  };
}

export function roomDisplayName(raw) {
  return String(raw || '')
    .toUpperCase()
    .replace(/[^A-Z0-9 _-]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 16);
}

export function roomSlug(name) {
  const slug = String(name || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 24);
  return slug || 'alpha';
}

export function makeRoom(mode, name, rules = null) {
  const display = roomDisplayName(name) || DEFAULT_ROOM;
  return { mode, name: display, key: `${mode}:${roomSlug(display)}`, rules: rules ? ruleSet(rules) : null };
}

export function roomTally(list = []) {
  const tally = new Map();
  for (const r of list) tally.set(r.room, (tally.get(r.room) || 0) + 1);
  return tally;
}

// The browser always offers the default room for a mode, plus every live
// room someone is currently sitting in. Rows merge by display name, so a
// stale presence under an old channel key can never list the same server
// twice.
export function roomRows(mode, list = []) {
  const rows = new Map();
  const base = makeRoom(mode, DEFAULT_ROOM);
  rows.set(base.name, { ...base, players: 0, rules: null });
  for (const r of list) {
    if (r.mode !== mode) continue;
    const name = roomDisplayName(r.roomName) || DEFAULT_ROOM;
    const row = rows.get(name) || { mode, name, key: r.room, players: 0, rules: null };
    row.players += 1;
    if (!row.rules && r.rules) row.rules = ruleSet(r.rules);
    rows.set(name, row);
  }
  return [...rows.values()].sort((a, b) => b.players - a.players || a.name.localeCompare(b.name));
}

// Quickplay drops into the busiest room of the mode that still has a slot,
// so a small player base actually meets instead of spreading thin.
export function quickRoom(mode, list = []) {
  const tally = roomTally(list);
  let best = null;
  let bestN = -1;
  for (const [key, n] of tally) {
    if (!key.startsWith(`${mode}:`) || n >= ROOM_CAPACITY) continue;
    if (n > bestN) { best = key; bestN = n; }
  }
  if (!best) return makeRoom(mode, DEFAULT_ROOM);
  const hit = list.find((r) => r.room === best);
  return makeRoom(mode, hit?.roomName || DEFAULT_ROOM);
}

export function findRoomByName(list = [], name = '') {
  const want = roomDisplayName(name);
  if (!want) return null;
  return list.find((r) => roomDisplayName(r.roomName) === want) || null;
}
