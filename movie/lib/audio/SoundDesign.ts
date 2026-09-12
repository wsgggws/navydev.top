/**
 * SoundDesign — fully synthesised soundscape. No external audio files.
 *
 * Web Audio context is created lazily on the first user gesture (browsers
 * gate audio playback). All loops return a `stop()` handle. Scenes call
 * `start*` in create() and `stop()` in destroy().
 */

let _ctx: AudioContext | null = null;
let _master: GainNode | null = null;
let _noiseBuf: AudioBuffer | null = null;
let _muted = false;

const MASTER_GAIN = 0.42;

function ctx(): AudioContext {
  if (_ctx) return _ctx;
  const Ctor = (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext);
  _ctx = new Ctor();
  _master = _ctx.createGain();
  _master.gain.value = _muted ? 0 : MASTER_GAIN;
  _master.connect(_ctx.destination);
  return _ctx;
}

function master(): GainNode {
  ctx();
  return _master!;
}

function noiseBuffer(): AudioBuffer {
  if (_noiseBuf) return _noiseBuf;
  const c = ctx();
  _noiseBuf = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
  const data = _noiseBuf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return _noiseBuf;
}

/** Resume context on user gesture. Safe to call repeatedly. */
export async function primeAudio(): Promise<void> {
  const c = ctx();
  if (c.state === "suspended") {
    try { await c.resume(); } catch { /* ignore */ }
  }
}

/** True once the context has been resumed (i.e. user has interacted). */
export function audioReady(): boolean {
  return !!_ctx && _ctx.state === "running";
}

export function setMuted(muted: boolean): void {
  _muted = muted;
  if (!_ctx || !_master) return;
  _master.gain.cancelScheduledValues(_ctx.currentTime);
  _master.gain.linearRampToValueAtTime(muted ? 0 : MASTER_GAIN, _ctx.currentTime + 0.12);
}

export function isMuted(): boolean {
  return _muted;
}

export function toggleMuted(): boolean {
  setMuted(!_muted);
  return _muted;
}

/** ────────────────────────────────────────────────────────────────
 *  Continuous loops
 *  ──────────────────────────────────────────────────────────────── */

export function startRain(volume = 0.35): () => void {
  const c = ctx();
  const src = c.createBufferSource();
  src.buffer = noiseBuffer();
  src.loop = true;
  const bp = c.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.value = 1100;
  bp.Q.value = 0.6;
  const lp = c.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 4000;
  const g = c.createGain();
  g.gain.value = 0;
  src.connect(bp).connect(lp).connect(g).connect(master());
  src.start();
  g.gain.linearRampToValueAtTime(volume, c.currentTime + 1.5);
  return () => {
    g.gain.cancelScheduledValues(c.currentTime);
    g.gain.linearRampToValueAtTime(0, c.currentTime + 0.3);
    setTimeout(() => src.stop(), 400);
  };
}

export function startCrtHum(volume = 0.06): () => void {
  const c = ctx();
  const g = c.createGain();
  g.gain.value = 0;
  g.connect(master());
  const o1 = c.createOscillator();
  o1.type = "sine";
  o1.frequency.value = 60;
  const o2 = c.createOscillator();
  o2.type = "sine";
  o2.frequency.value = 120;
  const o3 = c.createOscillator();
  o3.type = "sawtooth";
  o3.frequency.value = 15750;
  const lp = c.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 200;
  o1.connect(g);
  o2.connect(g);
  o3.connect(lp).connect(g);
  o1.start(); o2.start(); o3.start();
  g.gain.linearRampToValueAtTime(volume, c.currentTime + 1.0);
  return () => {
    g.gain.cancelScheduledValues(c.currentTime);
    g.gain.linearRampToValueAtTime(0, c.currentTime + 0.3);
    setTimeout(() => { o1.stop(); o2.stop(); o3.stop(); }, 400);
  };
}

export function startAmbient(
  mood: "warm" | "digital" | "chiptune" | "deep",
  volume = 0.1,
): () => void {
  const c = ctx();
  const g = c.createGain();
  g.gain.value = 0;
  g.connect(master());

  const nodes: OscillatorNode[] = [];
  const lfo = c.createOscillator();
  const lfoGain = c.createGain();
  lfoGain.gain.value = 0.04;
  lfo.frequency.value = 0.18;
  lfo.connect(lfoGain).connect(g.gain);
  lfo.start();
  nodes.push(lfo as unknown as OscillatorNode);

  const profile = {
    warm: [82, 110, 165, 220],
    digital: [196, 294, 392],
    chiptune: [392, 523, 659],
    deep: [55, 82],
  }[mood];

  profile.forEach((f, i) => {
    const o = c.createOscillator();
    o.type = i === 0 ? "sine" : mood === "chiptune" ? "square" : "sine";
    o.frequency.value = f;
    const subG = c.createGain();
    subG.gain.value = 0.5 / profile.length;
    o.connect(subG).connect(g);
    o.start();
    nodes.push(o);
  });

  g.gain.linearRampToValueAtTime(volume, c.currentTime + 2.0);
  return () => {
    g.gain.cancelScheduledValues(c.currentTime);
    g.gain.linearRampToValueAtTime(0, c.currentTime + 0.4);
    setTimeout(() => nodes.forEach((n) => n.stop()), 600);
  };
}

/** A single, continuous score for the whole reel: slow harmony, no hard beat. */
export function startCalmBackground(volume = 0.075): () => void {
  const c = ctx();
  const out = c.createGain();
  out.gain.value = 0;

  const lowpass = c.createBiquadFilter();
  lowpass.type = "lowpass";
  lowpass.frequency.value = 1150;
  lowpass.Q.value = 0.25;
  lowpass.connect(out).connect(master());

  const delay = c.createDelay(1.2);
  delay.delayTime.value = 0.48;
  const feedback = c.createGain();
  feedback.gain.value = 0.16;
  delay.connect(feedback).connect(delay);
  delay.connect(out);

  const chords = [
    [65.41, 98, 130.81, 164.81, 246.94],
    [55, 82.41, 110, 130.81, 164.81],
    [43.65, 65.41, 87.31, 110, 164.81],
    [49, 73.42, 98, 130.81, 196],
  ];
  const oscillators = chords[0].map((frequency, index) => {
    const oscillator = c.createOscillator();
    oscillator.type = index < 2 ? "sine" : "triangle";
    oscillator.frequency.value = frequency;
    oscillator.detune.value = index % 2 === 0 ? -3 : 3;
    const gain = c.createGain();
    gain.gain.value = index < 2 ? 0.18 : 0.07;
    oscillator.connect(gain).connect(lowpass);
    if (index > 2) gain.connect(delay);
    oscillator.start();
    return oscillator;
  });

  let chordIndex = 0;
  const changeChord = () => {
    chordIndex = (chordIndex + 1) % chords.length;
    const now = c.currentTime;
    oscillators.forEach((oscillator, index) => {
      oscillator.frequency.setTargetAtTime(chords[chordIndex][index], now, 1.6);
    });
  };
  const chordTimer = window.setInterval(changeChord, 8000);

  let noteIndex = 0;
  const notes = [261.63, 329.63, 392, 329.63, 293.66, 261.63, 220, 246.94];
  const playNote = () => {
    if (!audioReady()) return;
    const now = c.currentTime + 0.04;
    const oscillator = c.createOscillator();
    oscillator.type = "sine";
    oscillator.frequency.value = notes[noteIndex % notes.length];
    const gain = c.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.026, now + 0.45);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 3.4);
    oscillator.connect(gain).connect(delay);
    oscillator.start(now);
    oscillator.stop(now + 3.5);
    noteIndex += 1;
  };
  const noteTimer = window.setInterval(playNote, 4200);
  out.gain.linearRampToValueAtTime(volume, c.currentTime + 2.8);

  return () => {
    window.clearInterval(chordTimer);
    window.clearInterval(noteTimer);
    out.gain.cancelScheduledValues(c.currentTime);
    out.gain.linearRampToValueAtTime(0, c.currentTime + 1.2);
    window.setTimeout(() => {
      oscillators.forEach((oscillator) => oscillator.stop());
      out.disconnect();
    }, 1400);
  };
}

export function startScore(
  mood: "noir" | "signal" | "rush" | "garden" | "arcade" | "launch",
  volume = 0.045,
): () => void {
  const c = ctx();
  const out = c.createGain();
  out.gain.value = 0;
  out.connect(master());

  const lp = c.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = mood === "rush" || mood === "arcade" ? 1400 : 900;
  lp.Q.value = 0.4;
  lp.connect(out);

  const delay = c.createDelay(1.2);
  delay.delayTime.value = mood === "launch" ? 0.34 : 0.22;
  const feedback = c.createGain();
  feedback.gain.value = 0.24;
  delay.connect(feedback).connect(delay);
  delay.connect(out);

  const palettes: Record<typeof mood, number[]> = {
    noir: [49, 73.42, 98, 146.83],
    signal: [65.41, 98, 130.81, 196],
    rush: [82.41, 123.47, 164.81, 246.94],
    garden: [65.41, 98, 130.81, 196],
    arcade: [110, 164.81, 220, 329.63],
    launch: [55, 82.41, 110, 164.81],
  };
  const wave: OscillatorType = mood === "arcade" ? "square" : mood === "signal" ? "triangle" : "sine";
  const nodes: AudioScheduledSourceNode[] = [];
  const melodyGain = c.createGain();
  melodyGain.gain.value = volume * 0.52;
  melodyGain.connect(delay);
  melodyGain.connect(out);

  palettes[mood].forEach((freq, i) => {
    const osc = c.createOscillator();
    osc.type = i === 0 ? "sine" : wave;
    osc.frequency.value = freq;
    const gain = c.createGain();
    gain.gain.value = 0;
    const pan = c.createStereoPanner();
    pan.pan.value = (i - 1.5) * 0.22;
    osc.connect(gain).connect(pan).connect(lp);
    if (i > 1) gain.connect(delay);
    osc.start();
    nodes.push(osc);

    const now = c.currentTime;
    const target = (i === 0 ? 0.38 : 0.18) / palettes[mood].length;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(target, now + 1.2 + i * 0.16);
  });

  const lfo = c.createOscillator();
  lfo.type = "sine";
  lfo.frequency.value = mood === "rush" ? 0.42 : 0.18;
  const lfoGain = c.createGain();
  lfoGain.gain.value = volume * 0.18;
  lfo.connect(lfoGain).connect(out.gain);
  lfo.start();
  nodes.push(lfo);

  out.gain.linearRampToValueAtTime(volume, c.currentTime + 1.6);

  const melody: Record<typeof mood, number[]> = {
    noir: [146.83, 196, 220, 196, 164.81, 146.83],
    signal: [196, 246.94, 261.63, 246.94, 196, 164.81],
    rush: [246.94, 329.63, 392, 329.63, 493.88, 392],
    garden: [196, 220, 261.63, 329.63, 293.66, 261.63],
    arcade: [329.63, 392, 493.88, 659.25, 493.88, 392],
    launch: [164.81, 220, 246.94, 329.63, 392, 329.63],
  };
  const tempo = mood === "rush" || mood === "arcade" ? 185 : mood === "garden" ? 112 : 132;
  const beat = 60 / tempo;
  let step = 0;
  const playNote = () => {
    if (!audioReady()) return;
    const now = c.currentTime + 0.02;
    const freq = melody[mood][step % melody[mood].length];
    const osc = c.createOscillator();
    osc.type = mood === "arcade" ? "square" : "triangle";
    osc.frequency.setValueAtTime(freq, now);
    if (step % 4 === 3) osc.frequency.exponentialRampToValueAtTime(freq * 1.5, now + beat * 0.58);
    const env = c.createGain();
    env.gain.setValueAtTime(0.0001, now);
    env.gain.exponentialRampToValueAtTime(0.12, now + 0.025);
    env.gain.exponentialRampToValueAtTime(0.0001, now + beat * 0.82);
    osc.connect(env).connect(melodyGain);
    osc.start(now);
    osc.stop(now + beat);
    step++;
  };
  playNote();
  const melodyTimer = window.setInterval(playNote, beat * 1000);

  return () => {
    window.clearInterval(melodyTimer);
    out.gain.cancelScheduledValues(c.currentTime);
    out.gain.linearRampToValueAtTime(0, c.currentTime + 0.45);
    setTimeout(() => {
      nodes.forEach((n) => n.stop());
      out.disconnect();
    }, 650);
  };
}

/** ────────────────────────────────────────────────────────────────
 *  One-shot events
 *  ──────────────────────────────────────────────────────────────── */

export function typingClick(): void {
  if (!audioReady()) return;
  const c = ctx();
  const src = c.createBufferSource();
  src.buffer = noiseBuffer();
  const bp = c.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.value = 2600 + Math.random() * 900;
  bp.Q.value = 1.1;
  const g = c.createGain();
  const pan = c.createStereoPanner();
  pan.pan.value = Math.random() * 0.26 - 0.13;
  g.gain.setValueAtTime(0.035, c.currentTime);
  g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 0.045);
  src.connect(bp).connect(g).connect(pan).connect(master());
  src.start();
  src.stop(c.currentTime + 0.06);
}

export function bigImpact(): void {
  if (!audioReady()) return;
  const c = ctx();
  const o = c.createOscillator();
  o.type = "sine";
  o.frequency.setValueAtTime(80, c.currentTime);
  o.frequency.exponentialRampToValueAtTime(40, c.currentTime + 0.4);
  const g = c.createGain();
  g.gain.setValueAtTime(0.12, c.currentTime);
  g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 0.6);
  o.connect(g).connect(master());
  o.start();
  o.stop(c.currentTime + 0.7);
}

export function chordGlow(): void {
  if (!audioReady()) return;
  const c = ctx();
  [261.6, 329.6, 392.0, 523.2].forEach((f, i) => {
    const o = c.createOscillator();
    o.type = "triangle";
    o.frequency.value = f;
    const g = c.createGain();
    g.gain.setValueAtTime(0, c.currentTime + i * 0.05);
    g.gain.linearRampToValueAtTime(0.045, c.currentTime + i * 0.05 + 0.05);
    g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 1.4);
    o.connect(g).connect(master());
    o.start();
    o.stop(c.currentTime + 1.5);
  });
}

export function whoosh(): void {
  if (!audioReady()) return;
  const c = ctx();
  const src = c.createBufferSource();
  src.buffer = noiseBuffer();
  const bp = c.createBiquadFilter();
  bp.type = "highpass";
  bp.frequency.setValueAtTime(800, c.currentTime);
  bp.frequency.exponentialRampToValueAtTime(80, c.currentTime + 0.6);
  const g = c.createGain();
  g.gain.setValueAtTime(0.07, c.currentTime);
  g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 0.7);
  src.connect(bp).connect(g).connect(master());
  src.start();
  src.stop(c.currentTime + 0.8);
}

export function stopAll(): void {
  if (!_ctx) return;
  _ctx.close();
  _ctx = null;
  _master = null;
  _noiseBuf = null;
}
