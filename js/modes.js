// ------------------------------------------------------------------
//  Game modes — single source of truth for the landing, menu and arena
// ------------------------------------------------------------------

export const MODES = {
  deathmatch: {
    id: 'deathmatch',
    name: 'DEATHMATCH',
    tag: 'FREE-FOR-ALL',
    icon: 'skull',
    blurb: 'Every commander for themselves. Most kills takes the sector.',
    rules: 'FIRST TO 25 KILLS',
    objective: 'KILLS',
    target: 25,
    duration: 240,
    bots: 7,
    teams: false,
    accent: '#8fe86b',
    reward: 1,
  },
  team: {
    id: 'team',
    name: 'TEAM BATTLE',
    tag: 'GREEN VS RED',
    icon: 'target',
    blurb: 'Two squadrons, one arena. Push the line with your squadron.',
    rules: 'FIRST TO 60 TEAM KILLS',
    objective: 'TEAM KILLS',
    target: 60,
    duration: 300,
    bots: 10,
    teams: true,
    accent: '#63b3ff',
    reward: 1.25,
  },
  koth: {
    id: 'koth',
    name: 'KING OF THE HILL',
    tag: 'HOLD THE ZONE',
    icon: 'trophy',
    blurb: 'Fight for the central objective. Control it to bleed points.',
    rules: 'FIRST TO 100 POINTS',
    objective: 'ZONE PTS',
    target: 100,
    duration: 240,
    bots: 9,
    teams: true,
    zone: true,
    accent: '#e8c96a',
    reward: 1.35,
  },
  survival: {
    id: 'survival',
    name: 'SURVIVAL',
    tag: 'ENDLESS WAVES',
    icon: 'shield',
    blurb: 'Outnumbered and outgunned. Three lives against endless waves.',
    rules: 'SURVIVE THE WAVES',
    objective: 'WAVE',
    target: 0,
    duration: 0,
    bots: 4,
    teams: false,
    waves: true,
    accent: '#e0806a',
    reward: 1.5,
  },
};

export const MODE_ORDER = ['deathmatch', 'team', 'koth', 'survival'];

export const modeFor = (id) => MODES[id] || MODES.deathmatch;

export const MODE_ICONS = {
  skull: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a7 7 0 0 0-4.2 12.6V19h8.4v-3.4A7 7 0 0 0 12 3z"/><circle cx="9.2" cy="11" r="1.3" fill="currentColor" stroke="none"/><circle cx="14.8" cy="11" r="1.3" fill="currentColor" stroke="none"/><path d="M9.6 19v2M14.4 19v2"/></svg>',
  target: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/><path d="M12 1.5v3M12 19.5v3M1.5 12h3M19.5 12h3" stroke-linecap="round"/></svg>',
  trophy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M8 3.6h8v5.2a4 4 0 0 1-8 0V3.6z"/><path d="M8 5H5.2v1.9A3.1 3.1 0 0 0 8 10M16 5h2.8v1.9A3.1 3.1 0 0 1 16 10"/><path d="M10.2 20.4h3.6M12 12.9v7.5"/></svg>',
  shield: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M12 2.8 4.5 6v6.1c0 4.4 3.1 7.6 7.5 9.1 4.4-1.5 7.5-4.7 7.5-9.1V6z"/><path d="M9 12.1l2.1 2.1 4-4.2"/></svg>',
};
