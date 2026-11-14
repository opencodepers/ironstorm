// ------------------------------------------------------------------
//  Community maps — a 10x10 prop grid encoded into a short, URL-safe
//  code. No server needed: the code is the map.
// ------------------------------------------------------------------

import { WORLD } from './config.js';
import { storage } from './util.js';

export const GRID = 10;
export const MAP_MARGIN = 300;
export const CELL = (WORLD.size - MAP_MARGIN * 2) / GRID;

export const MAP_PALETTE = [
  { id: 'crateWood', label: 'CRATE', size: 56, opts: { destructible: true, hp: 45 } },
  { id: 'crateMetal', label: 'STEEL', size: 64, opts: { destructible: true, hp: 70 } },
  { id: 'sandbagBrown', label: 'SANDBAG', size: 56, opts: {} },
  { id: 'sandbagBeige', label: 'BAGS', size: 56, opts: {} },
  { id: 'barricadeMetal', label: 'BARRIER', size: 56, opts: {} },
  { id: 'fenceYellow', label: 'FENCE', size: 56, opts: {} },
  { id: 'barrelRed_top', label: 'BARREL', size: 44, opts: { destructible: true, hp: 18, explosive: true, radius: 20 } },
  { id: 'treeGreen_large', label: 'TREE', size: 128, opts: { radius: 26 } },
];

const THEMES = [
  { id: 'ash', name: 'ASHFORD', grade: 'rgba(9, 20, 12, 0.38)', tint: 'rgba(120, 150, 90, 0.05)', sand: 10, clutter: 0.55 },
  { id: 'ice', name: 'FROZEN', grade: 'rgba(24, 38, 44, 0.36)', tint: 'rgba(150, 200, 220, 0.09)', sand: 15, clutter: 0.5 },
  { id: 'dune', name: 'DUNE', grade: 'rgba(44, 34, 14, 0.24)', tint: 'rgba(200, 170, 110, 0.12)', sand: 22, clutter: 0.5 },
  { id: 'port', name: 'HARBOUR', grade: 'rgba(8, 20, 22, 0.42)', tint: 'rgba(90, 140, 150, 0.07)', sand: 5, clutter: 0.6 },
];

const b64encode = (text) => {
  const bytes = new TextEncoder().encode(text);
  let raw = '';
  for (const b of bytes) raw += String.fromCharCode(b);
  return btoa(raw).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
const b64decode = (code) => {
  const raw = atob(code.replace(/-/g, '+').replace(/_/g, '/'));
  const bytes = Uint8Array.from(raw, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
};

export function mapCode(name, theme, cells) {
  const safe = String(name || 'CUSTOM MAP').toUpperCase().replace(/[^A-Z0-9 _-]/g, '').slice(0, 16) || 'CUSTOM MAP';
  const clean = (cells || [])
    .filter((c) => c && c.x >= 0 && c.x < GRID && c.y >= 0 && c.y < GRID && MAP_PALETTE[c.i])
    .slice(0, 120)
    .map((c) => [c.i | 0, c.x | 0, c.y | 0]);
  return 'IS1.' + b64encode(JSON.stringify({ n: safe, t: theme | 0, c: clean }));
}

export function decodeMap(code) {
  if (typeof code !== 'string' || !code.startsWith('IS1.')) return null;
  try {
    const raw = JSON.parse(b64decode(code.slice(4)));
    if (!raw || !Array.isArray(raw.c)) return null;
    const cells = raw.c
      .filter((c) => Array.isArray(c) && c.length === 3)
      .filter(([i, x, y]) => MAP_PALETTE[i] && x >= 0 && x < GRID && y >= 0 && y < GRID)
      .slice(0, 120)
      .map(([i, x, y]) => ({ i, x, y }));
    return {
      name: String(raw.n || 'CUSTOM MAP').toUpperCase().slice(0, 16),
      theme: Math.max(0, Math.min(THEMES.length - 1, raw.t | 0)),
      cells,
    };
  } catch { return null; }
}

// Turn a code into a map definition the arena understands.
export function communityDef(code) {
  const data = decodeMap(code);
  if (!data) return null;
  const theme = THEMES[data.theme];
  const landmarks = data.cells.map(({ i, x, y }) => {
    const p = MAP_PALETTE[i];
    return {
      x: MAP_MARGIN + CELL * x + CELL / 2,
      y: MAP_MARGIN + CELL * y + CELL / 2,
      type: p.id,
      size: p.size,
      opts: { ...p.opts },
    };
  });
  const hash = code.split('').reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7).toString(36).slice(-4);
  return {
    id: 'custom-' + hash,
    code,
    custom: true,
    name: data.name,
    tagline: 'Community battlefield · ' + theme.name,
    grade: theme.grade,
    tint: theme.tint,
    sand: theme.sand,
    clutter: theme.clutter,
    landmarks,
  };
}

const KEY = (uid) => `ironstorm.maps.v1:${uid || 'local'}`;
export function listCustom(uid) {
  const list = storage.get(KEY(uid), []);
  return Array.isArray(list) ? list.filter((m) => m && typeof m.code === 'string') : [];
}
export function saveCustom(uid, code) {
  const data = decodeMap(code);
  if (!data) return { ok: false, why: 'That map code is not valid' };
  const list = listCustom(uid).filter((m) => m.code !== code);
  list.unshift({ code, name: data.name, at: Date.now() });
  storage.set(KEY(uid), list.slice(0, 24));
  return { ok: true };
}
export function removeCustom(uid, code) {
  storage.set(KEY(uid), listCustom(uid).filter((m) => m.code !== code));
}
export { THEMES };
