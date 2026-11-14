// ------------------------------------------------------------------
//  IronStorm — landing page: animated battlefield + warzone selection
// ------------------------------------------------------------------

import { $, $$, clamp, rand, pick } from './util.js';
import { audio } from './audio.js';
import { state, saveSettings } from './store.js';
import { MODES, MODE_ORDER, MODE_ICONS, modeFor } from './modes.js';
import { briefingSnapshot, formatDuration } from './ops.js';
import { dossierInitials } from './dossier.js';
import { openManual, manualSeen } from './manual.js';
import * as net from './net.js';

const TICKER = [
  'IRON CORPS DISPATCH — SECTOR 7 SECURED BY GREEN SQUADRON',
  'NEW: KING OF THE HILL NOW LIVE IN ROTATION',
  'CAMO REQUISITIONS OPEN — VISIT THE SHOP',
  'SURVIVAL ROTATION EXTENDED — WAVE 12 REPORTED',
  'FREE TO PLAY · NO DOWNLOAD · RUNS IN YOUR BROWSER',
];

let canvas = null;
let ctx = null;
let raf = 0;
let running = false;
let W = 0, H = 0, dpr = 1;
let scene = null;
let clock = 0;
let last = 0;
let handlers = {};
let tickerTimer = 0;
let briefBound = false;
const par = { x: 0, y: 0, tx: 0, ty: 0 };

// ---------------------------------------------------------------- api
export function initLanding(opts = {}) {
  handlers = opts;
  canvas = $('#landing-canvas');
  if (!canvas) return;
  ctx = canvas.getContext('2d');

  buildModeCards();
  renderTicker();
  bindBriefing();

  $('#land-deploy')?.addEventListener('click', () => {
    audio.init(); audio.unlock(); audio.play('ui');
    handlers.onDeploy?.();
  });
  $('#land-garage')?.addEventListener('click', () => {
    audio.init(); audio.play('ui');
    handlers.onGarage?.();
  });
  $('#land-signin')?.addEventListener('click', () => {
    audio.play('ui');
    handlers.onAuth?.();
  });
  $('#land-manual')?.addEventListener('click', () => {
    audio.play('ui');
    if (handlers.onManual) handlers.onManual();
    else openManual();
  });
  $('#land-brief-open')?.addEventListener('click', () => {
    audio.play('ui');
    handlers.onBrief?.();
  });
  $$('.land-links [data-jump]').forEach((b) =>
    b.addEventListener('click', () => {
      audio.play('ui');
      if (b.dataset.jump === 'modes') $('#land-modes')?.scrollIntoView({ block: 'nearest' });
      else if (b.dataset.jump === 'ops') $('#land-brief')?.scrollIntoView({ block: 'nearest' });
      else handlers.onGarage?.();
    })
  );
  setInterval(() => { if (running) paintBriefing(); }, 30000);

  window.addEventListener('resize', () => { if (running) resize(); });
  document.addEventListener('ironstorm:profile', paintModeCards);
}

export function showLanding() {
  const screen = $('#screen-landing');
  if (!screen) return;
  screen.classList.remove('hidden');
  running = true;
  resize();
  bindParallax();
  last = performance.now();
  cancelAnimationFrame(raf);
  raf = requestAnimationFrame(loop);
  paintModeCards();
  paintSession();
  paintBriefing();
  bindBriefing();
}

export function hideLanding() {
  running = false;
  cancelAnimationFrame(raf);
}

export function selectedMode() {
  return modeFor(state.settings?.mode);
}

export function setMode(id) {
  if (!MODES[id]) return;
  state.settings.mode = id;
  saveSettings({ mode: id });
  paintModeCards();
  document.dispatchEvent(new CustomEvent('ironstorm:mode', { detail: id }));
}

// ---------------------------------------------------------------- ui
function buildModeCards() {
  const wrap = $('#land-modes .mode-list');
  if (!wrap) return;
  wrap.innerHTML = MODE_ORDER.map((id) => {
    const m = MODES[id];
    return `<button class="mode-card" data-mode="${id}" style="--accent:${m.accent}">
      <span class="mc-icon">${MODE_ICONS[m.icon] || ''}</span>
      <span class="mc-body">
        <b>${m.name}</b>
        <i>${m.tag}</i>
        <small>${m.rules}</small>
      </span>
      <span class="mc-dot"></span>
    </button>`;
  }).join('');

  wrap.querySelectorAll('.mode-card').forEach((card) => {
    card.addEventListener('click', () => {
      audio.play('ui');
      setMode(card.dataset.mode);
    });
  });
  paintModeCards();
}

export function paintModeCards() {
  const active = selectedMode().id;
  $$('#land-modes .mode-card').forEach((c) => {
    c.classList.toggle('on', c.dataset.mode === active);
  });
  const label = $('#land-deploy b');
  if (label) label.textContent = state.profile ? 'CONTINUE TO BASE' : 'DEPLOY NOW';
}

function paintSession() {
  const btn = $('#land-signin');
  if (!btn) return;
  if (state.mode === 'account') {
    btn.textContent = state.profile.username;
    btn.classList.add('signed');
  } else {
    btn.textContent = 'SIGN IN';
    btn.classList.remove('signed');
  }
}

function bindBriefing() {
  if (briefBound || !state.uid) return;
  briefBound = true;
  net.watchLobby(() => { if (running) paintBriefing(); });
  net.watchDirectory(() => { if (running) paintBriefing(); });
}

function paintBriefing() {
  if (!state.profile) return;
  const b = briefingSnapshot({
    profile: state.profile,
    local: state.local,
    lobby: net.lobby,
    rooms: net.directory.rooms,
  });
  const write = (sel, value) => { const el = $(sel); if (el) el.textContent = value; };
  write('#land-brief-week', `WEEK ${String(b.week).padStart(2, '0')} · EU-CENTRAL`);
  write('#land-brief-online', b.online);
  write('#land-brief-rooms', b.openRooms);
  write('#land-online', `${b.online} COMMANDERS · ${b.openRooms} OPEN ROOMS`);
  write('#land-brief-room', b.activeRoom ? `${b.activeRoom.meta?.roomName || 'ALPHA'} · ${b.activeRoom.players} IN FIELD` : 'GLOBAL ARENA READY');

  const op = b.operation;
  write('#land-brief-op-name', op.name);
  write('#land-brief-op-brief', op.brief);
  write('#land-brief-op-progress', `${op.progress} / ${op.target}`);
  write('#land-brief-op-days', `${b.daysLeft}D LEFT`);
  const fill = $('#land-brief-op-fill');
  if (fill) fill.style.width = `${Math.round(op.pct * 100)}%`;

  const next = b.next;
  write('#land-brief-next-title', next ? next.name : 'ALL REQUISITIONS COMPLETE');
  write('#land-brief-next-sub', next ? `${next.kind} · ${next.need ? fmtNeed(next.need) + ' XP TO UNLOCK' : 'READY TO REQUISITION'}` : 'Every hull and camouflage is on your roster.');
  write('#land-brief-unlock', next ? next.name : 'COMPLETE');
  write('#land-brief-crate', b.crate.ready ? 'READY' : formatDuration(b.crate.msLeft));
  const doneContracts = b.contracts.filter((c) => c.complete).length;
  write('#land-brief-contract', `${doneContracts} / ${b.contracts.length}`);
  write('#land-brief-coalition', `${Math.round(b.coalition.pct * 100)}%`);

  write('#land-brief-name', state.profile.username);
  write('#land-brief-sigil', dossierInitials(state.profile.username));
  write('#land-brief-tier', `${b.tier.name} · SEASON ${String(b.week).padStart(2, '0')}`);
  write('#land-brief-points', b.season.tier.name ? `${b.season.tier.name} · ${Math.round(b.season.pct * 100)}%` : '—');
  const sigil = $('#land-brief-sigil');
  if (sigil) sigil.style.color = b.tier.color;
  const card = $('.brief-command');
  if (card) card.style.setProperty('--tier', b.tier.color);
  const manual = $('#land-manual');
  if (manual) manual.textContent = manualSeen() ? 'FIELD MANUAL' : 'NEW COMMANDER?';
}

function fmtNeed(n) {
  return n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}K` : String(n);
}

function renderTicker() {
  const el = $('#land-ticker');
  if (!el) return;
  const line = TICKER.join('   ///   ');
  el.innerHTML = `<span class="ticker-item">${line}</span><span class="ticker-item">${line}</span>`;
}

// ---------------------------------------------------------------- canvas
function resize() {
  if (!canvas) return;
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  W = canvas.clientWidth || window.innerWidth;
  H = canvas.clientHeight || window.innerHeight;
  canvas.width = Math.floor(W * dpr);
  canvas.height = Math.floor(H * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  buildScene();
}

function buildScene() {
  const horizon = H * 0.66;
  const rnd = mulberry(1337);

  const hills = [0, 1, 2].map((layer) => {
    const points = [];
    const amp = [26, 44, 66][layer];
    const base = horizon + [0, 26, 62][layer];
    const step = 70 - layer * 12;
    for (let x = -80; x <= W + 80; x += step) {
      points.push({ x, y: base - rnd() * amp - layer * 4 });
    }
    return { points, base, layer };
  });

  const tanks = [];
  for (let i = 0; i < 7; i++) {
    const depth = 0.35 + rnd() * 0.65;
    tanks.push({
      x: rnd() * W,
      y: horizon + 26 + depth * (H - horizon - 40),
      depth,
      scale: 0.28 + depth * 0.75,
      speed: (8 + depth * 26) * (i % 3 === 0 ? -1 : 1),
      dir: 1,
      dust: 0,
    });
  }

  scene = {
    horizon,
    hills,
    tanks,
    embers: Array.from({ length: 46 }, () => ({
      x: rnd() * W,
      y: horizon + rnd() * (H - horizon),
      vy: -(6 + rnd() * 22),
      vx: (rnd() - 0.5) * 10,
      size: 0.6 + rnd() * 1.8,
      life: 0.4 + rnd() * 0.6,
    })),
    tracers: [],
    flashes: [],
    smoke: Array.from({ length: 7 }, () => ({
      x: rnd() * W,
      y: horizon - rnd() * 30,
      r: 40 + rnd() * 70,
      drift: (rnd() - 0.5) * 8,
      alpha: 0.05 + rnd() * 0.06,
    })),
    nextTracer: 0.6,
    nextFlash: 1.8,
    nextSmoke: 0.2,
  };
}

function mulberry(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function loop(now) {
  if (!running) return;
  raf = requestAnimationFrame(loop);
  const dt = Math.min(0.05, (now - last) / 1000 || 0.016);
  last = now;
  clock += dt;
  updateScene(dt);
  drawScene();
  applyParallax();
}

function bindParallax() {
  const screen = $('#screen-landing');
  if (!screen || screen._par) return;
  screen._par = true;
  screen.addEventListener('pointermove', (e) => {
    par.tx = (e.clientX / window.innerWidth - 0.5) * 2;
    par.ty = (e.clientY / window.innerHeight - 0.5) * 2;
  });
  screen.addEventListener('pointerleave', () => { par.tx = 0; par.ty = 0; });
}

function applyParallax() {
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
  par.x += (par.tx - par.x) * 0.06;
  par.y += (par.ty - par.y) * 0.06;
  if (canvas) {
    canvas.style.transform =
      `translate3d(${(-par.x * 14).toFixed(2)}px, ${(-par.y * 9).toFixed(2)}px, 0) scale(1.045)`;
  }
  const hero = document.querySelector('.hero');
  if (hero) {
    hero.style.transform =
      `translate3d(${(par.x * 6).toFixed(2)}px, ${(par.y * 4).toFixed(2)}px, 0)`;
  }
}

function updateScene(dt) {
  if (!scene) return;
  const { horizon } = scene;

  for (const t of scene.tanks) {
    t.x += t.speed * dt;
    t.dust += dt;
    if (t.speed > 0 && t.x > W + 160) { t.x = -160; t.y = horizon + 26 + t.depth * (H - horizon - 40); }
    if (t.speed < 0 && t.x < -160) { t.x = W + 160; t.y = horizon + 26 + t.depth * (H - horizon - 40); }
    t.dir = t.speed > 0 ? 1 : -1;
  }

  scene.nextTracer -= dt;
  if (scene.nextTracer <= 0) {
    scene.nextTracer = rand(1.6, 0.4);
    const t = pick(scene.tanks);
    const ang = rand(-0.16, 0.16) + (t.dir > 0 ? Math.PI : 0);
    scene.tracers.push({
      x: t.x + t.dir * 30 * t.scale,
      y: t.y - 12 * t.scale,
      vx: Math.cos(ang) * rand(900, 520),
      vy: Math.sin(ang) * rand(120, 30) - 40,
      life: 0.32,
      max: 0.32,
    });
  }
  for (let i = scene.tracers.length - 1; i >= 0; i--) {
    const tr = scene.tracers[i];
    tr.x += tr.vx * dt; tr.y += tr.vy * dt;
    tr.life -= dt;
    if (tr.life <= 0) scene.tracers.splice(i, 1);
  }

  scene.nextFlash -= dt;
  if (scene.nextFlash <= 0) {
    scene.nextFlash = rand(5.5, 2.2);
    scene.flashes.push({ x: rand(W * 0.85, W * 0.1), y: horizon - rand(20, 0), r: rand(120, 40), life: 0.6 });
  }
  for (let i = scene.flashes.length - 1; i >= 0; i--) {
    const f = scene.flashes[i];
    f.life -= dt;
    if (f.life <= 0) scene.flashes.splice(i, 1);
  }

  for (const e of scene.embers) {
    e.x += e.vx * dt; e.y += e.vy * dt;
    e.vx += (Math.random() - 0.5) * 6 * dt;
    if (e.y < H * 0.4 || e.y < 0) {
      e.y = horizon + Math.random() * (H - horizon);
      e.x = Math.random() * W;
    }
  }

  for (const s of scene.smoke) {
    s.x += s.drift * dt;
    if (s.x > W + s.r) s.x = -s.r;
    if (s.x < -s.r) s.x = W + s.r;
  }
}

function drawScene() {
  if (!ctx || !scene) return;
  const { horizon, hills, tanks, embers, tracers, flashes, smoke } = scene;

  // sky
  const sky = ctx.createLinearGradient(0, 0, 0, horizon);
  sky.addColorStop(0, '#040806');
  sky.addColorStop(0.55, '#0a1510');
  sky.addColorStop(1, '#16281a');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, horizon + 2);

  // horizon glow
  const glow = ctx.createRadialGradient(W * 0.62, horizon, 0, W * 0.62, horizon, Math.max(W, H) * 0.55);
  glow.addColorStop(0, 'rgba(150, 220, 110, 0.27)');
  glow.addColorStop(0.4, 'rgba(80, 145, 65, 0.12)');
  glow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, horizon + 40);

  // smoke columns
  for (const s of smoke) {
    const g = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.r);
    g.addColorStop(0, `rgba(40, 60, 40, ${s.alpha})`);
    g.addColorStop(1, 'rgba(20, 30, 20, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx.fill();
  }

  // ridges
  const shades = ['#0f1d14', '#0b1611', '#070f0a'];
  hills.forEach((h, i) => {
    ctx.beginPath();
    ctx.moveTo(-80, H);
    for (const p of h.points) ctx.lineTo(p.x, p.y);
    ctx.lineTo(W + 80, H);
    ctx.closePath();
    ctx.fillStyle = shades[i];
    ctx.fill();
  });

  // ground
  const ground = ctx.createLinearGradient(0, horizon + 60, 0, H);
  ground.addColorStop(0, '#0b140c');
  ground.addColorStop(1, '#050806');
  ctx.fillStyle = ground;
  ctx.fillRect(0, horizon + 60, W, H - horizon - 60);

  // tanks + dust
  for (const t of tanks) {
    ctx.save();
    ctx.globalAlpha = clamp(0.35 + t.depth * 0.65, 0, 1);
    drawSilhouette(t.x, t.y, t.scale, t.dir, t.depth);
    ctx.restore();

    // dust plume
    const puff = ctx.createRadialGradient(
      t.x - t.dir * 26 * t.scale, t.y + 6 * t.scale, 0,
      t.x - t.dir * 26 * t.scale, t.y + 6 * t.scale, 34 * t.scale
    );
    puff.addColorStop(0, `rgba(120, 140, 100, ${0.10 * t.depth})`);
    puff.addColorStop(1, 'rgba(120,140,100,0)');
    ctx.fillStyle = puff;
    ctx.beginPath();
    ctx.arc(t.x - t.dir * 26 * t.scale, t.y + 6 * t.scale, 34 * t.scale, 0, Math.PI * 2);
    ctx.fill();
  }

  // tracers
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const tr of tracers) {
    const a = clamp(tr.life / tr.max, 0, 1);
    ctx.strokeStyle = `rgba(255, 210, 130, ${a * 0.85})`;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(tr.x, tr.y);
    ctx.lineTo(tr.x - tr.vx * 0.035, tr.y - tr.vy * 0.035);
    ctx.stroke();
  }
  for (const f of flashes) {
    const a = clamp(f.life / 0.6, 0, 1);
    const g = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, f.r * (1.4 - a * 0.4));
    g.addColorStop(0, `rgba(255, 220, 150, ${a * 0.5})`);
    g.addColorStop(0.4, `rgba(255, 150, 60, ${a * 0.22})`);
    g.addColorStop(1, 'rgba(255, 120, 40, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
    ctx.fill();
  }
  // embers
  for (const e of embers) {
    ctx.fillStyle = `rgba(220, 200, 140, ${0.18 + Math.sin(clock * 2 + e.x) * 0.1})`;
    ctx.fillRect(e.x, e.y, e.size, e.size);
  }
  ctx.restore();

  // atmospheric wash + bottom fade
  const wash = ctx.createLinearGradient(0, H * 0.45, 0, H);
  wash.addColorStop(0, 'rgba(3, 7, 5, 0)');
  wash.addColorStop(0.62, 'rgba(3, 7, 5, 0.55)');
  wash.addColorStop(1, 'rgba(2, 5, 3, 0.96)');
  ctx.fillStyle = wash;
  ctx.fillRect(0, H * 0.45, W, H * 0.55);

  const leftFade = ctx.createLinearGradient(0, 0, W * 0.62, 0);
  leftFade.addColorStop(0, 'rgba(3, 6, 4, 0.82)');
  leftFade.addColorStop(0.45, 'rgba(3, 6, 4, 0.3)');
  leftFade.addColorStop(1, 'rgba(3, 6, 4, 0)');
  ctx.fillStyle = leftFade;
  ctx.fillRect(0, 0, W * 0.62, H);
}

function drawSilhouette(x, y, s, dir, depth) {
  const body = `rgb(${14 + depth * 16}, ${22 + depth * 22}, ${16 + depth * 16})`;
  const dark = `rgb(${7 + depth * 10}, ${12 + depth * 12}, ${9 + depth * 10})`;
  const rim = `rgba(${120 + depth * 60}, ${190 + depth * 40}, ${100 + depth * 40}, ${0.10 + depth * 0.16})`;

  ctx.save();
  ctx.translate(x, y);
  ctx.scale(dir * s, s);

  // shadow
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.beginPath();
  ctx.ellipse(0, 8, 40, 8, 0, 0, Math.PI * 2);
  ctx.fill();

  // tracks
  ctx.fillStyle = dark;
  rr(-38, 0, 76, 14, 6); ctx.fill();
  rr(-34, 2, 68, 5, 2); ctx.fillStyle = 'rgba(140,160,120,0.12)'; ctx.fill();

  // hull
  ctx.fillStyle = body;
  rr(-34, -12, 68, 16, 4); ctx.fill();
  ctx.strokeStyle = rim;
  ctx.lineWidth = 1;
  ctx.stroke();

  // turret
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.ellipse(2, -14, 15, 11, 0, Math.PI, 0);
  ctx.fill();
  ctx.stroke();

  // barrel
  ctx.fillStyle = dark;
  rr(12, -18, 34, 4.4, 2); ctx.fill();

  // antenna
  ctx.strokeStyle = 'rgba(150,180,130,0.25)';
  ctx.beginPath();
  ctx.moveTo(-18, -12); ctx.lineTo(-26, -34);
  ctx.stroke();

  ctx.restore();
}

function rr(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
