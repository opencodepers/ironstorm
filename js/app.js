// ------------------------------------------------------------------
//  IronStorm — bootstrap & screen routing
// ------------------------------------------------------------------

import { loadAll, assetState } from './assets.js';
import { audio } from './audio.js';
import { state, startGuest, startAccount, loadSettings, fromRow, applyMatchRewards } from './store.js';
import * as net from './net.js';
import { Arena } from './game.js';
import {
  initMenu, refreshMenu, startPreview, stopPreview, showReport,
  bindAuth, showAuthScreen, toast, closePane,
} from './menu.js';
import { $, storage } from './util.js';

const app = { arena: null };

function setScreen(name) {
  for (const id of ['screen-auth', 'screen-menu', 'screen-game']) {
    $('#' + id)?.classList.toggle('hidden', id !== name);
  }
}

function showMenu() {
  setScreen('screen-menu');
  refreshMenu();
  stopPreview();
  startPreview();
}

async function boot() {
  loadSettings();
  audio.set(state.settings);
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
  showAuthScreen(true);
}

function finishBoot() {
  $('#boot')?.classList.add('done');
  setTimeout(() => $('#boot')?.remove(), 600);
  if (state.profile) {
    setScreen('screen-menu');
    refreshMenu();
    startPreview();
  }
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

// ---------------------------------------------------------------- arena
function startArena() {
  if (app.arena) { app.arena.stop(); app.arena = null; }
  closePane();
  stopPreview();
  $('#modal-root').innerHTML = '';
  setScreen('screen-game');
  const arena = new Arena({ onReport: finishMatch });
  app.arena = arena;
  arena.start();
}

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
