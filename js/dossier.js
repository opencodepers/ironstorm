// ------------------------------------------------------------------
//  IronStorm — shareable commander dossier
//  The dossier is encoded into the URL fragment so it works on static
//  hosting, for guests, and without exposing account identifiers.
// ------------------------------------------------------------------

import { TANKS } from './tanks.js';
import { MEDALS } from './medals.js';
import { careerTotals } from './progress.js';
import { lifetimePoints, tierFor, tierGlyph, weekPoints } from './season.js';
import { fmt, esc } from './util.js';

const enc = (obj) => {
  const bytes = new TextEncoder().encode(JSON.stringify(obj));
  let raw = '';
  for (const b of bytes) raw += String.fromCharCode(b);
  return btoa(raw).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

const dec = (code) => {
  try {
    const raw = atob(code.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(new TextDecoder().decode(Uint8Array.from(raw, (c) => c.charCodeAt(0))));
  } catch { return null; }
};

export function buildDossier(profile, local) {
  if (!profile) return null;
  const totals = careerTotals(local);
  const tier = tierFor(lifetimePoints(profile));
  const medals = Object.keys(local?.medals || {})
    .map((id) => MEDALS.find((m) => m.id === id))
    .filter(Boolean)
    .sort((a, b) => b.salvage - a.salvage)
    .slice(0, 5)
    .map((m) => m.name);
  const favorite = Object.entries(local?.tankStats || {})
    .sort((a, b) => (b[1].matches | 0) - (a[1].matches | 0))[0]?.[0] || profile.tank || 'sherman';
  return {
    n: profile.username || 'COMMANDER',
    lv: profile.level | 0,
    cr: profile.credits | 0,
    k: profile.kills | 0,
    d: profile.deaths | 0,
    m: profile.matches | 0,
    w: profile.wins | 0,
    bs: profile.bestScore | 0,
    sp: weekPoints(local?.weekly || {}),
    tp: lifetimePoints(profile),
    tier: tier.id,
    tn: tier.name,
    ac: totals.accuracy | 0,
    st: totals.bestStreak | 0,
    sv: local?.salvage | 0,
    fav: TANKS[favorite]?.name || 'M4 SHERMAN',
    md: medals,
    op: (local?.operations?.badges || []).length,
    at: Date.now(),
  };
}

export function dossierUrl(d) {
  if (!d) return '';
  const url = new URL('dossier.html', location.href);
  url.hash = `d=${enc(d)}`;
  return url.toString();
}

export function dossierFromHash(hash = location.hash) {
  const raw = String(hash || '').replace(/^#/, '');
  if (!raw.startsWith('d=')) return null;
  return dec(raw.slice(2));
}

export function encodeDossier(d) {
  return enc(d);
}

export function dossierInitials(name) {
  return String(name || 'IS').replace(/[^A-Z0-9]/gi, '').slice(0, 2).toUpperCase() || 'IS';
}

function medalMarkup(d) {
  if (!d.md?.length) return '<span class="ds-empty">NO MEDALS ON FILE YET</span>';
  return d.md.map((m, i) => `<span class="ds-medal"><i>0${i + 1}</i>${esc(m)}</span>`).join('');
}

export function dossierMarkup(d, { compact = false } = {}) {
  if (!d) return '';
  const tier = { bronze: '#b07a4e', silver: '#b9c6cc', gold: '#e8c96a', platinum: '#7fd8d0', diamond: '#8fb6ff' }[d.tier] || '#8fe86b';
  const kd = d.d ? (d.k / d.d).toFixed(2) : (d.k || 0).toFixed(2);
  const wr = d.m ? Math.round((d.w / d.m) * 100) : 0;
  return `<div class="dossier-sheet ${compact ? 'compact' : ''}" style="--dossier:${tier}">
    <div class="ds-grid"></div>
    <div class="ds-scan"></div>
    <header class="ds-head">
      <div class="ds-brand"><span>IRON</span>STORM <i>COMMANDER DOSSIER</i></div>
      <div class="ds-tier">${tierGlyph(d.tier)} ${esc(d.tn || 'BRONZE')}</div>
    </header>
    <section class="ds-id">
      <div class="ds-sigil">${esc(dossierInitials(d.n))}</div>
      <div class="ds-name">
        <span>FIELD IDENTITY</span>
        <h1>${esc(d.n)}</h1>
        <p>LEVEL ${d.lv} · ${fmt(d.tp)} CAREER POINTS · OPERATION BADGES ${d.op}</p>
      </div>
      <div class="ds-verified"><i></i> VERIFIED<br><b>IRON CORPS</b></div>
    </section>
    <section class="ds-stats">
      <div><b>${fmt(d.k)}</b><span>KILLS</span></div>
      <div><b>${kd}</b><span>K / D</span></div>
      <div><b>${fmt(d.m)}</b><span>BATTLES</span></div>
      <div><b>${wr}%</b><span>WIN RATE</span></div>
      <div><b>${d.ac}%</b><span>ACCURACY</span></div>
      <div><b>${d.st}</b><span>BEST STREAK</span></div>
    </section>
    <section class="ds-lower">
      <div class="ds-block">
        <span class="ds-kicker">PREFERRED PLATFORM</span>
        <b class="ds-tank">${esc(d.fav)}</b>
        <span class="ds-kicker">SEASON POINTS</span>
        <b class="ds-season">${fmt(d.sp)}</b>
      </div>
      <div class="ds-block ds-medals">
        <span class="ds-kicker">CITATION RIBBONS</span>
        ${medalMarkup(d)}
      </div>
      <div class="ds-block ds-salvage">
        <span class="ds-kicker">SALVAGE RESERVE</span>
        <b>${fmt(d.sv)}</b>
        <span>RECOVERED FROM THE FIELD</span>
      </div>
    </section>
    <footer class="ds-foot">
      <span>IRONSTORM · OPERATION IRONSTORM</span>
      <span>DOSSIER ${String(d.n).slice(0, 4).toUpperCase()}-${String(d.tp).padStart(6, '0')}</span>
    </footer>
  </div>`;
}

export async function copyDossierLink(d) {
  const link = dossierUrl(d);
  try {
    await navigator.clipboard.writeText(link);
    return { ok: true, link, method: 'clipboard' };
  } catch { return { ok: false, link, method: 'manual' }; }
}

export async function shareDossier(d) {
  const link = dossierUrl(d);
  if (navigator.share) {
    try {
      await navigator.share({ title: `${d.n} — IronStorm Dossier`, text: 'Commander dossier from IronStorm.', url: link });
      return { ok: true, link, method: 'share' };
    } catch (e) {
      if (e?.name === 'AbortError') return { ok: false, link, method: 'cancelled' };
    }
  }
  return copyDossierLink(d);
}

export function openDossierModal(d) {
  const root = document.querySelector('#modal-root');
  if (!root || !d) return;
  root.innerHTML = `<div class="modal-backdrop"></div>
    <div class="dossier-modal">
      <header class="dossier-modal-head">
        <div><span>COMMAND ARCHIVE</span><h2>COMMANDER DOSSIER</h2></div>
        <div class="dossier-head-actions">
          <button class="overlay-back" data-dossier-close type="button">← BACK</button>
          <button class="icon-btn" data-dossier-close aria-label="Close">✕</button>
        </div>
      </header>
      ${dossierMarkup(d)}
      <div class="dossier-actions">
        <button class="btn" id="dossier-share">SHARE DOSSIER</button>
        <button class="btn btn-ghost" id="dossier-copy">COPY LINK</button>
      </div>
    </div>`;
  const close = () => { root.innerHTML = ''; };
  root.querySelectorAll('[data-dossier-close]').forEach((b) => b.addEventListener('click', close));
  root.querySelector('.modal-backdrop')?.addEventListener('click', close);
  root.querySelector('#dossier-share')?.addEventListener('click', async (e) => {
    const res = await shareDossier(d);
    e.currentTarget.textContent = res.ok ? (res.method === 'share' ? 'SHARED' : 'LINK COPIED') : 'COPY FROM ADDRESS BAR';
    if (res.ok) setTimeout(() => { if (e.currentTarget.isConnected) e.currentTarget.textContent = 'SHARE DOSSIER'; }, 1800);
  });
  root.querySelector('#dossier-copy')?.addEventListener('click', async (e) => {
    const res = await copyDossierLink(d);
    e.currentTarget.textContent = res.ok ? 'COPIED' : 'COPY FAILED';
    if (!res.ok) window.prompt('Copy this dossier link:', res.link);
  });
}

// Used by dossier.html
export function renderDossierPage(root, hash = location.hash) {
  const d = dossierFromHash(hash);
  if (!d) {
    root.innerHTML = `<div class="dossier-missing"><h1>DOSSIER NOT FOUND</h1><p>This link is incomplete or has expired.</p><a href="./">RETURN TO BASE</a></div>`;
    return;
  }
  document.title = `${d.n} — IronStorm Dossier`;
  root.innerHTML = `<main class="dossier-page-wrap">${dossierMarkup(d)}
    <div class="dossier-page-actions">
      <a class="btn" href="./">DEPLOY TO IRONSTORM</a>
      <button class="btn btn-ghost" id="page-copy">COPY LINK</button>
    </div>
    <p class="dossier-page-note">This dossier is a snapshot shared by the commander. Stats may have changed since it was generated.</p>
  </main>`;
  root.querySelector('#page-copy')?.addEventListener('click', async (e) => {
    const res = await copyDossierLink(d);
    e.currentTarget.textContent = res.ok ? 'COPIED' : 'COPY FAILED';
  });
}
