// ------------------------------------------------------------------
//  IronStorm — installable app support
// ------------------------------------------------------------------

import { storage } from './util.js';
import { audio } from './audio.js';

let deferred = null;
let installed = false;
const DISMISS = 'ironstorm.install.dismissed.v1';

export function initInstall() {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e;
    document.dispatchEvent(new CustomEvent('ironstorm:install-ready'));
  });
  window.addEventListener('appinstalled', () => {
    installed = true;
    deferred = null;
    document.dispatchEvent(new CustomEvent('ironstorm:installed'));
  });
  if (window.matchMedia?.('(display-mode: standalone)').matches) installed = true;
  return { installed, canInstall: !!deferred };
}

export function isStandalone() {
  return installed || window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone === true;
}

export function canInstall() {
  return !!deferred && !isStandalone();
}

export function canOfferInstall() {
  return !isStandalone() && !storage.get(DISMISS, false);
}

export function dismissInstall() {
  storage.set(DISMISS, true);
  document.querySelector('.install-banner')?.remove();
}

function instructionsModal() {
  const root = document.querySelector('#modal-root');
  if (!root) return;
  const ua = navigator.userAgent || '';
  const ios = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  root.innerHTML = `<div class="modal-backdrop"></div>
    <div class="manual-modal install-modal">
      <header class="manual-head">
        <div class="manual-brand">IRON<span>STORM</span> <i>INSTALL</i></div>
        <button class="overlay-back" data-install-close type="button">← BACK</button>
      </header>
      <div class="install-copy">
        <span class="manual-tag">FIELD DEPLOYMENT</span>
        <h2>TAKE IRONSTORM WITH YOU</h2>
        <p>Install the game for a full-screen, landscape arena with an app icon and offline shell.</p>
        <div class="install-steps">
          <div><b>01</b><span>${ios ? 'Tap the Share button in Safari.' : 'Open the browser menu.'}</span></div>
          <div><b>02</b><span>${ios ? 'Choose “Add to Home Screen”.' : 'Choose “Install app” or “Add to Home Screen”.'}</span></div>
          <div><b>03</b><span>Launch IronStorm from your home screen and deploy.</span></div>
        </div>
        ${canInstall() ? '<button class="btn" id="install-native">INSTALL NOW</button>' : ''}
      </div>
    </div>`;
  root.querySelectorAll('[data-install-close]').forEach((b) => b.addEventListener('click', () => { root.innerHTML = ''; }));
  root.querySelector('.modal-backdrop')?.addEventListener('click', () => { root.innerHTML = ''; });
  root.querySelector('#install-native')?.addEventListener('click', () => promptInstall());
}

export async function promptInstall() {
  audio.play('ui');
  if (!deferred) { instructionsModal(); return { ok: false, reason: 'manual' }; }
  const e = deferred;
  deferred = null;
  try {
    await e.prompt();
    const choice = await e.userChoice;
    if (choice?.outcome === 'accepted') {
      installed = true;
      document.dispatchEvent(new CustomEvent('ironstorm:installed'));
      return { ok: true };
    }
  } catch { /* fall through */ }
  return { ok: false };
}

export function wireInstallButtons(root = document) {
  root.querySelectorAll('[data-install]').forEach((btn) => {
    if (btn.dataset.installWired) return;
    btn.dataset.installWired = '1';
    btn.addEventListener('click', () => promptInstall());
  });
  root.querySelectorAll('[data-install-help]').forEach((btn) => {
    if (btn.dataset.installWired) return;
    btn.dataset.installWired = '1';
    btn.addEventListener('click', instructionsModal);
  });
}

export function maybeOfferInstall(matches = 0) {
  if (matches < 2 || !canOfferInstall() || document.querySelector('.install-banner')) return false;
  const el = document.createElement('div');
  el.className = 'install-banner';
  el.innerHTML = `<div class="ib-mark">IS</div>
    <div class="ib-copy"><b>DEPLOY FROM YOUR HOME SCREEN</b><span>Full-screen arena · offline shell · no download</span></div>
    <button class="ib-install" ${canInstall() ? '' : 'data-install-help'}>INSTALL</button>
    <button class="ib-x" aria-label="Not now">✕</button>`;
  document.body.appendChild(el);
  el.querySelector('.ib-install')?.addEventListener('click', () => { canInstall() ? promptInstall() : instructionsModal(); });
  el.querySelector('.ib-x')?.addEventListener('click', () => { dismissInstall(); });
  requestAnimationFrame(() => el.classList.add('on'));
  setTimeout(() => {
    if (!el.isConnected) return;
    el.classList.remove('on');
    setTimeout(() => el.remove(), 300);
  }, 9000);
  return true;
}
