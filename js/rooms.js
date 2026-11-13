// ------------------------------------------------------------------
//  Arena rooms — one channel per warzone + server name. Each room is
//  keyed by mode and slugged name, so typing the same name lands two
//  players in the same match. Nothing here talks to Supabase; the live
//  occupancy list comes from net.js's room directory.
// ------------------------------------------------------------------

export const ROOM_CAPACITY = 12;
export const DEFAULT_ROOM = 'ALPHA';

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

export function makeRoom(mode, name) {
  const display = roomDisplayName(name) || DEFAULT_ROOM;
  return { mode, name: display, key: `${mode}:${roomSlug(display)}` };
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
  rows.set(base.name, { ...base, players: 0 });
  for (const r of list) {
    if (r.mode !== mode) continue;
    const name = roomDisplayName(r.roomName) || DEFAULT_ROOM;
    const row = rows.get(name) || { mode, name, key: r.room, players: 0 };
    row.players += 1;
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
