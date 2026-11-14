// ------------------------------------------------------------------
//  Touch controls — a left drive stick, right fire/dash buttons and a
//  tap-to-aim reticle with optional aim assist. Only mounted on coarse
//  pointers; the desktop input path is untouched.
// ------------------------------------------------------------------

import { clamp } from './util.js';
import { audio } from './audio.js';

export function isTouchDevice() {
  if (new URLSearchParams(location.search).has('touch')) return true;
  return !!(
    window.matchMedia?.('(pointer: coarse)').matches ||
    window.matchMedia?.('(any-pointer: coarse)').matches ||
    'ontouchstart' in window
  );
}

export function initTouch(arena) {
  const ui = document.getElementById('touch-ui');
  if (!ui || !arena?.input) return { destroy() {} };
  document.body.classList.add('touch-mode');
  ui.classList.remove('hidden');

  const abilityBtns = [...ui.querySelectorAll('[data-touch-ability]')];
  const abilityHandlers = abilityBtns.map((btn) => {
    const fn = (e) => { e.preventDefault(); arena.useAbility?.(btn.dataset.touchAbility); };
    btn.addEventListener('pointerdown', fn);
    return [btn, fn];
  });

  const stick = document.getElementById('touch-stick');
  const knob = document.getElementById('touch-stick-knob');
  const fire = document.getElementById('touch-fire');
  const dash = document.getElementById('touch-dash');
  const canvas = arena.canvas;
  const input = arena.input;
  input.touch = { x: 0, y: 0 };

  let stickId = null;
  let fireId = null;
  let cx = 0, cy = 0;

  const setStick = (dx, dy) => {
    const len = Math.hypot(dx, dy);
    const max = 52;
    const k = len > max ? max / len : 1;
    const ox = dx * k, oy = dy * k;
    input.touch.x = ox / max;
    input.touch.y = oy / max;
    if (knob) knob.style.transform = `translate(${ox.toFixed(1)}px, ${oy.toFixed(1)}px)`;
  };

  const stickDown = (e) => {
    if (stickId !== null) return;
    e.preventDefault();
    e.stopPropagation();
    stickId = e.pointerId;
    const r = stick.getBoundingClientRect();
    cx = r.left + r.width / 2;
    cy = r.top + r.height / 2;
    stick.setPointerCapture?.(e.pointerId);
    setStick(e.clientX - cx, e.clientY - cy);
  };
  const stickMove = (e) => {
    if (e.pointerId !== stickId) return;
    e.preventDefault();
    setStick(e.clientX - cx, e.clientY - cy);
  };
  const stickUp = (e) => {
    if (e.pointerId !== stickId) return;
    stickId = null;
    input.touch.x = 0; input.touch.y = 0;
    if (knob) knob.style.transform = 'translate(0px, 0px)';
  };

  const fireDown = (e) => {
    e.preventDefault();
    e.stopPropagation();
    fireId = e.pointerId;
    fire?.setPointerCapture?.(e.pointerId);
    fire?.classList.add('on');
    input.firing = true;
    audio.unlock();
  };
  const fireUp = (e) => {
    if (e.pointerId !== fireId) return;
    fireId = null;
    fire?.classList.remove('on');
    input.firing = false;
  };

  const dashDown = (e) => {
    e.preventDefault();
    e.stopPropagation();
    dash?.classList.add('on');
    audio.unlock();
    arena.tryDash?.();
  };
  const dashUp = (e) => {
    e.preventDefault();
    dash?.classList.remove('on');
  };

  // Tap or drag the right side of the arena to aim the turret.
  let aimId = null;
  const aimAt = (e) => {
    const r = canvas.getBoundingClientRect();
    input.mx = e.clientX - r.left;
    input.my = e.clientY - r.top;
    input.touchAim = true;
    audio.unlock();
  };
  const canvasDown = (e) => {
    if (e.pointerType === 'mouse') return;
    if (e.clientX < window.innerWidth * 0.34) return; // leave the stick alone
    e.preventDefault();
    aimId = e.pointerId;
    canvas.setPointerCapture?.(e.pointerId);
    aimAt(e);
  };
  const canvasMove = (e) => {
    if (e.pointerType === 'mouse' || aimId === null) return;
    if (e.pointerId !== aimId) return;
    e.preventDefault();
    aimAt(e);
  };
  const canvasUp = (e) => {
    if (e.pointerId === aimId) aimId = null;
  };

  const stopScroll = (e) => e.preventDefault();

  stick?.addEventListener('pointerdown', stickDown);
  stick?.addEventListener('pointermove', stickMove);
  stick?.addEventListener('pointerup', stickUp);
  stick?.addEventListener('pointercancel', stickUp);
  stick?.addEventListener('touchstart', stopScroll, { passive: false });

  fire?.addEventListener('pointerdown', fireDown);
  fire?.addEventListener('pointerup', fireUp);
  fire?.addEventListener('pointercancel', fireUp);
  fire?.addEventListener('pointerleave', fireUp);

  dash?.addEventListener('pointerdown', dashDown);
  dash?.addEventListener('pointerup', dashUp);
  dash?.addEventListener('pointercancel', dashUp);

  canvas?.addEventListener('pointerdown', canvasDown);
  canvas?.addEventListener('pointermove', canvasMove);
  canvas?.addEventListener('pointerup', canvasUp);
  canvas?.addEventListener('pointercancel', canvasUp);

  return {
    destroy() {
      document.body.classList.remove('touch-mode');
      ui.classList.add('hidden');
      for (const [btn, fn] of abilityHandlers) btn.removeEventListener('pointerdown', fn);
      stick?.removeEventListener('pointerdown', stickDown);
      stick?.removeEventListener('pointermove', stickMove);
      stick?.removeEventListener('pointerup', stickUp);
      stick?.removeEventListener('pointercancel', stickUp);
      fire?.removeEventListener('pointerdown', fireDown);
      fire?.removeEventListener('pointerup', fireUp);
      fire?.removeEventListener('pointercancel', fireUp);
      fire?.removeEventListener('pointerleave', fireUp);
      dash?.removeEventListener('pointerdown', dashDown);
      dash?.removeEventListener('pointerup', dashUp);
      dash?.removeEventListener('pointercancel', dashUp);
      canvas?.removeEventListener('pointerdown', canvasDown);
      canvas?.removeEventListener('pointermove', canvasMove);
      canvas?.removeEventListener('pointerup', canvasUp);
      canvas?.removeEventListener('pointercancel', canvasUp);
      input.firing = false;
      input.touch = { x: 0, y: 0 };
    },
  };
}
