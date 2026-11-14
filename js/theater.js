// ------------------------------------------------------------------
//  Replay theater — the last full battle is sampled into compact
//  frames and played back with a pannable, zoomable camera. Frames
//  live in sessionStorage when they fit, so a refresh keeps the replay.
// ------------------------------------------------------------------

import { esc } from './util.js';

const KEY = 'ironstorm.theater.v1';
let memory = null;
let raf = 0;

export function saveReplay(replay) {
  if (!replay?.frames?.length) return;
  memory = replay;
  try { sessionStorage.setItem(KEY, JSON.stringify(replay)); } catch { /* too large */ }
}

export function lastReplay() {
  if (memory) return memory;
  try {
    const raw = sessionStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export function clearReplay() {
  memory = null;
  try { sessionStorage.removeItem(KEY); } catch { /* ignore */ }
}

const lerp = (a, b, t) => a + (b - a) * t;

function frameAt(frames, time) {
  let lo = 0, hi = frames.length - 1;
  if (time <= frames[0].t) return { a: frames[0], b: frames[0], k: 0 };
  if (time >= frames[hi].t) return { a: frames[hi], b: frames[hi], k: 0 };
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (frames[mid].t < time) lo = mid + 1; else hi = mid - 1;
  }
  const a = frames[Math.max(0, hi)], b = frames[Math.min(frames.length - 1, lo)];
  return { a, b, k: (time - a.t) / Math.max(0.001, b.t - a.t) };
}

export function openTheater(replay = lastReplay()) {
  const root = document.querySelector('#modal-root');
  if (!root) return;
  if (!replay?.frames?.length) {
    root.innerHTML = `<div class="modal-backdrop"></div><div class="report theater-empty">
      <h2>NO REPLAY YET</h2><p>Finish a battle and the theater will keep the last one for this session.</p>
      <button class="btn" data-theater-close>CLOSE</button></div>`;
    root.querySelector('[data-theater-close]')?.addEventListener('click', () => { root.innerHTML = ''; });
    return;
  }

  const frames = replay.frames;
  const first = frames[0].t;
  const duration = Math.max(0.1, frames[frames.length - 1].t - first);
  root.innerHTML = `
    <div class="modal-backdrop"></div>
    <div class="theater-modal">
      <header class="theater-head">
        <div><h2>REPLAY THEATER</h2><p>${esc(replay.map || 'LAST BATTLE')} · ${duration.toFixed(0)}s · DRAG TO PAN · WHEEL TO ZOOM</p></div>
        <button class="icon-btn" data-theater-close aria-label="Close">✕</button>
      </header>
      <canvas id="theater-canvas"></canvas>
      <div class="theater-controls">
        <button class="rc-btn" id="theater-play">PAUSE</button>
        <input type="range" id="theater-scrub" min="0" max="1000" value="0" aria-label="Replay position">
        <span class="theater-time" id="theater-time">0:00 / ${Math.floor(duration / 60)}:${String(Math.floor(duration % 60)).padStart(2, '0')}</span>
        <button class="rc-btn" id="theater-speed">1×</button>
        <button class="rc-btn" id="theater-export">EXPORT CLIP</button>
      </div>
      <div class="theater-clip hidden" id="theater-clip">
        <video id="theater-clip-video" controls playsinline></video>
        <div class="theater-clip-copy">
          <b>CLIP READY</b>
          <span>A short highlight from the end of the battle.</span>
          <a id="theater-clip-download" class="rc-btn" download="ironstorm-clip.webm">SAVE CLIP</a>
          <i>If the download is blocked by an embedded player, use the video controls or right-click to save.</i>
        </div>
      </div>
    </div>`;

  const canvas = root.querySelector('#theater-canvas');
  const ctx = canvas.getContext('2d');
  const scrub = root.querySelector('#theater-scrub');
  const timeEl = root.querySelector('#theater-time');
  const playBtn = root.querySelector('#theater-play');
  const speedBtn = root.querySelector('#theater-speed');
  let playing = true;
  let speed = 1;
  let recorder = null;
  let chunks = [];
  let clipStopAt = Infinity;
  let clipUrl = '';
  let closed = false;
  let time = first;
  let last = 0;
  let cam = { ...(replay.focus || { x: 1300, y: 1300 }) };
  let zoom = 0.55;
  let drag = null;
  const keys = new Set();

  const sizeCanvas = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = canvas.clientWidth || 900;
    const h = Math.max(320, Math.min(window.innerHeight * 0.62, 620));
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    canvas.style.height = h + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    canvas._w = w; canvas._h = h;
  };
  sizeCanvas();

  const draw = () => {
    const w = canvas._w, h = canvas._h;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = replay.ground || '#1b2417';
    ctx.fillRect(0, 0, w, h);
    ctx.save();
    ctx.translate(w / 2, h / 2);
    ctx.scale(zoom, zoom);
    ctx.translate(-cam.x, -cam.y);

    const world = replay.size || 2600;
    ctx.fillStyle = 'rgba(110,150,90,.10)';
    ctx.fillRect(0, 0, world, world);
    ctx.strokeStyle = 'rgba(150,220,120,.25)';
    ctx.lineWidth = 4;
    ctx.strokeRect(0, 0, world, world);

    for (const o of replay.obstacles || []) {
      ctx.save();
      ctx.translate(o.x, o.y);
      ctx.fillStyle = o.type?.includes('barrel') ? '#7a5a3a' : o.type?.includes('tree') ? '#33502c' : '#5a6248';
      ctx.fillRect(-o.w / 2, -o.h / 2, o.w, o.h);
      ctx.restore();
    }

    const { a, b, k } = frameAt(frames, time);
    const tanks = a.tanks.map((ta, i) => {
      const tb = b.tanks[i] || ta;
      return {
        ...ta,
        x: lerp(ta.x, tb.x, k), y: lerp(ta.y, tb.y, k),
        a: lerp(ta.a, tb.a, k), tu: lerp(ta.tu, tb.tu, k),
      };
    });
    for (const t of tanks) {
      if (!t.alive) continue;
      const r = t.radius || 30;
      ctx.save();
      ctx.translate(t.x, t.y);
      ctx.rotate(t.a);
      ctx.fillStyle = t.local ? '#e8f5d8' : t.bot ? '#c46a5a' : '#6fc4d8';
      ctx.fillRect(-r * 0.8, -r * 1.1, r * 1.6, r * 2.2);
      ctx.fillStyle = 'rgba(10,16,10,.6)';
      ctx.fillRect(-r * 0.5, -r * 0.4, r, r * 0.8);
      ctx.rotate(t.tu - t.a);
      ctx.fillStyle = '#c9d6bd';
      ctx.fillRect(-2, -r * 2.1, 4, r * 1.6);
      ctx.restore();
      if (t.local) {
        ctx.strokeStyle = '#8fe86b';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(t.x, t.y, r * 1.6, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    ctx.restore();

    ctx.fillStyle = 'rgba(8,14,8,.7)';
    ctx.fillRect(12, 12, 152, 30);
    ctx.fillStyle = '#c9d6bd';
    ctx.font = '600 12px monospace';
    ctx.fillText(`REPLAY ${time.toFixed(1)}s`, 24, 32);
  };

  const tick = (now) => {
    raf = requestAnimationFrame(tick);
    const dt = Math.min(0.05, (now - (last || now)) / 1000);
    last = now;
    if (playing) {
      time += dt * speed;
      if (time > first + duration) { time = first + duration; playing = false; playBtn.textContent = 'PLAY'; }
      scrub.value = String(Math.round((time - first) / duration * 1000));
    }
    const pan = 900 * dt * (1 / Math.max(0.3, zoom));
    if (keys.has('a') || keys.has('arrowleft')) cam.x -= pan;
    if (keys.has('d') || keys.has('arrowright')) cam.x += pan;
    if (keys.has('w') || keys.has('arrowup')) cam.y -= pan;
    if (keys.has('s') || keys.has('arrowdown')) cam.y += pan;
    const shown = time - first;
    timeEl.textContent = `${Math.floor(shown / 60)}:${String(Math.floor(shown % 60)).padStart(2, '0')} / ${Math.floor(duration / 60)}:${String(Math.floor(duration % 60)).padStart(2, '0')}`;
    draw();
    if (recorder && time >= clipStopAt - 0.06) {
      try { recorder.stop(); } catch { /* ignore */ }
      recorder = null;
    }
  };
  raf = requestAnimationFrame(tick);

  const onResize = () => sizeCanvas();
  window.addEventListener('resize', onResize);
  const onKey = (e) => {
    const k = e.key.toLowerCase();
    if (['a', 'd', 'w', 's', 'arrowleft', 'arrowright', 'arrowup', 'arrowdown'].includes(k)) {
      e.preventDefault();
      keys.add(k);
    }
  };
  const onKeyUp = (e) => keys.delete(e.key.toLowerCase());
  window.addEventListener('keydown', onKey);
  window.addEventListener('keyup', onKeyUp);

  canvas.addEventListener('pointerdown', (e) => {
    drag = { x: e.clientX, y: e.clientY, cx: cam.x, cy: cam.y };
    canvas.setPointerCapture?.(e.pointerId);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!drag) return;
    cam.x = drag.cx - (e.clientX - drag.x) / zoom;
    cam.y = drag.cy - (e.clientY - drag.y) / zoom;
  });
  canvas.addEventListener('pointerup', () => { drag = null; });
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    zoom = Math.max(0.2, Math.min(2.4, zoom * (e.deltaY > 0 ? 0.9 : 1.1)));
  }, { passive: false });

  playBtn.addEventListener('click', () => {
    if (!playing && time >= first + duration) time = first;
    playing = !playing;
    playBtn.textContent = playing ? 'PAUSE' : 'PLAY';
  });
  speedBtn.addEventListener('click', () => {
    speed = speed === 1 ? 0.5 : speed === 0.5 ? 2 : 1;
    speedBtn.textContent = speed + '×';
  });
  const exportBtn = root.querySelector('#theater-export');
  const clipPanel = root.querySelector('#theater-clip');
  const clipVideo = root.querySelector('#theater-clip-video');
  const clipLink = root.querySelector('#theater-clip-download');
  exportBtn?.addEventListener('click', () => {
    if (recorder) return;
    const fallbackFrame = () => {
      const a = document.createElement('a');
      a.download = 'ironstorm-replay.png';
      a.href = canvas.toDataURL('image/png');
      a.click();
    };
    if (!canvas.captureStream || typeof MediaRecorder === 'undefined') { fallbackFrame(); return; }
    try {
      const clipLen = Math.min(10, duration);
      const clipStart = Math.max(first, first + duration - clipLen);
      time = clipStart;
      clipStopAt = clipStart + clipLen;
      playing = true;
      playBtn.textContent = 'PAUSE';
      chunks = [];
      const stream = canvas.captureStream(30);
      const mime = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
        ? 'video/webm;codecs=vp9' : 'video/webm';
      recorder = new MediaRecorder(stream, { mimeType: mime });
      recorder.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
      recorder.onstop = () => {
        exportBtn.textContent = 'EXPORT CLIP';
        exportBtn.disabled = false;
        clipStopAt = Infinity;
        if (!chunks.length || closed) return;
        const blob = new Blob(chunks, { type: 'video/webm' });
        if (clipUrl) URL.revokeObjectURL(clipUrl);
        clipUrl = URL.createObjectURL(blob);
        if (clipVideo) clipVideo.src = clipUrl;
        if (clipLink) clipLink.href = clipUrl;
        clipPanel?.classList.remove('hidden');
        const a = document.createElement('a');
        a.href = clipUrl;
        a.download = 'ironstorm-clip.webm';
        document.body.appendChild(a);
        a.click();
        a.remove();
      };
      recorder.start();
      exportBtn.textContent = 'RENDERING CLIP…';
      exportBtn.disabled = true;
    } catch { fallbackFrame(); }
  });
  scrub.addEventListener('input', () => {
    time = first + (Number(scrub.value) / 1000) * duration;
    playing = false;
    playBtn.textContent = 'PLAY';
  });
  const close = () => {
    closed = true;
    if (recorder) { try { recorder.stop(); } catch { /* ignore */ } recorder = null; }
    if (clipUrl) { URL.revokeObjectURL(clipUrl); clipUrl = ''; }
    cancelAnimationFrame(raf);
    raf = 0;
    window.removeEventListener('resize', onResize);
    window.removeEventListener('keydown', onKey);
    window.removeEventListener('keyup', onKeyUp);
    root.innerHTML = '';
  };
  root.querySelector('[data-theater-close]')?.addEventListener('click', close);
  root.querySelector('.modal-backdrop')?.addEventListener('click', close);
  const onEsc = (e) => { if (e.key === 'Escape') { close(); window.removeEventListener('keydown', onEsc); } };
  window.addEventListener('keydown', onEsc);
}
