// Vehicle catalogue + camo + upgrade maths. Mirrors public.tanks / public.skins
// in Supabase (the price shown here is replaced by the database value once
// the catalogue is fetched).

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
  churchill: {
    id: 'churchill', name: 'CHURCHILL VII', klass: 'HEAVY',
    body: 'tankBody_green', barrel: 'tankGreen_barrel1', tint: '#7fa868',
    hp: 215, speed: 132, accel: 440, turn: 2.3, damage: 37, reload: 0.92,
    shellSpeed: 740, spread: 0.03, radius: 37, price: 1400, unlock: 2,
    blurb: 'A rolling bunker. Absurd armour, modest gun, unbothered by hills.',
  },
  t34: {
    id: 't34', name: 'T-34/85', klass: 'MEDIUM',
    body: 'tankBody_dark', barrel: 'tankDark_barrel3', tint: '#8ea37f',
    hp: 135, speed: 186, accel: 610, turn: 2.7, damage: 31, reload: 0.78,
    shellSpeed: 820, spread: 0.03, radius: 32, price: 1800, unlock: 3,
    blurb: 'Sloped armour and a long 85 mm gun. Never stops rolling.',
  },
  pershing: {
    id: 'pershing', name: 'M26 PERSHING', klass: 'MEDIUM',
    body: 'tankBody_dark', barrel: 'tankDark_barrel2', tint: '#93a58f',
    hp: 168, speed: 168, accel: 545, turn: 2.5, damage: 43, reload: 0.9,
    shellSpeed: 880, spread: 0.022, radius: 34, price: 2600, unlock: 4,
    blurb: 'American heavy-medium. Punchy 90 mm with a stable hull.',
  },
  panther: {
    id: 'panther', name: 'PANTHER', klass: 'MEDIUM',
    body: 'tankBody_darkLarge', barrel: 'tankDark_barrel2', tint: '#9fb0bd',
    hp: 160, speed: 178, accel: 560, turn: 2.4, damage: 40, reload: 0.95,
    shellSpeed: 940, spread: 0.018, radius: 35, price: 3000, unlock: 5,
    blurb: 'High-velocity 75 mm. Punishes anything caught in the open.',
  },
  is2: {
    id: 'is2', name: 'IS-2', klass: 'HEAVY',
    body: 'tankBody_red', barrel: 'tankRed_barrel3', tint: '#b06a58',
    hp: 208, speed: 152, accel: 480, turn: 2.1, damage: 58, reload: 1.35,
    shellSpeed: 800, spread: 0.028, radius: 38, price: 4200, unlock: 6,
    blurb: 'A 122 mm sledgehammer. One shell changes a duel.',
  },
  tiger: {
    id: 'tiger', name: 'TIGER I', klass: 'HEAVY',
    body: 'tankBody_bigRed', barrel: 'tankRed_barrel2', tint: '#c07a5c',
    hp: 195, speed: 148, accel: 470, turn: 2.0, damage: 48, reload: 1.15,
    shellSpeed: 880, spread: 0.025, radius: 38, price: 5200, unlock: 8,
    blurb: 'Heavy armour, devastating 88 mm. Slow to swing the hull.',
  },
  leopard: {
    id: 'leopard', name: 'LEOPARD 1', klass: 'LIGHT',
    body: 'tankBody_blue', barrel: 'tankBlue_barrel2', tint: '#6f9dc4',
    hp: 122, speed: 234, accel: 730, turn: 3.4, damage: 35, reload: 0.6,
    shellSpeed: 980, spread: 0.026, radius: 29, price: 5600, unlock: 9,
    blurb: 'Cold-war speed demon. Outrun everything, out-armour nothing.',
  },
  jagdpanther: {
    id: 'jagdpanther', name: 'JAGDPANTHER', klass: 'TANK DESTROYER',
    body: 'tankBody_darkLarge', barrel: 'tankDark_barrel3', tint: '#8b9a86',
    hp: 172, speed: 164, accel: 520, turn: 2.2, damage: 66, reload: 1.5,
    shellSpeed: 1020, spread: 0.014, radius: 36, price: 7200, unlock: 10,
    blurb: 'Long 88 in a low casemate. Deletes tanks that show a flank.',
  },
  maus: {
    id: 'maus', name: 'MAUS', klass: 'SUPER HEAVY',
    body: 'tankBody_huge', barrel: 'tankSand_barrel1', tint: '#cfae6e',
    hp: 250, speed: 118, accel: 400, turn: 1.6, damage: 54, reload: 1.4,
    shellSpeed: 840, spread: 0.02, radius: 44, price: 9000, unlock: 12,
    blurb: 'A bunker with tracks. Absorbs punishment and deals it back.',
  },
  kv2: {
    id: 'kv2', name: 'KV-2', klass: 'SIEGE',
    body: 'tankBody_huge', barrel: 'tankSand_barrel3', tint: '#c2a87f',
    hp: 268, speed: 120, accel: 380, turn: 1.5, damage: 78, reload: 1.9,
    shellSpeed: 700, spread: 0.04, radius: 44, price: 11000, unlock: 13,
    blurb: 'A 152 mm howitzer on a tower. Reloads slowly. Ends arguments.',
  },
};

export const TANK_ORDER = [
  'sherman', 'crusader', 'churchill', 't34', 'pershing', 'panther',
  'is2', 'tiger', 'leopard', 'jagdpanther', 'maus', 'kv2',
];

// ------------------------------------------------------------------
//  Camouflage — applied to the sprite as a canvas filter, so every
//  skin works on every vehicle without new art.
// ------------------------------------------------------------------
export const SKINS = {
  olive: {
    id: 'olive', name: 'FIELD OLIVE', rarity: 'STANDARD',
    filter: 'none', price: 0, unlock: 1, swatch: '#8fbf5e',
    blurb: 'Factory finish. Issued to every new commander.',
  },
  desert: {
    id: 'desert', name: 'DESERT RAT', rarity: 'STANDARD',
    filter: 'sepia(.6) saturate(1.5) hue-rotate(-18deg) brightness(1.12)',
    price: 600, unlock: 1, swatch: '#d8bd7a',
    blurb: 'Sun-bleached tan for open sand and bad ideas.',
  },
  winter: {
    id: 'winter', name: 'WINTER WHITE', rarity: 'STANDARD',
    filter: 'grayscale(.8) brightness(1.5) contrast(.9)',
    price: 1200, unlock: 3, swatch: '#dfe7e2',
    blurb: 'Snow camo. Hard to spot, harder to miss.',
  },
  night: {
    id: 'night', name: 'NIGHT OPS', rarity: 'RARE',
    filter: 'saturate(.22) brightness(.66) contrast(1.22)',
    price: 1800, unlock: 5, swatch: '#3f5d6b',
    blurb: 'Low-signature graphite for night rotations.',
  },
  crimson: {
    id: 'crimson', name: 'CRIMSON GUARD', rarity: 'RARE',
    filter: 'sepia(1) saturate(4.2) hue-rotate(-22deg) brightness(.95)',
    price: 2600, unlock: 7, swatch: '#b8493c',
    blurb: 'Parade red. Everyone sees you coming.',
  },
  toxic: {
    id: 'toxic', name: 'TOXIC', rarity: 'RARE',
    filter: 'sepia(1) saturate(3.4) hue-rotate(28deg) brightness(1.12)',
    price: 3200, unlock: 9, swatch: '#9fd83c',
    blurb: 'Chemical-yellow hazard scheme. Illegal in four sectors.',
  },
  chrome: {
    id: 'chrome', name: 'CHROME', rarity: 'ELITE',
    filter: 'grayscale(1) brightness(1.55) contrast(1.3)',
    price: 4600, unlock: 11, swatch: '#c9d2d6',
    blurb: 'Polished steel. Reflects the explosion you caused.',
  },
  gold: {
    id: 'gold', name: 'GILDED', rarity: 'ELITE',
    filter: 'sepia(1) saturate(3.2) hue-rotate(-12deg) brightness(1.2)',
    price: 6400, unlock: 14, swatch: '#e8c96a',
    blurb: 'Solid-gold plating. Pure provocation.',
  },
};

export const SKIN_ORDER = ['olive', 'desert', 'winter', 'night', 'crimson', 'toxic', 'chrome', 'gold'];

export const skinFor = (id) => SKINS[id] || SKINS.olive;
export const skinCss = (id) => skinFor(id).filter || 'none';

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
export const skinCost = (id) => skinFor(id).price;

export function deriveStats(tankId, upgrades = {}, skinId = 'olive') {
  const t = TANKS[tankId] || TANKS.sherman;
  const u = (k) => Math.min(5, Math.max(0, upgrades?.[k] | 0));
  const fp = u('firepower'), ar = u('armor'), en = u('engine'), rl = u('reload'), tr = u('tracks');
  return {
    ...t,
    skin: skinId,
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
