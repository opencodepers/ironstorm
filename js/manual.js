// ------------------------------------------------------------------
//  IronStorm — first-run field manual
//  A three-panel cinematic control brief that hands directly into the
//  existing Academy rather than duplicating the tutorial.
// ------------------------------------------------------------------

import { storage } from './util.js';
import { audio } from './audio.js';

const KEY = 'ironstorm.manual.v1';
const STEPS = [
  {
    tag: '01 / MOBILITY', title: 'DRIVE THE HULL',
    sub: 'The tracks carry your speed into every corner. Point the hull where you want the armour to face.',
    keys: [['W', 'FORWARD'], ['S', 'REVERSE'], ['A D', 'TURN']],
    note: 'Your turret turns independently. The hull is the shield; the gun is the answer.',
  },
  {
    tag: '02 / FIREPOWER', title: 'TRAVERSE. FIRE. RELOAD.',
    sub: 'Mouse aims, left click fires. Watch the reload bar under the crosshair and make the first shell count.',
    keys: [['MOUSE', 'AIM'], ['LMB', 'FIRE'], ['ENTER', 'CHAT']],
    note: 'Hull down behind cover. A reloading tank is a target, not a threat.',
  },
  {
    tag: '03 / SURVIVAL', title: 'DASH INTO THE OBJECTIVE',
    sub: 'Shift burns a short emergency dash. Use it to break contact, cross open ground, or steal the hill.',
    keys: [['SHIFT', 'DASH'], ['1 2 3', 'COMMAND'], ['ESC', 'PAUSE']],
    note: 'Command points call supply, smoke and artillery. The objective wins battles, not kills.',
  },
];

export function manualSeen() {
  return !!storage.get(KEY, false);
}

export function markManual() {
  storage.set(KEY, true);
}

export function openManual({ onAcademy, onSkip } = {}) {
  const root = document.querySelector('#modal-root');
  if (!root) return;
  let step = 0;
  const render = () => {
    const s = STEPS[step];
    const last = step === STEPS.length - 1;
    root.innerHTML = `<div class="modal-backdrop"></div>
      <div class="manual-modal">
        <div class="manual-bars"><i></i><i></i></div>
        <header class="manual-head">
          <div class="manual-brand">IRON<span>STORM</span> <i>FIELD MANUAL</i></div>
          <button class="overlay-back" id="manual-skip" type="button">SKIP BRIEFING</button>
        </header>
        <div class="manual-stage">
          <div class="manual-visual">
            <div class="manual-reticle"><i></i><i></i><b></b></div>
            <span class="manual-coord">SECTOR 7 // LIVE FIRE</span>
            <span class="manual-number">0${step + 1}</span>
          </div>
          <div class="manual-copy">
            <span class="manual-tag">${s.tag}</span>
            <h2>${s.title}</h2>
            <p>${s.sub}</p>
            <div class="manual-keys">${s.keys.map(([k, label]) =>
              `<div><kbd>${k}</kbd><span>${label}</span></div>`).join('')}</div>
            <p class="manual-note">${s.note}</p>
          </div>
        </div>
        <footer class="manual-foot">
          <div class="manual-dots">${STEPS.map((_, i) => `<i class="${i === step ? 'on' : ''}"></i>`).join('')}</div>
          <div class="manual-actions">
            ${step > 0 ? '<button class="btn btn-ghost" id="manual-prev">← PREVIOUS</button>' : ''}
            <button class="btn" id="manual-next">${last ? 'BEGIN ACADEMY' : 'NEXT BRIEF →'}</button>
          </div>
        </footer>
      </div>`;
    root.querySelector('#manual-skip')?.addEventListener('click', () => {
      markManual(); audio.play('uiBack'); root.innerHTML = ''; onSkip?.();
    });
    root.querySelector('#manual-prev')?.addEventListener('click', () => { step = Math.max(0, step - 1); render(); });
    root.querySelector('#manual-next')?.addEventListener('click', () => {
      if (step < STEPS.length - 1) { step += 1; render(); return; }
      markManual(); audio.play('ui');
      root.innerHTML = '';
      if (onAcademy) onAcademy();
      else document.dispatchEvent(new CustomEvent('ironstorm:training', { detail: { kind: 'academy' } }));
    });
    root.querySelector('.modal-backdrop')?.addEventListener('click', () => {
      markManual(); root.innerHTML = '';
    });
  };
  render();
}

export function openManualReminder() {
  const root = document.querySelector('#modal-root');
  if (!root) return;
  openManual({
    onAcademy: () => document.dispatchEvent(new CustomEvent('ironstorm:training', { detail: { kind: 'academy' } })),
  });
}
