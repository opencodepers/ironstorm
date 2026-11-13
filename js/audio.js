// Procedural audio — every sound is synthesised, so there are no audio files
// to ship and no load-time hitches. A tiny look-ahead scheduler drives the
// ambient battlefield drone.

let ctx = null;
let master = null, sfxGain = null, musicGain = null;
let noiseBuf = null;
let started = false;
const settings = { sfx: 0.8, music: 0.3 };

function ensure() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = 1;
  master.connect(ctx.destination);

  sfxGain = ctx.createGain();
  sfxGain.gain.value = settings.sfx;
  sfxGain.connect(master);

  musicGain = ctx.createGain();
  musicGain.gain.value = 0;
  musicGain.connect(master);

  const len = ctx.sampleRate * 1.2;
  noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = noiseBuf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  return ctx;
}

function noise(dur, { gain = 0.5, freq = 900, q = 1, type = 'lowpass', sweep = 0 } = {}) {
  const c = ensure();
  if (!c) return;
  const src = c.createBufferSource();
  src.buffer = noiseBuf;
  src.playbackRate.value = 1;
  const f = c.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  f.Q.value = q;
  if (sweep) {
    f.frequency.setValueAtTime(freq, c.currentTime);
    f.frequency.exponentialRampToValueAtTime(Math.max(40, freq + sweep), c.currentTime + dur);
  }
  const g = c.createGain();
  g.gain.setValueAtTime(gain, c.currentTime);
  g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur);
  src.connect(f).connect(g).connect(sfxGain);
  src.start();
  src.stop(c.currentTime + dur + 0.02);
}

function tone(freq, dur, { type = 'sine', gain = 0.2, to = null, delay = 0 } = {}) {
  const c = ensure();
  if (!c) return;
  const t0 = c.currentTime + delay;
  const o = c.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  if (to) o.frequency.exponentialRampToValueAtTime(to, t0 + dur);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(sfxGain);
  o.start(t0);
  o.stop(t0 + dur + 0.02);
}

const SFX = {
  cannon() { noise(0.28, { gain: 0.75, freq: 1400, sweep: -1250, q: 0.6 }); tone(110, 0.25, { type: 'sine', gain: 0.5, to: 36 }); },
  hit() { noise(0.09, { gain: 0.4, freq: 2400, q: 2, sweep: -1500 }); tone(320, 0.07, { type: 'square', gain: 0.1, to: 140 }); },
  ricochet() { tone(1800, 0.1, { type: 'triangle', gain: 0.09, to: 620 }); },
  explosion() { noise(0.7, { gain: 0.85, freq: 700, sweep: -620, q: 0.7 }); tone(70, 0.6, { type: 'sine', gain: 0.55, to: 22 }); },
  reload() { noise(0.05, { gain: 0.18, freq: 3000, q: 3 }); tone(420, 0.06, { type: 'square', gain: 0.05, delay: 0.07 }); },
  pickup() { tone(660, 0.1, { gain: 0.14 }); tone(990, 0.14, { gain: 0.12, delay: 0.08 }); },
  dash() { noise(0.24, { gain: 0.3, freq: 500, sweep: 1400, q: 1.2, type: 'bandpass' }); },
  ui() { tone(520, 0.05, { type: 'triangle', gain: 0.08 }); },
  uiBack() { tone(360, 0.06, { type: 'triangle', gain: 0.07, to: 220 }); },
  death() { noise(0.9, { gain: 0.7, freq: 500, sweep: -440 }); tone(120, 0.8, { type: 'sawtooth', gain: 0.22, to: 30 }); },
  levelup() { [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.22, { gain: 0.13, delay: i * 0.09 })); },
  victory() { [392, 523, 659, 784].forEach((f, i) => tone(f, 0.3, { type: 'triangle', gain: 0.14, delay: i * 0.12 })); },
  buy() { tone(880, 0.07, { gain: 0.1 }); tone(1320, 0.12, { gain: 0.09, delay: 0.07 }); },
  deny() { tone(200, 0.14, { type: 'square', gain: 0.09, to: 120 }); },
};

export const audio = {
  init() {
    if (started) return;
    started = true;
    ensure();
    if (ctx && ctx.state === 'suspended') ctx.resume();
    this.apply();
  },
  unlock() {
    ensure();
    if (ctx && ctx.state === 'suspended') ctx.resume();
  },
  set(s) {
    settings.sfx = s.sfx;
    settings.music = s.music;
    this.apply();
  },
  apply() {
    if (!ctx) return;
    sfxGain.gain.value = settings.sfx;
    musicGain.gain.value = settings.music * 0.32;
    if (settings.music > 0.01) this.startMusic();
    else this.stopMusic();
  },
  play(name) {
    if (!ctx || settings.sfx <= 0.001) return;
    SFX[name]?.();
  },

  // ---- ambient loop -------------------------------------------------
  musicTimer: null,
  step: 0,
  nextTime: 0,
  startMusic() {
    if (!ctx || this.musicTimer) return;
    this.nextTime = ctx.currentTime + 0.1;
    this.musicTimer = setInterval(() => this.schedule(), 120);
  },
  stopMusic() {
    if (this.musicTimer) { clearInterval(this.musicTimer); this.musicTimer = null; }
  },
  schedule() {
    if (!ctx) return;
    const bpm = 76, stepDur = 60 / bpm / 2;
    while (this.nextTime < ctx.currentTime + 0.35) {
      const s = this.step % 16;
      const bassNotes = [55, 55, 82.4, 55, 73.4, 55, 65.4, 61.7];
      if (s % 4 === 0) {
        const f = bassNotes[(this.step / 4) % bassNotes.length | 0];
        this.bassAt(f, this.nextTime, stepDur * 3.2);
      }
      if (s % 8 === 4) this.hatAt(this.nextTime, 0.05);
      if (s % 2 === 0 && this.step % 32 > 15) this.padAt(this.nextTime, stepDur * 4);
      this.nextTime += stepDur;
      this.step++;
    }
  },
  bassAt(freq, t, dur) {
    const o = ctx.createOscillator(), g = ctx.createGain(), f = ctx.createBiquadFilter();
    o.type = 'sawtooth'; o.frequency.value = freq;
    f.type = 'lowpass'; f.frequency.value = 320; f.Q.value = 2;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.16, t + 0.05);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(f).connect(g).connect(musicGain);
    o.start(t); o.stop(t + dur + 0.05);
  },
  padAt(t, dur) {
    [220, 277.2, 329.6].forEach((fr) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sine'; o.frequency.value = fr;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.03, t + 0.6);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g).connect(musicGain);
      o.start(t); o.stop(t + dur + 0.05);
    });
  },
  hatAt(t, gain) {
    const src = ctx.createBufferSource(), g = ctx.createGain(), f = ctx.createBiquadFilter();
    src.buffer = noiseBuf;
    f.type = 'highpass'; f.frequency.value = 7000;
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    src.connect(f).connect(g).connect(musicGain);
    src.start(t); src.stop(t + 0.06);
  },
};
