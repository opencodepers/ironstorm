// ------------------------------------------------------------------
//  IronStorm — main menu, hangar, upgrades, leaderboards, settings
// ------------------------------------------------------------------

import {
  state, saveSettings, equipTankLocal, buyTankLocal, buyUpgradeLocal,
  buySkinLocal, equipSkinLocal, claimDailyLocal, dailyState,
  ensureContracts, CONTRACT_DEFS, claimContractLocal, unlockRankCrateLocal,
  ensureSquad, setSquad, rotateSquad, squadmates,
} from './store.js';
import {
  TANKS, TANK_ORDER, UPGRADES, UPGRADE_ORDER, upgradeCost, deriveStats, levelProgress,
  SKINS, SKIN_ORDER, skinCss, skinFor, xpForLevel,
} from './tanks.js';
import { MODES, MODE_ORDER } from './modes.js';
import {
  ROOM_CAPACITY, DEFAULT_ROOM, MUTATORS, roomDisplayName, roomRows, makeRoom, quickRoom, findRoomByName,
} from './rooms.js';
import { loadLocal, saveLocal, careerTotals, claimSeasonReward } from './progress.js';
import { MEDALS, medalProgress, unlockedCount } from './medals.js';
import {
  TIERS, tierFor, tierProgress, tierGlyph, lifetimePoints, weekPoints, weekNumber, daysLeft, seasonReward,
} from './season.js';
import {
  COSMETIC_KINDS, COSMETIC_ITEMS, cosmeticsOfKind, ownsCosmetic, equippedCosmetic,
  buyCosmeticLocal, equipCosmeticLocal,
} from './cosmetics.js';
import {
  friendsWithStatus, addFriend, removeFriend, inviteLink, copyInvite,
} from './social.js';
import { DEFAULT_KEYS } from './config.js';
import { t as tr, LANGS, setLang, applyI18n } from './i18n.js';
import {
  mapCode, decodeMap, MAP_PALETTE, GRID, THEMES, listCustom, saveCustom, removeCustom,
} from './community.js';
import { rankedState, rankTier, rankProgress, PLACEMENTS, RANK_TIERS } from './ranked.js';
import { lastReplay, openTheater } from './theater.js';
import { selectedMode, setMode } from './landing.js';
import { audio } from './audio.js';
import { img } from './assets.js';
import { fmt, esc, $, $$, clamp, storage } from './util.js';
import * as net from './net.js';

// ---------------------------------------------------------------- icons
const svg = (body, vb = '0 0 24 24') =>
  `<svg viewBox="${vb}" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;

export const ICONS = {
  gear: svg('<circle cx="12" cy="12" r="3.1"/><path d="M12 2.6v2.3M12 19.1v2.3M2.6 12h2.3M19.1 12h2.3M5.2 5.2l1.6 1.6M17.2 17.2l1.6 1.6M5.2 18.8l1.6-1.6M17.2 6.8l1.6-1.6"/><circle cx="12" cy="12" r="7.6" opacity=".55"/>'),
  hangar: svg('<path d="M2.5 20.5V9.4L12 4l9.5 5.4v11.1"/><path d="M7 20.5v-6.2h10v6.2"/><path d="M7 17.4h10"/><path d="M10.6 9.9h2.8"/>'),
  trophy: svg('<path d="M8 3.6h8v5.2a4 4 0 0 1-8 0V3.6z"/><path d="M8 5H5.2v1.9A3.1 3.1 0 0 0 8 10"/><path d="M16 5h2.8v1.9A3.1 3.1 0 0 1 16 10"/><path d="M10.2 20.4h3.6M12 12.9v7.5"/>'),
  gamepad: svg('<rect x="2.2" y="7" width="19.6" height="10.5" rx="4.4"/><path d="M7 10.6v3.4M5.3 12.3h3.4"/><circle cx="16" cy="11.5" r="1.05" fill="currentColor" stroke="none"/><circle cx="18.3" cy="14" r="1.05" fill="currentColor" stroke="none"/>'),
  play: `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 4.2 20 12 7 19.8z"/></svg>`,
  bolt: svg('<path d="M13.4 2.5 5 13.6h5.4L9.9 21.5 18.8 10h-5.6z"/>'),
  shield: svg('<path d="M12 2.8 4.5 6v6.1c0 4.4 3.1 7.6 7.5 9.1 4.4-1.5 7.5-4.7 7.5-9.1V6z"/><path d="M9 12.1l2.1 2.1 4-4.2"/>'),
  engine: svg('<path d="M4 9.5h9.5v7H4z"/><path d="M13.5 11.5H18l2.5 2v2.5H18"/><path d="M6 9.5V7h6v2.5"/><path d="M6 16.5v1.8M11 16.5v1.8"/>'),
  reload: svg('<path d="M20 12a8 8 0 1 1-2.6-5.9"/><path d="M20 3.6v4.2h-4.2"/>'),
  tracks: svg('<rect x="2.5" y="6.5" width="19" height="11" rx="4"/><circle cx="6.6" cy="12" r="1.5"/><circle cx="17.4" cy="12" r="1.5"/><path d="M9.4 9.2h5.2v5.6H9.4z"/>'),
  lock: svg('<rect x="4.5" y="10" width="15" height="10" rx="2"/><path d="M8 10V7.4a4 4 0 0 1 8 0V10"/>'),
  check: svg('<path d="M4.5 12.6l4.6 4.6L19.6 6.6"/>'),
  close: svg('<path d="M5 5l14 14M19 5 5 19"/>'),
  back: svg('<path d="M14.5 5 7.5 12l7 7"/><path d="M8 12h11"/>'),
  coin: `<svg viewBox="0 0 24 24" aria-hidden="true"><ellipse cx="12" cy="12" rx="6.4" ry="8.6" fill="#c9a227"/><ellipse cx="12" cy="12" rx="6.4" ry="8.6" fill="none" stroke="#f0d67a" stroke-width="1.2"/><ellipse cx="12" cy="12" rx="4" ry="6" fill="none" stroke="#8f6f14" stroke-width="1"/><path d="M12 8.2c-2 0-3 .9-3 2s1 1.7 3 2.1 3 1 3 2.1-1 2-3 2" fill="none" stroke="#f7e6a6" stroke-width="1.5"/></svg>`,
  user: svg('<circle cx="12" cy="8.2" r="3.6"/><path d="M4.8 20.2c1.3-3.6 4-5.4 7.2-5.4s5.9 1.8 7.2 5.4"/>'),
  squad: svg('<circle cx="9" cy="8.4" r="3.1"/><path d="M3.4 19.8c1-3.1 3.2-4.7 5.6-4.7s4.6 1.6 5.6 4.7"/><circle cx="17" cy="9.6" r="2.3"/><path d="M15.6 15.5c1.8.3 3.3 1.7 4.1 4.3"/>'),
  servers: svg('<rect x="3" y="3.6" width="18" height="6.4" rx="1.4"/><rect x="3" y="13.6" width="18" height="6.4" rx="1.4"/><path d="M6.6 6.8h.1M6.6 16.8h.1"/>'),
  skull: svg('<path d="M12 3a7 7 0 0 0-4.2 12.6V19h8.4v-3.4A7 7 0 0 0 12 3z"/><circle cx="9.2" cy="11" r="1.4" fill="currentColor" stroke="none"/><circle cx="14.8" cy="11" r="1.4" fill="currentColor" stroke="none"/><path d="M9.6 19v2M14.4 19v2"/>'),
  target: svg('<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/><path d="M12 1.5v3M12 19.5v3M1.5 12h3M19.5 12h3"/>'),
  cart: svg('<path d="M2.6 4.2h2.6l2.5 10.4h9.4l2.1-7.4H7"/><circle cx="9.4" cy="19" r="1.5"/><circle cx="17.4" cy="19" r="1.5"/>'),
  crate: svg('<path d="M3 7.6 12 3l9 4.6v8.8L12 21l-9-4.6z"/><path d="M3 7.6 12 12.2l9-4.6M12 12.2V21"/>'),
};

// ---------------------------------------------------------------- state
let onPlay = null;
let currentPane = null;
let previewRaf = 0;
let leaderMetric = 'kills';
let leaderFilter = 'all';
let leaderTank = 'sherman';
let shopTab = 'vehicles';
let serverFilter = null;
let serverUnsub = null;
let friendUnsub = null;

// Map Lab working state survives pane re-renders.
let editor = { name: 'CUSTOM MAP', theme: 0, palette: 0, cells: [] };

const PANE_META = {
  upgrades: { title: 'UPGRADES', sub: 'Spend credits on permanent hull improvements' },
  garage: { title: 'GARAGE', sub: 'Select and requisition armoured vehicles' },
  shop: { title: 'SHOP', sub: 'Vehicles, camouflage patterns and daily supply drops' },
  squad: { title: 'SQUAD', sub: 'Form up and roll into the same arena' },
  servers: { title: 'SERVERS', sub: 'Quickplay, or join a match by server name' },
  career: { title: 'CAREER', sub: 'Your record, per vehicle, and the weekly season' },
  medals: { title: 'MEDALS', sub: 'Long-term achievements paid in salvage' },
  friends: { title: 'FRIENDS', sub: 'Who is online, and an invite link to your server' },
  leaderboards: { title: 'LEADERBOARDS', sub: 'Global rankings and the weekly season' },
  gameplay: { title: 'GAMEPLAY', sub: 'Audio, controls and account settings' },
  academy: { title: 'ACADEMY', sub: 'Learn the hull, then take the free-fire range' },
  maps: { title: 'MAP LAB', sub: 'Build a battlefield and share it with a code' },
  ranked: { title: 'RANKED', sub: 'Placements, rating and a seat in the ladder' },
  theater: { title: 'THEATER', sub: 'Watch your last battle back with a free camera' },
};

export function initMenu({ onPlay: play }) {
  onPlay = play;
  applyIcons();
  applyDisplaySettings();

  $$('.rail-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      audio.play('ui');
      openPane(btn.dataset.pane);
    });
    btn.addEventListener('mouseenter', () => audio.play('ui'));
  });

  $('#play-btn')?.addEventListener('click', () => {
    audio.play('ui');
    audio.unlock();
    startArenaFlow();
  });

  document.addEventListener('keydown', (e) => {
    if (currentPane && e.key === 'Escape') { audio.play('uiBack'); closePane(); }
  });

  document.addEventListener('ironstorm:mode', () => {
    renderModeStrip();
    const m = selectedMode();
    const sub = $('#play-sub');
    if (sub) sub.textContent = `${m.name} · ${m.rules}`;
  });
}

function applyIcons() {
  $$('[data-icon]').forEach((n) => {
    const icon = ICONS[n.dataset.icon];
    if (icon) n.innerHTML = icon;
  });
  const coin = $('#menu-coin');
  if (coin) coin.innerHTML = ICONS.coin;
}

function startArenaFlow() {
  const btn = $('#play-btn');
  btn?.classList.add('busy');
  const label = $('#play-btn .play-label');
  if (label) label.textContent = 'DEPLOYING';
  setTimeout(() => {
    btn?.classList.remove('busy');
    if (label) label.textContent = 'PLAY';
    onPlay?.();
  }, 420);
}

// ---------------------------------------------------------------- menu render
export function refreshMenu() {
  applyDisplaySettings();
  const p = state.profile;
  if (!p) return;
  const nameEl = $('#menu-username');
  if (nameEl) nameEl.textContent = p.username;

  const tierEl = $('#menu-tier');
  if (tierEl) {
    const tier = tierFor(lifetimePoints(p));
    tierEl.textContent = `${tierGlyph(tier.id)} ${tier.name}`;
    tierEl.style.color = tier.color;
    tierEl.style.borderColor = tier.color;
  }

  const sub = $('#menu-sub');
  if (sub) {
    if (state.mode === 'guest') {
      sub.innerHTML = `Progress saved on this device · <b>LVL ${p.level}</b>`;
    } else {
      sub.innerHTML = `<b>LVL ${p.level}</b> · ${fmt(p.credits)} CR · ${fmt(p.kills)} KILLS`;
    }
  }

  const cred = $('#menu-credits');
  if (cred) {
    tweenCredits(cred, p.credits);
  }

  const tank = TANKS[p.tank] || TANKS.sherman;
  const nameTank = $('#menu-tank-name');
  if (nameTank) nameTank.textContent = tank.name;
  const sortieTank = $('#menu-sortie-tank');
  if (sortieTank) sortieTank.textContent = tank.name;

  const equipped = $('#menu-equipped');
  if (equipped) {
    const owned = p.owned.includes(tank.id);
    equipped.textContent = owned ? 'EQUIPPED' : 'NOT OWNED';
    equipped.style.color = owned ? '' : '#c9765f';
  }

  const stats = deriveStats(p.tank, p.upgrades);
  setBar('stat-fire', stats.damage / 60);
  setBar('stat-armor', stats.hp / 260);
  setBar('stat-move', stats.speed / 220);
  const statLabel = $('#menu-stat-text');
  if (statLabel) {
    statLabel.textContent = `${Math.round(stats.damage)} DMG · ${Math.round(stats.hp)} HP · ${Math.round(stats.speed)} SPD`;
  }

  renderModeStrip();

  const playSub = $('#play-sub');
  if (playSub) {
    const m = selectedMode();
    playSub.textContent = `${m.name} · ${m.rules}`;
  }

  const accBtn = $('#account-chip');
  if (accBtn) {
    accBtn.innerHTML = state.mode === 'account'
      ? `${ICONS.user}<span>${esc(p.username)}</span>`
      : `${ICONS.user}<span>SIGN IN</span>`;
  }
}

function renderModeStrip() {
  const wrap = $('#menu-modes');
  if (!wrap) return;
  const active = selectedMode().id;
  wrap.innerHTML = MODE_ORDER.map((id, i) => {
    const m = MODES[id];
    return `<button class="mode-chip ${id === active ? 'on' : ''}" data-mode="${id}" style="--accent:${m.accent}" type="button">
      <span class="mc-index">0${i + 1}</span>
      <span class="mc-copy"><b>${m.name}</b><i>${m.rules}</i></span>
      <span class="mc-signal" aria-hidden="true"><i></i><i></i><i></i></span>
    </button>`;
  }).join('');
  const m = selectedMode();
  const write = (sel, value) => { const el = $(sel); if (el) el.textContent = value; };
  write('#menu-brief-tag', m.tag);
  write('#menu-brief-name', m.name);
  write('#menu-brief-text', m.blurb);
  write('#menu-brief-rule', m.rules);
  write('#menu-sortie-mode', m.name);
  write('#menu-sortie-rule', m.rules);
  wrap.querySelectorAll('[data-mode]').forEach((b) =>
    b.addEventListener('click', () => { audio.play('ui'); setMode(b.dataset.mode); }));
}

let creditShown = null;
let creditRaf = 0;
function tweenCredits(el, value) {
  const from = creditShown == null ? value : creditShown;
  if (from === value) { el.textContent = fmt(value); return; }
  creditShown = value;
  el.classList.remove('bump');
  void el.offsetWidth;
  el.classList.add('bump');
  cancelAnimationFrame(creditRaf);
  const t0 = performance.now();
  const tick = (now) => {
    const k = clamp((now - t0) / 420, 0, 1);
    const e = 1 - Math.pow(1 - k, 3);
    el.textContent = fmt(from + (value - from) * e);
    if (k < 1) creditRaf = requestAnimationFrame(tick);
    else { creditShown = value; el.textContent = fmt(value); }
  };
  creditRaf = requestAnimationFrame(tick);
}

function setBar(id, pct) {
  const el = document.getElementById(id);
  if (el) el.style.width = clamp(pct * 100, 4, 100) + '%';
}

// ---------------------------------------------------------------- tank preview
export function startPreview() {
  cancelAnimationFrame(previewRaf);
  const c = $('#tank-preview');
  if (!c) return;
  const ctx = c.getContext('2d');
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const W = 380, H = 220;
  c.width = W * dpr; c.height = H * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const t0 = performance.now();
  const loop = (now) => {
    previewRaf = requestAnimationFrame(loop);
    const t = (now - t0) / 1000;
    const p = state.profile;
    if (!p) return;
    const stats = deriveStats(p.tank, p.upgrades);
    ctx.clearRect(0, 0, W, H);

    // platform glow
    const g = ctx.createRadialGradient(W / 2, H / 2 + 12, 10, W / 2, H / 2 + 12, 150);
    g.addColorStop(0, 'rgba(110,190,80,0.20)');
    g.addColorStop(1, 'rgba(110,190,80,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // dashed ring
    ctx.save();
    ctx.translate(W / 2, H / 2 + 34);
    ctx.scale(1, 0.34);
    ctx.strokeStyle = 'rgba(140,210,110,0.28)';
    ctx.lineWidth = 2;
    ctx.setLineDash([9, 12]);
    ctx.rotate(t * 0.25);
    ctx.beginPath();
    ctx.arc(0, 0, 118, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    const body = img(stats.body), barrel = img(stats.barrel);
    if (!body) return;
    const s = 2.0;
    const bw = body.width * s, bh = body.height * s;
    const cx = W / 2, cy = H / 2 - 6;
    const bob = Math.sin(t * 1.4) * 1.6;

    // shadow
    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.ellipse(cx, cy + bh * 0.42, bw * 0.46, bh * 0.22, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // hull
    const skf = skinCss(p.skin || 'olive');
    const hasSkin = skf && skf !== 'none';

    ctx.save();
    ctx.translate(cx, cy + bob);
    ctx.rotate(-0.05 + Math.sin(t * 0.6) * 0.015);
    if (hasSkin) ctx.filter = skf;
    ctx.drawImage(body, -bw / 2, -bh / 2, bw, bh);
    ctx.restore();

    // turret — slow sweep
    if (barrel) {
      const ang = -0.34 + Math.sin(t * 0.55) * 0.16;
      ctx.save();
      ctx.translate(cx, cy + bob);
      ctx.rotate(ang);
      const brw = barrel.width * s, brh = barrel.height * s;
      if (hasSkin) ctx.filter = skf;
      ctx.drawImage(barrel, -brw / 2, -brh + bh * 0.12, brw, brh);
      ctx.restore();
    }

    // scan sweep
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const sy = ((t * 34) % (H + 60)) - 30;
    const scan = ctx.createLinearGradient(0, sy - 24, 0, sy + 24);
    scan.addColorStop(0, 'rgba(120,220,110,0)');
    scan.addColorStop(0.5, 'rgba(120,220,110,0.05)');
    scan.addColorStop(1, 'rgba(120,220,110,0)');
    ctx.fillStyle = scan;
    ctx.fillRect(0, sy - 24, W, 48);
    ctx.restore();
  };
  previewRaf = requestAnimationFrame(loop);
}

export function stopPreview() {
  cancelAnimationFrame(previewRaf);
}

// ---------------------------------------------------------------- panes
export function openPane(name) {
  if (!PANE_META[name]) return;
  stopWatchingServers();
  stopWatchingFriends();
  currentPane = name;
  $$('.rail-btn').forEach((b) => b.classList.toggle('on', b.dataset.pane === name));
  const root = $('#pane-root');
  root.classList.remove('hidden');
  root.dataset.pane = name;
  renderPane();
}

export function closePane() {
  const root = $('#pane-root');
  if (!root || root.classList.contains('hidden') || root.classList.contains('closing')) return;
  stopWatchingServers();
  stopWatchingFriends();
  currentPane = null;
  $$('.rail-btn.on').forEach((b) => b.classList.remove('on'));
  root.classList.add('closing');
  setTimeout(() => {
    root.classList.remove('closing');
    root.classList.add('hidden');
    root.innerHTML = '';
  }, 190);
}

function renderPane() {
  const root = $('#pane-root');
  const meta = PANE_META[currentPane];
  const body = {
    upgrades: renderUpgrades,
    garage: renderGarage,
    leaderboards: renderLeaderboards,
    gameplay: renderGameplay,
    shop: renderShop,
    squad: renderSquad,
    servers: renderServers,
    career: renderCareer,
    medals: renderMedals,
    friends: renderFriends,
    academy: renderAcademyPane,
    maps: renderMapLab,
    ranked: renderRanked,
    theater: renderTheater,
  }[currentPane]?.() ?? '';

  root.innerHTML = `
    <div class="pane-backdrop" data-close></div>
    <div class="pane">
      <header class="pane-head">
        <div>
          <h2>${tr(`rail.${currentPane}`, tr(`pane.${currentPane}.title`, meta.title))}</h2>
          <p>${tr(`pane.${currentPane}.sub`, meta.sub)}</p>
        </div>
        <div class="pane-head-right">
          <button class="overlay-back" data-close type="button">← BACK</button>
          <span class="pane-credits">${ICONS.coin}<b>${fmt(state.profile.credits)}</b></span>
          <button class="icon-btn" data-close aria-label="Close">${ICONS.close}</button>
        </div>
      </header>
      <div class="pane-body">${body}</div>
    </div>`;

  root.querySelectorAll('[data-close]').forEach((n) =>
    n.addEventListener('click', () => { audio.play('uiBack'); closePane(); }));

  wirePane();
  if (currentPane === 'leaderboards') loadLeaderboard();
  if (currentPane === 'career') loadCareerExtras();
  requestAnimationFrame(paintGaragePreviews);
}

function wirePane() {
  const root = $('#pane-root');
  if (currentPane === 'upgrades') {
    root.querySelectorAll('[data-upgrade]').forEach((btn) => {
      btn.addEventListener('click', () => doUpgrade(btn.dataset.upgrade, btn));
    });
  }
  if (currentPane === 'garage') {
    root.querySelectorAll('[data-tank]').forEach((btn) => {
      btn.addEventListener('click', () => doTank(btn.dataset.tank, btn));
    });
  }
  if (currentPane === 'leaderboards') {
    root.querySelectorAll('[data-metric]').forEach((btn) => {
      btn.addEventListener('click', () => {
        leaderMetric = btn.dataset.metric;
        audio.play('ui');
        rerenderPaneBody();
        loadLeaderboard();
      });
    });
    root.querySelectorAll('[data-lb-filter]').forEach((btn) => {
      btn.addEventListener('click', () => {
        leaderFilter = btn.dataset.lbFilter;
        audio.play('ui');
        rerenderPaneBody();
        loadLeaderboard();
      });
    });
    $('#lb-tank')?.addEventListener('change', (e) => {
      leaderTank = e.target.value;
      loadLeaderboard();
    });
  }
  if (currentPane === 'gameplay') {
    wireGameplay();
  }
  if (currentPane === 'shop') {
    root.querySelectorAll('[data-shop-tab]').forEach((btn) => {
      btn.addEventListener('click', () => {
        shopTab = btn.dataset.shopTab;
        audio.play('ui');
        rerenderPaneBody();
      });
    });
    root.querySelectorAll('[data-tank]').forEach((btn) => {
      btn.addEventListener('click', () => doTank(btn.dataset.tank, btn));
    });
    root.querySelectorAll('[data-skin]').forEach((btn) => {
      btn.addEventListener('click', () => doSkin(btn.dataset.skin, btn));
    });
    root.querySelectorAll('[data-contract]').forEach((btn) => {
      btn.addEventListener('click', () => doContract(parseInt(btn.dataset.contract, 10), btn));
    });
    root.querySelectorAll('[data-cosmetic]').forEach((btn) => {
      btn.addEventListener('click', () => doCosmetic(btn.dataset.cosmetic, btn));
    });
    $('#claim-all')?.addEventListener('click', (e) => doClaimAll(e.currentTarget));
    document.getElementById('daily-claim')?.addEventListener('click', (e) => doDaily(e.currentTarget));
  }
  if (currentPane === 'career') {
    loadCareerExtras();
    $('#dogtag-open')?.addEventListener('click', openDogTag);
  }
  if (currentPane === 'academy') {
    $('#academy-launch')?.addEventListener('click', () => {
      closePane();
      document.dispatchEvent(new CustomEvent('ironstorm:training', { detail: { kind: 'academy' } }));
    });
    $('#academy-range-launch')?.addEventListener('click', () => {
      closePane();
      document.dispatchEvent(new CustomEvent('ironstorm:training', { detail: { kind: 'range' } }));
    });
  }
  if (currentPane === 'maps') wireMapLab();
  if (currentPane === 'ranked') {
    root.querySelectorAll('[data-ranked-mode]').forEach((btn) => {
      btn.addEventListener('click', () => {
        closePane();
        document.dispatchEvent(new CustomEvent('ironstorm:ranked', { detail: { mode: btn.dataset.rankedMode } }));
      });
    });
  }
  if (currentPane === 'theater') {
    $('#theater-watch')?.addEventListener('click', () => { closePane(); openTheater(); });
  }
  if (currentPane === 'friends') {
    friendUnsub = net.watchLobby(() => paintFriendList());
    const add = () => {
      const input = $('#friend-name');
      const res = addFriend(input?.value);
      if (!res.ok) {
        audio.play('deny');
        toast(res.why || 'Could not add that callsign', 'bad');
        input?.focus();
        return;
      }
      audio.play('buy');
      if (input) input.value = '';
      toast(`${res.name} added to your friends`, 'good');
      rerenderPaneBody();
    };
    $('#friend-add')?.addEventListener('click', add);
    $('#friend-name')?.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') add();
    });
    $$('#pane-root [data-unfriend]').forEach((b) =>
      b.addEventListener('click', () => {
        removeFriend(b.dataset.unfriend);
        audio.play('uiBack');
        rerenderPaneBody();
      }));
    $$('#pane-root [data-friend-join]').forEach((b) =>
      b.addEventListener('click', () => joinServer(b.dataset.friendMode, b.dataset.friendJoin)));
    $('#friend-refresh')?.addEventListener('click', () => {
      audio.play('ui');
      rerenderPaneBody();
    });
    $('#invite-copy')?.addEventListener('click', async () => {
      const name = roomDisplayName($('#invite-room')?.value);
      if (!name) {
        audio.play('deny');
        toast('Enter a server name first', 'bad');
        return;
      }
      const link = inviteLink({ room: name, mode: selectedMode().id, squad: state.settings.squad || '' });
      if (await copyInvite(link)) {
        audio.play('buy');
        toast('Invite link copied', 'good');
      } else {
        toast(link, 'info');
      }
    });
  }
  if (currentPane === 'squad') {
    const code = ensureSquad();
    $('#squad-copy')?.addEventListener('click', async () => {
      const link = `${location.origin}${location.pathname}?squad=${code}`;
      try {
        await navigator.clipboard.writeText(link);
        audio.play('buy');
        toast('Invite link copied', 'good');
      } catch {
        toast(link, 'info');
      }
    });
    $('#squad-new')?.addEventListener('click', () => {
      const next = rotateSquad();
      audio.play('buy');
      toast(`New squad code: ${next}`, 'good');
      rerenderPaneBody();
    });
    const join = () => {
      const v = ($('#squad-input')?.value || '').trim().toUpperCase();
      const ok = setSquad(v);
      if (!ok) {
        audio.play('deny');
        toast('Squad codes are 4 letters or numbers', 'bad');
        return;
      }
      audio.play('buy');
      toast(`Joined squad ${ok}`, 'good');
      rerenderPaneBody();
    };
    $('#squad-join')?.addEventListener('click', join);
    $('#squad-input')?.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') join();
    });
  }
  if (currentPane === 'servers') {
    stopWatchingServers();
    serverUnsub = net.watchDirectory(() => paintServerList());
    $$('#pane-root [data-srv-mode]').forEach((b) => b.addEventListener('click', () => {
      serverFilter = b.dataset.srvMode;
      audio.play('ui');
      rerenderPaneBody();
    }));
    $('#srv-refresh')?.addEventListener('click', () => {
      audio.play('ui');
      paintServerList();
      toast('Server list refreshed', 'info');
    });
    $('#srv-quick')?.addEventListener('click', () => {
      const mode = serverFilter || selectedMode().id;
      const room = quickRoom(mode, net.directory.rooms);
      joinServer(room.mode, room.name);
    });
    wireServerRows();
    const joinByName = () => {
      const input = $('#srv-name');
      const name = roomDisplayName(input?.value);
      if (!name) {
        audio.play('deny');
        toast('Enter a server name first', 'bad');
        input?.focus();
        return;
      }
      const live = findRoomByName(net.directory.rooms, name);
      joinServer(live?.mode || serverFilter || selectedMode().id, name);
    };
    $('#srv-join-btn')?.addEventListener('click', joinByName);
    $('#srv-name')?.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') joinByName();
    });
  }
}

function rerenderPaneBody() {
  const root = $('#pane-root');
  const body = {
    upgrades: renderUpgrades,
    garage: renderGarage,
    leaderboards: renderLeaderboards,
    gameplay: renderGameplay,
    shop: renderShop,
    squad: renderSquad,
    servers: renderServers,
    career: renderCareer,
    medals: renderMedals,
    friends: renderFriends,
    academy: renderAcademyPane,
    maps: renderMapLab,
    ranked: renderRanked,
    theater: renderTheater,
  }[currentPane]?.() ?? '';
  const holder = root.querySelector('.pane-body');
  if (holder) holder.innerHTML = body;
  const pc = root.querySelector('.pane-credits b');
  if (pc) pc.textContent = fmt(state.profile.credits);
  wirePane();
  if (currentPane === 'leaderboards') loadLeaderboard();
  if (currentPane === 'career') loadCareerExtras();
  requestAnimationFrame(paintGaragePreviews);
  if (currentPane === 'shop') requestAnimationFrame(paintSkinPreviews);
}

// ---- upgrades ----------------------------------------------------
function renderUpgrades() {
  const p = state.profile;
  return `<div class="upgrade-grid">${UPGRADE_ORDER.map((key) => {
    const def = UPGRADES[key];
    const lvl = p.upgrades[key] | 0;
    const maxed = lvl >= def.max;
    const cost = upgradeCost(lvl + 1);
    const afford = p.credits >= cost;
    return `<article class="upgrade-card ${maxed ? 'maxed' : ''}">
      <div class="uc-icon">${ICONS[def.icon]}</div>
      <div class="uc-main">
        <h3>${def.name}</h3>
        <p>${def.desc(lvl + (maxed ? 0 : 1))}</p>
        <div class="pips">${Array.from({ length: 5 }, (_, i) =>
          `<i class="${i < lvl ? 'on' : ''}"></i>`).join('')}</div>
      </div>
      <button class="uc-buy ${maxed ? 'done' : afford ? '' : 'poor'}"
        data-upgrade="${key}" ${maxed ? 'disabled' : ''}>
        ${maxed ? 'MAX' : `${ICONS.coin}<span>${fmt(cost)}</span>`}
      </button>
    </article>`;
  }).join('')}</div>
  <p class="pane-note">Upgrades apply to every vehicle in your garage, permanently.</p>`;
}

async function doUpgrade(key, btn) {
  if (btn?.disabled) return;
  btn.classList.add('busy');
  let res;
  if (state.mode === 'account') {
    const r = await net.buyUpgrade(key);
    if (r.ok) { state.profile = fromRowLocal(r.row); res = { ok: true }; }
    else res = { ok: false, why: r.error };
  } else {
    res = buyUpgradeLocal(key);
  }
  btn.classList.remove('busy');
  if (res.ok) {
    audio.play('buy');
    refreshMenu();
    rerenderPaneBody();
    toast(`${UPGRADES[key].name} upgraded`, 'good');
  } else {
    audio.play('deny');
    toast(res.why || 'Upgrade failed', 'bad');
  }
}

// ---- garage ------------------------------------------------------
function renderGarage() {
  const p = state.profile;
  return `${renderNextUnlock(p)}<div class="garage-grid">${TANK_ORDER.map((id) => {
    const t = TANKS[id];
    const owned = p.owned.includes(id);
    const equipped = p.tank === id;
    const locked = p.level < t.unlock;
    const price = state.catalog[id]?.price ?? t.price;
    const stats = deriveStats(id, p.upgrades);
    const btn = equipped
      ? `<button class="tank-btn equipped" disabled>${ICONS.check} EQUIPPED</button>`
      : owned
        ? `<button class="tank-btn" data-tank="${id}">EQUIP</button>`
        : locked
          ? `<button class="tank-btn locked" disabled>${ICONS.lock} LVL ${t.unlock}</button>`
          : `<button class="tank-btn buy" data-tank="${id}">${ICONS.coin} ${fmt(price)}</button>`;
    return `<article class="tank-card ${equipped ? 'active' : ''} ${owned ? '' : 'unowned'}">
      <div class="tc-preview">
        <canvas data-tank-preview="${id}" width="200" height="120"></canvas>
        ${equipped ? '<span class="tc-tag">IN SERVICE</span>' : ''}
      </div>
      <div class="tc-info">
        <div class="tc-head">
          <h3>${t.name}</h3>
          <span class="tc-class">${t.klass}</span>
        </div>
        <p class="tc-blurb">${t.blurb}</p>
        <div class="tc-stats">
          ${statRow('DMG', stats.damage / 60, '#e0a45a')}
          ${statRow('ARM', stats.hp / 260, '#7fb0d0')}
          ${statRow('SPD', stats.speed / 220, '#8fbf5e')}
        </div>
        ${btn}
        ${!owned && locked ? unlockRow(p, t.unlock) : ''}
      </div>
    </article>`;
  }).join('')}</div>`;
}

function statRow(label, pct, color) {
  return `<div class="tc-stat"><span>${label}</span>
    <i><b style="width:${clamp(pct * 100, 6, 100)}%;background:${color}"></b></i></div>`;
}

// ---- unlock paths ------------------------------------------------
function unlockInfo(p, lvl) {
  if (p.level >= lvl) return { ready: true, pct: 1, need: 0 };
  const start = xpForLevel(p.level);
  const end = xpForLevel(lvl);
  return {
    ready: false,
    pct: clamp((p.xp - start) / Math.max(1, end - start), 0, 1),
    need: Math.max(0, end - p.xp),
  };
}

function unlockRow(p, lvl) {
  const info = unlockInfo(p, lvl);
  return `<div class="tc-unlock">
    <div class="tu-bar"><i style="width:${Math.round(info.pct * 100)}%"></i></div>
    <span>${fmt(info.need)} XP TO LVL ${lvl}</span>
  </div>`;
}

function renderNextUnlock(p) {
  const nextTank = TANK_ORDER.map((id) => TANKS[id])
    .filter((t) => !p.owned.includes(t.id) && t.unlock > p.level)
    .sort((a, b) => a.unlock - b.unlock)[0];
  const nextSkin = SKIN_ORDER.map((id) => SKINS[id])
    .filter((s) => !p.ownedSkins.includes(s.id) && s.unlock > p.level)
    .sort((a, b) => a.unlock - b.unlock)[0];
  if (!nextTank && !nextSkin) return '';
  const item = (kind, name, lvl) => {
    const i = unlockInfo(p, lvl);
    return `<div class="gn-item">
      <span class="gn-kind">${kind}</span>
      <b>${esc(name)}</b>
      <i>LVL ${lvl} · ${fmt(i.need)} XP</i>
      <div class="gn-bar"><em style="width:${Math.round(i.pct * 100)}%"></em></div>
    </div>`;
  };
  const parts = [];
  if (nextTank) parts.push(item('VEHICLE', nextTank.name, nextTank.unlock));
  if (nextSkin) parts.push(item('CAMO', nextSkin.name, nextSkin.unlock));
  return `<div class="garage-next">
    <span class="gn-label">NEXT REQUISITION</span>
    ${parts.join('')}
  </div>`;
}

function paintGaragePreviews() {
  $$('[data-tank-preview]').forEach((c) => {
    const t = TANKS[c.dataset.tankPreview];
    if (!t) return;
    const ctx = c.getContext('2d');
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const W = 200, H = 120;
    c.width = W * dpr; c.height = H * dpr;
    c.style.width = W + 'px'; c.style.height = H + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const body = img(t.body), barrel = img(t.barrel);
    if (!body) return;
    const g = ctx.createRadialGradient(W / 2, H / 2, 5, W / 2, H / 2, 90);
    g.addColorStop(0, 'rgba(110,190,80,0.16)');
    g.addColorStop(1, 'rgba(110,190,80,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    const s = 1.05;
    const bw = body.width * s, bh = body.height * s;
    ctx.save();
    ctx.globalAlpha = 0.4;
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.ellipse(W / 2, H / 2 + bh * 0.42, bw * 0.46, bh * 0.2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.rotate(-0.06);
    ctx.drawImage(body, -bw / 2, -bh / 2, bw, bh);
    ctx.restore();

    if (barrel) {
      ctx.save();
      ctx.translate(W / 2, H / 2);
      ctx.rotate(-0.4);
      const brw = barrel.width * s, brh = barrel.height * s;
      ctx.drawImage(barrel, -brw / 2, -brh + bh * 0.12, brw, brh);
      ctx.restore();
    }
  });
}

function paintSkinPreviews() {
  $$('[data-skin-preview]').forEach((c) => {
    const t = TANKS[c.dataset.tank] || TANKS.sherman;
    const ctx = c.getContext('2d');
    const W = 240, H = 118;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    c.width = W * dpr; c.height = H * dpr;
    c.style.width = W + 'px'; c.style.height = H + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const body = img(t.body), barrel = img(t.barrel);
    if (!body) return;
    const s = 1.45;
    const bw = body.width * s, bh = body.height * s;
    ctx.save();
    ctx.translate(W / 2, H * 0.66);
    ctx.rotate(-0.05);
    ctx.drawImage(body, -bw / 2, -bh / 2, bw, bh);
    ctx.restore();
    if (barrel) {
      ctx.save();
      ctx.translate(W / 2, H * 0.66);
      ctx.rotate(-0.48);
      const brw = barrel.width * s, brh = barrel.height * s;
      ctx.drawImage(barrel, -brw / 2, -brh + bh * 0.12, brw, brh);
      ctx.restore();
    }
    c.style.filter = skinCss(c.dataset.skinPreview);
  });
}

async function doTank(id, btn) {
  const p = state.profile;
  const t = TANKS[id];
  if (!t) return;
  btn.classList.add('busy');
  const owned = p.owned.includes(id);

  if (state.mode === 'account') {
    const r = owned ? await net.equipTank(id) : await net.buyTank(id);
    btn.classList.remove('busy');
    if (r.ok) {
      state.profile = fromRowLocal(r.row);
      audio.play(owned ? 'ui' : 'buy');
      refreshMenu();
      rerenderPaneBody();
      toast(owned ? `${t.name} equipped` : `${t.name} requisitioned`, 'good');
    } else {
      audio.play('deny');
      toast(r.error || 'Unavailable', 'bad');
    }
    return;
  }

  if (owned) {
    equipTankLocal(id);
    btn.classList.remove('busy');
    audio.play('ui');
    refreshMenu();
    rerenderPaneBody();
    return;
  }
  const res = buyTankLocal(id);
  btn.classList.remove('busy');
  if (res.ok) {
    audio.play('buy');
    refreshMenu();
    rerenderPaneBody();
    toast(`${t.name} requisitioned`, 'good');
  } else {
    audio.play('deny');
    toast(res.why, 'bad');
  }
}

// ---- shop --------------------------------------------------------
function countdown(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function renderShop() {
  const tabs = [['vehicles', 'VEHICLES'], ['camo', 'CAMO'], ['salvage', 'SALVAGE'], ['supply', 'SUPPLY']];
  const body = shopTab === 'camo' ? renderCamo()
    : shopTab === 'supply' ? renderSupply()
    : shopTab === 'salvage' ? renderSalvage()
    : renderShopVehicles();
  return `<div class="shop-tabs">${tabs.map(([k, l]) =>
    `<button class="shop-tab ${shopTab === k ? 'on' : ''}" data-shop-tab="${k}">${l}</button>`).join('')}</div>${body}`;
}

function renderShopVehicles() {
  const p = state.profile;
  return `<div class="shop-grid">${TANK_ORDER.map((id) => {
    const t = TANKS[id];
    const owned = p.owned.includes(id);
    const equipped = p.tank === id;
    const locked = p.level < t.unlock;
    const price = state.catalog[id]?.price ?? t.price;
    const btn = equipped
      ? `<button class="sc-buy done" disabled>EQUIPPED</button>`
      : owned
        ? `<button class="sc-buy" data-tank="${id}">EQUIP</button>`
        : locked
          ? `<button class="sc-buy locked" disabled>LVL ${t.unlock}</button>`
          : `<button class="sc-buy" data-tank="${id}">${ICONS.coin}${fmt(price)}</button>`;
    return `<article class="shop-card ${owned ? 'owned' : ''} ${equipped ? 'equipped' : ''}">
      <div class="sc-top"><h3>${t.name}</h3><span class="sc-rarity">${t.klass}</span></div>
      <div class="sc-swatch"><canvas data-tank-preview="${id}" width="264" height="156"></canvas></div>
      <p class="sc-blurb">${t.blurb}</p>
      <div class="sc-foot">
        <span class="sc-note">${owned ? 'IN INVENTORY' : locked ? 'LVL ' + t.unlock + ' · ' + fmt(unlockInfo(p, t.unlock).need) + ' XP' : fmt(price) + ' CR'}</span>
        ${btn}
      </div>
    </article>`;
  }).join('')}</div>`;
}

function renderCamo() {
  const p = state.profile;
  const tank = TANKS[p.tank] || TANKS.sherman;
  return `<div class="shop-grid">${SKIN_ORDER.map((id) => {
    const s = SKINS[id];
    const owned = p.ownedSkins.includes(id);
    const active = p.skin === id;
    const locked = p.level < s.unlock;
    const btn = active
      ? `<button class="sc-buy done" disabled>ACTIVE</button>`
      : owned
        ? `<button class="sc-buy" data-skin="${id}">APPLY</button>`
        : locked
          ? `<button class="sc-buy locked" disabled>LVL ${s.unlock}</button>`
          : `<button class="sc-buy" data-skin="${id}">${ICONS.coin}${fmt(s.price)}</button>`;
    return `<article class="shop-card ${owned ? 'owned' : ''} ${active ? 'equipped' : ''}">
      <div class="sc-top"><h3>${s.name}</h3><span class="sc-rarity ${s.rarity.toLowerCase()}">${s.rarity}</span></div>
      <div class="sc-swatch"><canvas data-skin-preview="${id}" data-tank="${tank.id}" width="264" height="156"></canvas></div>
      <p class="sc-blurb">${s.blurb}</p>
      <div class="sc-foot">
        <span class="sc-note">${owned ? (active ? 'EQUIPPED' : 'OWNED') : locked ? 'REQUIRES LEVEL ' + s.unlock : fmt(s.price) + ' CR'}</span>
        ${btn}
      </div>
    </article>`;
  }).join('')}</div>`;
}

function msToUtcMidnight() {
  const now = new Date();
  const next = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
  return Math.max(0, next - now.getTime());
}

function renderContracts() {
  const c = ensureContracts();
  if (!c) return '';
  const modeName = (MODES[c.mode] || MODES.team).name;
  const claimed = c.claimed || [];
  const readyIds = CONTRACT_DEFS.map((d, i) => i)
    .filter((i) => (c[CONTRACT_DEFS[i].key] || 0) >= CONTRACT_DEFS[i].target && !claimed.includes(i));
  const head = `<div class="cc-headrow">
      <div>
        <b>DAILY CONTRACTS</b>
        <span>${claimed.length}/${CONTRACT_DEFS.length} claimed · resets in ${countdown(msToUtcMidnight())}</span>
      </div>
      ${readyIds.length > 1 ? `<button class="sc-buy cc-all" id="claim-all">${ICONS.coin}CLAIM ALL · ${readyIds.length}</button>` : ''}
    </div>`;
  return `${head}<div class="contract-grid">${CONTRACT_DEFS.map((d, i) => {
    const have = Math.min(d.target, c[d.key] || 0);
    const done = have >= d.target;
    const isClaimed = claimed.includes(i);
    return `<article class="contract-card ${isClaimed ? 'done' : done ? 'ready' : ''}">
      <div class="cc-head"><h3>${d.title}</h3><span class="cc-reward">${ICONS.coin}${fmt(d.reward)}</span></div>
      <p>${esc(d.sub.replace('{mode}', modeName))}</p>
      <div class="cc-bar"><i style="width:${(have / d.target) * 100}%"></i></div>
      <div class="cc-foot"><span>${have} / ${d.target}</span>
        ${isClaimed
          ? '<button class="sc-buy done" disabled>✓ CLAIMED</button>'
          : done
            ? `<button class="sc-buy" data-contract="${i}">${ICONS.coin}CLAIM</button>`
            : '<button class="sc-buy locked" disabled>IN PROGRESS</button>'}
      </div>
    </article>`;
  }).join('')}</div>`;
}

function renderSupply() {
  const d = dailyState();
  return `${renderContracts()}<div class="daily-card">
    <div class="daily-crate ${d.ready ? 'ready' : ''}">${ICONS.crate}</div>
    <div class="daily-copy">
      <h3>SUPPLY DROP</h3>
      <p>One free requisition crate every 20 hours. Credits go straight into your field account and can be spent on vehicles, camouflage or upgrades.</p>
      <div class="daily-timer">${d.ready ? 'CRATE READY TO OPEN' : 'NEXT CRATE IN ' + countdown(d.msLeft)}</div>
    </div>
    <button class="sc-buy ${d.ready ? '' : 'locked'}" id="daily-claim" ${d.ready ? '' : 'disabled'}>
      ${ICONS.crate}<span>${d.ready ? 'OPEN' : 'LOCKED'}</span>
    </button>
  </div>`;
}

// ---- career ------------------------------------------------------
function ago(ts) {
  const s = Math.max(0, (Date.now() - ts) / 1000);
  if (s < 90) return 'JUST NOW';
  if (s < 3600) return Math.floor(s / 60) + 'M AGO';
  if (s < 86400) return Math.floor(s / 3600) + 'H AGO';
  return Math.floor(s / 86400) + 'D AGO';
}

function renderCareer() {
  const p = state.profile;
  const l = state.local || loadLocal();
  const t = careerTotals(l);
  const pts = lifetimePoints(p);
  const tier = tierFor(pts);
  const wp = l.weekly;
  const wpts = weekPoints(wp);
  const prog = tierProgress(wpts);
  const stat = (label, value, sub) => `<div class="career-stat"><b>${value}</b><span>${label}</span>${sub ? `<i>${sub}</i>` : ''}</div>`;
  const rows = TANK_ORDER.map((id) => {
    const rec = l.tankStats[id];
    if (!rec || !rec.matches) return '';
    const kd = rec.deaths ? (rec.kills / rec.deaths).toFixed(2) : rec.kills.toFixed(2);
    const wr = Math.round((rec.wins / Math.max(1, rec.matches)) * 100);
    return `<div class="career-tr">
      <span class="ctr-name">${TANKS[id].name}</span>
      <span>${rec.kills}</span><span>${kd}</span><span>${rec.matches}</span><span>${wr}%</span>
    </div>`;
  }).join('');
  const matches = (l.history || []).map((m) => {
    const tank = TANKS[m.tank]?.name || 'M4 SHERMAN';
    return `<div class="career-match ${m.won ? 'won' : ''}">
      <span class="cm-result">${m.won ? 'V' : 'D'}</span>
      <div class="cm-main"><b>${esc(m.modeName || m.mode)}</b>
        <i>${esc(tank)} · ${esc(m.map || m.room || 'FIELD')} · ${ago(m.at)}</i></div>
      <div class="cm-line"><b>${m.kills}K</b> / ${m.deaths}D · ${m.accuracy}%</div>
    </div>`;
  }).join('');
  return `<div class="career-banner" style="--tier:${tier.color};--tier-bg:${tier.tint}">
      <div class="cb-tier">
        <span class="cb-glyph">${tierGlyph(tier.id)}</span>
        <div><b>${tier.name}</b><span>${fmt(pts)} CAREER POINTS</span></div>
      </div>
      <div class="cb-week">
        <span>SEASON WEEK ${weekNumber()}</span>
        <b>${fmt(wpts)} PTS</b>
        <i>${wp.matches} BATTLES · ${daysLeft()}D LEFT</i>
      </div>
      <div class="cb-salvage">${ICONS.crate}<div><b>${fmt(l.salvage)}</b><span>SALVAGE</span></div></div>
      <button id="dogtag-open" class="cb-dogtag">SHARE DOG TAG</button>
    </div>
    <div class="career-grid">
      ${stat('KILLS', fmt(p.kills))}
      ${stat('DEATHS', fmt(p.deaths))}
      ${stat('K / D', (p.deaths ? p.kills / p.deaths : p.kills).toFixed(2))}
      ${stat('WINS', fmt(p.wins))}
      ${stat('BATTLES', fmt(p.matches))}
      ${stat('BEST SCORE', fmt(p.bestScore))}
      ${stat('BEST STREAK', t.bestStreak, 'THIS DEVICE')}
      ${stat('ACCURACY', t.accuracy + '%', 'THIS DEVICE')}
    </div>
    <div class="season-track">
      <div class="st-line"><span>WEEK ${weekNumber()} · ${prog.tier.name}</span><span>${prog.next ? `${fmt(prog.need)} TO ${prog.next.name}` : 'MAX TIER'}</span></div>
      <div class="st-bar"><i style="width:${Math.round(prog.pct * 100)}%;background:${prog.tier.color}"></i></div>
    </div>
    <div class="career-split">
      <section class="career-card">
        <h3>VEHICLE RECORD</h3>
        ${rows ? `<div class="career-table"><div class="career-tr head"><span>VEHICLE</span><span>K</span><span>K/D</span><span>BATTLES</span><span>WIN%</span></div>${rows}</div>`
          : '<p class="career-empty">No battles logged yet. Your first deploy starts the record.</p>'}
      </section>
      <section class="career-card">
        <h3>RECENT BATTLES</h3>
        <div id="career-history">${matches || '<p class="career-empty">Nothing on file yet.</p>'}</div>
        <div id="career-server"></div>
      </section>
    </div>
    <p class="pane-note">Battle history, streaks and salvage are stored on this device. Season points reset every Monday 00:00 UTC.</p>`;
}

async function loadCareerExtras() {
  if (state.mode !== 'account') return;
  const res = await net.fetchHistory(20);
  const holder = $('#career-server');
  if (!holder || !holder.isConnected) return;
  if (!res.ok || !res.rows.length) { holder.innerHTML = ''; return; }
  holder.innerHTML = `<b class="career-sub">COMMAND ARCHIVE</b>${res.rows.map((r) => {
    const at = Date.parse(r.played_at) || Date.now();
    return `<div class="career-match ${r.won ? 'won' : ''}">
      <span class="cm-result">${r.won ? 'V' : 'D'}</span>
      <div class="cm-main"><b>RECORDED BATTLE</b><i>${ago(at)}</i></div>
      <div class="cm-line"><b>${r.kills}K</b> / ${r.deaths}D</div>
    </div>`;
  }).join('')}`;
}

// ---- medals ------------------------------------------------------
function renderMedals() {
  const l = state.local || loadLocal();
  const ctx = { profile: state.profile, local: l };
  const done = unlockedCount(l);
  return `<div class="medal-head">
      <div class="mh-count"><b>${done} / ${MEDALS.length}</b><span>MEDALS EARNED</span></div>
      <div class="mh-salvage">${ICONS.crate}<b>${fmt(l.salvage)}</b><span>SALVAGE</span></div>
    </div>
    <div class="medal-grid">${MEDALS.map((m) => {
      const p = medalProgress(m, ctx);
      const on = !!l.medals[m.id];
      return `<article class="medal-card ${on ? 'on' : ''} ${m.tier.toLowerCase()}">
        <div class="mc-tier">${m.tier}</div>
        <h3>${m.name}</h3>
        <p>${m.desc}</p>
        <div class="mc-bar"><i style="width:${Math.round(p.pct * 100)}%"></i></div>
        <div class="mc-foot"><span>${on ? 'EARNED' : `${p.have} / ${p.need}`}</span><b>+${m.salvage}</b></div>
      </article>`;
    }).join('')}</div>
    <p class="pane-note">Every medal pays salvage the moment it unlocks. Salvage buys emblems, shell trails and kill effects in the shop.</p>`;
}

// ---- friends -----------------------------------------------------
function friendRowsHtml() {
  const list = friendsWithStatus(net.lobby);
  if (!list.length) {
    return '<div class="friend-empty">No friends yet. Add a callsign below — when they are online you can drop into their server.</div>';
  }
  return list.map((f) => `<article class="friend-row ${f.online ? 'on' : ''}">
      <span class="friend-dot"></span>
      <div class="friend-id"><b>${esc(f.name)}</b>
        <span>${f.online
          ? (f.room ? `IN ${esc(f.room.name)} · ${MODES[f.room.mode]?.name || 'ARENA'}` : 'ONLINE IN THE MENU')
          : 'OFFLINE'}</span></div>
      ${f.level ? `<span class="friend-lvl">LVL ${f.level}</span>` : ''}
      ${f.room ? `<button class="sc-buy" data-friend-join="${esc(f.room.name)}" data-friend-mode="${esc(f.room.mode)}">JOIN</button>` : ''}
      <button class="friend-x" data-unfriend="${esc(f.name)}" title="Remove friend">×</button>
    </article>`).join('');
}

function renderFriends() {
  const list = friendsWithStatus(net.lobby);
  const online = list.filter((f) => f.online).length;
  return `<div class="friend-head">
      <div><b>${list.length} ON YOUR LIST</b><span>${online} ONLINE NOW</span></div>
      <button class="srv-refresh" id="friend-refresh">REFRESH</button>
    </div>
    <div class="friend-list" id="friend-list">${friendRowsHtml()}</div>
    <div class="friend-add">
      <label class="field"><span>ADD BY CALLSIGN</span>
        <input id="friend-name" maxlength="16" placeholder="IRONWOLF" autocomplete="off" spellcheck="false" />
      </label>
      <button class="btn" id="friend-add">ADD FRIEND</button>
    </div>
    <div class="friend-invite">
      <label class="field"><span>INVITE TO A SERVER</span>
        <input id="invite-room" maxlength="16" value="${DEFAULT_ROOM}" autocomplete="off" spellcheck="false" />
      </label>
      <button class="btn btn-ghost" id="invite-copy">COPY INVITE LINK</button>
    </div>
    <p class="pane-note">Invite links open IronStorm straight into that server and carry your squad code. Online status comes from live presence; the friends list itself is stored on this device.</p>`;
}

function paintFriendList() {
  if (currentPane !== 'friends') return;
  const holder = $('#friend-list');
  if (!holder) return;
  holder.innerHTML = friendRowsHtml();
  $$('#pane-root [data-unfriend]').forEach((b) =>
    b.addEventListener('click', () => {
      removeFriend(b.dataset.unfriend);
      audio.play('uiBack');
      rerenderPaneBody();
    }));
  $$('#pane-root [data-friend-join]').forEach((b) =>
    b.addEventListener('click', () => joinServer(b.dataset.friendMode, b.dataset.friendJoin)));
}

// ---- salvage cosmetics ------------------------------------------
function renderSalvage() {
  const l = state.local || loadLocal();
  const sections = Object.entries(COSMETIC_KINDS).map(([kind, meta]) => {
    const cards = cosmeticsOfKind(kind).map((item) => {
      const owned = ownsCosmetic(l, kind, item.id);
      const active = equippedCosmetic(l, kind) === item.id;
      const afford = (l.salvage | 0) >= item.price;
      return `<article class="cosmetic-card ${active ? 'equipped' : ''} ${owned ? 'owned' : ''}">
        <div class="cos-glyph">${item.glyph}</div>
        <h4>${item.name}</h4>
        <p>${item.blurb}</p>
        <div class="cos-foot">
          <span>${owned ? (active ? 'EQUIPPED' : 'OWNED') : fmt(item.price) + ' SALVAGE'}</span>
          ${active
            ? '<button class="sc-buy done" disabled>ACTIVE</button>'
            : `<button class="sc-buy ${!owned && !afford ? 'locked' : ''}" data-cosmetic="${item.key}" ${!owned && !afford ? 'disabled' : ''}>${owned ? 'EQUIP' : 'BUY'}</button>`}
        </div>
      </article>`;
    }).join('');
    return `<section class="cosmetic-section">
      <div class="cos-head"><h3>${meta.label}</h3><span>${meta.sub}</span></div>
      <div class="cosmetic-grid">${cards}</div>
    </section>`;
  }).join('');
  return `<div class="salvage-head">
      <div><b>${fmt(l.salvage)}</b><span>SALVAGE AVAILABLE</span></div>
      <p>Earned from every battle and from medals. Salvage never expires and is shared across every tank.</p>
    </div>${sections}
    <p class="pane-note">Cosmetics are stored locally with your career record, so they follow this device rather than the account.</p>`;
}

function doCosmetic(key, btn) {
  const item = COSMETIC_ITEMS.find((c) => c.key === key);
  if (!item) return;
  const l = state.local || loadLocal();
  const owned = ownsCosmetic(l, item.kind, item.id);
  const res = owned
    ? equipCosmeticLocal(l, item.kind, item.id)
    : buyCosmeticLocal(l, item.kind, item.id);
  if (res.ok) {
    saveLocal(state.uid, l);
    audio.play(owned ? 'ui' : 'buy');
    refreshMenu();
    rerenderPaneBody();
    toast(owned ? `${item.name} equipped` : `${item.name} unlocked`, 'good');
  } else {
    audio.play('deny');
    toast(res.why || 'Unavailable', 'bad');
  }
}

// ---- squad -------------------------------------------------------
function renderSquad() {
  const code = ensureSquad();
  const mates = squadmates();
  const link = `${location.origin}${location.pathname}?squad=${code}`;
  return `<div class="squad-hero">
      <div class="squad-code">
        <span>SQUAD CODE</span>
        <b id="squad-code">${code}</b>
      </div>
      <div class="squad-copy">
        <h3>ROLL WITH YOUR SQUAD</h3>
        <p>Squadmates carry a green diamond over their hull in the arena and drop into the same global battle. Share the code or send the invite link.</p>
        <div class="squad-actions">
          <button class="btn" id="squad-copy">COPY INVITE LINK</button>
          <button class="btn btn-ghost" id="squad-new">NEW CODE</button>
        </div>
      </div>
    </div>
    <div class="squad-join">
      <label class="field"><span>JOIN A SQUAD</span>
        <input id="squad-input" maxlength="4" placeholder="CODE" autocomplete="off" spellcheck="false" />
      </label>
      <button class="btn" id="squad-join">JOIN</button>
    </div>
    <p class="pane-note">Invite link — <b class="squad-link">${esc(link)}</b></p>
    <div class="squad-roster">
      <b>RECENT SQUADMATES</b>
      <div class="squad-mates">${mates.length
        ? mates.map((n) => `<span class="squad-mate">◆ ${esc(n)}</span>`).join('')
        : '<span class="squad-empty">No squadmates sighted yet — share the link to roll together.</span>'}</div>
    </div>`;
}

// ---- servers -----------------------------------------------------
function stopWatchingServers() {
  if (serverUnsub) {
    serverUnsub();
    serverUnsub = null;
  }
}

function stopWatchingFriends() {
  if (friendUnsub) {
    friendUnsub();
    friendUnsub = null;
  }
}

function renderServers() {
  const mode = serverFilter || selectedMode().id;
  return `<div class="srv-head">
      <div class="srv-tabs">${MODE_ORDER.map((id) =>
        `<button class="srv-tab ${id === mode ? 'on' : ''}" data-srv-mode="${id}">${MODES[id].name}</button>`).join('')}</div>
      <button class="srv-refresh" id="srv-refresh">REFRESH</button>
    </div>
    <div class="srv-list" id="srv-list">${serverRowsHtml(mode)}</div>
    <div class="srv-join">
      <label class="field"><span>JOIN BY SERVER NAME</span>
        <input id="srv-name" maxlength="16" placeholder="MY SERVER" autocomplete="off" spellcheck="false" />
      </label>
      <button class="btn" id="srv-join-btn">JOIN</button>
    </div>
    <button class="btn srv-quick" id="srv-quick">QUICKPLAY · ${MODES[mode].name}</button>
    <p class="pane-note">Quickplay drops you into the busiest ${MODES[mode].name} server with a free slot. Server names are shared by everyone — tell a friend the name and you land in the same match.</p>`;
}

function serverRowsHtml(mode) {
  return roomRows(mode, net.directory.rooms).map((r) => {
    const full = r.players >= ROOM_CAPACITY;
    const pct = clamp((r.players / ROOM_CAPACITY) * 100, 2, 100);
    return `<article class="srv-row ${full ? 'full' : ''}">
      <div class="srv-id">
        <b>${esc(r.name)}</b>
        <span>${MODES[mode].name} · ${r.players}/${ROOM_CAPACITY}${r.players === 0 ? ' · EMPTY' : ''}${r.rules && r.rules.mutator !== 'standard' ? ' · ' + MUTATORS[r.rules.mutator].name : ''}</span>
      </div>
      <div class="srv-occ"><i style="width:${pct}%"></i></div>
      <button class="sc-buy ${full ? 'locked' : ''}" data-join-mode="${r.mode}" data-join-name="${esc(r.name)}" ${full ? 'disabled' : ''}>${full ? 'FULL' : 'JOIN'}</button>
    </article>`;
  }).join('');
}

function paintServerList() {
  if (currentPane !== 'servers') return;
  const holder = $('#srv-list');
  if (!holder) return;
  holder.innerHTML = serverRowsHtml(serverFilter || selectedMode().id);
  wireServerRows();
}

function wireServerRows() {
  $$('#srv-list [data-join-name]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const mode = btn.dataset.joinMode;
      const row = roomRows(mode, net.directory.rooms).find((r) => r.name === btn.dataset.joinName);
      joinServer(mode, btn.dataset.joinName, row?.players || 0);
    });
  });
}

function joinServer(mode, name, players = null) {
  const row = roomRows(mode, net.directory.rooms).find((r) => r.name === roomDisplayName(name));
  const count = players ?? row?.players ?? 0;
  if (count >= ROOM_CAPACITY) {
    audio.play('deny');
    toast('That server is full', 'bad');
    return;
  }
  audio.play('ui');
  document.dispatchEvent(new CustomEvent('ironstorm:join', { detail: makeRoom(mode, name) }));
  closePane();
}

async function doSkin(id, btn) {
  const s = SKINS[id];
  if (!s) return;
  btn?.classList.add('busy');
  const owned = state.profile.ownedSkins.includes(id);
  let res;
  if (state.mode === 'account') {
    const r = owned ? await net.equipSkin(id) : await net.buySkin(id);
    if (r.ok) { state.profile = fromRowLocal(r.row); res = { ok: true }; }
    else res = { ok: false, why: r.error };
  } else if (owned) {
    res = equipSkinLocal(id) ? { ok: true } : { ok: false, why: 'Unavailable' };
  } else {
    res = buySkinLocal(id);
  }
  btn?.classList.remove('busy');
  if (res.ok) {
    audio.play(owned ? 'ui' : 'buy');
    refreshMenu();
    rerenderPaneBody();
    toast(owned ? `${s.name} applied` : `${s.name} unlocked`, 'good');
  } else {
    audio.play('deny');
    toast(res.why || 'Unavailable', 'bad');
  }
}

async function doClaimAll(btn) {
  btn?.classList.add('busy');
  const c = ensureContracts();
  const claimed = c.claimed || [];
  const ids = CONTRACT_DEFS.map((d, i) => i)
    .filter((i) => (c[CONTRACT_DEFS[i].key] || 0) >= CONTRACT_DEFS[i].target && !claimed.includes(i));
  let paid = 0;
  for (const i of ids) {
    if (state.mode === 'account') {
      const r = await net.claimContract(i);
      if (r.ok) { state.profile = fromRowLocal(r.row); paid += CONTRACT_DEFS[i].reward; }
    } else {
      const r = claimContractLocal(i);
      if (r.ok) paid += r.reward;
    }
  }
  btn?.classList.remove('busy');
  if (paid) {
    audio.play('buy');
    refreshMenu();
    rerenderPaneBody();
    toast(`${ids.length} contracts claimed: +${fmt(paid)} credits`, 'good');
  } else {
    audio.play('deny');
    toast('Nothing left to claim', 'bad');
  }
}

async function doContract(index, btn) {
  btn?.classList.add('busy');
  let res;
  if (state.mode === 'account') {
    const r = await net.claimContract(index);
    if (r.ok) { state.profile = fromRowLocal(r.row); res = { ok: true, reward: CONTRACT_DEFS[index].reward }; }
    else res = { ok: false, why: r.error };
  } else {
    res = claimContractLocal(index);
  }
  btn?.classList.remove('busy');
  if (res.ok) {
    audio.play('buy');
    refreshMenu();
    rerenderPaneBody();
    toast(`Contract complete: +${fmt(res.reward)} credits`, 'good');
  } else {
    audio.play('deny');
    toast(res.why || 'Unavailable', 'bad');
  }
}

async function doDaily(btn) {
  if (!btn || btn.disabled) return;
  btn.classList.add('busy');
  let res;
  if (state.mode === 'account') {
    const r = await net.claimDaily();
    if (r.ok) {
      if (r.row) state.profile = fromRowLocal(r.row);
      res = { ok: true, reward: r.reward };
    } else res = { ok: false, why: r.error };
  } else {
    res = claimDailyLocal();
  }
  btn.classList.remove('busy');
  if (res.ok) {
    audio.play('buy');
    refreshMenu();
    rerenderPaneBody();
    toast(`Supply crate: +${fmt(res.reward || 0)} credits`, 'good');
  } else {
    audio.play('deny');
    toast(res.why || 'Crate unavailable', 'bad');
  }
}

// ---- leaderboard -------------------------------------------------
function renderLeaderboards() {
  const tabs = [
    ['kills', 'KILLS'], ['wins', 'WINS'], ['level', 'LEVEL'],
    ['best_score', 'BEST SCORE'], ['kd', 'K / D'], ['season', 'SEASON'],
  ];
  return `
    <div class="lb-tabs">${tabs.map(([k, label]) =>
      `<button class="lb-tab ${leaderMetric === k ? 'on' : ''}" data-metric="${k}">${label}</button>`).join('')}
    </div>
    <div class="lb-filters">
      <div class="lb-filter-tabs">
        ${[['all', tr('lb.all', 'ALL TIME')], ['week', tr('lb.week', 'THIS WEEK')], ['friends', tr('lb.friends', 'FRIENDS')], ['vehicle', tr('lb.vehicle', 'VEHICLE')]].map(([k, label]) =>
          `<button class="lb-filter ${leaderFilter === k ? 'on' : ''}" data-lb-filter="${k}">${label}</button>`).join('')}
      </div>
      <select id="lb-tank" class="lb-tank" aria-label="Vehicle">${TANK_ORDER.map((id) =>
        `<option value="${id}" ${leaderTank === id ? 'selected' : ''}>${TANKS[id].name}</option>`).join('')}</select>
    </div>
    <div class="lb-table" id="lb-table"><div class="lb-loading">FETCHING RANKINGS…</div></div>`;
}

function renderSeasonPanel() {
  const l = state.local || loadLocal();
  const pts = weekPoints(l.weekly);
  const prog = tierProgress(pts);
  const next = prog.next;
  return `<div class="season-panel" style="--tier:${prog.tier.color}">
    <div class="season-head">
      <div class="sh-week"><span>SEASON</span><b>WEEK ${weekNumber()}</b><i>${daysLeft()} DAYS REMAINING</i></div>
      <div class="sh-tier">${tierGlyph(prog.tier.id)} ${prog.tier.name}</div>
    </div>
    <div class="season-stats">
      <div><b>${fmt(pts)}</b><span>POINTS</span></div>
      <div><b>${l.weekly.kills | 0}</b><span>KILLS</span></div>
      <div><b>${l.weekly.wins | 0}</b><span>WINS</span></div>
      <div><b>${l.weekly.matches | 0}</b><span>BATTLES</span></div>
    </div>
    <div class="season-line"><span>${prog.tier.name}</span><span>${next ? next.name : 'MAX'}</span></div>
    <div class="season-bar"><i style="width:${Math.round(prog.pct * 100)}%"></i></div>
    <div class="season-next">${next ? `${fmt(prog.need)} POINTS TO ${next.name}` : 'MAXIMUM TIER — HOLD THE LINE'}</div>
    <div class="tier-ladder">${TIERS.map((t) => {
      const rw = seasonReward(t.id);
      const claimed = !!l.seasonClaims?.[t.id];
      const locked = pts < t.min;
      return `<div class="tier-row ${prog.tier.id === t.id ? 'on' : ''}" style="--tier:${t.color}">
        <span>${tierGlyph(t.id)} ${t.name}</span><b>${fmt(t.min)}+</b>
        ${rw ? `<i class="tier-reward">+${rw.salvage} SALVAGE${rw.cosmetic ? ' · COSMETIC' : ''}</i>
        <button class="tier-claim" data-claim-tier="${t.id}" ${claimed || locked ? 'disabled' : ''}>${claimed ? 'CLAIMED' : locked ? 'LOCKED' : 'CLAIM'}</button>` : ''}
      </div>`;
    }).join('')}</div>
    ${l.seasonPayout ? `<p class="season-payout">BEST WEEK PAYOUT · ${esc(l.seasonPayout.week)} · +${fmt(l.seasonPayout.salvage)} SALVAGE</p>` : ''}
    <p class="pane-note">Weekly points come from kills, wins and completed battles. They reset every Monday 00:00 UTC; your best week is kept and paid out in salvage. Tier badges beside global rankings reflect lifetime points.</p>
  </div>`;
}

async function loadLeaderboard() {
  const holder = $('#lb-table');
  if (!holder) return;
  if (leaderMetric === 'season') {
    holder.innerHTML = renderSeasonPanel();
    holder.querySelectorAll('[data-claim-tier]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const res = claimSeasonReward(btn.dataset.claimTier);
        if (!res.ok) { audio.play('deny'); toast(res.why, 'bad'); return; }
        audio.play('buy');
        toast(`Tier reward: +${fmt(res.reward.salvage)} salvage${res.reward.cosmetic ? ' and a cosmetic' : ''}`, 'good');
        loadLeaderboard();
      });
    });
    return;
  }
  if (leaderFilter === 'week') {
    const local = state.local || loadLocal();
    const rows = [...(net.lobby?.values?.() || [])]
      .filter((m) => m && m.name)
      .map((m) => ({ name: m.name, wp: m.wp | 0, level: m.level | 0, room: m.roomName || '' }));
    rows.push({ name: state.profile.username, wp: weekPoints(local.weekly), level: state.profile.level, room: 'YOU' });
    const seen = new Set();
    const board = rows
      .filter((r) => (seen.has(r.name) ? false : seen.add(r.name)))
      .sort((a, b) => b.wp - a.wp || a.name.localeCompare(b.name));
    holder.innerHTML = `<div class="lb-caption">LIVE WEEKLY · ONLINE COMMANDERS</div>
      <div class="lb-row lb-head"><span class="lb-rank">#</span><span class="lb-name">COMMANDER</span>
      <span>WEEK</span><span>LVL</span><span>SERVER</span><span>STATUS</span></div>
      ${board.map((r, i) => `<div class="lb-row ${r.name === state.profile.username ? 'lb-me' : ''}">
        <span class="lb-rank">${i + 1}</span><span class="lb-name">${esc(r.name)}</span>
        <span>${fmt(r.wp)}</span><span>${r.level}</span><span>${esc(r.room || '—')}</span>
        <span>${r.room === 'YOU' ? 'YOU' : 'LIVE'}</span></div>`).join('')}`;
    return;
  }
  if (leaderFilter === 'vehicle') {
    const local = state.local || loadLocal();
    const rec = local.tankStats?.[leaderTank] || { kills: 0, deaths: 0, matches: 0, wins: 0, shots: 0, hits: 0 };
    const kd = rec.deaths ? (rec.kills / rec.deaths).toFixed(2) : (rec.kills || 0).toFixed(2);
    const wr = Math.round((rec.wins / Math.max(1, rec.matches)) * 100);
    const acc = rec.shots ? Math.round((rec.hits / rec.shots) * 100) : 0;
    holder.innerHTML = `<div class="lb-caption">YOUR ${TANKS[leaderTank].name} RECORD</div>
      <div class="lb-vehicle"><b>${fmt(rec.kills)}</b><span>KILLS</span><b>${kd}</b><span>K/D</span><b>${rec.matches}</b><span>BATTLES</span><b>${wr}%</b><span>WINS</span><b>${acc}%</b><span>ACCURACY</span></div>
      <p class="pane-note">Vehicle records come from your local battle ledger; the command database only stores career totals.</p>`;
    return;
  }
  const col = { kills: 'kills', wins: 'wins', level: 'level', best_score: 'best_score', kd: 'kd' }[leaderMetric];
  const res = await net.fetchLeaderboard(col);
  if (!holder.isConnected) return;
  let rows = res.rows || [];
  if (leaderFilter === 'friends') {
    const names = new Set(friendsWithStatus().map((f) => f.name));
    names.add(state.profile.username);
    rows = rows.filter((r) => names.has(r.username));
  }
  if (!res.ok || !rows.length) {
    const me = state.profile;
    holder.innerHTML = `
      <div class="lb-empty">
        <p>No ranked commanders yet — or command is offline.</p>
        <div class="lb-row lb-me">
          <span class="lb-rank">—</span><span class="lb-name">${esc(me.username)}</span>
          <span>${fmt(me.kills)}</span><span>${fmt(me.wins)}</span><span>${me.level}</span>
          <span>${fmt(me.bestScore)}</span><span>${me.deaths ? (me.kills / me.deaths).toFixed(2) : me.kills.toFixed(2)}</span>
        </div>
      </div>`;
    return;
  }
  const me = state.profile.username;
  holder.innerHTML = `
    <div class="lb-row lb-head">
      <span class="lb-rank">#</span><span class="lb-name">COMMANDER</span>
      <span>KILLS</span><span>WINS</span><span>LVL</span><span>BEST</span><span>K/D</span>
    </div>
    ${rows.map((r, i) => {
      const tier = tierFor(lifetimePoints(r));
      return `
      <div class="lb-row ${r.username === me ? 'lb-me' : ''}">
        <span class="lb-rank">${i < 3 ? ['①', '②', '③'][i] : i + 1}</span>
        <span class="lb-name"><i class="lb-tier" style="color:${tier.color}" title="${tier.name}">${tierGlyph(tier.id)}</i>${esc(r.username)}</span>
        <span>${fmt(r.kills)}</span><span>${fmt(r.wins)}</span><span>${r.level}</span>
        <span>${fmt(r.best_score)}</span><span>${Number(r.kd || 0).toFixed(2)}</span>
      </div>`;
    }).join('')}`;
}

// ---- academy -----------------------------------------------------
function renderAcademyPane() {
  const drills = [
    ['01', 'DRIVE THE HULL', 'Roll forward, turn, and learn how the tracks carry speed into a corner.'],
    ['02', 'FIRE AND RELOAD', 'Put three shells into the target dummies and watch the reload bar.'],
    ['03', 'DASH TO THE ZONE', 'Dash into the marked circle and hold it for three seconds.'],
  ];
  return `<div class="academy-pane">
    <div class="academy-hero">
      <span class="ah-kicker">FIELD TRAINING · NO REWARDS</span>
      <h3>THREE DRILLS. THEN THE RANGE.</h3>
      <p>No bots hunting you, no score, no rank change. Finish the drills and the free-fire range opens with unlimited targets and respawns.</p>
    </div>
    <div class="academy-drills">${drills.map(([n, title, sub]) =>
      `<article class="academy-drill"><b>${n}</b><h4>${title}</h4><p>${sub}</p></article>`).join('')}</div>
    <div class="academy-cta">
      <button class="btn" id="academy-launch">${tr('academy.start', 'START ACADEMY')}</button>
      <button class="btn btn-ghost" id="academy-range-launch">${tr('academy.range', 'FREE-FIRE RANGE')}</button>
    </div>
    <p class="pane-note">Touch players get the same drills with the virtual stick and buttons. Gamepads work too — left stick drives, right stick aims, RT fires.</p>
  </div>`;
}

// ---- map lab -----------------------------------------------------
function renderMapLab() {
  const code = mapCode(editor.name, editor.theme, editor.cells);
  editor.code = code;
  const grid = new Map(editor.cells.map((c) => [`${c.x},${c.y}`, c]));
  const saved = listCustom(state.uid);
  return `<div class="maplab">
    <div class="ml-main">
      <div class="ml-board">
        <div class="ml-grid">${Array.from({ length: GRID * GRID }, (_, i) => {
          const x = i % GRID, y = Math.floor(i / GRID);
          const c = grid.get(`${x},${y}`);
          return `<button class="ml-cell ${c ? 'filled' : ''}" data-ml-cell="${x},${y}" aria-label="Cell ${x},${y}">${c ? MAP_PALETTE[c.i].label[0] : ''}</button>`;
        }).join('')}</div>
        <p class="ml-hint">CLICK A CELL TO PLACE OR REMOVE THE SELECTED PROP</p>
      </div>
      <div class="ml-side">
        <label class="field"><span>MAP NAME</span><input id="ml-name" maxlength="16" value="${esc(editor.name)}" /></label>
        <label class="field"><span>THEME</span><select id="ml-theme">${THEMES.map((th, i) =>
          `<option value="${i}" ${editor.theme === i ? 'selected' : ''}>${th.name}</option>`).join('')}</select></label>
        <div class="ml-palette">${MAP_PALETTE.map((p, i) =>
          `<button class="ml-prop ${editor.palette === i ? 'on' : ''}" data-ml-palette="${i}">${p.label}</button>`).join('')}</div>
        <label class="field"><span>SHARE CODE</span><input id="ml-code" readonly value="${esc(code)}" /></label>
        <div class="ml-actions">
          <button class="btn" id="ml-test">TEST MAP</button>
          <button class="btn btn-ghost" id="ml-host">HOST SERVER</button>
        </div>
        <div class="ml-actions">
          <button class="sc-buy" id="ml-copy">COPY CODE</button>
          <button class="sc-buy" id="ml-save">SAVE</button>
          <button class="sc-buy" id="ml-random">RANDOM</button>
          <button class="sc-buy" id="ml-clear">CLEAR</button>
        </div>
        <div class="ml-import">
          <input id="ml-import" placeholder="PASTE A MAP CODE" />
          <button class="sc-buy" id="ml-import-btn">LOAD</button>
        </div>
      </div>
    </div>
    <div class="ml-saved">
      <h3>SAVED BATTLEFIELDS</h3>
      ${saved.length ? saved.map((m) => `<div class="ml-saved-row">
        <b>${esc(m.name)}</b><code>${esc(m.code.slice(0, 22))}…</code>
        <button class="sc-buy" data-map-load="${esc(m.code)}">LOAD</button>
        <button class="sc-buy" data-map-play="${esc(m.code)}">PLAY</button>
        <button class="sc-buy" data-map-delete="${esc(m.code)}">DELETE</button>
      </div>`).join('') : '<p class="career-empty">Nothing saved yet. Build a layout, then hit SAVE.</p>'}
    </div>
    <p class="pane-note">Codes are self-contained: a host carries the map into a server, and anyone with the code can load the exact same battlefield. No database needed.</p>
  </div>`;
}

function wireMapLab() {
  const root = $('#pane-root');
  const redraw = () => {
    editor.code = mapCode(editor.name, editor.theme, editor.cells);
    const field = $('#ml-code');
    if (field) field.value = editor.code;
  };
  $('#ml-name')?.addEventListener('input', (e) => { editor.name = e.target.value || 'CUSTOM MAP'; redraw(); });
  $('#ml-theme')?.addEventListener('change', (e) => { editor.theme = parseInt(e.target.value, 10) || 0; redraw(); });
  root.querySelectorAll('[data-ml-palette]').forEach((btn) => btn.addEventListener('click', () => {
    editor.palette = parseInt(btn.dataset.mlPalette, 10) || 0;
    audio.play('ui');
    rerenderPaneBody();
  }));
  root.querySelectorAll('[data-ml-cell]').forEach((btn) => btn.addEventListener('click', () => {
    const [x, y] = btn.dataset.mlCell.split(',').map(Number);
    const at = editor.cells.findIndex((c) => c.x === x && c.y === y);
    if (at >= 0) editor.cells.splice(at, 1);
    else editor.cells.push({ i: editor.palette, x, y });
    audio.play('ui');
    rerenderPaneBody();
  }));
  $('#ml-copy')?.addEventListener('click', async () => {
    const code = mapCode(editor.name, editor.theme, editor.cells);
    try { await navigator.clipboard.writeText(code); toast('Map code copied', 'good'); }
    catch { toast(code, 'info'); }
  });
  const launch = (event) => {
    const code = mapCode(editor.name, editor.theme, editor.cells);
    closePane();
    document.dispatchEvent(new CustomEvent(event, { detail: { kind: 'range', map: code, mode: selectedMode().id } }));
  };
  $('#ml-test')?.addEventListener('click', () => launch('ironstorm:training'));
  $('#ml-host')?.addEventListener('click', () => launch('ironstorm:hostmap'));
  $('#ml-save')?.addEventListener('click', () => {
    const res = saveCustom(state.uid, mapCode(editor.name, editor.theme, editor.cells));
    if (!res.ok) { audio.play('deny'); toast(res.why, 'bad'); return; }
    audio.play('buy'); toast('Battlefield saved', 'good'); rerenderPaneBody();
  });
  $('#ml-random')?.addEventListener('click', () => {
    const used = new Set();
    editor.cells = [];
    for (let i = 0; i < 16; i++) {
      const x = Math.floor(Math.random() * GRID), y = Math.floor(Math.random() * GRID);
      if (used.has(`${x},${y}`)) continue;
      used.add(`${x},${y}`);
      editor.cells.push({ i: Math.floor(Math.random() * MAP_PALETTE.length), x, y });
    }
    audio.play('ui'); rerenderPaneBody();
  });
  $('#ml-clear')?.addEventListener('click', () => { editor.cells = []; audio.play('uiBack'); rerenderPaneBody(); });
  $('#ml-import-btn')?.addEventListener('click', () => {
    const data = decodeMap(($('#ml-import')?.value || '').trim());
    if (!data) { audio.play('deny'); toast('That is not a valid map code', 'bad'); return; }
    editor = { name: data.name, theme: data.theme, palette: editor.palette, cells: data.cells };
    audio.play('buy'); toast('Map loaded', 'good'); rerenderPaneBody();
  });
  root.querySelectorAll('[data-map-load]').forEach((btn) => btn.addEventListener('click', () => {
    const data = decodeMap(btn.dataset.mapLoad);
    if (!data) return;
    editor = { name: data.name, theme: data.theme, palette: editor.palette, cells: data.cells };
    rerenderPaneBody();
  }));
  root.querySelectorAll('[data-map-play]').forEach((btn) => btn.addEventListener('click', () => {
    closePane();
    document.dispatchEvent(new CustomEvent('ironstorm:training', { detail: { kind: 'range', map: btn.dataset.mapPlay } }));
  }));
  root.querySelectorAll('[data-map-delete]').forEach((btn) => btn.addEventListener('click', () => {
    removeCustom(state.uid, btn.dataset.mapDelete);
    audio.play('uiBack'); rerenderPaneBody();
  }));
}

// ---- ranked ------------------------------------------------------
function renderRanked() {
  const r = rankedState(state.local);
  const tier = rankTier(r.rating);
  const prog = rankProgress(r.rating);
  const placed = r.placements <= 0;
  return `<div class="ranked-pane" style="--tier:${tier.color}">
    <div class="ranked-card">
      <div class="rc-tier"><span>${tier.name}</span><b>${fmt(r.rating)}</b><i>RATING</i></div>
      <div class="rc-meta"><span>BEST ${fmt(r.best)}</span><span>${r.wins} WINS / ${r.played} PLAYED</span>
        <span>${placed ? 'PLACED' : `PLACEMENT ${PLACEMENTS - r.placements + 1} / ${PLACEMENTS}`}</span></div>
      <div class="rank-bar"><i style="width:${Math.round(prog.pct * 100)}%"></i></div>
      <div class="rank-next">${prog.next ? `${fmt(prog.need)} TO ${prog.next.name}` : 'MAXIMUM RATING'}</div>
    </div>
    <div class="ranked-queue">
      <h3>QUEUE</h3>
      <div class="ranked-buttons">${['deathmatch', 'team', 'koth'].map((id) =>
        `<button class="btn" data-ranked-mode="${id}">${MODES[id].name}</button>`).join('')}</div>
      <p class="set-note">Ranked fields run veteran bots at the current mutator. Rating is local to this commander — the command database cannot store a ladder yet.</p>
    </div>
    <div class="ranked-ladder">${RANK_TIERS.map((t) => `<div class="tier-row ${t.id === tier.id ? 'on' : ''}" style="--tier:${t.color}"><span>${t.name}</span><b>${fmt(t.min)}+</b></div>`).join('')}</div>
    <div class="ranked-history">
      <h3>RECENT RANKED</h3>
      ${r.history.length ? r.history.map((h) => `<div class="ranked-row ${h.won ? 'won' : ''}">
        <b>${h.won ? 'V' : 'D'}</b><span>${h.kills}K / ${h.deaths}D</span><i>${h.delta >= 0 ? '+' : ''}${h.delta}</i><em>${fmt(h.rating)}</em>
      </div>`).join('') : '<p class="career-empty">No ranked battles yet. Placements swing harder than settled matches.</p>'}
    </div>
  </div>`;
}

// ---- theater -----------------------------------------------------
function renderTheater() {
  const replay = lastReplay();
  const frames = replay?.frames || [];
  const span = frames.length ? Math.max(0, frames[frames.length - 1].t - frames[0].t) : 0;
  return `<div class="theater-pane">
    ${frames.length ? `<div class="theater-card">
      <span class="tc-kicker">LAST BATTLE</span>
      <h3>${esc(replay.map || 'FIELD RECORDING')}</h3>
      <div class="tc-meta"><span>${Math.floor(span / 60)}:${String(Math.floor(span % 60)).padStart(2, '0')} · ${frames.length} FRAMES</span>
      <span>${replay.obstacles?.length || 0} PROPS</span></div>
      <button class="btn" id="theater-watch">OPEN THEATER</button>
      <p class="set-note">Drag to pan, wheel to zoom, WASD to fly. The replay lasts for this browser session.</p>
    </div>` : `<div class="theater-card empty"><h3>NO REPLAY YET</h3><p>Finish any battle — including a training run — and the theater will hold the recording.</p></div>`}
  </div>`;
}

// ---- dog tag -----------------------------------------------------
function openDogTag() {
  const root = $('#modal-root');
  if (!root) return;
  const l = state.local || loadLocal();
  const p = state.profile;
  const t = careerTotals(l);
  const tier = tierFor(lifetimePoints(p));
  const medals = Object.keys(l.medals || {}).map((id) => MEDALS.find((m) => m.id === id)).filter(Boolean).slice(0, 3);
  const fav = Object.entries(l.tankStats || {}).sort((a, b) => (b[1].matches | 0) - (a[1].matches | 0))[0]?.[0] || p.tank;
  root.innerHTML = `<div class="modal-backdrop"></div>
    <div class="dogtag-modal">
      <header><div><h2>COMMANDER DOG TAG</h2><p>Share your record with the squad.</p></div>
        <div class="dogtag-head-actions">
          <button class="overlay-back" data-dogtag-close type="button">← BACK</button>
          <button class="icon-btn" data-dogtag-close aria-label="Close">✕</button>
        </div></header>
      <canvas id="dogtag-canvas" width="900" height="500"></canvas>
      <div class="dogtag-actions">
        <a class="btn" id="dogtag-download" download="ironstorm-dogtag.png">DOWNLOAD PNG</a>
        <button class="btn btn-ghost" data-dogtag-close>CLOSE</button>
      </div>
    </div>`;
  const canvas = $('#dogtag-canvas');
  const ctx = canvas.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 900, 500);
  g.addColorStop(0, '#0a120b'); g.addColorStop(1, '#1b2a18');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 900, 500);
  ctx.strokeStyle = tier.color; ctx.lineWidth = 4; ctx.strokeRect(18, 18, 864, 464);
  ctx.fillStyle = 'rgba(255,255,255,.04)';
  for (let i = 0; i < 12; i++) ctx.fillRect(0, i * 46, 900, 1);
  ctx.fillStyle = tier.color; ctx.font = '700 20px monospace';
  ctx.fillText(`${tierGlyph(tier.id)} ${tier.name}`, 56, 76);
  ctx.fillStyle = '#edf5e4'; ctx.font = '700 52px sans-serif';
  ctx.fillText(p.username, 56, 142);
  ctx.fillStyle = '#8fa184'; ctx.font = '600 16px monospace';
  ctx.fillText(`LEVEL ${p.level} · ${fmt(lifetimePoints(p))} CAREER POINTS`, 56, 174);
  const stats = [['KILLS', fmt(p.kills)], ['K/D', (p.deaths ? p.kills / p.deaths : p.kills).toFixed(2)], ['BATTLES', fmt(p.matches)], ['ACCURACY', t.accuracy + '%'], ['BEST STREAK', t.bestStreak]];
  stats.forEach(([label, value], i) => {
    const x = 56 + i * 160;
    ctx.fillStyle = '#edf5e4'; ctx.font = '700 30px monospace'; ctx.fillText(value, x, 280);
    ctx.fillStyle = '#7f9275'; ctx.font = '600 12px monospace'; ctx.fillText(label, x, 304);
  });
  ctx.fillStyle = '#c9d6bd'; ctx.font = '700 18px sans-serif';
  ctx.fillText(`FAVOURITE  ${TANKS[fav]?.name || 'M4 SHERMAN'}`, 56, 368);
  ctx.fillStyle = '#8fa184'; ctx.font = '600 14px monospace';
  ctx.fillText('MEDALS', 56, 404);
  medals.forEach((m, i) => {
    ctx.fillStyle = '#e8c96a'; ctx.font = '600 15px monospace';
    ctx.fillText(`✦ ${m.name}`, 56 + i * 260, 432);
  });
  ctx.fillStyle = 'rgba(143,232,107,.7)'; ctx.font = '600 13px monospace';
  ctx.fillText('IRONSTORM · OPERATION IRONSTORM', 56, 462);
  ctx.textAlign = 'right'; ctx.fillStyle = tier.color; ctx.font = '700 64px monospace';
  ctx.fillText(tierGlyph(tier.id), 844, 300);
  $('#dogtag-download').href = canvas.toDataURL('image/png');
  root.querySelectorAll('[data-dogtag-close]').forEach((b) => b.addEventListener('click', () => { root.innerHTML = ''; }));
  root.querySelector('.modal-backdrop')?.addEventListener('click', () => { root.innerHTML = ''; });
}

export function applyDisplaySettings() {
  const s = state.settings || {};
  const scale = Number(s.textScale) || 1;
  document.body.classList.toggle('a11y-large', scale >= 1.1);
  document.body.classList.toggle('a11y-huge', scale >= 1.25);
  document.body.classList.toggle('high-contrast', !!s.highContrast);
  document.body.classList.toggle('one-hand', !!s.oneHanded);
  setLang(s.lang || 'en');
}

// ---- gameplay / settings -----------------------------------------
function renderGameplay() {
  const s = state.settings;
  return `
  <div class="settings-grid">
    <section class="set-card">
      <h3>FIELD CONTROLS</h3>
      <ul class="keylist">
        <li><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd><span>Drive the hull</span></li>
        <li><kbd>MOUSE</kbd><span>Traverse turret</span></li>
        <li><kbd>LMB</kbd><span>Fire main gun</span></li>
        <li><kbd>SHIFT</kbd><span>Emergency dash</span></li>
        <li><kbd>TAB</kbd><span>Full scoreboard</span></li>
        <li><kbd>ENTER</kbd><span>Chat</span></li>
        <li><kbd>ESC</kbd><span>Pause / leave</span></li>
      </ul>
    </section>

    <section class="set-card">
      <h3>AUDIO</h3>
      ${slider('music', 'MUSIC', s.music, 1)}
      ${slider('sfx', 'SOUND FX', s.sfx, 1)}
      <div class="set-toggle">
        <label class="switch"><input type="checkbox" id="set-names" ${s.showNames !== false ? 'checked' : ''}><i></i><span>SHOW CALLSIGNS</span></label>
      </div>
      <div class="set-toggle">
        <label class="switch"><input type="checkbox" id="set-fps" ${s.showFps ? 'checked' : ''}><i></i><span>SHOW FPS</span></label>
      </div>
    </section>

    <section class="set-card">
      <h3>BATTLE</h3>
      <div class="set-line">
        <span>SCREEN SHAKE</span>
        <input type="range" id="set-shake" min="0" max="1.5" step="0.1" value="${s.shake}">
      </div>
      <div class="set-line">
        <span>PRACTICE BOTS</span>
        <div class="seg" id="set-bots">
          ${[0, 3, 6, 9].map((n) => `<button data-bots="${n}" class="${s.bots === n ? 'on' : ''}">${n}</button>`).join('')}
        </div>
      </div>
      <p class="set-note">Bots keep the arena alive. Real commanders join the same server in real time — see SERVERS.</p>
    </section>

    <section class="set-card">
      <h3>ACCESSIBILITY</h3>
      <div class="set-toggle">
        <label class="switch"><input type="checkbox" id="set-colorblind" ${s.colorblind ? 'checked' : ''}><i></i><span>COLOURBLIND TEAM MARKERS</span></label>
      </div>
      <div class="set-toggle">
        <label class="switch"><input type="checkbox" id="set-reduceflash" ${s.reduceFlash ? 'checked' : ''}><i></i><span>REDUCE SCREEN FLASHES</span></label>
      </div>
      <div class="set-toggle">
        <label class="switch"><input type="checkbox" id="set-aimassist" ${s.aimAssist ? 'checked' : ''}><i></i><span>AIM ASSIST</span></label>
      </div>
      <div class="set-toggle">
        <label class="switch"><input type="checkbox" id="set-contrast" ${s.highContrast ? 'checked' : ''}><i></i><span>HIGH CONTRAST UI</span></label>
      </div>
      <div class="set-toggle">
        <label class="switch"><input type="checkbox" id="set-shake-toggle" ${s.shake > 0 ? 'checked' : ''}><i></i><span>SCREEN SHAKE</span></label>
      </div>
      <div class="set-toggle">
        <label class="switch"><input type="checkbox" id="set-onehand" ${s.oneHanded ? 'checked' : ''}><i></i><span>ONE-HANDED TOUCH</span></label>
      </div>
      <div class="set-line">
        <span>${tr('settings.text', 'TEXT SIZE')}</span>
        <div class="seg" id="set-textscale">
          ${[['1', 'A'], ['1.12', 'A+'], ['1.25', 'A++']].map(([v, label]) =>
            `<button data-textscale="${v}" class="${String(s.textScale || 1) === v ? 'on' : ''}">${label}</button>`).join('')}
        </div>
      </div>
      <p class="set-note">Team markers gain shapes and switch to blue/orange. Aim assist nudges the turret toward a nearby target; it is most useful on touch. High contrast brightens the HUD and switches teams to cyan/orange.</p>
    </section>

    <section class="set-card">
      <h3>KEY BINDINGS</h3>
      <div class="keybind-list">
        ${[['up', 'FORWARD'], ['down', 'REVERSE'], ['left', 'TURN LEFT'], ['right', 'TURN RIGHT'],
           ['dash', 'DASH'], ['chat', 'CHAT'], ['board', 'SCOREBOARD']].map(([k, label]) =>
          `<div class="keybind"><span>${label}</span><button class="kb-btn" data-bind="${k}">${String(s.keys?.[k] || DEFAULT_KEYS[k]).toUpperCase()}</button></div>`).join('')}
      </div>
      <button class="btn btn-ghost" id="keys-reset">RESET TO DEFAULT</button>
    </section>

    <section class="set-card">
      <h3>LANGUAGE</h3>
      <div class="set-line">
        <span>${tr('settings.language', 'LANGUAGE')}</span>
        <select id="set-lang" class="set-select">${LANGS.map((l) =>
          `<option value="${l.code}" ${(s.lang || 'en') === l.code ? 'selected' : ''}>${l.label}</option>`).join('')}</select>
      </div>
      <p class="set-note">Core menus, controls and training briefings are translated. Arabic switches the interface to right-to-left.</p>
    </section>

    <section class="set-card account-card">
      <h3>ACCOUNT</h3>
      ${state.mode === 'account' ? `
        <div class="acc-line"><span class="acc-name">${ICONS.user} ${esc(state.profile.username)}</span>
        <span class="acc-badge">ONLINE</span></div>
        <p class="set-note">Progress, credits and garage are stored in the cloud.</p>
        <button class="btn btn-ghost" id="btn-signout">SIGN OUT</button>
      ` : `
        <div class="acc-line"><span class="acc-name">${ICONS.user} GUEST PROFILE</span>
        <span class="acc-badge local">LOCAL</span></div>
        <p class="set-note">Create a callsign to save your credits, garage and ranks across devices.</p>
        <button class="btn" id="btn-goto-auth">CREATE ACCOUNT</button>
      `}
    </section>
  </div>`;
}

function slider(key, label, value, max) {
  return `<div class="set-line">
    <span>${label}</span>
    <input type="range" id="set-${key}" min="0" max="${max}" step="0.05" value="${value}">
    <b class="set-val" id="val-${key}">${Math.round(value / max * 100)}</b>
  </div>`;
}

function wireGameplay() {
  const bind = (id, key, labelId) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('input', () => {
      state.settings[key] = parseFloat(el.value);
      saveSettings({ [key]: state.settings[key] });
      const l = labelId && document.getElementById(labelId);
      if (l) l.textContent = Math.round((state.settings[key] / 1) * 100);
      audio.set(state.settings);
    });
  };
  bind('set-music', 'music', 'val-music');
  bind('set-sfx', 'sfx', 'val-sfx');
  bind('set-shake', 'shake', null);

  $('#set-names')?.addEventListener('change', (e) => {
    state.settings.showNames = e.target.checked;
    saveSettings({ showNames: e.target.checked });
  });
  $('#set-fps')?.addEventListener('change', (e) => {
    state.settings.showFps = e.target.checked;
    saveSettings({ showFps: e.target.checked });
  });
  const toggle = (id, key) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('change', () => {
      state.settings[key] = el.checked;
      saveSettings({ [key]: el.checked });
      applyDisplaySettings();
      audio.play('ui');
    });
  };
  toggle('set-colorblind', 'colorblind');
  toggle('set-reduceflash', 'reduceFlash');
  toggle('set-aimassist', 'aimAssist');
  toggle('set-contrast', 'highContrast');
  toggle('set-onehand', 'oneHanded');
  $('#set-shake-toggle')?.addEventListener('change', (e) => {
    state.settings.shake = e.target.checked ? 1 : 0;
    saveSettings({ shake: state.settings.shake });
    audio.play('ui');
  });
  $$('#set-textscale button').forEach((b) => b.addEventListener('click', () => {
    const scale = parseFloat(b.dataset.textscale) || 1;
    state.settings.textScale = scale;
    saveSettings({ textScale: scale });
    applyDisplaySettings();
    $$('#set-textscale button').forEach((x) => x.classList.toggle('on', x === b));
    audio.play('ui');
  }));
  $('#set-lang')?.addEventListener('change', (e) => {
    state.settings.lang = e.target.value;
    saveSettings({ lang: e.target.value });
    applyDisplaySettings();
    audio.play('ui');
    refreshMenu();
    rerenderPaneBody();
  });

  $$('#pane-root [data-bind]').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (btn.classList.contains('listening')) return;
      btn.classList.add('listening');
      btn.textContent = 'PRESS A KEY';
      const once = (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        window.removeEventListener('keydown', once, true);
        if (ev.key !== 'Escape') {
          const k = btn.dataset.bind;
          state.settings.keys[k] = ev.key.toLowerCase();
          saveSettings({ keys: state.settings.keys });
          audio.play('ui');
        }
        rerenderPaneBody();
      };
      window.addEventListener('keydown', once, true);
    });
  });
  $('#keys-reset')?.addEventListener('click', () => {
    state.settings.keys = { ...DEFAULT_KEYS };
    saveSettings({ keys: state.settings.keys });
    audio.play('uiBack');
    rerenderPaneBody();
  });
  $$('#set-bots button').forEach((b) => b.addEventListener('click', () => {
    const n = parseInt(b.dataset.bots, 10);
    state.settings.bots = n;
    saveSettings({ bots: n });
    $$('#set-bots button').forEach((x) => x.classList.toggle('on', x === b));
    refreshMenu();
    audio.play('ui');
  }));

  $('#btn-signout')?.addEventListener('click', async () => {
    await net.signOut();
    location.reload();
  });
  $('#btn-goto-auth')?.addEventListener('click', () => {
    closePane();
    window.dispatchEvent(new CustomEvent('ironstorm:show-auth', { detail: { mode: 'up', from: 'menu' } }));
  });
}

// ---------------------------------------------------------------- auth screen
let setAuthMode = null;
let authFromMenu = false;

export function bindAuth({ onAccount, onGuest, onBack }) {
  const screen = $('#screen-auth');
  if (!screen) return;
  let mode = 'in';

  const tabs = $$('.auth-tab', screen);
  const form = $('#auth-form');
  const userIn = $('#auth-user');
  const passIn = $('#auth-pass');
  const errEl = $('#auth-error');
  const submit = $('#auth-submit');
  const title = $('#auth-title');
  const sub = $('#auth-sub');

  const setMode = (m) => {
    mode = m;
    tabs.forEach((t) => t.classList.toggle('on', t.dataset.mode === m));
    if (title) title.textContent = m === 'in' ? 'WELCOME BACK, COMMANDER' : 'ENLIST IN THE IRON CORPS';
    if (sub) sub.textContent = m === 'in'
      ? 'Sign in with your callsign and password.'
      : 'Pick a callsign. It is your name on the battlefield.';
    if (submit) submit.textContent = m === 'in' ? 'SIGN IN' : 'CREATE ACCOUNT';
    if (errEl) errEl.textContent = '';
    passIn?.setAttribute('autocomplete', m === 'in' ? 'current-password' : 'new-password');
  };

  tabs.forEach((t) => t.addEventListener('click', () => { audio.play('ui'); setMode(t.dataset.mode); }));

  const runAuth = async () => {
    if (!errEl || submit?.disabled) return;
    const username = userIn.value.trim();
    const password = passIn.value;
    errEl.textContent = '';
    if (!net.validUsername(username)) {
      errEl.textContent = 'Callsign: 3-16 letters, numbers or underscores.';
      audio.play('deny');
      return;
    }
    if (password.length < 6) {
      errEl.textContent = 'Password must be at least 6 characters.';
      audio.play('deny');
      return;
    }
    submit.classList.add('busy');
    submit.disabled = true;
    try {
      const res = mode === 'in'
        ? await net.signIn(username, password)
        : await net.signUp(username, password);
      if (!res.ok) {
        errEl.textContent = res.error;
        audio.play('deny');
        return;
      }
      audio.play('levelup');
      onAccount?.(res.uid, res.row);
    } finally {
      submit.classList.remove('busy');
      submit.disabled = false;
    }
  };

  // Sandboxed embeds (Cudic, itch.io) may omit allow-forms, which blocks
  // native form submission before the submit event. Drive auth from clicks
  // and Enter presses instead.
  form?.addEventListener('submit', (e) => { e.preventDefault(); runAuth(); });
  submit?.addEventListener('click', (e) => { e.preventDefault(); runAuth(); });
  [userIn, passIn].forEach((input) => input?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); runAuth(); }
  }));

  $('#auth-back')?.addEventListener('click', () => {
    audio.play('uiBack');
    onBack?.(authFromMenu);
  });

  $('#auth-guest')?.addEventListener('click', () => {
    audio.play('ui');
    onGuest?.();
  });

  setMode('in');
  setAuthMode = setMode;
  window.addEventListener('ironstorm:show-auth', (e) => {
    authFromMenu = e.detail?.from === 'menu';
    setMode(e.detail?.mode === 'up' ? 'up' : 'in');
    $('#screen-menu')?.classList.add('hidden');
    screen.classList.remove('hidden');
    userIn?.focus();
  });
}

export function showAuthScreen(show, mode, fromMenu = false) {
  if (show) authFromMenu = fromMenu;
  if (mode) setAuthMode?.(mode);
  if (show) $('#screen-landing')?.classList.add('hidden');
  $('#screen-auth')?.classList.toggle('hidden', !show);
  $('#screen-menu')?.classList.toggle('hidden', show);
  if (show) $('#auth-user')?.focus();
}

// ---------------------------------------------------------------- report
export function showReport(data) {
  const root = $('#modal-root');
  if (!root) return;
  const p = state.profile;
  const prog = levelProgress(p.xp);
  const win = data.won;

  root.innerHTML = `
    <div class="modal-backdrop"></div>
    <div class="report ${win ? 'win' : ''}">
      <div class="report-head">
        <div>
          <h2>BATTLE REPORT</h2>
          <div class="report-mode">WARZONE <b>${esc(data.modeName || 'DEATHMATCH')}</b>${data.room ? ` · SERVER <b>${esc(data.room.name)}</b>` : ''}${data.map ? ` · MAP <b>${esc(data.map)}</b>` : ''}${data.mutatorName && data.mutator !== 'standard' ? ` · <b>${esc(data.mutatorName)}</b>` : ''}${data.verdict ? ` · RESULT <b>${esc(data.verdict)}</b>` : ''}</div>
        </div>
        <div class="report-head-actions">
          <button class="overlay-back" id="report-back" type="button">← BACK</button>
          <span class="report-verdict">${win ? 'VICTORY' : (data.verdict || 'SURVIVED')}</span>
        </div>
      </div>
      ${data.replay && data.replay.frames?.length ? `<div class="report-replay">
        <canvas id="replay-canvas"></canvas>
        <span class="replay-bar top"></span>
        <span class="replay-bar bottom"></span>
        <span class="replay-tag">FINAL MOMENT · KILL CAM${data.replay.last ? ` · ${esc(data.replay.last.victim)}` : ''}</span>
        <span class="replay-rate" id="replay-rate">0.90×</span>
        <div class="replay-progress"><i id="replay-fill"></i></div>
        <div class="replay-controls">
          <button class="rc-btn" id="replay-restart">⟳ REPLAY</button>
          <button class="rc-btn ghost" id="replay-skip">SKIP</button>
        </div>
        <div class="replay-final" id="replay-final">${data.replay.last ? esc(data.replay.last.by || '') + ' ELIMINATED ' + esc(data.replay.last.victim) : 'FINAL BLOW'}</div>
      </div>` : ''}
      <div class="report-stats">
        ${rstat('KILLS', data.kills)}
        ${rstat('DEATHS', data.deaths)}
        ${rstat('SCORE', fmt(data.score))}
        ${rstat('STREAK', data.bestStreak)}
        ${rstat('ACCURACY', data.accuracy + '%')}
        ${rstat('TIME', Math.floor(data.seconds / 60) + ':' + String(data.seconds % 60).padStart(2, '0'))}
      </div>
      <div class="report-rewards">
        <div class="reward"><span>${ICONS.coin}</span><b>+${fmt(data.earned.credits)}</b><i>CREDITS</i></div>
        <div class="reward"><span>${ICONS.bolt}</span><b>+${fmt(data.earned.xp)}</b><i>XP</i></div>
        ${data.earned.salvage ? `<div class="reward salvage"><span>${ICONS.crate}</span><b>+${fmt(data.earned.salvage)}</b><i>SALVAGE</i></div>` : ''}
      </div>
      ${data.rankedResult ? `<div class="report-ranked"><span>RANKED</span><b>${data.rankedResult.delta >= 0 ? '+' : ''}${data.rankedResult.delta}</b><i>${fmt(data.rankedResult.rating)} RATING · ${data.rankedResult.tier.name}${data.rankedResult.placement ? ' · PLACEMENT' : ''}${data.rankedResult.promotion ? ` · +${fmt(data.rankedResult.promotion.salvage)} SALVAGE PROMOTION` : ''}</i></div>` : ''}
      ${data.medals?.length ? `<div class="report-medals">${data.medals.map((m) =>
        `<span class="rm"><b>${m.name}</b><i>+${m.salvage} SALVAGE</i></span>`).join('')}</div>` : ''}
      <div class="report-level">
        <div class="rl-line"><span>LEVEL ${prog.level}</span><span>${fmt(p.xp)} XP</span></div>
        <div class="rl-bar"><i style="width:${prog.pct * 100}%"></i></div>
        <div class="rl-next">${fmt(prog.next)} XP TO LEVEL ${prog.level + 1}</div>
        ${data.levelUp ? '<div class="levelup-flash">LEVEL UP — NEW EQUIPMENT UNLOCKED</div>' : ''}
      </div>
      <div class="report-actions">
        <button class="btn btn-ghost" id="report-menu">RETURN TO BASE</button>
        <button class="btn" id="report-again">${ICONS.play} PLAY AGAIN</button>
      </div>
    </div>`;

  if (data.replay) playReplay($('#replay-canvas'), data.replay);
  if (data.levelUp) setTimeout(() => showRankUp(p.level), 260);

  $('#replay-restart')?.addEventListener('click', (e) => {
    e.stopPropagation();
    $('#replay-final')?.classList.remove('on');
    $('.report-replay')?.classList.remove('done');
    playReplay($('#replay-canvas'), data.replay);
  });
  $('#replay-skip')?.addEventListener('click', (e) => {
    e.stopPropagation();
    stopReplay();
    $('.report-replay')?.classList.add('skipped');
  });

  $('#report-back')?.addEventListener('click', () => { stopReplay(); root.innerHTML = ''; });
  $('#report-menu')?.addEventListener('click', () => { stopReplay(); root.innerHTML = ''; });
  $('#report-again')?.addEventListener('click', () => {
    stopReplay();
    root.innerHTML = '';
    if (data.room?.name) {
      document.dispatchEvent(new CustomEvent('ironstorm:join', { detail: data.room }));
    } else {
      startArenaFlow();
    }
  });
}

let replayRaf = 0;
let replayLoop = null;

function stopReplay() {
  cancelAnimationFrame(replayRaf);
  replayRaf = 0;
}

function playReplay(canvas, replay) {
  stopReplay();
  if (!canvas || !replay?.frames?.length) return;
  const ctx = canvas.getContext('2d');
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const W = 560, H = 300;
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  canvas.style.width = '100%';
  canvas.style.height = 'auto';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const frames = replay.frames;
  const t0 = frames[0].t;
  const span = Math.max(0.001, frames[frames.length - 1].t - t0);
  const focus0 = replay.focus || { x: (replay.size || 2600) / 2, y: (replay.size || 2600) / 2 };
  const lastFrame = frames[frames.length - 1];
  const localLast = lastFrame.tanks.find((t) => t.local);
  const target = localLast ? { x: localLast.x, y: localLast.y } : focus0;
  const DUR = 3.6;
  const wrap = canvas.closest('.report-replay');
  const rateEl = $('#replay-rate');
  const fillEl = $('#replay-fill');
  const finalEl = $('#replay-final');
  const started = performance.now();
  let finished = false;
  let finishAt = 0;

  const draw = (now) => {
    replayRaf = requestAnimationFrame(draw);
    const p = Math.min(1, (now - started) / (DUR * 1000));
    const eased = 1 - Math.pow(1 - p, 2.4);
    const tt = t0 + eased * span;
    if (rateEl) rateEl.textContent = (0.9 - eased * 0.72).toFixed(2) + '×';
    if (fillEl) fillEl.style.width = (p * 100).toFixed(1) + '%';
    if (p >= 1 && !finished) {
      finished = true;
      finishAt = now;
      wrap?.classList.add('done');
      finalEl?.classList.add('on');
    }
    const flash = finished ? Math.max(0, 1 - (now - finishAt) / 380) : 0;
    let idx = 0;
    while (idx < frames.length - 1 && frames[idx + 1].t <= tt) idx += 1;
    const f = frames[idx];

    ctx.fillStyle = '#080d09';
    ctx.fillRect(0, 0, W, H);

    const sc = 0.5 + eased * 0.24;
    const fx = focus0.x + (target.x - focus0.x) * eased * 0.7;
    const fy = focus0.y + (target.y - focus0.y) * eased * 0.7;

    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.scale(sc, sc);
    ctx.translate(-fx, -fy);

    ctx.fillStyle = 'rgba(74, 96, 60, 0.55)';
    ctx.fillRect(fx - 1000, fy - 1000, 2000, 2000);

    for (const o of replay.obstacles) {
      const im = img(o.type);
      if (im) ctx.drawImage(im, o.x - o.w / 2, o.y - o.h / 2, o.w, o.h);
    }

    for (const t of f.tanks) {
      if (!t.alive) continue;
      const body = img(t.body);
      const barrel = img(t.barrel);
      if (!body) continue;
      const sk = t.skin ? skinCss(t.skin) : 'none';
      ctx.save();
      ctx.translate(t.x, t.y);
      ctx.rotate(t.a);
      if (sk && sk !== 'none') ctx.filter = sk;
      ctx.drawImage(body, -body.width / 2, -body.height / 2);
      ctx.restore();
      if (barrel) {
        ctx.save();
        ctx.translate(t.x, t.y);
        ctx.rotate(t.tu);
        if (sk && sk !== 'none') ctx.filter = sk;
        ctx.drawImage(barrel, -barrel.width / 2, -barrel.height + body.height * 0.12);
        ctx.restore();
      }
      if (t.local) {
        ctx.strokeStyle = 'rgba(158, 245, 118, 0.9)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(t.x, t.y, t.radius + 18, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    ctx.restore();

    if (flash > 0) {
      ctx.fillStyle = `rgba(255, 255, 255, ${flash * 0.85})`;
      ctx.fillRect(0, 0, W, H);
    }
    ctx.fillStyle = 'rgba(0, 0, 0, 0.22)';
    for (let y = 0; y < H; y += 3) ctx.fillRect(0, y, W, 1);
  };
  replayRaf = requestAnimationFrame(draw);
}

const RANKS = [
  'RECRUIT', 'PRIVATE', 'CORPORAL', 'SERGEANT', 'LIEUTENANT',
  'CAPTAIN', 'MAJOR', 'COLONEL', 'COMMANDER', 'WARLORD', 'LEGEND',
];

function rankName(level) {
  return RANKS[Math.min(RANKS.length - 1, Math.floor((level - 1) / 2))];
}

function rankInsignia(level) {
  const n = Math.min(4, 1 + Math.floor(level / 4));
  const chevrons = Array.from({ length: n }, (_, i) =>
    `<path d="M14 ${46 - i * 9} L32 ${36 - i * 9} L50 ${46 - i * 9}" stroke-linejoin="round" stroke-linecap="round"/>`).join('');
  return `<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2.4">${chevrons}</svg>`;
}

function showRankUp(level) {
  const root = $('#modal-root');
  if (!root) return;
  const p = state.profile;
  const prog = p ? levelProgress(p.xp) : { pct: 0 };
  const el = document.createElement('div');
  el.className = 'rankup';
  el.innerHTML = `<div class="rankup-glow"></div>
    <div class="rankup-card">
      <div class="rankup-insignia">${rankInsignia(level)}</div>
      <p>PROMOTION</p>
      <h2>${rankName(level)}</h2>
      <span>LEVEL ${level} · SUPPLY CRATE UNLOCKED</span>
      <div class="rankup-next"><em>NEXT RANK</em> ${rankName(level + 2)}</div>
      <div class="rankup-bar"><i style="width:${Math.round(prog.pct * 100)}%"></i></div>
      <button class="overlay-back rankup-back" type="button">← BACK TO DECK</button>
    </div>`;
  root.appendChild(el);
  audio.play('rank');
  grantRankCrate();
  let closed = false;
  const dismiss = () => {
    if (closed) return;
    closed = true;
    el.classList.add('out');
    setTimeout(() => el.remove(), 480);
  };
  el.addEventListener('click', dismiss);
  el.querySelector('.rankup-back')?.addEventListener('click', (e) => {
    e.stopPropagation();
    dismiss();
  });
}

async function grantRankCrate() {
  if (state.mode === 'account') {
    const r = await net.unlockRankCrate();
    if (r.ok && r.row) state.profile = fromRowLocal(r.row);
  } else {
    unlockRankCrateLocal();
  }
  refreshMenu();
}

function rstat(label, value) {
  return `<div class="rstat"><b>${value}</b><span>${label}</span></div>`;
}

// ---------------------------------------------------------------- toast
export function toast(msg, kind = 'info') {
  const root = $('#toast-root');
  if (!root) return;
  const t = document.createElement('div');
  t.className = `toast ${kind}`;
  t.textContent = msg;
  root.appendChild(t);
  requestAnimationFrame(() => t.classList.add('show'));
  setTimeout(() => {
    t.classList.remove('show');
    setTimeout(() => t.remove(), 300);
  }, 2200);
}

// local import shim (avoid circular import of store.fromRow)
function fromRowLocal(row) {
  return {
    username: row.username,
    credits: row.credits ?? 0,
    level: row.level ?? 1,
    xp: row.xp ?? 0,
    tank: row.tank_id || 'sherman',
    owned: row.owned_tanks?.length ? row.owned_tanks : ['sherman'],
    upgrades: row.upgrades || { engine: 0, armor: 0, firepower: 0, reload: 0, tracks: 0 },
    skin: row.skin || 'olive',
    ownedSkins: Array.isArray(row.owned_skins) && row.owned_skins.length ? row.owned_skins : ['olive'],
    lastDaily: row.last_daily ? Date.parse(row.last_daily) || 0 : 0,
    contracts: row.contracts || null,
    kills: row.kills ?? 0,
    deaths: row.deaths ?? 0,
    matches: row.matches ?? 0,
    wins: row.wins ?? 0,
    bestScore: row.best_score ?? 0,
    bestKills: row.best_kills ?? row.best_score ?? 0,
  };
}
