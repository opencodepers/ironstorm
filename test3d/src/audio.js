export function createAudio() {
  let context = null;
  let master = null;
  let compressor = null;
  let muffle = null;
  let ambience = null;
  let noiseBuffer = null;
  let engineOscillator = null;
  let engineGain = null;
  let engineFilter = null;
  let trackGain = null;
  let windGain = null;
  let rainGain = null;
  let insectGain = null;
  let duckGain = null;
  let muted = false;
  let engineLevel = 0;
  let duck = 0;
  let lastVoice = 0;
  let lastWarning = 0;
  let speechPrimed = false;

  const primeSpeech = () => {
    if (speechPrimed || !('speechSynthesis' in window)) return;
    speechPrimed = true;
    try {
      // Voice enumeration can initialize the platform speech engine. Doing
      // that behind the loader avoids a one-second hitch on the first crew call.
      window.speechSynthesis.getVoices();
      const utterance = new SpeechSynthesisUtterance(' ');
      utterance.volume = 0;
      utterance.rate = 1.5;
      window.speechSynthesis.speak(utterance);
    } catch {
      // Speech is an optional layer; radio clicks remain available.
    }
  };

  const ensure = () => {
    if (!context) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return false;
      context = new AudioContextClass();
      master = context.createGain();
      master.gain.value = muted ? 0 : 0.34;
      muffle = context.createBiquadFilter();
      muffle.type = 'lowpass';
      muffle.frequency.value = 18000;
      compressor = context.createDynamicsCompressor();
      compressor.threshold.value = -18;
      compressor.knee.value = 20;
      compressor.ratio.value = 5;
      compressor.attack.value = 0.003;
      compressor.release.value = 0.28;
      duckGain = context.createGain();
      duckGain.gain.value = 1;
      master.connect(muffle);
      muffle.connect(duckGain);
      duckGain.connect(compressor);
      compressor.connect(context.destination);

      const length = Math.floor(context.sampleRate * 1.8);
      noiseBuffer = context.createBuffer(1, length, context.sampleRate);
      const samples = noiseBuffer.getChannelData(0);
      let last = 0;
      for (let i = 0; i < length; i++) {
        const white = Math.random() * 2 - 1;
        last = last * 0.66 + white * 0.34;
        samples[i] = last;
      }

      ambience = context.createGain();
      ambience.gain.value = 0.55;
      ambience.connect(master);

      const loopNoise = (filterType, frequency, q = 1) => {
        const source = context.createBufferSource();
        source.buffer = noiseBuffer;
        source.loop = true;
        const filter = context.createBiquadFilter();
        filter.type = filterType;
        filter.frequency.value = frequency;
        filter.Q.value = q;
        const gain = context.createGain();
        gain.gain.value = 0;
        source.connect(filter);
        filter.connect(gain);
        gain.connect(ambience);
        source.start();
        return gain;
      };

      windGain = loopNoise('lowpass', 460, 0.5);
      rainGain = loopNoise('highpass', 2300, 0.7);
      insectGain = loopNoise('bandpass', 4200, 4.5);
      trackGain = loopNoise('bandpass', 180, 1.6);

      engineOscillator = context.createOscillator();
      engineOscillator.type = 'sawtooth';
      engineOscillator.frequency.value = 38;
      engineFilter = context.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 210;
      engineGain = context.createGain();
      engineGain.gain.value = 0;
      engineOscillator.connect(engineFilter);
      engineFilter.connect(engineGain);
      engineGain.connect(ambience);
      engineOscillator.start();
      primeSpeech();
    }
    if (context.state === 'suspended') context.resume().catch(() => {});
    return true;
  };

  const stereo = (pan = 0) => {
    if (!ensure() || !context.createStereoPanner) return null;
    const panner = context.createStereoPanner();
    panner.pan.value = Math.max(-1, Math.min(1, pan));
    panner.connect(master);
    return panner;
  };

  const noise = (duration, gain, filterType, frequency, endFrequency = frequency, delay = 0, pan = 0, output = null) => {
    if (!ensure()) return null;
    const now = context.currentTime + delay;
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
    const panner = pan ? stereo(pan) : null;
    envelope.connect(panner || output || master);
    source.start(now);
    source.stop(now + duration + 0.02);
    return { source, filter, envelope };
  };

  const tone = (type, duration, gain, startFrequency, endFrequency, delay = 0, pan = 0) => {
    if (!ensure()) return;
    const now = context.currentTime + delay;
    const oscillator = context.createOscillator();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(startFrequency, now);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, endFrequency), now + duration);
    const envelope = context.createGain();
    envelope.gain.setValueAtTime(gain, now);
    envelope.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    oscillator.connect(envelope);
    const panner = pan ? stereo(pan) : null;
    envelope.connect(panner || master);
    oscillator.start(now);
    oscillator.stop(now + duration + 0.02);
  };

  const radioClick = (pan = 0) => {
    if (!ensure()) return;
    noise(0.06, 0.06, 'bandpass', 1800, 1200, 0, pan);
    tone('sine', 0.06, 0.025, 740, 620, 0.0, pan);
  };

  const speak = (text, pan = 0) => {
    if (!ensure() || muted) return;
    const now = performance.now();
    if (now - lastVoice < 900) return;
    lastVoice = now;
    radioClick(pan);
    if (!('speechSynthesis' in window)) return;
    try {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.08;
      utterance.pitch = 0.82 + Math.random() * 0.14;
      utterance.volume = 0.34;
      utterance.lang = 'en-US';
      // Queue after the current frame. Cancelling on every call forces the
      // platform voice engine to synchronize and can stall the render loop.
      window.setTimeout(() => {
        try {
          window.speechSynthesis.speak(utterance);
        } catch {
          // No speech service on this host.
        }
      }, 0);
    } catch {
      // Speech is optional; the radio click still gives the crew cue.
    }
  };

  return {
    unlock: ensure,
    get muted() {
      return muted;
    },
    toggle() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.34;
      if (muted && 'speechSynthesis' in window) window.speechSynthesis.cancel();
      return muted;
    },
    update({ speed = 0, moving = false, rpm = 0, rain = 0, wind = 0, buttoned = false, damage = 0, repairing = false, tempC = 18 } = {}) {
      if (!context) return;
      const now = context.currentTime;
      const targetEngine = moving ? Math.min(1, 0.24 + Math.abs(speed) * 0.045 + rpm * 0.2) : 0.16;
      engineLevel += (targetEngine - engineLevel) * 0.08;
      engineGain.gain.setTargetAtTime(engineLevel * 0.16, now, 0.12);
      engineOscillator.frequency.setTargetAtTime(28 + Math.abs(speed) * 3.8 + rpm * 34, now, 0.14);
      engineFilter.frequency.setTargetAtTime(160 + Math.abs(speed) * 30 + rpm * 420, now, 0.14);
      trackGain.gain.setTargetAtTime(moving ? Math.min(0.12, Math.abs(speed) * 0.012) : 0.0001, now, 0.18);
      windGain.gain.setTargetAtTime(Math.min(0.14, wind * 0.012), now, 0.4);
      rainGain.gain.setTargetAtTime(rain * 0.09, now, 0.5);
      insectGain.gain.setTargetAtTime(Math.max(0, 0.007 - rain * 0.007 + (tempC > 16 ? 0.004 : 0)), now, 0.8);
      muffle.frequency.setTargetAtTime(buttoned ? 1100 : damage > 0.4 ? 2400 : 18000, now, 0.12);
      if (duck > 0) {
        duck = Math.max(0, duck - 0.016);
        duckGain.gain.setTargetAtTime(0.44 + (1 - duck) * 0.56, now, 0.05);
      } else {
        duckGain.gain.setTargetAtTime(repairing ? 0.76 : 1, now, 0.2);
      }
    },
    fire(shell, delay = 0, pan = 0) {
      if (!ensure()) return;
      const heavy = shell === 'HE' || shell === 'HEAT' || shell === 'HESH';
      noise(0.2, 0.42, 'highpass', 5200, 900, delay, pan);
      noise(1.25, 0.98, 'lowpass', 2100, 55, delay, pan);
      tone('sine', 1.15, 1.3, heavy ? 54 : 62, heavy ? 19 : 23, delay, pan);
      tone('triangle', 0.34, 0.48, 180, 48, delay, pan);
      if (heavy) tone('sine', 1.5, 0.4, 44, 18, delay, pan);
      tone('triangle', 0.12, 0.16, 220, 70, delay + 0.38, pan);
      tone('triangle', 0.09, 0.1, 1250, 420, delay + 0.46, pan);
      noise(1.2, 0.18, 'lowpass', 520, 65, delay + 0.28, pan);
      tone('sine', 0.8, 0.16, 43, 20, delay + 0.24, pan);
      duck = 1;
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
    impact(kind, distance = 0, pan = 0) {
      if (!ensure()) return;
      const delay = Math.min(0.9, distance / 1900);
      const gain = distance > 100 ? 0.16 : 0.32;
      if (kind === 'metal') {
        noise(0.22, gain, 'highpass', 1800, 900, delay, pan);
        tone('triangle', 0.28, gain * 0.65, 1120, 640, delay, pan);
      } else if (kind === 'tank' || kind === 'explosion') {
        noise(0.7, gain * 2.1, 'lowpass', 1600, 90, delay, pan);
        tone('sine', 0.8, gain * 1.5, 74, 24, delay, pan);
        noise(0.25, gain * 0.5, 'highpass', 2200, 700, delay, pan);
      } else {
        noise(0.28, gain, 'lowpass', 620, 90, delay, pan);
        tone('sine', 0.25, gain * 0.5, 64, 28, delay, pan);
      }
    },
    explosion(scale = 1, distance = 0, pan = 0) {
      if (!ensure()) return;
      const delay = Math.min(1.4, distance / 1100);
      const gain = distance > 160 ? 0.16 : 0.42;
      noise(0.85 * scale, gain * 1.8, 'lowpass', 1800, 70, delay, pan);
      tone('sine', 0.9 * scale, gain * 1.5, 78, 22, delay, pan);
      noise(0.2, gain * 0.5, 'highpass', 2400, 800, delay, pan);
      duck = 1;
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
    click() {
      if (!ensure()) return;
      tone('sine', 0.04, 0.025, 880, 760);
    },
    mg() {
      if (!ensure()) return;
      noise(0.08, 0.11, 'highpass', 3100, 900);
      tone('triangle', 0.06, 0.055, 180, 80);
    },
    distantFire(distance = 400, pan = 0) {
      if (!ensure()) return;
      const delay = Math.min(1.6, distance / 950);
      noise(0.45, 0.12, 'lowpass', 620, 80, delay, pan);
      tone('sine', 0.65, 0.1, 48, 20, delay, pan);
    },
    missile(distance = 200, pan = 0) {
      if (!ensure()) return;
      const delay = Math.min(0.4, distance / 1600);
      noise(0.65, 0.16, 'bandpass', 1700, 500, delay, pan);
      tone('sawtooth', 0.45, 0.07, 260, 120, delay, pan);
    },
    flyby(pan = 0) {
      if (!ensure()) return;
      noise(0.5, 0.2, 'bandpass', 700, 2800, 0, pan);
      tone('triangle', 0.45, 0.05, 90, 42, 0, pan);
    },
    warning(pan = 0) {
      if (!ensure()) return;
      const now = performance.now();
      if (now - lastWarning < 350) return;
      lastWarning = now;
      tone('square', 0.08, 0.035, 1480, 1480, 0, pan);
      tone('square', 0.08, 0.035, 1080, 1080, 0.12, pan);
    },
    crew(text, pan = 0) {
      if (!text) return;
      speak(text, pan);
    },
    radio(text, pan = 0) {
      radioClick(pan);
      if (text) speak(text, pan);
    },
    artilleryIncoming(distance = 300, pan = 0) {
      if (!ensure()) return;
      const delay = Math.min(1.8, distance / 900);
      tone('sine', 0.9, 0.1, 90, 36, delay, pan);
      noise(0.8, 0.1, 'lowpass', 500, 50, delay, pan);
    },
    damage() {
      if (!ensure()) return;
      noise(0.8, 0.6, 'lowpass', 1100, 60);
      tone('sine', 0.7, 0.5, 68, 24);
      noise(0.25, 0.2, 'highpass', 1800, 600);
    },
    repairTick() {
      if (!ensure()) return;
      tone('triangle', 0.05, 0.028, 460, 520);
    },
  };
}
