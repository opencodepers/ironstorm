// ------------------------------------------------------------------
//  IronStorm — main menu, hangar, upgrades, leaderboards, settings
// ------------------------------------------------------------------

import {
  state, saveSettings, equipTankLocal, buyTankLocal, buyUpgradeLocal,
  buySkinLocal, equipSkinLocal, claimDailyLocal, dailyState,
  ensureContracts, CONTRACT_DEFS, claimContractLocal, unlockRankCrateLocal,
} from './store.js';
import {
  TANKS, TANK_ORDER, UPGRADES, UPGRADE_ORDER, upgradeCost, deriveStats, levelProgress,
  SKINS, SKIN_ORDER, skinCss, skinFor,
} from './tanks.js';
import { MODES, MODE_ORDER } from './modes.js';
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
let shopTab = 'vehicles';

const PANE_META = {
  upgrades: { title: 'UPGRADES', sub: 'Spend credits on permanent hull improvements' },
  garage: { title: 'GARAGE', sub: 'Select and requisition armoured vehicles' },
  shop: { title: 'SHOP', sub: 'Vehicles, camouflage patterns and daily supply drops' },
  leaderboards: { title: 'LEADERBOARDS', sub: 'Global rankings of the Iron Corps' },
  gameplay: { title: 'GAMEPLAY', sub: 'Audio, controls and account settings' },
};

export function initMenu({ onPlay: play }) {
  onPlay = play;
  applyIcons();

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
  const p = state.profile;
  if (!p) return;
  const nameEl = $('#menu-username');
  if (nameEl) nameEl.textContent = p.username;

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
  wrap.innerHTML = MODE_ORDER.map((id) => {
    const m = MODES[id];
    return `<button class="mode-chip ${id === active ? 'on' : ''}" data-mode="${id}" style="--accent:${m.accent}">
      <span>${m.name}</span><i>${m.rules}</i>
    </button>`;
  }).join('');
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
  currentPane = name;
  const root = $('#pane-root');
  root.classList.remove('hidden');
  root.dataset.pane = name;
  renderPane();
}

export function closePane() {
  const root = $('#pane-root');
  if (!root || root.classList.contains('hidden') || root.classList.contains('closing')) return;
  currentPane = null;
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
  }[currentPane]?.() ?? '';

  root.innerHTML = `
    <div class="pane-backdrop" data-close></div>
    <div class="pane">
      <header class="pane-head">
        <div>
          <h2>${meta.title}</h2>
          <p>${meta.sub}</p>
        </div>
        <div class="pane-head-right">
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
    document.getElementById('daily-claim')?.addEventListener('click', (e) => doDaily(e.currentTarget));
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
  }[currentPane]?.() ?? '';
  const holder = root.querySelector('.pane-body');
  if (holder) holder.innerHTML = body;
  const pc = root.querySelector('.pane-credits b');
  if (pc) pc.textContent = fmt(state.profile.credits);
  wirePane();
  if (currentPane === 'leaderboards') loadLeaderboard();
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
  return `<div class="garage-grid">${TANK_ORDER.map((id) => {
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
      </div>
    </article>`;
  }).join('')}</div>`;
}

function statRow(label, pct, color) {
  return `<div class="tc-stat"><span>${label}</span>
    <i><b style="width:${clamp(pct * 100, 6, 100)}%;background:${color}"></b></i></div>`;
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
  const tabs = [['vehicles', 'VEHICLES'], ['camo', 'CAMO'], ['supply', 'SUPPLY']];
  const body = shopTab === 'camo' ? renderCamo() : shopTab === 'supply' ? renderSupply() : renderShopVehicles();
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
        <span class="sc-note">${owned ? 'IN INVENTORY' : locked ? 'REQUIRES LEVEL ' + t.unlock : fmt(price) + ' CR'}</span>
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

function renderContracts() {
  const c = ensureContracts();
  if (!c) return '';
  const modeName = (MODES[c.mode] || MODES.team).name;
  return `<div class="contract-grid">${CONTRACT_DEFS.map((d, i) => {
    const have = Math.min(d.target, c[d.key] || 0);
    const done = have >= d.target;
    const claimed = (c.claimed || []).includes(i);
    return `<article class="contract-card ${claimed ? 'done' : done ? 'ready' : ''}">
      <div class="cc-head"><h3>${d.title}</h3><span class="cc-reward">${ICONS.coin}${fmt(d.reward)}</span></div>
      <p>${esc(d.sub.replace('{mode}', modeName))}</p>
      <div class="cc-bar"><i style="width:${(have / d.target) * 100}%"></i></div>
      <div class="cc-foot"><span>${have} / ${d.target}</span>
        ${claimed
          ? '<button class="sc-buy done" disabled>CLAIMED</button>'
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
    ['best_score', 'BEST SCORE'], ['kd', 'K / D'],
  ];
  return `
    <div class="lb-tabs">${tabs.map(([k, label]) =>
      `<button class="lb-tab ${leaderMetric === k ? 'on' : ''}" data-metric="${k}">${label}</button>`).join('')}
    </div>
    <div class="lb-table" id="lb-table"><div class="lb-loading">FETCHING RANKINGS…</div></div>`;
}

async function loadLeaderboard() {
  const holder = $('#lb-table');
  if (!holder) return;
  const col = { kills: 'kills', wins: 'wins', level: 'level', best_score: 'best_score', kd: 'kd' }[leaderMetric];
  const res = await net.fetchLeaderboard(col);
  if (!holder.isConnected) return;
  if (!res.ok || !res.rows.length) {
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
    ${res.rows.map((r, i) => `
      <div class="lb-row ${r.username === me ? 'lb-me' : ''}">
        <span class="lb-rank">${i < 3 ? ['①', '②', '③'][i] : i + 1}</span>
        <span class="lb-name">${esc(r.username)}</span>
        <span>${fmt(r.kills)}</span><span>${fmt(r.wins)}</span><span>${r.level}</span>
        <span>${fmt(r.best_score)}</span><span>${Number(r.kd || 0).toFixed(2)}</span>
      </div>`).join('')}`;
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
      <p class="set-note">Bots keep the arena alive. Real commanders join the same global arena in real time.</p>
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
    window.dispatchEvent(new CustomEvent('ironstorm:show-auth'));
  });
}

// ---------------------------------------------------------------- auth screen
export function bindAuth({ onAccount, onGuest }) {
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

  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = userIn.value.trim();
    const password = passIn.value;
    if (!errEl) return;
    errEl.textContent = '';
    submit.classList.add('busy');
    submit.disabled = true;
    const res = mode === 'in'
      ? await net.signIn(username, password)
      : await net.signUp(username, password);
    submit.classList.remove('busy');
    submit.disabled = false;
    if (!res.ok) {
      errEl.textContent = res.error;
      audio.play('deny');
      return;
    }
    audio.play('levelup');
    onAccount?.(res.uid, res.row);
  });

  $('#auth-guest')?.addEventListener('click', () => {
    audio.play('ui');
    onGuest?.();
  });

  setMode('in');
  window.addEventListener('ironstorm:show-auth', () => {
    $('#screen-menu')?.classList.add('hidden');
    screen.classList.remove('hidden');
    userIn?.focus();
  });
}

export function showAuthScreen(show) {
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
          <div class="report-mode">WARZONE <b>${esc(data.modeName || 'DEATHMATCH')}</b>${data.verdict ? ` · RESULT <b>${esc(data.verdict)}</b>` : ''}</div>
        </div>
        <span class="report-verdict">${win ? 'VICTORY' : (data.verdict || 'SURVIVED')}</span>
      </div>
      ${data.replay && data.replay.frames?.length ? `<div class="report-replay">
        <canvas id="replay-canvas"></canvas>
        <span class="replay-bar top"></span>
        <span class="replay-bar bottom"></span>
        <span class="replay-tag">FINAL MOMENT · KILL CAM</span>
        <span class="replay-rate">0.4×</span>
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
      </div>
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

  $('#report-menu')?.addEventListener('click', () => { stopReplay(); root.innerHTML = ''; });
  $('#report-again')?.addEventListener('click', () => {
    stopReplay();
    root.innerHTML = '';
    startArenaFlow();
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
  const scale = 0.62;
  const focus = replay.focus || { x: (replay.size || 2600) / 2, y: (replay.size || 2600) / 2 };
  const started = performance.now();

  const draw = (now) => {
    replayRaf = requestAnimationFrame(draw);
    const k = (((now - started) / 1000) * 0.4) % 1;
    const tt = t0 + k * span;
    let idx = 0;
    while (idx < frames.length - 1 && frames[idx + 1].t <= tt) idx += 1;
    const f = frames[idx];

    ctx.fillStyle = '#080d09';
    ctx.fillRect(0, 0, W, H);

    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.scale(scale, scale);
    ctx.translate(-focus.x, -focus.y);

    ctx.fillStyle = 'rgba(74, 96, 60, 0.55)';
    ctx.fillRect(focus.x - 1000, focus.y - 1000, 2000, 2000);

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
  const el = document.createElement('div');
  el.className = 'rankup';
  el.innerHTML = `<div class="rankup-glow"></div>
    <div class="rankup-card">
      <div class="rankup-insignia">${rankInsignia(level)}</div>
      <p>PROMOTION</p>
      <h2>${rankName(level)}</h2>
      <span>LEVEL ${level} · SUPPLY CRATE UNLOCKED</span>
    </div>`;
  root.appendChild(el);
  audio.play('rank');
  grantRankCrate();
  setTimeout(() => {
    el.classList.add('out');
    setTimeout(() => el.remove(), 520);
  }, 1900);
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
    kills: row.kills ?? 0,
    deaths: row.deaths ?? 0,
    matches: row.matches ?? 0,
    wins: row.wins ?? 0,
    bestScore: row.best_score ?? 0,
    bestKills: row.best_kills ?? row.best_score ?? 0,
  };
}
