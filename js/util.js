// Small shared helpers. No dependencies.

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const rand = (a = 1, b = 0) => b + Math.random() * (a - b);
export const randInt = (a, b) => Math.floor(b + Math.random() * (a - b + 1));
export const pick = (arr) => arr[(Math.random() * arr.length) | 0];
export const dist2 = (ax, ay, bx, by) => {
  const dx = ax - bx, dy = ay - by;
  return dx * dx + dy * dy;
};
export const dist = (ax, ay, bx, by) => Math.sqrt(dist2(ax, ay, bx, by));

export function angleDiff(a, b) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}
export function angleLerp(a, b, t) {
  return a + angleDiff(a, b) * t;
}
export function approach(cur, target, delta) {
  if (cur < target) return Math.min(cur + delta, target);
  return Math.max(cur - delta, target);
}

export const fmt = (n) => Math.round(n).toLocaleString('en-US');
export const nf = new Intl.NumberFormat('en-US');

export function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );
}

export function el(tag, className, html) {
  const n = document.createElement(tag);
  if (className) n.className = className;
  if (html != null) n.innerHTML = html;
  return n;
}

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

export const uuid = () =>
  (crypto.randomUUID ? crypto.randomUUID() :
    'id-' + Math.random().toString(36).slice(2) + Date.now().toString(36));

// Deterministic PRNG (mulberry32) — keeps arena layout stable per seed.
export function makeRng(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const storage = {
  get(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch { return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* quota */ }
  },
  del(key) { try { localStorage.removeItem(key); } catch { /* ignore */ } },
};

// tiny event bus for cross-module UI signals
export const bus = {
  map: new Map(),
  on(evt, fn) {
    if (!this.map.has(evt)) this.map.set(evt, new Set());
    this.map.get(evt).add(fn);
    return () => this.off(evt, fn);
  },
  off(evt, fn) { this.map.get(evt)?.delete(fn); },
  emit(evt, data) { this.map.get(evt)?.forEach((fn) => fn(data)); },
};
