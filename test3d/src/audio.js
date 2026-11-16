export function createAudio() {
  let context = null;
  let master = null;
  let noiseBuffer = null;
  let muted = false;

  const ensure = () => {
    if (!context) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return false;
      context = new AudioContextClass();
      master = context.createGain();
      master.gain.value = muted ? 0 : 0.42;
      master.connect(context.destination);

      const length = Math.floor(context.sampleRate * 1.6);
      noiseBuffer = context.createBuffer(1, length, context.sampleRate);
      const samples = noiseBuffer.getChannelData(0);
      let last = 0;
      for (let i = 0; i < length; i++) {
        const white = Math.random() * 2 - 1;
        last = last * 0.68 + white * 0.32;
        samples[i] = last;
      }
    }
    if (context.state === 'suspended') context.resume().catch(() => {});
    return true;
  };

  const noise = (duration, gain, filterType, frequency, endFrequency = frequency) => {
    if (!ensure()) return null;
    const now = context.currentTime;
    const source = context.createBufferSource();
    source.buffer = noiseBuffer;
    const filter = context.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.setValueAtTime(frequency, now);
    filter.frequency.exponentialRampToValueAtTime(Math.max(25, endFrequency), now + duration);
    const envelope = context.createGain();
    envelope.gain.setValueAtTime(gain, now);
    envelope.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    source.connect(filter);
    filter.connect(envelope);
    envelope.connect(master);
    source.start(now);
    source.stop(now + duration + 0.02);
    return { source, filter, envelope };
  };

  const tone = (type, duration, gain, startFrequency, endFrequency) => {
    if (!ensure()) return;
    const now = context.currentTime;
    const oscillator = context.createOscillator();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(startFrequency, now);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, endFrequency), now + duration);
    const envelope = context.createGain();
    envelope.gain.setValueAtTime(gain, now);
    envelope.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    oscillator.connect(envelope);
    envelope.connect(master);
    oscillator.start(now);
    oscillator.stop(now + duration + 0.02);
  };

  return {
    unlock: ensure,
    get muted() {
      return muted;
    },
    toggle() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.42;
      return muted;
    },
    fire(shell) {
      if (!ensure()) return;
      noise(0.85, 0.85, 'lowpass', 2600, 110);
      tone('sine', 0.7, 0.9, 88, 31);
      noise(0.12, 0.32, 'highpass', 2400, 1400);
      if (shell === 'HE') tone('triangle', 0.5, 0.18, 56, 28);
    },
    reload() {
      if (!ensure()) return;
      const now = context.currentTime;
      const click = (at, gain, frequency) => {
        const source = context.createBufferSource();
        source.buffer = noiseBuffer;
        const filter = context.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = frequency;
        filter.Q.value = 1.3;
        const envelope = context.createGain();
        envelope.gain.setValueAtTime(gain, now + at);
        envelope.gain.exponentialRampToValueAtTime(0.0001, now + at + 0.12);
        source.connect(filter);
        filter.connect(envelope);
        envelope.connect(master);
        source.start(now + at);
        source.stop(now + at + 0.15);
      };
      click(0.02, 0.35, 1700);
      click(0.34, 0.48, 820);
      click(0.62, 0.24, 1200);
    },
    ready() {
      if (!ensure()) return;
      tone('sine', 0.16, 0.08, 880, 920);
    },
    impact(kind) {
      if (!ensure()) return;
      if (kind === 'metal') {
        noise(0.22, 0.22, 'highpass', 1800, 900);
        tone('triangle', 0.28, 0.14, 1120, 640);
      } else if (kind === 'tank' || kind === 'explosion') {
        noise(0.7, 0.82, 'lowpass', 1600, 90);
        tone('sine', 0.8, 0.65, 74, 24);
        noise(0.25, 0.18, 'highpass', 2200, 700);
      } else {
        noise(0.28, 0.38, 'lowpass', 620, 90);
        tone('sine', 0.25, 0.18, 64, 28);
      }
    },
    explosion(scale = 1) {
      if (!ensure()) return;
      noise(0.85 * scale, 0.95, 'lowpass', 1800, 70);
      tone('sine', 0.9 * scale, 0.8, 78, 22);
      noise(0.2, 0.2, 'highpass', 2400, 800);
    },
    hit(kill = false) {
      if (!ensure()) return;
      tone('triangle', 0.2, 0.1, kill ? 1320 : 980, kill ? 720 : 600);
      if (kill) {
        noise(0.4, 0.3, 'lowpass', 1000, 80);
        tone('sine', 0.5, 0.24, 60, 22);
      }
    },
    laser() {
      if (!ensure()) return;
      tone('sine', 0.18, 0.07, 1760, 420);
    },
  };
}
