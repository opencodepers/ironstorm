// ------------------------------------------------------------------
//  IronStorm — bootstrap & screen routing
// ------------------------------------------------------------------

import { loadAll, assetState } from './assets.js';
import { audio } from './audio.js';
import { state, startGuest, startAccount, loadSettings, fromRow, applyMatchRewards, setSquad } from './store.js';
import * as net from './net.js';
import { Arena } from './game.js';
import {
  initMenu, refreshMenu, startPreview, stopPreview, showReport,
  bindAuth, showAuthScreen, toast, closePane, openPane, openBriefing,
} from './menu.js';
import { initInstall, maybeOfferInstall } from './install.js';
import { myRegiment, joinRegiment, adoptRegiment } from './regiments.js';
import { initLanding, showLanding, hideLanding, setMode, selectedMode } from './landing.js';
import { makeRoom, quickRoom } from './rooms.js';
import { modeFor } from './modes.js';
import { loadLocal, noteMatch, saveLocal } from './progress.js';
import { applyRankedMatch, rankedRoomName } from './ranked.js';
import { weekPoints } from './season.js';
import { setLang } from './i18n.js';
import { $, storage } from './util.js';

const app = { arena: null };
let pendingRoom = null;
let pendingReg = null;
const onDirectory = () => {};
const onLobby = () => {};

// Never let a dead uplink hold the boot screen open.
const withTimeout = (promise, ms, fallback) => Promise.race([
  Promise.resolve(promise).catch(() => fallback),
  new Promise((resolve) => setTimeout(() => resolve(fallback), ms)),
]);

function trackLobbyPresence(room) {
  if (!state.profile || !state.uid) return;
  net.trackLobby({
    name: state.profile.username,
    level: state.profile.level,
    room: room?.key || '',
    roomName: room?.name || '',
    mode: room?.mode || modeFor(state.settings.mode).id,
    wp: state.local ? weekPoints(state.local.weekly) : 0,
    tank: state.profile.tank,
    reg: state.regiment?.code || '',
    regTag: state.regiment?.tag || '',
    regName: state.regiment?.name || '',
    at: Date.now(),
  });
}

let refreshingForUpdate = false;
function registerServiceWorker() {
  try {
    if (!('serviceWorker' in navigator)) return;
    if (!location.protocol.startsWith('http')) return;
    const hadController = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      // A new worker has claimed this page. Reload once so HTML and CSS
      // always come from the same build, never a stale/mixed pair.
      if (!hadController || refreshingForUpdate) return;
      refreshingForUpdate = true;
      location.reload();
    });
    navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' })
      .then((reg) => { reg.update().catch(() => {}); })
      .catch(() => { /* offline shell is optional */ });
  } catch { /* sandboxed embeds cannot register a service worker */ }
}

function setScreen(name) {
  for (const id of ['screen-landing', 'screen-auth', 'screen-menu', 'screen-game']) {
    $('#' + id)?.classList.toggle('hidden', id !== name);
  }
}

function showMenu() {
  hideLanding();
  setScreen('screen-menu');
  refreshMenu();
  stopPreview();
  startPreview();
  // Keep the room directory and friend presence warm.
  if (state.uid) {
    net.watchDirectory(onDirectory);
    net.watchLobby(onLobby);
    trackLobbyPresence(null);
  }
  if (pendingRoom && state.profile) {
    const invite = pendingRoom;
    pendingRoom = null;
    const params = new URLSearchParams(location.search);
    params.delete('room');
    params.delete('mode');
    params.delete('pass');
    history.replaceState(null, '', location.pathname + (params.toString() ? `?${params}` : '') + location.hash);
    const rules = invite.passcode ? { private: true, passcode: invite.passcode } : null;
    setTimeout(() => startArena(makeRoom(invite.mode, invite.name, rules)), 420);
  }
}

async function boot() {
  loadSettings();
  setLang(state.settings.lang || 'en');
  audio.set(state.settings);
  registerServiceWorker();
  initInstall();

  const params = new URLSearchParams(location.search);
  const regCode = params.get('reg');
  if (regCode) {
    pendingReg = {
      code: regCode,
      meta: {
        name: params.get('rname') || '',
        tag: params.get('rtag') || '',
      },
    };
  }
  // ?room=NAME&mode=warzone — a friend invite drops straight into a server.
  const invitedRoom = params.get('room');
  if (invitedRoom) {
    pendingRoom = {
      name: invitedRoom,
      mode: modeFor(params.get('mode') || 'deathmatch').id,
      passcode: params.get('pass') || '',
    };
  }

  // ?squad=ABCD — an invite link drops you straight into that squad.
  const invited = params.get('squad');
  if (invited && setSquad(invited)) {
    history.replaceState(null, '', location.pathname + location.hash);
    setTimeout(() => toast(`Squad ${state.settings.squad} joined`, 'good'), 900);
  }
  const unlock = () => { audio.init(); audio.set(state.settings); window.removeEventListener('pointerdown', unlock); };
  window.addEventListener('pointerdown', unlock);
  window.addEventListener('keydown', unlock, { once: true });

  const fill = $('#boot-fill');
  const pct = $('#boot-pct');
  await withTimeout(loadAll((p) => {
    if (fill) fill.style.width = Math.round(p * 100) + '%';
    if (pct) pct.textContent = Math.round(p * 100) + '%';
  }), 7000, null);

  const uplink = navigator.onLine;
  state.catalog = uplink ? await withTimeout(net.loadCatalog(), 3000, {}) : {};

  let session = uplink ? await withTimeout(net.currentSession(), 2500, null) : null;
  if (session?.user) {
    const row = await withTimeout(net.fetchProfile(session.user.id, 2), 2500, null);
    if (row) {
      startAccount(session.user.id, row);
      loadLocal(session.user.id);
      finishBoot();
      return;
    }
  }
  // Offline (or command unreachable): keep the arena playable with a local profile.
  if (!state.profile) {
    startGuest();
    loadLocal(state.uid);
    if (!uplink) setTimeout(() => toast('Offline — local skirmish', 'info'), 700);
  }
  finishBoot();
}

function finishBoot() {
  $('#boot')?.classList.add('done');
  setTimeout(() => $('#boot')?.remove(), 600);
  state.regiment = myRegiment(state.uid);
  if (pendingReg && state.profile) finishPendingRegiment();
  if (state.mode === 'account') syncRemoteRegiment();
  if (pendingRoom && state.profile) showMenu();
  else showLanding();
  refreshMenu();
}

function applyRegiment(reg, message) {
  if (!reg?.code) return;
  state.regiment = adoptRegiment(reg, state.uid);
  document.dispatchEvent(new CustomEvent('ironstorm:regiment', { detail: state.regiment }));
  refreshMenu();
  if (message) setTimeout(() => toast(message, 'good'), 700);
}

async function syncRemoteRegiment() {
  if (state.mode !== 'account' || !state.uid) return;
  const res = await net.fetchMyRegiment();
  if (res.ok && res.regiment) {
    const same = state.regiment?.code === res.regiment.code;
    state.regiment = adoptRegiment(res.regiment, state.uid);
    if (!same) {
      document.dispatchEvent(new CustomEvent('ironstorm:regiment', { detail: state.regiment }));
      refreshMenu();
    }
  }
}

async function finishPendingRegiment() {
  const invite = pendingReg;
  pendingReg = null;
  if (!invite) return;
  if (state.mode === 'account') {
    const remote = await net.joinRegimentRemote(invite.code);
    if (remote.ok) {
      applyRegiment(remote.regiment, `Enlisted in ${remote.regiment.name}`);
    } else {
      const local = joinRegiment(invite.code, invite.meta, state.uid);
      if (local.ok) applyRegiment(local.regiment, `${local.regiment.name} enlisted locally — command database unavailable`);
      else setTimeout(() => toast(local.why, 'bad'), 900);
    }
  } else {
    const joined = joinRegiment(invite.code, invite.meta, state.uid);
    if (joined.ok) applyRegiment(joined.regiment, `Enlisted in ${joined.regiment.name}`);
    else setTimeout(() => toast(joined.why, 'bad'), 900);
  }
  history.replaceState(null, '', location.pathname + location.hash);
}

// ---------------------------------------------------------------- auth wiring
bindAuth({
  onAccount(uid, row) {
    startAccount(uid, row);
    loadLocal(uid);
    showAuthScreen(false);
    showMenu();
    syncRemoteRegiment();
    toast(`Signed in as ${row.username}`, 'good');
  },
  onGuest() {
    startGuest();
    loadLocal(state.uid);
    showAuthScreen(false);
    showMenu();
  },
  onBack(fromMenu) {
    showAuthScreen(false);
    if (fromMenu) {
      refreshMenu();
      return;
    }
      $('#screen-menu')?.classList.add('hidden');
    showLanding();
  },
});

initMenu({ onPlay: startArena });

initLanding({
  onDeploy() {
    if (!state.profile) { hideLanding(); showAuthScreen(true); return; }
    showMenu();
  },
  onGarage() {
    if (!state.profile) { hideLanding(); showAuthScreen(true); return; }
    showMenu();
    openPane('garage');
  },
  onAuth() {
    if (state.mode === 'account') { showMenu(); return; }
    hideLanding();
    showAuthScreen(true, 'in');
  },
  onBrief() { openBriefing(); },
  onManual() {
    import('./manual.js').then((m) => m.openManual({
      onAcademy: () => startTraining({ kind: 'academy' }),
    }));
  },
});

window.addEventListener('ironstorm:open-briefing', () => openBriefing());

// ---------------------------------------------------------------- arena
async function preparePrivateRoom(room) {
  if (!room?.rules?.private) return room;
  if (state.mode !== 'account') {
    toast('Sign in to enter a private field', 'bad');
    return null;
  }
  if (!room.rules.passcode) {
    toast('That private field is missing its passcode', 'bad');
    return null;
  }
  const { passcode, ...rules } = room.rules;
  const res = room.host
    ? await net.hostPrivateRoom({ mode: room.mode, name: room.name, passcode, rules })
    : await net.joinPrivateRoom({ mode: room.mode, name: room.name, passcode });
  if (!res.ok) {
    toast(res.error || 'Private field admission failed', 'bad');
    return null;
  }
  return { ...room, channel: res.channel, roomId: res.roomId, rules: { ...rules, private: true } };
}

async function startArena(room, opts = {}) {
  const prepared = await preparePrivateRoom(room);
  if (room && !prepared) return;
  room = prepared || room;
  if (app.arena) { app.arena.stop(); app.arena = null; }
  closePane();
  stopPreview();
  $('#modal-root').innerHTML = '';
  const modeId = room?.mode || modeFor(state.settings.mode).id;
  const resolved = room?.name ? room : await resolveQuickRoom(modeId);
  setMode(resolved.mode);
  trackLobbyPresence(resolved);
  $('#screen-game')?.classList.remove('spectate-mode');
  setScreen('screen-game');
  const arena = new Arena({ onReport: finishMatch, mode: resolved.mode, room: resolved, ...opts });
  app.arena = arena;
  arena.start();
}

// Give the presence directory a beat to sync before falling back to ALPHA.
// Academy / free-fire range: no uplink, no rewards, unlimited respawns.
function startTraining({ kind = 'academy', map = 'rotate' } = {}) {
  if (app.arena) { app.arena.stop(); app.arena = null; }
  closePane();
  stopPreview();
  $('#modal-root').innerHTML = '';
  $('#screen-game')?.classList.remove('spectate-mode');
  setScreen('screen-game');
  const room = {
    mode: 'deathmatch', name: kind === 'range' ? 'RANGE' : 'DRILL', key: 'training',
    rules: { map, bots: 0, weather: 'clear' },
  };
  const arena = new Arena({ onReport: finishMatch, training: kind, room });
  app.arena = arena;
  arena.start();
}

// Community map host: a normal arena whose room rule carries the code.
function hostCommunityMap({ map, mode = 'deathmatch' } = {}) {
  if (!map) return;
  closePane();
  const room = makeRoom(mode, 'MAP LAB', { map, difficulty: 'regular' });
  startArena(room);
}

function startSpectate(room = null) {
  if (app.arena) { app.arena.stop(); app.arena = null; }
  closePane();
  stopPreview();
  $('#modal-root').innerHTML = '';
  const mode = room?.mode || selectedMode().id;
  const target = room ? makeRoom(room.mode, room.name, room.rules) : quickRoom(mode, net.directory.rooms);
  setScreen('screen-game');
  const arena = new Arena({ mode: target.mode, room: target, spectator: true, onExit: () => {
    setScreen('screen-menu');
    refreshMenu();
    startPreview();
  } });
  app.arena = arena;
  arena.start();
}

function startRanked({ mode = 'deathmatch' } = {}) {
  if (!state.local) return;
  const room = makeRoom(mode, rankedRoomName(state.local), {
    difficulty: 'veteran', bots: 6, weather: 'random', mutator: 'standard',
  });
  startArena(room, { ranked: true });
}

document.addEventListener('ironstorm:training', (e) => startTraining(e.detail || {}));
document.addEventListener('ironstorm:hostmap', (e) => hostCommunityMap(e.detail || {}));
document.addEventListener('ironstorm:ranked', (e) => startRanked(e.detail || {}));
document.addEventListener('ironstorm:spectate', (e) => startSpectate(e.detail || null));
document.addEventListener('ironstorm:regiment', (e) => {
  state.regiment = e.detail || null;
  if (state.profile) trackLobbyPresence(null);
});

async function resolveQuickRoom(mode) {
  if (!net.directory.synced) {
    await new Promise((done) => {
      let stop = () => {};
      stop = net.watchDirectory(() => {
        if (!net.directory.synced) return;
        stop();
        done();
      });
      setTimeout(() => { stop(); done(); }, 1000);
    });
  }
  return quickRoom(mode, net.directory.rooms);
}

// Server browser / "play again" ask for a specific room by name.
document.addEventListener('ironstorm:join', (e) => {
  const room = e.detail;
  if (!room?.name) return;
  if (room.key || room.rules) startArena(room);
  else startArena(makeRoom(room.mode || modeFor(state.settings.mode).id, room.name));
});

async function finishMatch(data) {
  app.arena = null;
  setScreen('screen-menu');
  if (data.practice) {
    trackLobbyPresence(null);
    refreshMenu();
    startPreview();
    toast('Training complete — no rewards, no rank change', 'info');
    return;
  }
  const before = { ...state.profile };
  let earned = { credits: data.credits, xp: data.xp };
  let levelUp = false;

  // salvage from crates is tracked locally and added to the report
  const salvage = 0;
  if (salvage) earned.credits += salvage;

  if (state.mode === 'account') {
    const res = await net.recordMatch(data);
    if (res.ok && res.row) {
      const after = fromRow(res.row);
      levelUp = after.level > before.level;
      earned.credits = Math.max(0, after.credits - before.credits);
      earned.xp = Math.max(0, after.xp - before.xp);
      state.profile = after;
    } else {
      applyMatchRewards({ ...data, credits: earned.credits, xp: earned.xp });
      toast('Command unreachable — progress saved on this device', 'bad');
    }
  } else {
    applyMatchRewards({ ...data, credits: earned.credits, xp: earned.xp });
  }

  // Career ledger, salvage and medals are recorded locally for every commander.
  const note = noteMatch({ ...data, earned }, {
    tank: data.tank || state.profile.tank,
    map: data.map,
    mutator: data.mutator,
    host: data.hosted,
  });
  earned.salvage = note.salvage;
  data.medals = note.medals;

  if (data.ranked) {
    data.rankedResult = applyRankedMatch(state.local, data);
    saveLocal();
    const r = data.rankedResult;
    toast(`RANKED ${r.delta >= 0 ? '+' : ''}${r.delta} · ${r.rating} RATING`, r.delta >= 0 ? 'good' : 'bad');
  }

  trackLobbyPresence(null);
  refreshMenu();
  startPreview();
  showReport({ ...data, earned, levelUp });
  audio.play(data.won ? 'victory' : 'ui');
  setTimeout(() => maybeOfferInstall(state.profile?.matches | 0), 1600);
}

// re-show the menu preview after a report is dismissed
document.addEventListener('click', (e) => {
  if (e.target.id === 'report-menu') {
    refreshMenu();
    startPreview();
  }
});

boot();

window.addEventListener('offline', () => toast('Command uplink lost — offline skirmish only', 'bad'));
window.addEventListener('online', () => toast('Command uplink restored', 'good'));

window.addEventListener('error', (e) => {
  console.error('[ironstorm]', e.error || e.message);
});
