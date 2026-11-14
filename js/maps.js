// ------------------------------------------------------------------
//  Maps — four authored battlegrounds. Each one changes the terrain
//  mix, the clutter density and a set of fixed landmarks, so the same
//  2600 arena plays differently. Map choice is a room rule.
// ------------------------------------------------------------------

import { WORLD } from './config.js';
import { communityDef } from './community.js';

const L = (x, y, type, size, opts = {}) => ({ x, y, type, size, opts });

// Landmarks are absolute positions in the arena. Keep the centre and the
// eight spawns readable — these frame the fight rather than block it.
export const MAP_DEFS = {
  ashford: {
    id: 'ashford',
    name: 'ASHFORD RIDGE',
    tagline: 'Burnt convoys and broken cover',
    grade: 'rgba(9, 20, 12, 0.38)',
    tint: 'rgba(120, 150, 90, 0.05)',
    sand: 10,
    clutter: 1,
    landmarks: [
      L(760, 760, 'barricadeMetal', 56), L(820, 760, 'barricadeMetal', 56),
      L(1840, 760, 'crateWood', 56, { destructible: true, hp: 45 }),
      L(1840, 820, 'crateWood', 56, { destructible: true, hp: 45 }),
      L(760, 1840, 'sandbagBrown', 56), L(820, 1840, 'sandbagBrown', 56),
      L(1840, 1840, 'barrelRed_top', 44, { destructible: true, hp: 18, explosive: true, radius: 20 }),
      L(1900, 1840, 'barrelGreen_top', 44, { destructible: true, hp: 18, explosive: true, radius: 20 }),
      L(1300, 780, 'fenceYellow', 56), L(1300, 1820, 'fenceRed', 56),
    ],
  },
  frozen: {
    id: 'frozen',
    name: 'FROZEN CROSSING',
    tagline: 'Open ice, frozen cover',
    grade: 'rgba(24, 38, 44, 0.36)',
    tint: 'rgba(150, 200, 220, 0.09)',
    sand: 15,
    clutter: 0.8,
    landmarks: [
      L(900, 1300, 'fenceRed', 56), L(960, 1300, 'fenceRed', 56), L(1020, 1300, 'fenceRed', 56),
      L(1700, 1300, 'fenceYellow', 56), L(1640, 1300, 'fenceYellow', 56), L(1580, 1300, 'fenceYellow', 56),
      L(1300, 900, 'treeGreen_small', 96, { radius: 20 }),
      L(1300, 1700, 'treeGreen_small', 96, { radius: 20 }),
      L(700, 700, 'crateMetal', 64, { destructible: true, hp: 70 }),
      L(1900, 1900, 'crateMetal', 64, { destructible: true, hp: 70 }),
    ],
  },
  dunes: {
    id: 'dunes',
    name: 'DUNE BASIN',
    tagline: 'Long sightlines, soft cover',
    grade: 'rgba(44, 34, 14, 0.24)',
    tint: 'rgba(200, 170, 110, 0.12)',
    sand: 22,
    clutter: 0.85,
    landmarks: [
      L(820, 980, 'sandbagBeige', 56), L(820, 1040, 'sandbagBeige', 56), L(820, 1100, 'sandbagBeige', 56),
      L(1780, 1560, 'sandbagBeige', 56), L(1780, 1620, 'sandbagBeige', 56),
      L(980, 1780, 'barrelBlack_top', 44, { destructible: true, hp: 18, explosive: true, radius: 20 }),
      L(1620, 820, 'barrelBlack_top', 44, { destructible: true, hp: 18, explosive: true, radius: 20 }),
      L(1300, 620, 'sandbagBrown', 56), L(1300, 1980, 'sandbagBrown', 56),
    ],
  },
  harbour: {
    id: 'harbour',
    name: 'ASH HARBOUR',
    tagline: 'Tight corners, industrial cover',
    grade: 'rgba(8, 20, 22, 0.42)',
    tint: 'rgba(90, 140, 150, 0.07)',
    sand: 5,
    clutter: 1.15,
    landmarks: [
      L(780, 900, 'crateMetal', 64, { destructible: true, hp: 70 }),
      L(844, 900, 'crateMetal', 64, { destructible: true, hp: 70 }),
      L(780, 964, 'crateMetal', 64, { destructible: true, hp: 70 }),
      L(1820, 1640, 'crateWood', 56, { destructible: true, hp: 45 }),
      L(1884, 1640, 'crateWood', 56, { destructible: true, hp: 45 }),
      L(1820, 1704, 'crateWood', 56, { destructible: true, hp: 45 }),
      L(960, 1700, 'barrelGreen_top', 44, { destructible: true, hp: 18, explosive: true, radius: 20 }),
      L(1640, 900, 'barrelRed_top', 44, { destructible: true, hp: 18, explosive: true, radius: 20 }),
      L(1300, 700, 'barricadeMetal', 56), L(1300, 1900, 'barricadeMetal', 56),
    ],
  },
};

export const MAP_LIST = ['ashford', 'frozen', 'dunes', 'harbour'];

export function mapFor(id) {
  if (typeof id === 'string' && id.startsWith('IS1.')) {
    const made = communityDef(id);
    if (made) return made;
  }
  return MAP_DEFS[id] || MAP_DEFS[hashMap(id)];
}

// Rooms without an explicit map rotate by name, so two servers feel different.
export function hashMap(name = '') {
  let h = 0;
  const s = String(name);
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return MAP_LIST[h % MAP_LIST.length];
}

export function pickMap(name) {
  return MAP_DEFS[hashMap(name)];
}

export const MAP_CENTER = { x: WORLD.size / 2, y: WORLD.size / 2 };
