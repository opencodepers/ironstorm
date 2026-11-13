// ------------------------------------------------------------------
//  IronStorm — arena simulation & renderer
// ------------------------------------------------------------------

import { img } from './assets.js';
import { audio } from './audio.js';
import { state } from './store.js';
import { connectArena } from './net.js';
import { TANKS, TANK_ORDER, deriveStats, skinCss } from './tanks.js';
import { modeFor } from './modes.js';
import { WORLD, PALETTE, NET } from './config.js';
import {
  clamp, lerp, rand, randInt, pick, dist, dist2, angleDiff, angleLerp,
  makeRng, fmt, $,
} from './util.js';

const BOT_NAMES = [
  'VULCAN', 'RUSTY', 'KRAKEN', 'HOTSHOT', 'GRIM', 'ZEALOT', 'DUKE', 'NOMAD',
  'WRAITH', 'BOLT', 'SABLE', 'HAVOC', 'CINDER', 'TOMAHAWK', 'PATCHES', 'JACKAL',
];

const POWERUPS = {
  repair:  { label: 'REPAIR',  color: '#6ee06a', glyph: '✚', dur: 0 },
  rapid:   { label: 'RAPID',   color: '#ffd35a', glyph: '»', dur: 7 },
  shield:  { label: 'SHIELD',  color: '#5ac8ff', glyph: '◈', dur: 6 },
  triple:  { label: 'TRIPLE',  color: '#ff9a5a', glyph: '≡', dur: 7 },
  boost:   { label: 'BOOST',   color: '#c8a0ff', glyph: '▲', dur: 6 },
  salvage: { label: 'SALVAGE', color: '#e8c96a', glyph: '$', dur: 0 },
};
const POWER_KEYS = Object.keys(POWERUPS);

const SPAWNS = [
  { x: 520, y: 520 }, { x: WORLD.size - 520, y: 520 },
  { x: 520, y: WORLD.size - 520 }, { x: WORLD.size - 520, y: WORLD.size - 520 },
  { x: WORLD.size / 2, y: 520 }, { x: WORLD.size / 2, y: WORLD.size - 520 },
  { x: 520, y: WORLD.size / 2 }, { x: WORLD.size - 520, y: WORLD.size / 2 },
];

const TANK_FWD = (a) => ({ x: Math.sin(a), y: -Math.cos(a) });

export class Arena {
  constructor({ onExit, onReport, mode = 'deathmatch' } = {}) {
    this.onExit = onExit;
    this.onReport = onReport;
    this.modeId = mode;
    this.mode = modeFor(mode);
    this.matchLen = this.mode.duration || 0;
    this.remaining = this.mode.duration || 0;
    this.ended = false;
    this.result = null;
    this.teamScore = [0, 0];
    this.zonePts = [0, 0];
    this.zone = null;
    this.zoneHolder = -1;
    this.zoneCounts = [0, 0];
    this.wave = 0;
    this.waveTimer = 0;
    this.lives = this.mode.waves ? 3 : Infinity;
    this.weather = pick(['clear', 'clear', 'clear', 'rain', 'fog', 'dusk']);
    this.recentKills = [];
    this.graveyard = [];
    this.canvas = $('#arena-canvas');
    this.ctx = this.canvas.getContext('2d');
    this.minimap = $('#hud-minimap');
    this.mctx = this.minimap ? this.minimap.getContext('2d') : null;

    this.hud = {
      hpFill: $('#hud-hp-fill'), hpText: $('#hud-hp-text'),
      reloadFill: $('#hud-reload-fill'), dash: $('#hud-dash'),
      score: $('#hud-score'), kills: $('#hud-kills'), deaths: $('#hud-deaths'),
      streak: $('#hud-streak'), board: $('#hud-board'), feed: $('#hud-feed'),
      timer: $('#hud-timer'), online: $('#hud-online'), fps: $('#hud-fps'),
      respawn: $('#hud-respawn'), respawnText: $('#hud-respawn-text'),
      pause: $('#hud-pause'), powers: $('#hud-powers'), chatLog: $('#hud-chat-log'),
      chatInput: $('#hud-chat-input'), chatWrap: $('#hud-chat'),
      announce: $('#hud-announce'),
      mode: $('#hud-mode'), objective: $('#hud-objective'),
      objectiveLabel: $('#hud-objective-label'), remaining: $('#hud-remaining'),
      modebar: $('#hud-modebar'), medals: $('#hud-medals'), lives: $('#hud-lives'),
    };

    this.running = false;
    this.t = 0;
    this.paused = false;
    this.chatOpen = false;
    this.net = null;
    this.raf = 0;
    this.lastFrame = 0;
    this.fps = 60;
    this.fpsAcc = 0; this.fpsFrames = 0;
    this.frame = 0;
    this.shake = 0;
    this.zoom = 1;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);

    this.tanks = [];
    this.remotes = new Map();
    this.bullets = [];
    this.particles = [];
    this.fxList = [];
    this.powerups = [];
    this.decals = [];
    this.floaters = [];
    this.obstacles = [];
    this.me = null;

    this.input = { keys: new Set(), mx: 0, my: 0, firing: false };
    this.cam = { x: WORLD.size / 2, y: WORLD.size / 2 };
    this.startAt = 0;
    this.stats = { kills: 0, deaths: 0, score: 0, bestStreak: 0, shots: 0, hits: 0 };
    this.hud.modebar?.setAttribute('data-mode', this.modeId);

    this._bind();
  }

  // ----------------------------------------------------------------
  //  lifecycle
  // ----------------------------------------------------------------
  start() {
    const p = state.profile;
    this.settings = state.settings;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.resize();

    const seed = (Date.now() ^ 0x9e3779b9) >>> 0;
    this.genWorld(seed);

    const stats = deriveStats(p.tank, p.upgrades);
    const spawn = pick(SPAWNS);
    this.me = this.makeTank({
      uid: state.uid,
      name: p.username,
      x: spawn.x,
      y: spawn.y,
      stats,
      level: p.level,
      local: true,
      color: PALETTE[0],
    });
    this.me.invuln = 2.6;      // deploy shield
    this.me.spawnFx = 0.8;
    this.cam.x = this.me.x;
    this.cam.y = this.me.y;
    this.tanks.push(this.me);

    this.setupMode();

    this.hud.chatWrap?.classList.add('hidden');
    this.hud.pause?.classList.add('hidden');
    this.hud.respawn?.classList.add('hidden');

    this.connect();

    this.running = true;
    this.startAt = performance.now() + 1;
    this.lastFrame = performance.now();
    this.animate(this.lastFrame);
    this.announce('BATTLE START', 1600);
    audio.play('levelup');
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.raf);
    this.net?.leave();
    this.net = null;
    window.removeEventListener('resize', this._onResize);
  }

  report() {
    const s = this.stats;
    const won = this.result
      ? this.result.won
      : (this.mode.teams ? this.teamScore[0] > this.teamScore[1] : s.kills >= 3 && s.kills > s.deaths);
    const mult = this.mode.reward || 1;
    const credits = Math.round((30 + s.kills * 14 + (won ? 180 : 0) + Math.floor(s.score / 25)) * mult);
    const xp = Math.round((40 + s.kills * 22 + (won ? 120 : 0) + Math.floor(s.score / 60)) * mult);
    const seconds = Math.max(1, Math.floor((performance.now() - this.startAt - 1) / 1000));
    return {
      kills: s.kills, deaths: s.deaths, score: s.score,
      bestStreak: s.bestStreak, seconds, won, credits, xp,
      mode: this.mode.id, modeName: this.mode.name,
      verdict: this.result?.label || null, wave: this.wave,
      teamScore: this.teamScore.slice(),
      accuracy: s.shots ? Math.round((s.hits / s.shots) * 100) : 0,
    };
  }

  // ----------------------------------------------------------------
  //  modes
  // ----------------------------------------------------------------
  setupMode() {
    const m = this.mode;
    this.me.team = 0;
    this.me.skin = state.profile.skin || 'olive';
    if (m.zone) this.zone = { x: WORLD.size / 2, y: WORLD.size / 2, r: 235 };
    if (this.hud.mode) this.hud.mode.textContent = m.name;
    if (m.waves) {
      this.nextWave();
    } else {
      this.spawnBots(this.settings.bots ?? m.bots, { teams: !!m.teams });
      if (m.teams) this.balanceTeams();
    }
  }

  balanceTeams() {
    let a = 0, b = 0;
    for (const t of this.tanks) {
      if (!t.bot) continue;
      if (a <= b) { t.team = 0; a += 1; } else { t.team = 1; b += 1; }
    }
  }

  nextWave() {
    this.wave += 1;
    const count = 3 + this.wave * 2;
    const hpScale = 1 + (this.wave - 1) * 0.14;
    const dmgScale = 1 + (this.wave - 1) * 0.07;
    const names = BOT_NAMES.slice().sort(() => Math.random() - 0.5);
    for (let i = 0; i < count; i++) {
      const tankId = pick(['crusader', 't34', 'panther', 'tiger', 'is2', 'leopard']);
      const base = deriveStats(tankId, {});
      const stats = {
        ...base,
        hp: Math.round(base.hp * hpScale),
        damage: base.damage * dmgScale,
        reload: base.reload * 1.3,
      };
      const spot = this.freeSpot(560);
      const b = this.makeTank({
        uid: 'bot:w' + this.wave + ':' + i + ':' + Math.random().toString(36).slice(2, 6),
        name: names[i % names.length],
        stats, level: 1 + this.wave, bot: true, team: 1,
        color: '#c46a5a',
        x: spot.x, y: spot.y,
      });
      b.hp = b.maxHp;
      b.noRespawn = true;
      this.tanks.push(b);
    }
    this.announce('WAVE ' + this.wave + ' — ' + count + ' HOSTILES', 1900);
    this.medal('WAVE ' + this.wave, count + ' HOSTILES INBOUND');
  }

  updateMode(dt) {
    if (this.ended) return;
    const m = this.mode;

    if (m.duration) {
      this.remaining = Math.max(0, this.matchLen - this.t);
      if (this.remaining <= 0) { this.finishByTime(); return; }
    }

    if (m.zone && this.zone) {
      const z = this.zone;
      const counts = [0, 0];
      for (const t of this.tanks) {
        if (t.alive && dist2(t.x, t.y, z.x, z.y) < z.r * z.r) counts[t.team || 0] += 1;
      }
      const holder = counts[0] === counts[1] ? -1 : counts[0] > counts[1] ? 0 : 1;
      this.zoneHolder = holder;
      this.zoneCounts = counts;
      if (holder >= 0) this.zonePts[holder] += dt * (7 + Math.max(0, counts[holder] - 1) * 3);
      if (this.zonePts[0] >= m.target) { this.endMatch(true, 'ZONE SECURED'); return; }
      if (this.zonePts[1] >= m.target) { this.endMatch(false, 'ZONE LOST'); return; }
    }

    if (m.waves) {
      const alive = this.tanks.reduce((n, t) => n + (t.bot && t.alive ? 1 : 0), 0);
      if (alive === 0) {
        if (this.waveTimer <= 0) {
          this.waveTimer = 3.5;
          this.announce('SECTOR CLEAR — NEXT WAVE INBOUND', 1700);
        }
        this.waveTimer -= dt;
        if (this.waveTimer <= 0) { this.waveTimer = 0; this.nextWave(); }
      }
    }

    if (m.teams && !m.zone) {
      if (this.teamScore[0] >= m.target) { this.endMatch(true, 'SQUADRON VICTORY'); return; }
      if (this.teamScore[1] >= m.target) { this.endMatch(false, 'SQUADRON DEFEAT'); return; }
    } else if (!m.teams && m.target) {
      const leader = this.tanks.reduce((best, t) => (t.kills > (best?.kills ?? -1) ? t : best), null);
      if (this.me.kills >= m.target) { this.endMatch(true, 'SECTOR SECURED'); return; }
      if (leader && leader !== this.me && leader.kills >= m.target) { this.endMatch(false, 'SECTOR LOST'); return; }
    }

    if (this.graveyard.length) {
      this.graveyard = this.graveyard.filter((g) => {
        if (this.t < g.at) return true;
        this.tanks = this.tanks.filter((x) => x !== g.tank);
        return false;
      });
    }
  }

  finishByTime() {
    const m = this.mode;
    if (m.teams) {
      const win = this.teamScore[0] > this.teamScore[1];
      this.endMatch(win, win ? 'SQUADRON VICTORY' : 'SQUADRON DEFEAT');
      return;
    }
    const best = this.tanks.reduce((n, t) => Math.max(n, t.kills), 0);
    const win = this.me.kills >= best && this.me.kills > 0;
    this.endMatch(win, win ? 'SECTOR SECURED' : 'SECTOR LOST');
  }

  endMatch(won, label) {
    if (this.ended) return;
    this.ended = true;
    this.result = { won: !!won, label: label || (won ? 'VICTORY' : 'DEFEAT') };
    this.input.firing = false;
    this.announce(this.result.label, 2600);
    this.medal(this.result.label, 'MATCH COMPLETE');
    audio.play(won ? 'victory' : 'death');
    clearTimeout(this._endTimer);
    this._endTimer = setTimeout(() => this.leave(), 3000);
  }

  fmtTime(s) {
    if (!this.mode.duration) return '∞';
    const v = Math.max(0, Math.ceil(s));
    return String(Math.floor(v / 60)).padStart(2, '0') + ':' + String(v % 60).padStart(2, '0');
  }

  medal(title, sub) {
    const root = this.hud.medals;
    if (!root) return;
    const el = document.createElement('div');
    el.className = 'medal';
    el.innerHTML = `<b>${esc(title)}</b><span>${esc(sub || '')}</span>`;
    root.appendChild(el);
    setTimeout(() => el.classList.add('out'), 1800);
    setTimeout(() => el.remove(), 2300);
  }

  // ----------------------------------------------------------------
  //  world
  // ----------------------------------------------------------------
  genWorld(seed) {
    const rng = makeRng(seed);
    this.obstacles = [];
    this.decals = [];
    this.tileSeed = seed;

    const add = (x, y, type, size, opts = {}) => {
      this.obstacles.push({
        x, y, w: size, h: size, type,
        hp: opts.hp ?? 0, maxHp: opts.hp ?? 0,
        destructible: !!opts.destructible,
        explosive: !!opts.explosive,
        blocks: opts.blocks !== false,
        radius: opts.radius ?? size / 2,
        seed: rng(),
      });
    };

    const types = [
      ['crateWood', 56, { destructible: true, hp: 45 }],
      ['crateMetal', 64, { destructible: true, hp: 70 }],
      ['sandbagBeige', 56, {}],
      ['sandbagBrown', 56, {}],
      ['barricadeMetal', 56, {}],
      ['barricadeWood', 56, { destructible: true, hp: 55 }],
      ['fenceRed', 56, {}],
      ['fenceYellow', 56, {}],
      ['barrelRed_top', 44, { destructible: true, hp: 18, explosive: true, radius: 20 }],
      ['barrelGreen_top', 44, { destructible: true, hp: 18, explosive: true, radius: 20 }],
      ['barrelBlack_top', 44, { destructible: true, hp: 18, explosive: true, radius: 20 }],
      ['treeGreen_large', 128, { radius: 26 }],
      ['treeGreen_small', 96, { radius: 20 }],
    ];

    const clearOfSpawns = (x, y) =>
      SPAWNS.every((s) => dist(x, y, s.x, s.y) > 230) &&
      dist(x, y, WORLD.size / 2, WORLD.size / 2) > 120;

    // clusters
    for (let c = 0; c < 26; c++) {
      const cx = 220 + rng() * (WORLD.size - 440);
      const cy = 220 + rng() * (WORLD.size - 440);
      if (!clearOfSpawns(cx, cy)) continue;
      const n = 2 + Math.floor(rng() * 5);
      for (let i = 0; i < n; i++) {
        const [type, size, opts] = types[Math.floor(rng() * types.length)];
        const a = rng() * Math.PI * 2, r = rng() * 90;
        add(
          clamp(cx + Math.cos(a) * r, 120, WORLD.size - 120),
          clamp(cy + Math.sin(a) * r, 120, WORLD.size - 120),
          type, size, opts
        );
      }
    }
    // scattered singles
    for (let i = 0; i < 55; i++) {
      const x = 160 + rng() * (WORLD.size - 320);
      const y = 160 + rng() * (WORLD.size - 320);
      if (!clearOfSpawns(x, y)) continue;
      const [type, size, opts] = types[Math.floor(rng() * types.length)];
      add(x, y, type, size, opts);
    }

    // Organic sand patches on a coarse grid — avoids a tiled checkerboard.
    const N = Math.ceil(WORLD.size / WORLD.tile);
    this.tN = N;
    this.terrain = new Uint8Array(N * N);
    for (let b = 0; b < 10; b++) {
      const cx = 1 + Math.floor(rng() * (N - 2));
      const cy = 1 + Math.floor(rng() * (N - 2));
      const r = 1.7 + rng() * 2.6;
      for (let y = 0; y < N; y++) {
        for (let x = 0; x < N; x++) {
          const dx = x - cx, dy = y - cy;
          const wob = Math.sin(x * 1.31 + y * 2.17 + seed * 0.001) * 0.42;
          if (Math.hypot(dx, dy) < r + wob) this.terrain[y * N + x] = 1;
        }
      }
    }

    // oil spills are pure decoration
    for (let i = 0; i < 16; i++) {
      this.decals.push({
        x: 200 + rng() * (WORLD.size - 400),
        y: 200 + rng() * (WORLD.size - 400),
        img: 'oilSpill_large', a: rng() * Math.PI * 2,
        s: 0.8 + rng() * 0.8, alpha: 0.5,
      });
    }
  }

  freeSpot(minFromTanks = 260) {
    for (let i = 0; i < 40; i++) {
      const x = rand(WORLD.size - 260, 260);
      const y = rand(WORLD.size - 260, 260);
      if (this.obstacles.some((o) => Math.abs(o.x - x) < 80 && Math.abs(o.y - y) < 80)) continue;
      if (this.tanks.some((t) => t.alive && dist2(t.x, t.y, x, y) < minFromTanks * minFromTanks)) continue;
      return { x, y };
    }
    return { x: WORLD.size / 2 + rand(200, -200), y: WORLD.size / 2 + rand(200, -200) };
  }

  // ----------------------------------------------------------------
  //  entities
  // ----------------------------------------------------------------
  makeTank({ uid, name, stats, level, local = false, color, x = 0, y = 0, remote = false, bot = false, team = 0, skin }) {
    return {
      uid, name, stats, level, local, remote, bot, team,
      skin: skin || stats.skin || 'olive',
      color: color || pick(PALETTE),
      x, y, angle: 0, turret: 0, vx: 0, vy: 0,
      hp: stats.hp, maxHp: stats.hp,
      reloadT: 0, alive: true, respawnT: 0, invuln: 0,
      shieldUntil: 0, rapidUntil: 0, tripleUntil: 0, boostUntil: 0,
      dashReady: 0, dashing: 0,
      kills: 0, deaths: 0, score: 0, streak: 0, bestStreak: 0,
      hitFlash: 0, muzzle: 0, trackT: 0, spawnFx: 0,
      ai: bot ? { think: 0, target: null, strafe: Math.random() < 0.5 ? 1 : -1, react: 0.4, err: 0 } : null,
      lastSeen: performance.now(),
      tx: x, ty: y, ta: 0, tt: 0,
    };
  }

  spawnBots(count, opts = {}) {
    const diff = clamp(0.72 + (this.me?.level || 1) * 0.012, 0.72, 0.95);
    // Distinct callsigns, farthest spawns from the player first.
    const names = BOT_NAMES.slice().sort(() => Math.random() - 0.5);
    const spots = SPAWNS.slice().sort(
      (a, b) => dist2(b.x, b.y, this.me.x, this.me.y) - dist2(a.x, a.y, this.me.x, this.me.y)
    );
    for (let i = 0; i < count; i++) {
      const team = opts.teams ? (i % 2 === 0 ? 1 : 0) : 0;
      const tankId = pick(['sherman', 'crusader', 't34', 'panther', 'tiger']);
      const base = deriveStats(tankId, {});
      const stats = {
        ...base,
        damage: base.damage * diff,
        reload: base.reload * 1.45,
        hp: Math.round(base.hp * 0.9),
      };
      const spot = spots[i % spots.length];
      const b = this.makeTank({
        uid: 'bot:' + i + ':' + Math.random().toString(36).slice(2, 7),
        name: names[i % names.length],
        stats, level: randInt(1, 9), bot: true, team,
        color: PALETTE[(i + 1) % PALETTE.length],
        x: spot.x + rand(90, -90), y: spot.y + rand(90, -90),
      });
      b.hp = b.maxHp;
      this.tanks.push(b);
    }
  }

  // ----------------------------------------------------------------
  //  networking
  // ----------------------------------------------------------------
  connect() {
    const me = this.me;
    try {
      this.net = connectArena({
        onReady: () => {
          this.announce('CONNECTED TO ARENA', 1400);
        },
        onError: () => {
          this.announce('OFFLINE — LOCAL SKIRMISH', 2200);
        },
        onRoster: (m) => {
          this.hud.online.textContent = (m.size + 1) + ' ONLINE';
          for (const [uid, meta] of m) {
            if (!this.remotes.has(uid)) this.addRemote(uid, meta);
          }
          for (const uid of [...this.remotes.keys()]) {
            if (!m.has(uid)) this.removeRemote(uid);
          }
        },
        onJoin: (meta) => {
          if (!meta?.uid) return;
          this.addRemote(meta.uid, meta);
          this.feed(`<b>${esc(meta.name)}</b> rolled into the arena`, '#8fbf5e');
        },
        onLeave: (uid) => this.removeRemote(uid),
        onState: (s) => this.remoteState(s),
        onFire: (s) => this.remoteFire(s),
        onDamage: (d) => this.takeRemoteDamage(d),
        onKill: (k) => {
          if (k.killerName && k.victimName) {
            this.feed(`<b>${esc(k.killerName)}</b> destroyed <b>${esc(k.victimName)}</b>`, '#c9d6bd');
          }
        },
        onChat: (c) => this.addChat(c.from, c.text),
      });
    } catch (e) {
      console.warn('[net]', e);
      this.net = null;
    }
    this.hud.online.textContent = '1 ONLINE';
  }

  addRemote(uid, meta) {
    if (!uid || uid === state.uid) return;
    let t = this.remotes.get(uid);
    if (t) return;
    const stats = deriveStats(meta.tank || 'sherman', {});
    const spot = this.freeSpot(300);
    t = this.makeTank({
      uid, name: meta.name || 'UNKNOWN', stats,
      level: meta.level || 1, remote: true,
      team: this.mode.teams ? ((uid.charCodeAt(0) || 0) % 2) : 0,
      skin: meta.skin || 'olive',
      color: PALETTE[(uid.length * 7) % PALETTE.length],
      x: spot.x, y: spot.y,
    });
    t.tx = t.x; t.ty = t.y;
    this.remotes.set(uid, t);
    this.tanks.push(t);
  }

  removeRemote(uid) {
    const t = this.remotes.get(uid);
    if (!t) return;
    this.remotes.delete(uid);
    this.tanks = this.tanks.filter((x) => x !== t);
  }

  remoteState(s) {
    let t = this.remotes.get(s.i);
    if (!t) {
      this.addRemote(s.i, { name: s.n, tank: s.t, level: s.l });
      t = this.remotes.get(s.i);
      if (!t) return;
    }
    t.tx = s.x; t.ty = s.y; t.ta = s.a; t.tt = s.tu;
    t.hp = s.h; t.maxHp = s.mh || t.maxHp;
    t.kills = s.k ?? t.kills; t.score = s.s ?? t.score;
    t.name = s.n || t.name; t.level = s.l ?? t.level;
    if (s.sk) t.skin = s.sk;
    if (s.tm != null) t.team = s.tm;
    t.lastSeen = performance.now();
    if (t.hp > 0 && !t.alive) this.reviveRemote(t);
  }

  remoteFire(s) {
    const t = this.remotes.get(s.i);
    if (t) { t.muzzle = 0.06; t.turret = s.a ?? t.turret; }
    if (!t) return;
    const f = TANK_FWD(s.a ?? t.turret);
    const len = this.muzzleLength(t);
    this.bullets.push({
      x: t.x + f.x * len, y: t.y + f.y * len,
      vx: f.x * 820, vy: f.y * 820,
      owner: t, dmg: 0, life: 1.3, color: t.color, visual: true, r: 4,
    });
    this.muzzleFlash(t, s.a ?? t.turret);
    audio.play('cannon');
  }

  takeRemoteDamage(d) {
    const me = this.me;
    if (!me.alive) return;
    me.hp -= d.amount;
    me.hitFlash = 0.16;
    this.shake = Math.max(this.shake, 7 * this.settings.shake);
    audio.play('hit');
    this.spark(me.x, me.y, '#ffd27a', 8);
    this.floater(me.x, me.y - 40, '-' + Math.round(d.amount), '#ff8a6a');
    if (me.hp <= 0) this.killLocal(me, d.fromName || 'ENEMY', true);
  }

  reviveRemote(t) {
    const spot = this.freeSpot(320);
    t.x = t.tx = spot.x; t.y = t.ty = spot.y;
    t.hp = t.maxHp; t.alive = true;
    t.spawnFx = 0.6;
  }

  // ----------------------------------------------------------------
  //  input
  // ----------------------------------------------------------------
  _bind() {
    this._onResize = () => this.resize();
    window.addEventListener('resize', this._onResize);

    this._onKeyDown = (e) => {
      if (this.chatOpen) {
        if (e.key === 'Escape') this.closeChat();
        if (e.key === 'Enter') this.submitChat();
        return;
      }
      const k = e.key.toLowerCase();
      if (['w', 'a', 's', 'd', ' ', 'tab', 'shift', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) e.preventDefault();
      this.input.keys.add(k);
      if (k === 'escape') this.togglePause();
      if (k === 'enter') this.openChat();
      if (k === 'tab') $('#hud-board')?.classList.add('expanded');
      if (k === 'shift') this.tryDash();
      if (k === 'm') {
        this.settings.music = this.settings.music > 0 ? 0 : 0.3;
        audio.set(this.settings);
        this.announce(this.settings.music ? 'MUSIC ON' : 'MUSIC OFF', 900);
      }
    };
    this._onKeyUp = (e) => {
      const k = e.key.toLowerCase();
      this.input.keys.delete(k);
      if (k === 'tab') $('#hud-board')?.classList.remove('expanded');
    };
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);

    this._onMove = (e) => {
      const r = this.canvas.getBoundingClientRect();
      this.input.mx = e.clientX - r.left;
      this.input.my = e.clientY - r.top;
    };
    this.canvas.addEventListener('mousemove', this._onMove);
    this.canvas.addEventListener('mousedown', (e) => {
      if (e.button === 0) { this.input.firing = true; audio.unlock(); }
    });
    window.addEventListener('mouseup', (e) => { if (e.button === 0) this.input.firing = false; });
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    this._onBlur = () => { this.input.keys.clear(); this.input.firing = false; };
    window.addEventListener('blur', this._onBlur);

    $('#hud-resume')?.addEventListener('click', () => this.togglePause());
    $('#hud-leave')?.addEventListener('click', () => this.leave());
    this.hud.chatInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.submitChat();
      if (e.key === 'Escape') this.closeChat();
      e.stopPropagation();
    });
  }

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.floor(w * this.dpr);
    this.canvas.height = Math.floor(h * this.dpr);
    this.canvas.style.width = w + 'px';
    this.canvas.style.height = h + 'px';
    this.vw = w; this.vh = h;
    this.zoom = clamp(Math.max(w / 1560, h / 960) * 1.22, 0.85, 1.5);
    if (this.minimap) {
      const size = this.minimap.clientWidth || 168;
      this.minimap.width = size * this.dpr;
      this.minimap.height = size * this.dpr;
    }
  }

  tryDash() {
    const me = this.me;
    if (!me?.alive || this.t < me.dashReady) return;
    me.dashReady = this.t + 3.2;
    me.dashing = 0.18;
    audio.play('dash');
    for (let i = 0; i < 10; i++) {
      this.particles.push({
        x: me.x + rand(24, -24), y: me.y + rand(24, -24),
        vx: rand(80, -80), vy: rand(80, -80),
        life: 0.5, maxLife: 0.5, size: rand(14, 6), color: 'rgba(190,200,170,0.4)',
      });
    }
  }

  togglePause() {
    if (!this.running) return;
    this.paused = !this.paused;
    this.hud.pause?.classList.toggle('hidden', !this.paused);
    audio.play(this.paused ? 'uiBack' : 'ui');
  }

  openChat() {
    if (!this.running) return;
    this.chatOpen = true;
    this.hud.chatWrap?.classList.remove('hidden');
    this.hud.chatInput?.focus();
  }
  closeChat() {
    this.chatOpen = false;
    this.hud.chatWrap?.classList.add('hidden');
    if (this.hud.chatInput) this.hud.chatInput.value = '';
    this.hud.chatInput?.blur();
  }
  submitChat() {
    const v = (this.hud.chatInput?.value || '').trim();
    if (v) {
      this.addChat(state.profile.username, v);
      this.net?.sendChat(v);
    }
    this.closeChat();
  }

  // ----------------------------------------------------------------
  //  main loop
  // ----------------------------------------------------------------
  animate(now) {
    if (!this.running) return;
    this.raf = requestAnimationFrame((t) => this.animate(t));
    let dt = (now - this.lastFrame) / 1000;
    this.lastFrame = now;
    if (dt > 0.05) dt = 0.05;
    this.fpsAcc += dt; this.fpsFrames++;
    if (this.fpsAcc > 0.4) {
      this.fps = Math.round(this.fpsFrames / this.fpsAcc);
      this.fpsAcc = 0; this.fpsFrames = 0;
    }

    if (!this.paused) {
      this.t += dt;
      this.update(dt);
    }
    this.render(dt);
    this.frame++;
    if (this.frame % 4 === 0) this.drawMinimap();
  }

  update(dt) {
    const me = this.me;

    // ---- local tank drive
    if (me.alive) {
      let ix = 0, iy = 0;
      const k = this.input.keys;
      if (k.has('w') || k.has('arrowup')) iy -= 1;
      if (k.has('s') || k.has('arrowdown')) iy += 1;
      if (k.has('a') || k.has('arrowleft')) ix -= 1;
      if (k.has('d') || k.has('arrowright')) ix += 1;
      if (this.chatOpen) { ix = 0; iy = 0; }

      const mag = Math.hypot(ix, iy);
      if (mag > 0) {
        ix /= mag; iy /= mag;
        const target = Math.atan2(ix, -iy);
        const turnRate = me.stats.turn * (me.boostUntil > this.t ? 1.25 : 1);
        me.angle = angleLerp(me.angle, target, clamp(turnRate * dt, 0, 1));
        const boost = me.boostUntil > this.t ? 1.45 : 1;
        const accel = me.stats.accel * boost * (me.dashing > 0 ? 2.6 : 1);
        me.vx += Math.sin(me.angle) * accel * dt;
        me.vy += -Math.cos(me.angle) * accel * dt;
      } else {
        me.vx *= Math.pow(0.02, dt);
        me.vy *= Math.pow(0.02, dt);
      }

      const maxSp = me.stats.speed * (me.boostUntil > this.t ? 1.45 : 1) * (me.dashing > 0 ? 2.2 : 1);
      const sp = Math.hypot(me.vx, me.vy);
      if (sp > maxSp) { me.vx = (me.vx / sp) * maxSp; me.vy = (me.vy / sp) * maxSp; }

      me.x += me.vx * dt;
      me.y += me.vy * dt;
      this.collideWorld(me);

      // turret aim
      const wm = this.screenToWorld(this.input.mx, this.input.my);
      const aim = Math.atan2(wm.x - me.x, -(wm.y - me.y));
      me.turret = angleLerp(me.turret, aim, clamp(9 * dt, 0, 1));

      if (this.input.firing && !this.chatOpen) this.fire(me);
      if (me.dashing > 0) me.dashing = Math.max(0, me.dashing - dt);

      // track marks
      me.trackT -= dt;
      if (me.trackT <= 0 && sp > 30) {
        me.trackT = 0.09;
        this.decals.push({
          x: me.x, y: me.y, img: 'tracksDouble', a: me.angle,
          s: (me.stats.scale || 1) * 0.72, alpha: 0.15, fade: true, life: 8,
        });
        if (this.decals.length > 320) this.decals.splice(0, this.decals.length - 320);
      }
    }

    // ---- remote interpolation
    for (const t of this.remotes.values()) {
      const k = clamp(dt * 1000 / NET.interp, 0, 1);
      t.x = lerp(t.x, t.tx, k);
      t.y = lerp(t.y, t.ty, k);
      t.angle = angleLerp(t.angle, t.ta, k);
      t.turret = angleLerp(t.turret, t.tt, k);
      if (t.hp <= 0 && t.alive) t.alive = false;
      if (t.lastSeen && performance.now() - t.lastSeen > 12000) this.removeRemote(t.uid);
    }

    // ---- bots
    for (const b of this.tanks) if (b.bot && b.alive) this.updateBot(b, dt);

    // ---- timers / fx
    for (const t of this.tanks) {
      if (t.hitFlash > 0) t.hitFlash -= dt;
      if (t.muzzle > 0) t.muzzle -= dt;
      if (t.spawnFx > 0) t.spawnFx -= dt;
      if (!t.alive && !t.remote) {
        t.respawnT -= dt;
        if (t.respawnT <= 0) this.respawn(t);
      }
    }

    // ---- bullets
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      const steps = Math.max(1, Math.ceil(Math.hypot(b.vx, b.vy) * dt / 16));
      let dead = false;
      for (let s = 0; s < steps && !dead; s++) {
        b.x += (b.vx * dt) / steps;
        b.y += (b.vy * dt) / steps;
        if (b.x < WORLD.wall || b.y < WORLD.wall || b.x > WORLD.size - WORLD.wall || b.y > WORLD.size - WORLD.wall) {
          dead = true; this.spark(b.x, b.y, '#cfd8bd', 4); break;
        }
        for (const o of this.obstacles) {
          if (!o.blocks) continue;
          if (Math.abs(b.x - o.x) < o.w / 2 + b.r && Math.abs(b.y - o.y) < o.h / 2 + b.r) {
            dead = true;
            this.spark(b.x, b.y, '#ffcf8a', 6);
            if (o.destructible) this.damageObstacle(o, b.dmg || 12, b);
            break;
          }
        }
        if (dead) break;
        for (const t of this.tanks) {
          if (t === b.owner || !t.alive || t.invuln > this.t) continue;
          if (this.mode.teams && t.team === b.owner.team) continue;
          const rr = t.stats.radius + b.r;
          if (dist2(b.x, b.y, t.x, t.y) < rr * rr) {
            dead = true;
            this.bulletHit(b, t);
            break;
          }
        }
      }
      b.life -= dt;
      if (dead || b.life <= 0) this.bullets.splice(i, 1);
    }

    // ---- particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.vx *= 0.96; p.vy *= 0.96;
      p.life -= dt;
      if (p.life <= 0) this.particles.splice(i, 1);
    }
    for (let i = this.floaters.length - 1; i >= 0; i--) {
      const f = this.floaters[i];
      f.y -= 34 * dt; f.life -= dt;
      if (f.life <= 0) this.floaters.splice(i, 1);
    }
    for (let i = this.fxList.length - 1; i >= 0; i--) {
      const f = this.fxList[i];
      f.life -= dt;
      if (f.life <= 0) this.fxList.splice(i, 1);
    }
    for (let i = this.decals.length - 1; i >= 0; i--) {
      const d = this.decals[i];
      if (d.fade) {
        d.life -= dt;
        d.alpha = Math.max(0, Math.min(0.28, d.life * 0.03));
        if (d.life <= 0) this.decals.splice(i, 1);
      }
    }

    // ---- powerups
    this.powerupTimer = (this.powerupTimer ?? 4) - dt;
    if (this.powerupTimer <= 0 && this.powerups.length < 6) {
      this.powerupTimer = rand(11, 6);
      const spot = this.freeSpot(180);
      this.powerups.push({ x: spot.x, y: spot.y, kind: pick(POWER_KEYS), t: 0, life: 26 });
    }
    for (let i = this.powerups.length - 1; i >= 0; i--) {
      const pu = this.powerups[i];
      pu.t += dt; pu.life -= dt;
      if (pu.life <= 0) { this.powerups.splice(i, 1); continue; }
      if (me.alive && dist2(me.x, me.y, pu.x, pu.y) < 42 * 42) {
        this.applyPowerup(me, pu.kind);
        this.powerups.splice(i, 1);
      }
    }

    // ---- camera (clamped to the arena so the void is never visible)
    if (me.alive) {
      this.cam.x = lerp(this.cam.x, me.x, clamp(dt * 7, 0, 1));
      this.cam.y = lerp(this.cam.y, me.y, clamp(dt * 7, 0, 1));
    }
    this.clampCamera();
    this.shake = Math.max(0, this.shake - dt * 34);

    // ---- net state broadcast
    if (this.net && me.alive) {
      this.net.sendState({
        x: Math.round(me.x), y: Math.round(me.y),
        a: +me.angle.toFixed(2), tu: +me.turret.toFixed(2),
        h: Math.round(me.hp), mh: Math.round(me.maxHp),
        k: this.stats.kills, s: this.stats.score,
        sk: me.skin, tm: me.team, mo: this.modeId,
      });
    }

    this.updateMode(dt);
    this.updateHud();
  }

  clampCamera() {
    const hw = this.vw / 2 / this.zoom;
    const hh = this.vh / 2 / this.zoom;
    this.cam.x = WORLD.size > hw * 2 ? clamp(this.cam.x, hw, WORLD.size - hw) : WORLD.size / 2;
    this.cam.y = WORLD.size > hh * 2 ? clamp(this.cam.y, hh, WORLD.size - hh) : WORLD.size / 2;
  }

  // ----------------------------------------------------------------
  //  combat
  // ----------------------------------------------------------------
  muzzleLength(t) {
    const barrel = img(t.stats.barrel), body = img(t.stats.body);
    if (!barrel || !body) return 46;
    const s = t.stats.scale || 1;
    return barrel.height * s - body.height * s * 0.12;
  }

  fire(t) {
    if (!t.alive || this.t < t.reloadT) return;
    const rapid = t.rapidUntil > this.t;
    const triple = t.tripleUntil > this.t;
    t.reloadT = this.t + t.stats.reload * (rapid ? 0.5 : 1);
    t.muzzle = 0.07;

    const f = TANK_FWD(t.turret);
    const len = this.muzzleLength(t);
    const sx = t.x + f.x * len, sy = t.y + f.y * len;
    const count = triple ? 3 : 1;
    const spread = t.stats.spread * (triple ? 2.2 : 1);

    for (let i = 0; i < count; i++) {
      const off = count === 1 ? 0 : (i - 1) * spread * 1.4;
      const a = t.turret + off + rand(spread, -spread);
      const ff = TANK_FWD(a);
      this.bullets.push({
        x: sx, y: sy,
        vx: ff.x * t.stats.shellSpeed, vy: ff.y * t.stats.shellSpeed,
        owner: t, dmg: t.stats.damage, life: 1.35,
        color: t.color, r: 5, mine: t.local,
      });
    }
    this.muzzleFlash(t, t.turret);
    this.shake = Math.max(this.shake, (t.local ? 3.4 : 1.6) * this.settings.shake);
    audio.play('cannon');
    if (t.local) {
      this.stats.shots += 1;
      this.net?.sendFire({ x: sx, y: sy, a: t.turret });
      // recoil
      t.vx -= f.x * 26; t.vy -= f.y * 26;
    }
  }

  muzzleFlash(t, angle) {
    this.fxList.push({
      sprite: 'shotOrange', x: t.x + Math.sin(angle) * (this.muzzleLength(t) + 8),
      y: t.y - Math.cos(angle) * (this.muzzleLength(t) + 8),
      a: angle, life: 0.09, maxLife: 0.09, scale: 1.1, rotate: true,
    });
    for (let i = 0; i < 5; i++) {
      this.particles.push({
        x: t.x + Math.sin(angle) * this.muzzleLength(t),
        y: t.y - Math.cos(angle) * this.muzzleLength(t),
        vx: Math.sin(angle + rand(0.4, -0.4)) * rand(220, 90),
        vy: -Math.cos(angle + rand(0.4, -0.4)) * rand(220, 90),
        life: 0.28, maxLife: 0.28, size: rand(9, 4), color: 'rgba(255,190,90,0.85)',
      });
    }
  }

  bulletHit(b, t) {
    this.spark(b.x, b.y, t.color || '#ffc45a', 8);
    // Remote players' shells are visual only — their owner resolves the hit
    // and tells us through the damage channel.
    if (b.visual) return;
    const dmg = b.dmg || 14;
    if (b.mine) this.stats.hits += 1;

    if (t.remote) {
      // client-authoritative damage message; the owner applies it
      this.net?.sendDamage({ to: t.uid, amount: Math.round(dmg), x: b.x, y: b.y });
      this.floater(t.x, t.y - 44, '-' + Math.round(dmg), '#ffd27a');
      t.hitFlash = 0.16;
      if (b.mine) {
        if (t.hp - dmg <= 0) {
          this.predictRemoteKill(t);
        }
        t.hp -= dmg;
      }
      return;
    }

    this.damageTank(t, dmg, this.me, b.mine);
  }

  predictRemoteKill(t) {
    if (!t.alive) return;
    t.alive = false;
    t.hp = 0;
    this.explodeAt(t.x, t.y, 1.1);
    this.creditKill(this.me, t.name);
    this.net?.sendKill({ victim: t.uid, victimName: t.name });
    clearTimeout(t._reviveTimer);
    t._reviveTimer = setTimeout(() => {
      if (this.remotes.has(t.uid)) this.reviveRemote(t);
    }, 3200);
  }

  damageTank(t, dmg, from, credit) {
    if (!t.alive) return;
    if (t.invuln > this.t) return;
    if (t.shieldUntil > this.t) {
      this.spark(t.x, t.y, '#5ac8ff', 10);
      audio.play('ricochet');
      return;
    }
    t.hp -= dmg;
    t.hitFlash = 0.18;
    this.floater(t.x, t.y - 44, '-' + Math.round(dmg), credit ? '#ffd27a' : '#ff9d84');
    audio.play('hit');
    if (t.hp <= 0) this.killTank(t, from, credit);
  }

  killTank(t, from, credit) {
    t.alive = false;
    t.hp = 0;
    t.deaths++;
    t.streak = 0;
    this.explodeAt(t.x, t.y, 1.2);
    audio.play('death');

    if (t.local) {
      this.stats.deaths++;
      this.hud.respawn?.classList.remove('hidden');
      t.respawnT = 3.2;
      this.shake = 16 * this.settings.shake;
      t.vx = t.vy = 0;
      if (this.mode.waves) {
        this.lives -= 1;
        if (this.lives <= 0) this.endMatch(false, 'OVERRUN');
      }
    }
    if (t.bot) {
      this.feed(`<b>${esc(from?.name || 'YOU')}</b> destroyed <b>${esc(t.name)}</b>`, '#c9d6bd');
      if (this.mode.waves) {
        t.respawnT = 1e9;
        this.graveyard.push({ tank: t, at: this.t + 1.6 });
      } else {
        t.respawnT = rand(4.5, 2.5);
      }
      if (credit) this.creditKill(from, t.name);
    }
  }

  creditKill(killer, victimName) {
    if (!killer) return;
    killer.streak++;
    killer.bestStreak = Math.max(killer.bestStreak, killer.streak);
    const mult = Math.min(1 + (killer.streak - 1) * 0.25, 3);
    const gain = Math.round(100 * mult);
    killer.score += gain;
    killer.kills++;
    if (this.mode.teams) this.teamScore[killer.team || 0] += 1;
    if (killer.local) {
      this.stats.kills++;
      this.stats.score += gain;
      this.stats.bestStreak = Math.max(this.stats.bestStreak, killer.streak);
      this.floater(killer.x, killer.y - 60, '+' + gain, '#8fbf5e');
      if (killer.streak >= 3) this.announce(`${killer.streak} KILL STREAK`, 1200);

      const now = performance.now();
      this.recentKills = this.recentKills.filter((x) => now - x < 3200);
      this.recentKills.push(now);
      const n = this.recentKills.length;
      if (n === 2) this.medal('DOUBLE KILL', 'TWO IN THREE SECONDS');
      else if (n === 3) this.medal('TRIPLE KILL', 'RAMPAGE');
      else if (n >= 4) { this.medal('MULTI KILL', 'UNSTOPPABLE'); this.recentKills = []; }
    }
  }

  killLocal(me, killerName, remoteKiller) {
    me.alive = false;
    me.hp = 0;
    me.deaths++;
    me.streak = 0;
    this.stats.deaths++;
    this.explodeAt(me.x, me.y, 1.2);
    audio.play('death');
    this.shake = 16 * this.settings.shake;
    me.respawnT = 3.2;
    this.hud.respawn?.classList.remove('hidden');
    if (this.mode.waves) {
      this.lives -= 1;
      if (this.lives <= 0) this.endMatch(false, 'OVERRUN');
    }
    if (killerName) this.feed(`<b>${esc(killerName)}</b> destroyed <b>YOU</b>`, '#e0806a');
  }

  respawn(t) {
    let spot;
    if (this.mode.teams) {
      const pool = SPAWNS.filter((s) => (s.x > WORLD.size / 2 ? 1 : 0) === (t.team ? 1 : 0));
      const base = pick(pool.length ? pool : SPAWNS);
      spot = { x: base.x + rand(140, -140), y: base.y + rand(140, -140) };
    } else {
      spot = this.freeSpot(420);
    }
    t.x = spot.x; t.y = spot.y;
    t.vx = t.vy = 0;
    t.hp = t.maxHp;
    t.alive = true;
    t.invuln = this.t + 2.2;
    t.spawnFx = 0.7;
    t.angle = rand(Math.PI * 2, 0);
    t.turret = t.angle;
    t.streak = 0;
    t.reloadT = this.t + 0.4;
    if (t.local) {
      this.hud.respawn?.classList.add('hidden');
      this.cam.x = t.x; this.cam.y = t.y;
      this.announce('RESPAWNED', 900);
    }
  }

  damageObstacle(o, dmg, bullet) {
    if (!o.destructible) return;
    o.hp -= dmg;
    if (o.hp <= 0) {
      o.blocks = false;
      o.dead = true;
      if (o.explosive) {
        this.explodeAt(o.x, o.y, 1.6);
        this.areaDamage(o.x, o.y, 165, 46);
      } else {
        this.explodeAt(o.x, o.y, 0.6);
      }
      this.obstacles = this.obstacles.filter((x) => x !== o);
    }
  }

  areaDamage(x, y, radius, dmg) {
    for (const t of this.tanks) {
      if (!t.alive || t.invuln > this.t) continue;
      const d = dist(x, y, t.x, t.y);
      if (d < radius) {
        const falloff = 1 - d / radius;
        if (t.remote) {
          if (t === this.me) continue;
        }
        if (t.local) this.damageTank(t, dmg * falloff, null, false);
        else if (!t.remote) this.damageTank(t, dmg * falloff, this.me, t.bot);
      }
    }
  }

  applyPowerup(t, kind) {
    audio.play('pickup');
    const pu = POWERUPS[kind];
    this.floater(t.x, t.y - 50, pu.label, pu.color);
    switch (kind) {
      case 'repair':
        t.hp = Math.min(t.maxHp, t.hp + t.maxHp * 0.4);
        this.spark(t.x, t.y, '#6ee06a', 14);
        break;
      case 'rapid': t.rapidUntil = this.t + pu.dur; break;
      case 'shield': t.shieldUntil = this.t + pu.dur; break;
      case 'triple': t.tripleUntil = this.t + pu.dur; break;
      case 'boost': t.boostUntil = this.t + pu.dur; break;
      case 'salvage':
        t.score += 75;
        if (t.local) { this.stats.score += 75; this.me.creditsFound = (this.me.creditsFound || 0) + 40; }
        break;
      default: break;
    }
  }

  // ----------------------------------------------------------------
  //  bots
  // ----------------------------------------------------------------
  updateBot(b, dt) {
    const ai = b.ai;
    ai.think -= dt;

    if (ai.think <= 0) {
      ai.think = rand(0.9, 0.35);
      let best = null, bd = 1e9;
      for (const t of this.tanks) {
        if (t === b || !t.alive) continue;
        if (this.mode.waves && t !== this.me) continue;
        if (this.mode.teams && t.team === b.team) continue;
        const d = dist2(b.x, b.y, t.x, t.y);
        if (d < bd) { bd = d; best = t; }
      }
      ai.target = best;
      if (Math.random() < 0.3) ai.strafe *= -1;
      ai.err = rand(0.16, -0.16);
      ai.react = rand(0.75, 0.3);
    }

    const target = ai.target;
    if (!target || !target.alive) {
      b.vx *= Math.pow(0.1, dt); b.vy *= Math.pow(0.1, dt);
      b.x += b.vx * dt; b.y += b.vy * dt;
      this.collideWorld(b);
      return;
    }

    const d = dist(b.x, b.y, target.x, target.y);
    const desired = 300 + (b.stats.radius * 2);
    const toward = Math.atan2(target.x - b.x, -(target.y - b.y));
    let dir = toward;
    if (d < desired * 0.72) dir = toward + Math.PI;             // back off
    else if (d < desired * 1.05) dir = toward + ai.strafe * 1.45; // strafe

    // obstacle avoidance: steer around blocking props
    let pushX = 0, pushY = 0;
    for (const o of this.obstacles) {
      if (!o.blocks) continue;
      const dd = dist2(b.x, b.y, o.x, o.y);
      if (dd < 165 * 165) {
        const f = 1 - Math.sqrt(dd) / 165;
        pushX += (b.x - o.x) * f * 0.06;
        pushY += (b.y - o.y) * f * 0.06;
      }
    }
    const mvx = Math.sin(dir) + pushX, mvy = -Math.cos(dir) + pushY;
    const ma = Math.atan2(mvx, -mvy);
    b.angle = angleLerp(b.angle, ma, clamp(b.stats.turn * 1.4 * dt, 0, 1));

    const accel = b.stats.accel * 0.9;
    b.vx += Math.sin(b.angle) * accel * dt;
    b.vy += -Math.cos(b.angle) * accel * dt;
    const sp = Math.hypot(b.vx, b.vy);
    const maxSp = b.stats.speed * 0.92;
    if (sp > maxSp) { b.vx = (b.vx / sp) * maxSp; b.vy = (b.vy / sp) * maxSp; }
    b.x += b.vx * dt; b.y += b.vy * dt;
    this.collideWorld(b);

    // aim with lead
    const travel = d / b.stats.shellSpeed;
    const px = target.x + target.vx * travel * 0.85;
    const py = target.y + target.vy * travel * 0.85;
    const aim = Math.atan2(px - b.x, -(py - b.y)) + ai.err;
    b.turret = angleLerp(b.turret, aim, clamp(4.4 * dt, 0, 1));

    if (ai.react > 0) { ai.react -= dt; return; }
    if (d < 620 && Math.abs(angleDiff(b.turret, aim)) < 0.14 && Math.random() < 0.7) {
      this.fire(b);
    }
  }

  // ----------------------------------------------------------------
  //  collision
  // ----------------------------------------------------------------
  collideWorld(t) {
    const r = t.stats.radius;
    const m = WORLD.wall + r;
    t.x = clamp(t.x, m, WORLD.size - m);
    t.y = clamp(t.y, m, WORLD.size - m);

    for (const o of this.obstacles) {
      if (!o.blocks) continue;
      const halfW = o.w / 2, halfH = o.h / 2;
      const nx = clamp(t.x, o.x - halfW, o.x + halfW);
      const ny = clamp(t.y, o.y - halfH, o.y + halfH);
      const dx = t.x - nx, dy = t.y - ny;
      const d2 = dx * dx + dy * dy;
      if (d2 < r * r) {
        const d = Math.sqrt(d2) || 0.001;
        const overlap = r - d;
        t.x += (dx / d) * overlap;
        t.y += (dy / d) * overlap;
        const dot = t.vx * (dx / d) + t.vy * (dy / d);
        if (dot < 0) { t.vx -= dot * (dx / d) * 0.7; t.vy -= dot * (dy / d) * 0.7; }
      }
    }
  }

  // ----------------------------------------------------------------
  //  fx helpers
  // ----------------------------------------------------------------
  spark(x, y, color, n = 6) {
    for (let i = 0; i < n; i++) {
      this.particles.push({
        x, y,
        vx: rand(260, -260), vy: rand(260, -260),
        life: rand(0.35, 0.12), maxLife: 0.35,
        size: rand(6, 2), color,
      });
    }
    if (this.particles.length > 520) this.particles.splice(0, this.particles.length - 520);
  }

  explodeAt(x, y, scale = 1) {
    this.fxList.push({
      sprite: 'explosion' + randInt(1, 5), x, y, a: rand(Math.PI * 2, 0),
      life: 0.42, maxLife: 0.42, scale: scale * 1.5, grow: true,
    });
    this.fxList.push({
      sprite: 'explosionSmoke' + randInt(1, 5), x: x + rand(20, -20), y: y + rand(20, -20),
      a: rand(Math.PI * 2, 0), life: 1.1, maxLife: 1.1, scale: scale * 1.9, grow: true, smoke: true,
    });
    for (let i = 0; i < 18; i++) {
      const a = rand(Math.PI * 2, 0), s = rand(420, 60) * scale;
      this.particles.push({
        x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
        life: rand(0.8, 0.3), maxLife: 0.8, size: rand(12, 4),
        color: i % 3 === 0 ? 'rgba(255,220,140,0.9)' : 'rgba(255,150,60,0.7)',
      });
    }
    this.shake = Math.max(this.shake, 10 * scale * this.settings.shake);
    audio.play('explosion');
  }

  floater(x, y, text, color) {
    this.floaters.push({ x: x + rand(16, -16), y, text, color, life: 0.9 });
  }

  feed(html, color = '#c9d6bd') {
    if (!this.hud.feed) return;
    const div = document.createElement('div');
    div.className = 'feed-item';
    div.style.borderColor = color;
    div.innerHTML = html;
    this.hud.feed.appendChild(div);
    while (this.hud.feed.children.length > 5) this.hud.feed.firstChild.remove();
    setTimeout(() => div.classList.add('fade'), 4200);
    setTimeout(() => div.remove(), 5000);
  }

  addChat(from, text) {
    if (!this.hud.chatLog) return;
    const line = document.createElement('div');
    line.className = 'chat-line';
    line.innerHTML = `<b>${esc(from)}</b> ${esc(text)}`;
    this.hud.chatLog.appendChild(line);
    while (this.hud.chatLog.children.length > 6) this.hud.chatLog.firstChild.remove();
    setTimeout(() => line.classList.add('fade'), 9000);
    setTimeout(() => line.remove(), 10000);
  }

  announce(text, ms = 1400) {
    const a = this.hud.announce;
    if (!a) return;
    a.textContent = text;
    a.classList.remove('hidden');
    a.classList.add('show');
    clearTimeout(this._annTimer);
    this._annTimer = setTimeout(() => {
      a.classList.remove('show');
      setTimeout(() => a.classList.add('hidden'), 300);
    }, ms);
  }

  // ----------------------------------------------------------------
  //  hud
  // ----------------------------------------------------------------
  updateHud() {
    const me = this.me;
    const pct = clamp(me.hp / me.maxHp, 0, 1);
    if (this.hud.hpFill) {
      this.hud.hpFill.style.width = pct * 100 + '%';
      this.hud.hpFill.style.background =
        pct > 0.55 ? 'linear-gradient(90deg,#5fbf2e,#8fe86b)'
        : pct > 0.25 ? 'linear-gradient(90deg,#c9a227,#e8d05a)'
        : 'linear-gradient(90deg,#a32c1c,#e0553c)';
    }
    if (this.hud.hpText) this.hud.hpText.textContent = `${Math.max(0, Math.round(me.hp))} / ${me.maxHp}`;

    const ready = clamp(1 - (me.reloadT - this.t) / me.stats.reload, 0, 1);
    if (this.hud.reloadFill) this.hud.reloadFill.style.width = ready * 100 + '%';

    const dashLeft = clamp((me.dashReady - this.t) / 3.2, 0, 1);
    if (this.hud.dash) {
      this.hud.dash.style.setProperty('--ready', (1 - dashLeft) * 100 + '%');
      this.hud.dash.classList.toggle('ready', dashLeft <= 0);
    }

    if (this.hud.score) this.hud.score.textContent = fmt(this.stats.score);
    if (this.hud.kills) this.hud.kills.textContent = this.stats.kills;
    if (this.hud.deaths) this.hud.deaths.textContent = this.stats.deaths;
    if (this.hud.streak) this.hud.streak.textContent = me.streak > 1 ? 'x' + me.streak : '—';
    if (this.hud.fps) this.hud.fps.textContent = this.settings.showFps ? this.fps + ' FPS' : '';

    if (this.hud.respawnText) {
      this.hud.respawnText.textContent = Math.max(0, me.respawnT).toFixed(1);
    }

    // active powerups
    if (this.hud.powers) {
      const active = [];
      if (me.rapidUntil > this.t) active.push(['RAPID', me.rapidUntil - this.t, '#ffd35a']);
      if (me.shieldUntil > this.t) active.push(['SHIELD', me.shieldUntil - this.t, '#5ac8ff']);
      if (me.tripleUntil > this.t) active.push(['TRIPLE', me.tripleUntil - this.t, '#ff9a5a']);
      if (me.boostUntil > this.t) active.push(['BOOST', me.boostUntil - this.t, '#c8a0ff']);
      const key = active.map((a) => a[0]).join(',');
      if (key !== this._powerKey) {
        this._powerKey = key;
        this.hud.powers.innerHTML = active
          .map(([n, , c]) => `<span class="power-chip" style="--c:${c}">${n}</span>`)
          .join('');
      }
    }

    if (this.hud.online && this.net) {
      this.hud.online.textContent = (this.net.playerCount()) + ' ONLINE';
    }

    if (this.frame % 15 === 0 && this.hud.board) this.renderBoard();
    if (this.hud.timer && this.frame % 30 === 0) {
      const s = Math.floor((performance.now() - this.startAt) / 1000);
      this.hud.timer.textContent =
        String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
    }

    // ---- mode objective + match clock
    if (this.hud.remaining) this.hud.remaining.textContent = this.fmtTime(this.remaining);
    if (this.hud.objective) {
      const m = this.mode;
      let val, label;
      if (m.zone) { val = `${Math.floor(this.zonePts[0])} : ${Math.floor(this.zonePts[1])}`; label = 'ZONE PTS'; }
      else if (m.teams) { val = `${this.teamScore[0]} : ${this.teamScore[1]}`; label = 'TEAM KILLS'; }
      else if (m.waves) { val = `WAVE ${this.wave}`; label = `${this.stats.kills} KILLS`; }
      else { val = `${this.me.kills} / ${m.target}`; label = 'KILLS'; }
      this.hud.objective.textContent = val;
      if (this.hud.objectiveLabel) this.hud.objectiveLabel.textContent = label;
    }
    if (this.hud.lives) {
      this.hud.lives.textContent = this.mode.waves
        ? 'LIVES ' + '◆'.repeat(Math.max(0, this.lives))
        : '';
      this.hud.lives.classList.toggle('danger', this.mode.waves && this.lives <= 1);
    }
  }

  renderBoard() {
    const list = [...this.tanks]
      .filter((t) => !t.remote || this.remotes.has(t.uid))
      .sort((a, b) => b.kills - a.kills || b.score - a.score)
      .slice(0, 8);
    this.hud.board.innerHTML = list
      .map((t, i) => `<div class="board-row ${t.local ? 'me' : ''}">
        <span class="br-rank">${i + 1}</span>
        <span class="br-name">${esc(t.name)}</span>
        <span class="br-k">${t.kills}</span>
        <span class="br-s">${fmt(t.score)}</span>
      </div>`).join('');
  }

  screenToWorld(sx, sy) {
    return {
      x: (sx - this.vw / 2) / this.zoom + this.cam.x,
      y: (sy - this.vh / 2) / this.zoom + this.cam.y,
    };
  }

  // ----------------------------------------------------------------
  //  render
  // ----------------------------------------------------------------
  render(dt) {
    const ctx = this.ctx;
    const { vw, vh, zoom, dpr } = this;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, vw, vh);

    // backdrop
    const bg = ctx.createRadialGradient(vw / 2, vh / 2, 80, vw / 2, vh / 2, Math.max(vw, vh) * 0.8);
    bg.addColorStop(0, '#141d15');
    bg.addColorStop(1, '#060a07');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, vw, vh);

    let shakeX = 0, shakeY = 0;
    if (this.shake > 0.2) {
      shakeX = rand(this.shake, -this.shake);
      shakeY = rand(this.shake, -this.shake);
    }

    ctx.save();
    ctx.translate(vw / 2 + shakeX, vh / 2 + shakeY);
    ctx.scale(zoom, zoom);
    ctx.translate(-this.cam.x, -this.cam.y);

    this.drawGround(ctx);
    this.drawDecals(ctx);
    if (this.zone) this.drawZone(ctx);

    // collect drawables for y-sorting
    const drawables = [];
    for (const o of this.obstacles) drawables.push({ y: o.y + o.h / 2, kind: 'obstacle', ref: o });
    for (const t of this.tanks) if (t.alive) drawables.push({ y: t.y + t.stats.radius, kind: 'tank', ref: t });
    for (const p of this.powerups) drawables.push({ y: p.y + 16, kind: 'powerup', ref: p });
    drawables.sort((a, b) => a.y - b.y);

    for (const d of drawables) {
      if (d.kind === 'obstacle') this.drawObstacle(ctx, d.ref);
      else if (d.kind === 'powerup') this.drawPowerup(ctx, d.ref);
      else this.drawTank(ctx, d.ref);
    }

    this.drawBullets(ctx);
    this.drawParticles(ctx);
    this.drawFx(ctx);
    this.drawFloaters(ctx);
    if (this.settings.showNames !== false) this.drawTags(ctx);
    this.drawWorldEdge(ctx);
    ctx.restore();

    this.drawVignette(ctx);
    this.drawWeather(ctx);
    if (this.me && !this.me.alive) this.drawDeathOverlay(ctx);
  }

  drawGround(ctx) {
    const { vw, vh, zoom } = this;
    const half = { x: vw / 2 / zoom + 120, y: vh / 2 / zoom + 120 };
    const left = Math.max(0, this.cam.x - half.x);
    const right = Math.min(WORLD.size, this.cam.x + half.x);
    const top = Math.max(0, this.cam.y - half.y);
    const bottom = Math.min(WORLD.size, this.cam.y + half.y);
    const TS = WORLD.tile;
    const x0 = Math.floor(left / TS) * TS;
    const y0 = Math.floor(top / TS) * TS;

    for (let y = y0; y <= bottom; y += TS) {
      for (let x = x0; x <= right; x += TS) {
        const tx = Math.floor(x / TS), ty = Math.floor(y / TS);
        const sand = this.terrain ? this.terrain[ty * this.tN + tx] === 1 : false;
        const h = (tx * 37 + ty * 91 + this.tileSeed % 17) % 100;
        // sand is uniform, grass gets a rare second variant for texture
        const key = sand ? (h > 55 ? 'tileSand2' : 'tileSand1')
                         : (h > 82 ? 'tileGrass2' : 'tileGrass1');
        const im = img(key);
        if (im) ctx.drawImage(im, x, y, TS + 1, TS + 1);
      }
    }

    // colour grade — knocks the toy-bright tiles back into military drab
    ctx.save();
    ctx.fillStyle = 'rgba(9, 20, 12, 0.38)';
    ctx.fillRect(left - 200, top - 200, right - left + 400, bottom - top + 400);
    const warm = ctx.createLinearGradient(left, top, right, bottom);
    warm.addColorStop(0, 'rgba(120, 150, 90, 0.05)');
    warm.addColorStop(1, 'rgba(10, 30, 20, 0.16)');
    ctx.fillStyle = warm;
    ctx.fillRect(left - 200, top - 200, right - left + 400, bottom - top + 400);
    ctx.restore();

    // subtle grid
    ctx.save();
    ctx.strokeStyle = 'rgba(130,190,120,0.028)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = x0; x <= right; x += TS) { ctx.moveTo(x, top); ctx.lineTo(x, bottom); }
    for (let y = y0; y <= bottom; y += TS) { ctx.moveTo(left, y); ctx.lineTo(right, y); }
    ctx.stroke();
    ctx.restore();

    // arena border
    ctx.save();
    ctx.strokeStyle = 'rgba(120,200,90,0.35)';
    ctx.lineWidth = WORLD.wall;
    ctx.strokeRect(WORLD.wall / 2, WORLD.wall / 2, WORLD.size - WORLD.wall, WORLD.size - WORLD.wall);
    ctx.restore();
  }

  drawDecals(ctx) {
    for (const d of this.decals) {
      const im = img(d.img);
      if (!im) continue;
      ctx.save();
      ctx.globalAlpha = d.alpha ?? 0.4;
      ctx.translate(d.x, d.y);
      ctx.rotate(d.a);
      const s = d.s || 1;
      ctx.drawImage(im, (-im.width / 2) * s, (-im.height / 2) * s, im.width * s, im.height * s);
      ctx.restore();
    }
  }

  drawObstacle(ctx, o) {
    const im = img(o.type);
    if (!im) return;
    ctx.save();
    ctx.drawImage(im, o.x - im.width / 2, o.y - im.height / 2);
    if (o.destructible && o.maxHp && o.hp < o.maxHp) {
      const w = 46, pct = o.hp / o.maxHp;
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(o.x - w / 2, o.y - im.height / 2 - 8, w, 4);
      ctx.fillStyle = pct > 0.5 ? '#8fe86b' : '#e0b44a';
      ctx.fillRect(o.x - w / 2, o.y - im.height / 2 - 8, w * pct, 4);
    }
    ctx.restore();
  }

  drawPowerup(ctx, p) {
    const pu = POWERUPS[p.kind];
    const bob = Math.sin(p.t * 2.4) * 4;
    ctx.save();
    ctx.translate(p.x, p.y + bob);
    ctx.globalAlpha = p.life < 4 ? 0.4 + Math.sin(p.t * 14) * 0.3 : 1;

    ctx.beginPath();
    ctx.arc(0, 6, 22, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fill();

    ctx.beginPath();
    ctx.arc(0, 0, 19, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(10,18,12,0.9)';
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = pu.color;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(0, 0, 26 + Math.sin(p.t * 3) * 3, 0, Math.PI * 2);
    ctx.strokeStyle = pu.color + '44';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = pu.color;
    ctx.font = 'bold 20px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(pu.glyph, 0, 1);
    ctx.restore();
  }

  drawTank(ctx, t) {
    const body = img(t.stats.body);
    const barrel = img(t.stats.barrel);
    if (!body) return;
    const s = t.stats.scale || 1;
    const bw = body.width * s, bh = body.height * s;

    // ground shadow
    ctx.save();
    ctx.translate(t.x, t.y + 8);
    ctx.rotate(t.angle);
    ctx.globalAlpha = 0.32;
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.ellipse(0, 0, bw * 0.48, bh * 0.42, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // player marker — dark halo so the hull never gets lost against terrain,
    // plus a rotating dashed ring
    if (t.local) {
      ctx.save();
      ctx.translate(t.x, t.y);
      const halo = ctx.createRadialGradient(0, 0, t.stats.radius * 0.8, 0, 0, t.stats.radius + 38);
      halo.addColorStop(0, 'rgba(12, 26, 10, 0.42)');
      halo.addColorStop(1, 'rgba(12, 26, 10, 0)');
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(0, 0, t.stats.radius + 38, 0, Math.PI * 2);
      ctx.fill();

      ctx.rotate(this.t * 0.55);
      ctx.strokeStyle = 'rgba(8, 18, 8, 0.55)';
      ctx.lineWidth = 4.5;
      ctx.beginPath();
      ctx.arc(0, 0, t.stats.radius + 17, 0, Math.PI * 2);
      ctx.stroke();

      ctx.strokeStyle = 'rgba(158, 245, 118, 0.95)';
      ctx.lineWidth = 2.2;
      ctx.setLineDash([13, 11]);
      ctx.beginPath();
      ctx.arc(0, 0, t.stats.radius + 17, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    ctx.save();
    if (t.invuln > this.t) ctx.globalAlpha = 0.55 + Math.sin(this.t * 20) * 0.25;
    ctx.translate(t.x, t.y);
    ctx.rotate(t.angle);
    const sk = t.skin ? skinCss(t.skin) : 'none';
    if (sk && sk !== 'none') ctx.filter = sk;
    ctx.drawImage(body, -bw / 2, -bh / 2, bw, bh);
    ctx.restore();

    if (barrel) {
      const brw = barrel.width * s, brh = barrel.height * s;
      ctx.save();
      ctx.translate(t.x, t.y);
      ctx.rotate(t.turret);
      if (sk && sk !== 'none') ctx.filter = sk;
      ctx.drawImage(barrel, -brw / 2, -brh + bh * 0.12, brw, brh);
      // muzzle glow
      if (t.muzzle > 0) {
        ctx.globalCompositeOperation = 'lighter';
        ctx.beginPath();
        ctx.arc(0, -brh + bh * 0.12, 14, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,200,90,0.35)';
        ctx.fill();
      }
      ctx.restore();
    }

    if (t.shieldUntil > this.t) {
      ctx.save();
      ctx.translate(t.x, t.y);
      ctx.strokeStyle = 'rgba(90,200,255,0.8)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, t.stats.radius + 16, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = 'rgba(90,200,255,0.10)';
      ctx.fill();
      ctx.restore();
    }

    if (t.hitFlash > 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.translate(t.x, t.y);
      ctx.rotate(t.angle);
      ctx.globalAlpha = t.hitFlash * 1.6;
      ctx.fillStyle = '#ff6a4a';
      ctx.beginPath();
      ctx.ellipse(0, 0, bw * 0.46, bh * 0.46, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // hp bar above other tanks
    if (!t.local) {
      const pct = clamp(t.hp / t.maxHp, 0, 1);
      const w = 54;
      ctx.save();
      ctx.translate(t.x, t.y - t.stats.radius - 26);
      ctx.fillStyle = 'rgba(0,0,0,0.65)';
      ctx.fillRect(-w / 2 - 1, -1, w + 2, 6);
      ctx.fillStyle = t.bot ? '#c26a5a' : '#8fe86b';
      ctx.fillRect(-w / 2, 0, w * pct, 4);
      ctx.restore();
    }
  }

  drawTags(ctx) {
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const t of this.tanks) {
      if (!t.alive) continue;
      const y = t.y - (t.stats.radius || 30) - 40;
      ctx.font = 'bold 12px "Courier New", monospace';
      ctx.fillStyle = t.local ? '#d8f0c0'
        : this.mode.teams ? (t.team === 0 ? '#a8e88a' : '#e68e78')
        : t.remote ? '#9ee0ff' : '#e2d7bf';
      ctx.globalAlpha = 0.95;
      const label = t.local ? t.name + ' (YOU)' : t.name;
      ctx.fillText(label, t.x, y);
      if (t.local) {
        ctx.beginPath();
        ctx.moveTo(t.x - 6, y - 16);
        ctx.lineTo(t.x + 6, y - 16);
        ctx.lineTo(t.x, y - 24);
        ctx.closePath();
        ctx.fillStyle = '#8fe86b';
        ctx.fill();
      }
      if (t.level) {
        ctx.font = '10px "Courier New", monospace';
        ctx.fillStyle = 'rgba(200,215,180,0.55)';
        ctx.fillText('LVL ' + t.level, t.x, y + 13);
      }
    }
    ctx.restore();
  }

  drawBullets(ctx) {
    for (const b of this.bullets) {
      const a = Math.atan2(b.vx, -b.vy);
      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.rotate(a);
      // tracer
      const grad = ctx.createLinearGradient(0, 0, 0, 26);
      grad.addColorStop(0, 'rgba(255,220,150,0.9)');
      grad.addColorStop(1, 'rgba(255,160,60,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(-1.6, -4, 3.2, 26);
      ctx.beginPath();
      ctx.arc(0, 0, b.r || 5, 0, Math.PI * 2);
      ctx.fillStyle = '#ffe6a8';
      ctx.fill();
      ctx.restore();
    }
  }

  drawParticles(ctx) {
    for (const p of this.particles) {
      const a = clamp(p.life / (p.maxLife || 0.4), 0, 1);
      ctx.globalAlpha = a;
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    ctx.globalAlpha = 1;
  }

  drawFx(ctx) {
    for (const f of this.fxList) {
      const im = img(f.sprite);
      if (!im) continue;
      const k = 1 - f.life / f.maxLife;
      const scale = (f.scale || 1) * (f.grow ? 0.6 + k * 1.1 : 1);
      ctx.save();
      ctx.globalAlpha = f.smoke ? (1 - k) * 0.55 : Math.max(0, 1 - k * 1.15);
      ctx.translate(f.x, f.y);
      ctx.rotate(f.a || 0);
      const w = im.width * scale, h = im.height * scale;
      ctx.drawImage(im, -w / 2, -h / 2, w, h);
      ctx.restore();
    }
  }

  drawFloaters(ctx) {
    ctx.save();
    ctx.textAlign = 'center';
    for (const f of this.floaters) {
      ctx.globalAlpha = clamp(f.life / 0.9, 0, 1);
      ctx.font = 'bold 16px "Courier New", monospace';
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillText(f.text, f.x + 1, f.y + 1);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x, f.y);
    }
    ctx.restore();
  }

  drawWorldEdge(ctx) {
    ctx.save();
    ctx.strokeStyle = 'rgba(90,160,70,0.5)';
    ctx.lineWidth = 3;
    ctx.strokeRect(2, 2, WORLD.size - 4, WORLD.size - 4);
    ctx.restore();
  }

  drawZone(ctx) {
    const z = this.zone;
    if (!z) return;
    const holder = this.zoneHolder;
    const col = holder === 0 ? '#8fe86b' : holder === 1 ? '#e0685a' : '#e8c96a';
    const pulse = 0.5 + Math.sin(this.t * 2.2) * 0.5;

    ctx.save();
    ctx.translate(z.x, z.y);

    const g = ctx.createRadialGradient(0, 0, z.r * 0.15, 0, 0, z.r);
    g.addColorStop(0, 'rgba(110, 170, 70, 0.07)');
    g.addColorStop(1, 'rgba(20, 40, 15, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, z.r, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = col;
    ctx.globalAlpha = 0.28 + pulse * 0.22;
    ctx.lineWidth = 3;
    ctx.setLineDash([18, 14]);
    ctx.lineDashOffset = -this.t * 30;
    ctx.beginPath();
    ctx.arc(0, 0, z.r, 0, Math.PI * 2);
    ctx.stroke();

    ctx.setLineDash([]);
    ctx.globalAlpha = 0.5 + pulse * 0.3;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, 0, z.r * 0.6, 0, Math.PI * 2);
    ctx.stroke();

    ctx.globalAlpha = 0.3;
    ctx.beginPath();
    ctx.moveTo(-20, 0); ctx.lineTo(20, 0);
    ctx.moveTo(0, -20); ctx.lineTo(0, 20);
    ctx.stroke();
    ctx.restore();
  }

  drawWeather(ctx) {
    const { vw, vh } = this;
    if (this.weather === 'rain') {
      ctx.save();
      ctx.strokeStyle = 'rgba(185, 210, 200, 0.20)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = 0; i < 150; i++) {
        const x = ((i * 137 + this.t * 420) % (vw + 240)) - 120;
        const y = ((i * 83 + this.t * 1100) % (vh + 120)) - 60;
        ctx.moveTo(x, y);
        ctx.lineTo(x - 5, y + 22);
      }
      ctx.stroke();
      ctx.fillStyle = 'rgba(18, 28, 24, 0.12)';
      ctx.fillRect(0, 0, vw, vh);
      ctx.restore();
      return;
    }
    if (this.weather === 'fog') {
      ctx.save();
      const band = (Math.sin(this.t * 0.12) + 1) * 0.5;
      const g = ctx.createLinearGradient(0, 0, 0, vh);
      g.addColorStop(0, 'rgba(175, 195, 175, 0.10)');
      g.addColorStop(0.35 + band * 0.15, 'rgba(195, 210, 195, 0.17)');
      g.addColorStop(1, 'rgba(150, 170, 150, 0.05)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, vw, vh);
      ctx.restore();
      return;
    }
    if (this.weather === 'dusk') {
      ctx.save();
      const g = ctx.createLinearGradient(0, 0, vw, vh);
      g.addColorStop(0, 'rgba(255, 150, 60, 0.10)');
      g.addColorStop(0.5, 'rgba(180, 90, 40, 0.05)');
      g.addColorStop(1, 'rgba(40, 20, 60, 0.18)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, vw, vh);
      ctx.restore();
    }
  }

  drawVignette(ctx) {
    const { vw, vh } = this;
    const g = ctx.createRadialGradient(vw / 2, vh / 2, Math.min(vw, vh) * 0.35, vw / 2, vh / 2, Math.max(vw, vh) * 0.75);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,0.62)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, vw, vh);

    // damage vignette
    if (this.me && this.me.alive) {
      const hurt = 1 - clamp(this.me.hp / this.me.maxHp, 0, 1);
      if (hurt > 0.55) {
        ctx.fillStyle = `rgba(150,20,10,${(hurt - 0.55) * 0.5})`;
        ctx.fillRect(0, 0, vw, vh);
      }
    }
  }

  drawDeathOverlay(ctx) {
    const { vw, vh } = this;
    ctx.fillStyle = 'rgba(60,10,6,0.24)';
    ctx.fillRect(0, 0, vw, vh);
  }

  drawMinimap() {
    if (!this.mctx) return;
    const c = this.mctx, S = this.minimap.width, dpr = this.dpr;
    const scale = S / WORLD.size;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, S, S);
    c.fillStyle = 'rgba(8,14,10,0.82)';
    c.fillRect(0, 0, S, S);
    c.strokeStyle = 'rgba(120,200,90,0.35)';
    c.lineWidth = 1 * dpr;
    c.strokeRect(0.5, 0.5, S - 1, S - 1);

    c.fillStyle = 'rgba(120,160,100,0.28)';
    for (const o of this.obstacles) {
      c.fillRect(o.x * scale - 1.5 * dpr, o.y * scale - 1.5 * dpr, 3 * dpr, 3 * dpr);
    }
    for (const p of this.powerups) {
      c.fillStyle = POWERUPS[p.kind].color;
      c.beginPath();
      c.arc(p.x * scale, p.y * scale, 2.4 * dpr, 0, Math.PI * 2);
      c.fill();
    }
    for (const t of this.tanks) {
      if (!t.alive) continue;
      c.fillStyle = t.local ? '#e8f5d8' : t.remote ? '#7fd4ff' : (t.bot ? '#d98c7a' : '#9fbf8f');
      const r = t.local ? 3.4 * dpr : 2.4 * dpr;
      c.beginPath();
      c.arc(t.x * scale, t.y * scale, r, 0, Math.PI * 2);
      c.fill();
      if (t.local) {
        c.strokeStyle = '#8fe86b';
        c.lineWidth = 1.4 * dpr;
        c.beginPath();
        c.arc(t.x * scale, t.y * scale, 6 * dpr, 0, Math.PI * 2);
        c.stroke();
      }
    }
  }

  leave() {
    if (this._leaving) return;
    this._leaving = true;
    const data = this.report();
    this.stop();
    this.onReport?.(data);
  }
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
