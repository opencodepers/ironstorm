// Supabase: accounts, persistence, and the realtime arena.

import { SB_URL, SB_KEY, ARENA_CHANNEL, NET } from './config.js';
import { state } from './store.js';

const EMAIL_DOMAIN = 'ironstorm.gg';
const sb = window.supabase.createClient(SB_URL, SB_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
});

export { sb };
export const net = { online: true, arena: null, roster: new Map() };

// ------------------------------------------------------------------
//  Room directory
//  Every player inside a room publishes it on one presence channel, so
//  the server browser can list live rooms and how full they are.
// ------------------------------------------------------------------
const DIR_CHANNEL = 'ironstorm-directory-v1';

export const directory = { rooms: [], synced: false };

let dirChannel = null;
let dirPending = null;
const dirListeners = new Set();

function emitDirectory() {
  if (!dirChannel) return;
  const out = [];
  for (const [key, arr] of Object.entries(dirChannel.presenceState())) {
    if (key === state.uid) continue;
    const meta = arr[0];
    if (!meta?.room) continue;
    out.push({
      uid: key,
      mode: meta.mode || 'deathmatch',
      room: meta.room,
      roomName: meta.roomName || 'ALPHA',
    });
  }
  directory.rooms = out;
  directory.synced = true;
  for (const fn of dirListeners) {
    try { fn(out); } catch { /* ignore */ }
  }
}

function ensureDirectory() {
  if (dirChannel) return dirChannel;
  if (!state.uid) return null;
  dirChannel = sb.channel(DIR_CHANNEL, { config: { presence: { key: state.uid } } });
  dirChannel
    .on('presence', { event: 'sync' }, emitDirectory)
    .on('presence', { event: 'join' }, emitDirectory)
    .on('presence', { event: 'leave' }, emitDirectory)
    .subscribe(async (status) => {
      if (status !== 'SUBSCRIBED') return;
      if (dirPending) {
        try { await dirChannel.track(dirPending); } catch { /* ignore */ }
        dirPending = null;
      }
      emitDirectory();
    });
  return dirChannel;
}

export function watchDirectory(fn) {
  dirListeners.add(fn);
  ensureDirectory();
  fn(directory.rooms);
  return () => dirListeners.delete(fn);
}

export function trackDirectory(meta) {
  dirPending = meta;
  const ch = ensureDirectory();
  if (!ch || ch.state !== 'joined') return;
  try {
    const p = ch.track(meta);
    if (p?.catch) p.catch(() => {});
  } catch { /* presence may be disabled */ }
}

export function untrackDirectory() {
  dirPending = null;
  try { dirChannel?.untrack(); } catch { /* ignore */ }
}

const emailFor = (username) => `${username.toLowerCase()}@${EMAIL_DOMAIN}`;

export function validUsername(u) {
  return /^[A-Za-z0-9_]{3,16}$/.test(u);
}

function friendly(message = '') {
  const m = message.toLowerCase();
  if (m.includes('invalid login')) return 'Wrong callsign or password.';
  if (m.includes('already registered') || m.includes('already been registered')) return 'That callsign is taken.';
  if (m.includes('password should be at least')) return 'Password must be at least 6 characters.';
  if (m.includes('email not confirmed')) return 'Email confirmation is pending on this project.';
  if (m.includes('rate limit')) return 'Too many attempts. Wait a minute and try again.';
  if (m.includes('failed to fetch') || m.includes('network')) return 'No connection to command.';
  return message || 'Something went wrong.';
}

export async function currentSession() {
  const { data } = await sb.auth.getSession();
  return data?.session ?? null;
}

export async function signUp(username, password) {
  if (!validUsername(username)) {
    return { ok: false, error: 'Callsign: 3-16 letters, numbers or underscores.' };
  }
  if ((password || '').length < 6) return { ok: false, error: 'Password must be at least 6 characters.' };

  const { data, error } = await sb.auth.signUp({
    email: emailFor(username),
    password,
    options: { data: { username } },
  });
  if (error) return { ok: false, error: friendly(error.message) };
  // Supabase returns a decoy user with an empty identities array when the
  // address is already registered.
  if (data?.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
    return { ok: false, error: 'That callsign is taken.' };
  }
  if (!data?.session) {
    return { ok: false, error: 'Account created but not signed in. Try signing in.' };
  }
  const profile = await fetchProfile(data.user.id);
  if (!profile) return { ok: false, error: 'Account created. Please sign in.' };
  return { ok: true, uid: data.user.id, row: profile };
}

export async function signIn(username, password) {
  if (!username || !password) return { ok: false, error: 'Callsign and password are required.' };
  const { data, error } = await sb.auth.signInWithPassword({
    email: emailFor(username),
    password,
  });
  if (error) return { ok: false, error: friendly(error.message) };
  const profile = await fetchProfile(data.user.id);
  if (!profile) return { ok: false, error: 'Profile not found for that account.' };
  return { ok: true, uid: data.user.id, row: profile };
}

export async function signOut() {
  try { await sb.auth.signOut(); } catch { /* ignore */ }
}

export async function fetchProfile(uid, tries = 6) {
  for (let i = 0; i < tries; i++) {
    const { data, error } = await sb.from('profiles').select('*').eq('id', uid).maybeSingle();
    if (!error && data) return data;
    await new Promise((r) => setTimeout(r, 250));
  }
  return null;
}

export async function loadCatalog() {
  const { data, error } = await sb.from('tanks').select('id, price, unlock_level');
  if (error || !data) return {};
  const out = {};
  for (const t of data) out[t.id] = { price: t.price, unlock_level: t.unlock_level };
  return out;
}

export async function fetchLeaderboard(metric = 'kills') {
  const col = ['kills', 'wins', 'level', 'best_score', 'kd'].includes(metric) ? metric : 'kills';
  const { data, error } = await sb
    .from('leaderboard')
    .select('username,level,kills,deaths,wins,matches,best_score,kd')
    .order(col, { ascending: false })
    .limit(50);
  if (error) return { ok: false, rows: [] };
  return { ok: true, rows: data || [] };
}

export async function recordMatch({ kills, deaths, score, won, mode }) {
  const { data, error } = await sb.rpc('record_match', {
    p_kills: Math.round(kills),
    p_deaths: Math.round(deaths),
    p_score: Math.round(score),
    p_won: !!won,
    p_mode: mode || 'deathmatch',
  });
  if (error) return { ok: false, error: friendly(error.message) };
  return { ok: true, row: data };
}

export async function claimContract(index) {
  const { data, error } = await sb.rpc('claim_contract', { p_index: index });
  if (error) return { ok: false, error: friendly(error.message) };
  return { ok: true, row: data };
}

export async function unlockRankCrate() {
  const { data, error } = await sb.rpc('unlock_rank_crate');
  if (error) return { ok: false, error: friendly(error.message) };
  return { ok: true, row: data };
}

export async function buyUpgrade(key) {
  const { data, error } = await sb.rpc('buy_upgrade', { p_key: key });
  if (error) return { ok: false, error: friendly(error.message) };
  return { ok: true, row: data };
}

export async function buySkin(id) {
  const { data, error } = await sb.rpc('buy_skin', { p_skin: id });
  if (error) return { ok: false, error: friendly(error.message) };
  return { ok: true, row: data };
}

export async function equipSkin(id) {
  const { data, error } = await sb.rpc('equip_skin', { p_skin: id });
  if (error) return { ok: false, error: friendly(error.message) };
  return { ok: true, row: data };
}

export async function claimDaily() {
  const { data, error } = await sb.rpc('claim_daily');
  if (error) return { ok: false, error: friendly(error.message) };
  return { ok: true, reward: data?.reward ?? 0, row: data?.profile || null };
}

export async function buyTank(id) {
  const { data, error } = await sb.rpc('buy_tank', { p_tank: id });
  if (error) return { ok: false, error: friendly(error.message) };
  return { ok: true, row: data };
}

export async function equipTank(id) {
  const { data, error } = await sb.rpc('equip_tank', { p_tank: id });
  if (error) return { ok: false, error: friendly(error.message) };
  return { ok: true, row: data };
}

// ------------------------------------------------------------------
//  Realtime arena
// ------------------------------------------------------------------
export function connectArena(handlers = {}, room = null) {
  if (!state.uid) return { ok: false, error: 'not signed in', leave() {} };
  const isGuest = state.mode === 'guest';
  const uid = state.uid;
  const p = state.profile;
  const channelName = room?.key ? `${ARENA_CHANNEL}:${room.key}` : ARENA_CHANNEL;

  const channel = sb.channel(channelName, {
    config: {
      broadcast: { self: false, ack: false },
      presence: { key: uid },
    },
  });

  const meta = {
    uid,
    name: p.username,
    tank: p.tank,
    level: p.level,
    guest: isGuest,
    squad: state.settings.squad || '',
    mode: room?.mode || 'deathmatch',
    room: room?.key || '',
    roomName: room?.name || '',
  };

  channel
    .on('presence', { event: 'sync' }, () => {
      const m = new Map();
      for (const [key, arr] of Object.entries(channel.presenceState())) {
        const first = arr[0];
        if (first && key !== uid) m.set(key, first);
      }
      net.roster = m;
      handlers.onRoster?.(m);
    })
    .on('presence', { event: 'join' }, ({ key, newPresences }) => {
      if (key === uid) return;
      handlers.onJoin?.(newPresences?.[0]);
    })
    .on('presence', { event: 'leave' }, ({ key }) => {
      handlers.onLeave?.(key);
    })
    .on('broadcast', { event: 'state' }, ({ payload }) => {
      if (payload && payload.i && payload.i !== uid) handlers.onState?.(payload);
    })
    .on('broadcast', { event: 'fire' }, ({ payload }) => {
      if (payload && payload.i !== uid) handlers.onFire?.(payload);
    })
    .on('broadcast', { event: 'dmg' }, ({ payload }) => {
      if (payload && payload.to === uid) handlers.onDamage?.(payload);
    })
    .on('broadcast', { event: 'kill' }, ({ payload }) => {
      if (payload) handlers.onKill?.(payload);
    })
    .on('broadcast', { event: 'chat' }, ({ payload }) => {
      if (payload) handlers.onChat?.(payload);
    })
    // Presence handshake over broadcast as well: reliable on projects where
    // realtime presence is disabled, and harmless when it is enabled.
    .on('broadcast', { event: 'join' }, ({ payload }) => {
      if (!payload?.uid || payload.uid === uid) return;
      handlers.onJoin?.(payload);
      send('hello', meta);
    })
    .on('broadcast', { event: 'hello' }, ({ payload }) => {
      if (!payload?.uid || payload.uid === uid) return;
      handlers.onJoin?.(payload);
    })
    .on('broadcast', { event: 'bye' }, ({ payload }) => {
      if (payload?.uid && payload.uid !== uid) handlers.onLeave?.(payload.uid);
    });

  let sendTimer = null;
  let lastSend = 0;

  channel.subscribe(async (status) => {
    net.online = status === 'SUBSCRIBED';
    if (status === 'SUBSCRIBED') {
      try { await channel.track(meta); } catch { /* presence may be disabled */ }
      if (room?.key) {
        trackDirectory({
          mode: room.mode,
          room: room.key,
          roomName: room.name,
          name: p.username,
          level: p.level,
        });
      }
      send('join', meta);
      handlers.onReady?.();
    } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
      handlers.onError?.(status);
    }
  });

  const send = (event, payload) => {
    if (!channel) return;
    channel.send({ type: 'broadcast', event, payload }).catch(() => {});
  };

  return {
    ok: true,
    channel,
    uid,
    meta,
    ready: () => net.online,
    playerCount: () => net.roster.size + 1,
    sendState(payload) {
      const now = performance.now();
      if (now - lastSend < 1000 / NET.sendHz) return;
      lastSend = now;
      send('state', { ...payload, i: uid, n: p.username, t: p.tank, l: p.level });
    },
    sendFire(payload) { send('fire', { ...payload, i: uid }); },
    sendDamage(payload) { send('dmg', { ...payload, from: uid, fromName: p.username }); },
    sendKill(payload) { send('kill', { ...payload, killer: uid, killerName: p.username }); },
    sendChat(text) { send('chat', { from: p.username, text: String(text).slice(0, 120), t: Date.now() }); },
    leave() {
      if (sendTimer) clearInterval(sendTimer);
      untrackDirectory();
      send('bye', { uid });
      try { channel.untrack(); } catch { /* ignore */ }
      try { sb.removeChannel(channel); } catch { /* ignore */ }
      net.online = true;
      net.roster = new Map();
    },
  };
}
