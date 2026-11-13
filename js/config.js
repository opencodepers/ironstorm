// ------------------------------------------------------------------
//  IronStorm — build configuration
// ------------------------------------------------------------------

// Supabase project (public anon key — row level security protects data)
export const SB_URL = 'https://tooaxcbdajbhkqzbwoae.supabase.co';
export const SB_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRvb2F4Y2JkYWpiaGtxemJ3b2FlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQ1ODcyMDcsImV4cCI6MjExMDE2MzIwN30.v-ufL3-TbpnfvW_aiXGC1C-ra0NNVkyJ-j7UFaH4Hno';

export const ARENA_CHANNEL = 'ironstorm-arena-v1';
export const SAVE_KEY = 'ironstorm.save.v1';
export const SETTINGS_KEY = 'ironstorm.settings.v1';

export const WORLD = {
  size: 2600,       // arena is square
  tile: 128,        // terrain tile size
  wall: 46,         // boundary thickness
};

export const NET = {
  sendHz: 10,       // our state broadcast rate
  interp: 110,      // ms of interpolation buffer for remote tanks
};

export const DEFAULT_SETTINGS = {
  music: 0.3,
  sfx: 0.8,
  shake: 1,
  showFps: false,
  showNames: true,
  bots: 6,
};

export const PALETTE = [
  '#8fbf5e', '#5ec8c4', '#e0b44a', '#c46a5a',
  '#9b8cd6', '#d98cc0', '#6fa8dc', '#d6d2b4',
];
