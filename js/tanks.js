// Vehicle catalogue + upgrade maths. Mirrors public.tanks in Supabase
// (id / price / unlock level); the price shown here is replaced by the
// database value once the catalogue is fetched.

export const TANKS = {
  sherman: {
    id: 'sherman', name: 'M4 SHERMAN', klass: 'MEDIUM',
    body: 'tankBody_green', barrel: 'tankGreen_barrel2', tint: '#8fbf5e',
    hp: 110, speed: 172, accel: 560, turn: 2.9, damage: 26, reload: 0.62,
    shellSpeed: 780, spread: 0.035, radius: 30, price: 0, unlock: 1,
    blurb: 'The dependable workhorse. Balanced armour, firepower and mobility.',
  },
  crusader: {
    id: 'crusader', name: 'CRUSADER', klass: 'LIGHT',
    body: 'tankBody_sand', barrel: 'tankSand_barrel1', tint: '#d8bd7a',
    hp: 88, speed: 214, accel: 690, turn: 3.5, damage: 19, reload: 0.42,
    shellSpeed: 760, spread: 0.05, radius: 27, price: 900, unlock: 1,
    blurb: 'Fast scout tank. Paper armour, vicious rate of fire.',
  },
  t34: {
    id: 't34', name: 'T-34/85', klass: 'MEDIUM',
    body: 'tankBody_dark', barrel: 'tankDark_barrel3', tint: '#8ea37f',
    hp: 135, speed: 186, accel: 610, turn: 2.7, damage: 31, reload: 0.78,
    shellSpeed: 820, spread: 0.03, radius: 32, price: 1800, unlock: 3,
    blurb: 'Sloped armour and a long 85 mm gun. Never stops rolling.',
  },
  panther: {
    id: 'panther', name: 'PANTHER', klass: 'MEDIUM',
    body: 'tankBody_darkLarge', barrel: 'tankDark_barrel2', tint: '#9fb0bd',
    hp: 160, speed: 178, accel: 560, turn: 2.4, damage: 40, reload: 0.95,
    shellSpeed: 940, spread: 0.018, radius: 35, price: 3000, unlock: 5,
    blurb: 'High-velocity 75 mm. Punishes anything caught in the open.',
  },
  tiger: {
    id: 'tiger', name: 'TIGER I', klass: 'HEAVY',
    body: 'tankBody_bigRed', barrel: 'tankRed_barrel2', tint: '#c07a5c',
    hp: 195, speed: 148, accel: 470, turn: 2.0, damage: 48, reload: 1.15,
    shellSpeed: 880, spread: 0.025, radius: 38, price: 5200, unlock: 8,
    blurb: 'Heavy armour, devastating 88 mm. Slow to swing the hull.',
  },
  maus: {
    id: 'maus', name: 'MAUS', klass: 'SUPER HEAVY',
    body: 'tankBody_huge', barrel: 'tankSand_barrel3', tint: '#cfae6e',
    hp: 250, speed: 118, accel: 400, turn: 1.6, damage: 54, reload: 1.4,
    shellSpeed: 840, spread: 0.02, radius: 44, price: 9000, unlock: 12,
    blurb: 'A bunker with tracks. Absorbs punishment and deals it back.',
  },
};

export const TANK_ORDER = ['sherman', 'crusader', 't34', 'panther', 'tiger', 'maus'];

export const UPGRADES = {
  firepower: {
    name: 'FIREPOWER', icon: 'bolt', max: 5,
    desc: (l) => `+${(l * 7).toFixed(0)}% shell damage`,
    per: 'Shell damage',
  },
  armor: {
    name: 'ARMOUR', icon: 'shield', max: 5,
    desc: (l) => `+${(l * 9).toFixed(0)}% hull integrity`,
    per: 'Hull integrity',
  },
  engine: {
    name: 'ENGINE', icon: 'engine', max: 5,
    desc: (l) => `+${(l * 6).toFixed(0)}% speed & acceleration`,
    per: 'Speed',
  },
  reload: {
    name: 'AUTOLOADER', icon: 'reload', max: 5,
    desc: (l) => `-${(l * 6).toFixed(0)}% reload time`,
    per: 'Reload time',
  },
  tracks: {
    name: 'TRACKS', icon: 'tracks', max: 5,
    desc: (l) => `+${(l * 8).toFixed(0)}% hull traverse`,
    per: 'Hull traverse',
  },
};

export const UPGRADE_ORDER = ['firepower', 'armor', 'engine', 'reload', 'tracks'];

export const upgradeCost = (level) => Math.round(160 * Math.pow(Math.max(level, 1), 1.4));

export function deriveStats(tankId, upgrades = {}) {
  const t = TANKS[tankId] || TANKS.sherman;
  const u = (k) => Math.min(5, Math.max(0, upgrades?.[k] | 0));
  const fp = u('firepower'), ar = u('armor'), en = u('engine'), rl = u('reload'), tr = u('tracks');
  return {
    ...t,
    hp: Math.round(t.hp * (1 + ar * 0.09)),
    speed: t.speed * (1 + en * 0.06),
    accel: t.accel * (1 + en * 0.06),
    turn: t.turn * (1 + tr * 0.08),
    damage: +(t.damage * (1 + fp * 0.07)).toFixed(1),
    reload: +(t.reload * (1 - rl * 0.06)).toFixed(3),
  };
}

// xp needed to reach level L: 100 * (L-1)^2
export const xpForLevel = (lvl) => 100 * Math.pow(Math.max(lvl - 1, 0), 2);
export const levelForXp = (xp) => Math.floor(Math.sqrt(Math.max(xp, 0) / 100)) + 1;
export function levelProgress(xp) {
  const lvl = levelForXp(xp);
  const start = xpForLevel(lvl), end = xpForLevel(lvl + 1);
  return { level: lvl, pct: Math.min(1, (xp - start) / Math.max(end - start, 1)), next: end - xp };
}
