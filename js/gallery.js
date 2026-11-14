// ------------------------------------------------------------------
//  IronStorm — community map gallery
//  Map codes are self-contained, so the gallery can work entirely
//  client-side. When the optional community SQL is installed, net.js
//  layers shared rows on top of this local archive.
// ------------------------------------------------------------------

import { storage } from './util.js';
import { mapCode, decodeMap, GRID, MAP_PALETTE, THEMES } from './community.js';

const KEY = (uid) => `ironstorm.gallery.v1:${uid || 'local'}`;
const REPORT_KEY = (uid) => `ironstorm.gallery.reports.v1:${uid || 'local'}`;

const cell = (i, x, y) => ({ i, x, y });

const SEEDS = [
  {
    name: 'CROSSFIRE JUNCTION', theme: 0, author: 'IRON CORPS',
    cells: [
      cell(0, 4, 4), cell(0, 5, 4), cell(0, 4, 5), cell(0, 5, 5),
      cell(6, 2, 2), cell(6, 7, 2), cell(6, 2, 7), cell(6, 7, 7),
      cell(4, 0, 5), cell(4, 9, 4), cell(4, 5, 0), cell(4, 4, 9),
      cell(2, 3, 1), cell(2, 6, 8), cell(5, 8, 2), cell(5, 1, 7),
    ],
  },
  {
    name: 'FROZEN CROSSING', theme: 1, author: 'NORTH WATCH',
    cells: [
      cell(5, 0, 4), cell(5, 1, 4), cell(5, 2, 4), cell(5, 7, 5), cell(5, 8, 5), cell(5, 9, 5),
      cell(1, 4, 1), cell(1, 5, 1), cell(1, 4, 8), cell(1, 5, 8),
      cell(7, 2, 2), cell(7, 7, 7), cell(3, 7, 2), cell(3, 2, 7),
    ],
  },
  {
    name: 'DUNE RELAY', theme: 2, author: 'SAND VIPERS',
    cells: [
      cell(6, 3, 3), cell(6, 4, 3), cell(6, 6, 6), cell(6, 5, 6),
      cell(0, 1, 5), cell(0, 8, 4), cell(0, 5, 1), cell(0, 4, 8),
      cell(2, 3, 7), cell(2, 6, 2), cell(4, 0, 2), cell(4, 9, 7),
      cell(1, 5, 5), cell(1, 4, 4),
    ],
  },
  {
    name: 'HARBOUR SIEGE', theme: 3, author: 'TIDE BREAKERS',
    cells: [
      cell(4, 0, 3), cell(4, 0, 4), cell(4, 0, 5), cell(4, 9, 4), cell(4, 9, 5),
      cell(2, 2, 2), cell(2, 2, 3), cell(2, 7, 6), cell(2, 7, 7),
      cell(0, 4, 4), cell(0, 5, 5), cell(7, 3, 6), cell(7, 6, 3),
    ],
  },
  {
    name: 'THE FOUNDRY', theme: 0, author: 'BLACK ANVIL',
    cells: [
      cell(3, 4, 4), cell(3, 5, 5), cell(3, 4, 5), cell(3, 5, 4),
      cell(0, 2, 2), cell(0, 3, 2), cell(0, 6, 7), cell(0, 7, 7),
      cell(6, 1, 6), cell(6, 8, 3), cell(6, 4, 6), cell(6, 5, 3),
      cell(2, 3, 8), cell(2, 6, 1),
    ],
  },
  {
    name: 'LAST RIDGE', theme: 2, author: 'IRON CORPS',
    cells: [
      cell(1, 4, 1), cell(1, 5, 1), cell(1, 4, 2), cell(1, 5, 2),
      cell(1, 4, 7), cell(1, 5, 7), cell(1, 4, 8), cell(1, 5, 8),
      cell(7, 1, 4), cell(7, 8, 5), cell(0, 9, 0), cell(0, 0, 9),
      cell(2, 2, 5), cell(2, 7, 4),
    ],
  },
].map((m) => {
  const code = mapCode(m.name, m.theme, m.cells);
  return { ...m, code, seed: true, votes: 12 + m.name.length * 3, at: 0 };
});

const hash = (text) => {
  let h = 7;
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) >>> 0;
  return h.toString(36);
};

function read(uid) {
  const raw = storage.get(KEY(uid), []);
  return Array.isArray(raw) ? raw.filter((m) => m && typeof m.code === 'string') : [];
}

function write(uid, list) {
  storage.set(KEY(uid), list.slice(0, 30));
}

export function localGallery(uid) {
  return read(uid).map((m) => {
    const data = decodeMap(m.code);
    return data ? {
      ...m,
      name: m.name || data.name,
      theme: data.theme,
      cells: data.cells,
      votes: m.votes | 0,
      id: m.id || hash(m.code),
    } : null;
  }).filter(Boolean);
}

function readReports(uid) {
  const raw = storage.get(REPORT_KEY(uid), []);
  return Array.isArray(raw) ? raw.slice(0, 80) : [];
}

export function galleryMaps(uid, remote = []) {
  const seen = new Set();
  const hidden = new Set(readReports(uid));
  const rows = [];
  const add = (m) => {
    if (!m?.code || seen.has(m.code)) return;
    const data = decodeMap(m.code);
    if (!data) return;
    seen.add(m.code);
    const id = m.id || hash(m.code);
    if (hidden.has(id)) return;
    rows.push({
      ...m,
      id,
      name: m.name || data.name,
      theme: data.theme,
      cells: data.cells,
      votes: m.votes | 0,
      seed: !!m.seed,
    });
  };
  for (const m of remote || []) add(m);
  for (const m of localGallery(uid)) add(m);
  for (const m of SEEDS) add(m);
  return rows.sort((a, b) => (a.seed !== b.seed ? a.seed ? 1 : -1 : b.votes - a.votes));
}

export function publishMap(uid, code, author = 'COMMANDER') {
  const data = decodeMap(code);
  if (!data) return { ok: false, why: 'That map code is invalid' };
  const list = read(uid);
  const id = hash(code);
  const existing = list.find((m) => m.code === code || m.id === id);
  if (existing) return { ok: false, why: 'That battlefield is already in your archive' };
  list.unshift({
    id, code, name: data.name, author: String(author || 'COMMANDER').toUpperCase().slice(0, 16),
    votes: 0, at: Date.now(),
  });
  write(uid, list);
  return { ok: true, map: { id, code, name: data.name } };
}

export function voteMap(uid, id) {
  const list = read(uid);
  const hit = list.find((m) => (m.id || hash(m.code)) === id);
  if (!hit) return { ok: false, why: 'Local field archive maps cannot be voted on' };
  if (hit.voted) return { ok: false, why: 'Already voted' };
  hit.voted = true;
  hit.votes = (hit.votes | 0) + 1;
  write(uid, list);
  return { ok: true, votes: hit.votes };
}

export function reportMap(uid, id) {
  if (!id) return { ok: false, why: 'Field not found' };
  const reports = readReports(uid);
  if (reports.includes(id)) return { ok: false, why: 'Already reported' };
  reports.push(id);
  storage.set(REPORT_KEY(uid), reports);
  return { ok: true };
}

export function mapStyle(code) {
  const data = decodeMap(code);
  const theme = THEMES[data?.theme || 0];
  return {
    name: data?.name || 'CUSTOM FIELD',
    theme: theme?.name || 'ASHFORD',
    cells: data?.cells || [],
    grade: theme?.grade || 'rgba(9,20,12,.38)',
  };
}

export function galleryPreview(code) {
  const data = decodeMap(code);
  const cells = new Map((data?.cells || []).map((c) => [`${c.x},${c.y}`, c.i]));
  return `<div class="mg-mini" aria-hidden="true">${Array.from({ length: GRID * GRID }, (_, i) => {
    const x = i % GRID, y = Math.floor(i / GRID);
    const prop = cells.get(`${x},${y}`);
    return `<i class="${prop != null ? 'on' : ''}" style="${prop != null ? `--p:${prop}` : ''}"></i>`;
  }).join('')}</div>`;
}

export { SEEDS, GRID, MAP_PALETTE };
