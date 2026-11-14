// ------------------------------------------------------------------
//  Gamepad input — polled once per arena frame. Xbox-style mapping:
//  left stick drives, right stick aims, RT fires, A dashes, X/Y/B call
//  abilities and Start pauses. Rumble is best-effort.
// ------------------------------------------------------------------

const DEAD = 0.18;
const pressed = (pad, i) => !!pad.buttons?.[i]?.pressed;
const axis = (pad, i) => pad.axes?.[i] || 0;

export function readGamepad() {
  const pads = navigator.getGamepads?.() || [];
  const pad = [...pads].find((p) => p && p.connected);
  if (!pad) return { connected: false };

  let x = axis(pad, 0);
  let y = axis(pad, 1);
  if (Math.hypot(x, y) < DEAD) { x = 0; y = 0; }
  let aimX = axis(pad, 2);
  let aimY = axis(pad, 3);
  if (Math.hypot(aimX, aimY) < DEAD) { aimX = 0; aimY = 0; }

  return {
    connected: true,
    x, y, aimX, aimY,
    fire: pressed(pad, 7) || pressed(pad, 5) || pad.buttons?.[7]?.value > 0.4,
    dash: pressed(pad, 0),
    supply: pressed(pad, 2),
    smoke: pressed(pad, 3),
    artillery: pressed(pad, 1),
    start: pressed(pad, 9),
    id: pad.id,
  };
}

export function rumble(ms = 70, strong = 0.55) {
  try {
    const pads = navigator.getGamepads?.() || [];
    const pad = [...pads].find((p) => p && p.connected);
    pad?.vibrationActuator?.playEffect?.('dual-rumble', {
      duration: ms,
      strongMagnitude: strong,
      weakMagnitude: strong * 0.5,
    });
  } catch { /* unsupported */ }
}
