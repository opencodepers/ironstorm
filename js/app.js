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
  bindAuth, showAuthScreen, toast, closePane, openPane,
} from './menu.js';
import { initLanding, showLanding, hideLanding, setMode } from './landing.js';
import { makeRoom, quickRoom } from './rooms.js';
import { modeFor } from './modes.js';
import { $, storage } from './util.js';

const app = { arena: null };

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
  // Keep the room directory warm so quickplay knows which servers are live.
  if (state.uid) net.watchDirectory(() => {});
}

async function boot() {
  loadSettings();
  audio.set(state.settings);

  // ?squad=ABCD — an invite link drops you straight into that squad.
  const invited = new URLSearchParams(location.search).get('squad');
  if (invited && setSquad(invited)) {
    history.replaceState(null, '', location.pathname + location.hash);
    setTimeout(() => toast(`Squad ${state.settings.squad} joined`, 'good'), 900);
  }
  const unlock = () => { audio.init(); audio.set(state.settings); window.removeEventListener('pointerdown', unlock); };
  window.addEventListener('pointerdown', unlock);
  window.addEventListener('keydown', unlock, { once: true });

  const fill = $('#boot-fill');
  const pct = $('#boot-pct');
  await loadAll((p) => {
    if (fill) fill.style.width = Math.round(p * 100) + '%';
    if (pct) pct.textContent = Math.round(p * 100) + '%';
  });

  try {
    state.catalog = await net.loadCatalog();
  } catch { state.catalog = {}; }

  const session = await net.currentSession();
  if (session?.user) {
    const row = await net.fetchProfile(session.user.id, 2);
    if (row) {
      startAccount(session.user.id, row);
      finishBoot();
      return;
    }
  }
  finishBoot();
}

function finishBoot() {
  $('#boot')?.classList.add('done');
  setTimeout(() => $('#boot')?.remove(), 600);
  showLanding();
  refreshMenu();
}

// ---------------------------------------------------------------- auth wiring
bindAuth({
  onAccount(uid, row) {
    startAccount(uid, row);
    showAuthScreen(false);
    showMenu();
    toast(`Signed in as ${row.username}`, 'good');
  },
  onGuest() {
    startGuest();
    showAuthScreen(false);
    showMenu();
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
    if (state.profile) { showMenu(); return; }
    hideLanding();
    showAuthScreen(true);
  },
});

// ---------------------------------------------------------------- arena
async function startArena(room) {
  if (app.arena) { app.arena.stop(); app.arena = null; }
  closePane();
  stopPreview();
  $('#modal-root').innerHTML = '';
  const modeId = room?.mode || modeFor(state.settings.mode).id;
  const resolved = room?.name ? room : await resolveQuickRoom(modeId);
  setMode(resolved.mode);
  setScreen('screen-game');
  const arena = new Arena({ onReport: finishMatch, mode: resolved.mode, room: resolved });
  app.arena = arena;
  arena.start();
}

// Give the presence directory a beat to sync before falling back to ALPHA.
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
  startArena(makeRoom(room.mode || modeFor(state.settings.mode).id, room.name));
});

async function finishMatch(data) {
  app.arena = null;
  setScreen('screen-menu');
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

  refreshMenu();
  startPreview();
  showReport({ ...data, earned, levelUp });
  audio.play(data.won ? 'victory' : 'ui');
}

// re-show the menu preview after a report is dismissed
document.addEventListener('click', (e) => {
  if (e.target.id === 'report-menu') {
    refreshMenu();
    startPreview();
  }
});

boot();

window.addEventListener('error', (e) => {
  console.error('[ironstorm]', e.error || e.message);
});
