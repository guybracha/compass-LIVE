import type { AudioEngine } from './AudioEngine';

// Procedural sound effects — synthesized at runtime, so the project ships with
// no third-party audio and no licensing concerns. Replace any entry with a
// sample-based version later without touching callers (they only use names).

type Bus = 'dialogue' | 'music' | 'sfx';
export type Loop = { stop: (fade?: number) => void };
type SfxFn = (a: AudioEngine) => Loop | void;

interface ToneOpts {
  freq: number;
  freqEnd?: number;
  type?: OscillatorType;
  dur: number;
  gain: number;
  attack?: number;
  delay?: number;
  bus?: Bus;
}

export function tone(a: AudioEngine, o: ToneOpts) {
  const ctx = a.ctx!;
  const t = ctx.currentTime + (o.delay ?? 0);
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = o.type ?? 'sine';
  osc.frequency.setValueAtTime(o.freq, t);
  if (o.freqEnd) osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.freqEnd), t + o.dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(o.gain, t + (o.attack ?? 0.01));
  g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
  osc.connect(g).connect(a.buses[o.bus ?? 'sfx']);
  osc.start(t);
  osc.stop(t + o.dur + 0.05);
}

interface NoiseOpts {
  dur: number;
  gain: number;
  filter?: BiquadFilterType;
  freq?: number;
  freqEnd?: number;
  q?: number;
  attack?: number;
  delay?: number;
  bus?: Bus;
}

export function noise(a: AudioEngine, o: NoiseOpts) {
  const ctx = a.ctx!;
  const t = ctx.currentTime + (o.delay ?? 0);
  const src = ctx.createBufferSource();
  src.buffer = a.noise;
  src.loop = true;
  const f = ctx.createBiquadFilter();
  f.type = o.filter ?? 'lowpass';
  f.frequency.setValueAtTime(o.freq ?? 1000, t);
  if (o.freqEnd) f.frequency.exponentialRampToValueAtTime(o.freqEnd, t + o.dur);
  f.Q.value = o.q ?? 0.7;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(o.gain, t + (o.attack ?? 0.005));
  g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
  src.connect(f).connect(g).connect(a.buses[o.bus ?? 'sfx']);
  src.start(t, Math.random());
  src.stop(t + o.dur + 0.05);
}

function helicopter(a: AudioEngine): Loop {
  const ctx = a.ctx!;
  const src = ctx.createBufferSource();
  src.buffer = a.noise;
  src.loop = true;
  const f = ctx.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = 420;
  const chop = ctx.createGain();
  chop.gain.value = 0.5;
  const lfo = ctx.createOscillator();
  lfo.frequency.value = 13;
  const depth = ctx.createGain();
  depth.gain.value = 0.5;
  lfo.connect(depth).connect(chop.gain);
  const out = ctx.createGain();
  out.gain.setValueAtTime(0.0001, ctx.currentTime);
  out.gain.exponentialRampToValueAtTime(0.35, ctx.currentTime + 1.5);
  src.connect(f).connect(chop).connect(out).connect(a.buses.sfx);
  src.start();
  lfo.start();
  // fade out automatically after the aerial segment
  const autoStop = window.setTimeout(() => stop(4), 24000);
  function stop(fade = 1) {
    window.clearTimeout(autoStop);
    const t = ctx.currentTime;
    out.gain.cancelScheduledValues(t);
    out.gain.setValueAtTime(Math.max(out.gain.value, 0.0001), t);
    out.gain.exponentialRampToValueAtTime(0.0001, t + fade);
    src.stop(t + fade + 0.1);
    lfo.stop(t + fade + 0.1);
  }
  return { stop };
}

function easAlert(a: AudioEngine, repeats: number) {
  for (let i = 0; i < repeats; i++) {
    tone(a, { freq: 853, type: 'square', dur: 0.42, gain: 0.07, delay: i * 0.5 });
    tone(a, { freq: 960, type: 'square', dur: 0.42, gain: 0.07, delay: i * 0.5 });
  }
}

export const SFX: Record<string, SfxFn> = {
  alert: (a) => easAlert(a, 4),
  alertShort: (a) => easAlert(a, 2),
  choiceOpen: (a) => {
    tone(a, { freq: 660, dur: 0.18, gain: 0.15, type: 'triangle' });
    tone(a, { freq: 990, dur: 0.3, gain: 0.12, type: 'triangle', delay: 0.12 });
  },
  choiceConfirm: (a) => {
    tone(a, { freq: 523, dur: 0.15, gain: 0.18, type: 'triangle' });
    tone(a, { freq: 784, dur: 0.15, gain: 0.18, type: 'triangle', delay: 0.08 });
    tone(a, { freq: 1046, dur: 0.4, gain: 0.15, type: 'triangle', delay: 0.16 });
  },
  choiceTimeout: (a) => tone(a, { freq: 330, freqEnd: 220, dur: 0.5, gain: 0.15, type: 'sawtooth' }),
  heliStart: (a) => helicopter(a),
  radio: (a) => {
    noise(a, { dur: 0.12, gain: 0.12, filter: 'bandpass', freq: 2200, q: 2, bus: 'dialogue' });
    tone(a, { freq: 1800, dur: 0.06, gain: 0.05, type: 'square', delay: 0.1, bus: 'dialogue' });
  },
  radar: (a) => {
    for (let i = 0; i < 3; i++) tone(a, { freq: 1320, freqEnd: 1250, dur: 0.6, gain: 0.12, delay: i * 0.9 });
  },
  transmit: (a) => {
    for (let i = 0; i < 10; i++) tone(a, { freq: 400 + (i % 3) * 300, dur: 0.08, gain: 0.08, type: 'square', delay: i * 0.13 });
    tone(a, { freq: 60, freqEnd: 120, dur: 2.5, gain: 0.25, type: 'sawtooth' });
  },
  roar: (a) => {
    tone(a, { freq: 70, freqEnd: 45, dur: 2.2, gain: 0.35, type: 'sawtooth', attack: 0.3 });
    tone(a, { freq: 140, freqEnd: 95, dur: 2, gain: 0.15, type: 'square', attack: 0.3 });
    noise(a, { dur: 2, gain: 0.2, filter: 'bandpass', freq: 500, freqEnd: 250, q: 1.5, attack: 0.3 });
  },
  whoosh: (a) => noise(a, { dur: 0.9, gain: 0.25, filter: 'bandpass', freq: 400, freqEnd: 3000, q: 1.2, attack: 0.4 }),
  land: (a) => {
    tone(a, { freq: 90, freqEnd: 30, dur: 0.7, gain: 0.6 });
    noise(a, { dur: 0.8, gain: 0.35, filter: 'lowpass', freq: 900, freqEnd: 120 });
  },
  stomp: (a) => {
    tone(a, { freq: 55, freqEnd: 28, dur: 0.5, gain: 0.55 });
    noise(a, { dur: 0.35, gain: 0.18, filter: 'lowpass', freq: 400 });
  },
  servo: (a) => tone(a, { freq: 180, freqEnd: 420, dur: 0.6, gain: 0.08, type: 'sawtooth', attack: 0.1 }),
  debris: (a) => {
    for (let i = 0; i < 6; i++) noise(a, { dur: 0.25, gain: 0.15, filter: 'bandpass', freq: 600 + Math.random() * 1500, q: 3, delay: 0.1 + Math.random() * 0.8 });
  },
  laserCharge: (a) => tone(a, { freq: 200, freqEnd: 1400, dur: 1.2, gain: 0.12, type: 'sawtooth', attack: 0.8 }),
  laserFire: (a) => {
    tone(a, { freq: 120, freqEnd: 90, dur: 1.1, gain: 0.25, type: 'sawtooth' });
    tone(a, { freq: 2400, freqEnd: 1800, dur: 1, gain: 0.04, type: 'square' });
    noise(a, { dur: 1.1, gain: 0.15, filter: 'highpass', freq: 3000 });
  },
  explosion: (a) => {
    tone(a, { freq: 80, freqEnd: 30, dur: 0.8, gain: 0.5 });
    noise(a, { dur: 1.3, gain: 0.45, filter: 'lowpass', freq: 2500, freqEnd: 150 });
  },
  bigExplosion: (a) => {
    tone(a, { freq: 60, freqEnd: 20, dur: 2, gain: 0.8 });
    noise(a, { dur: 3, gain: 0.6, filter: 'lowpass', freq: 3500, freqEnd: 80 });
    SFX.debris(a);
  },
  crash: (a) => {
    tone(a, { freq: 45, freqEnd: 20, dur: 1.8, gain: 0.8 });
    noise(a, { dur: 2.5, gain: 0.5, filter: 'lowpass', freq: 1200, freqEnd: 100 });
    SFX.debris(a);
  },
  zap: (a) => {
    tone(a, { freq: 1600 + Math.random() * 600, freqEnd: 300, dur: 0.22, gain: 0.1, type: 'sawtooth' });
    noise(a, { dur: 0.18, gain: 0.15, filter: 'highpass', freq: 2500 });
  },
  megaZap: (a) => {
    tone(a, { freq: 2200, freqEnd: 80, dur: 1.2, gain: 0.3, type: 'sawtooth' });
    noise(a, { dur: 1.5, gain: 0.4, filter: 'bandpass', freq: 3000, freqEnd: 200, q: 0.8 });
  },
  chargeUp: (a) => {
    tone(a, { freq: 120, freqEnd: 1800, dur: 2.2, gain: 0.15, type: 'sawtooth', attack: 1.8 });
    noise(a, { dur: 2.2, gain: 0.12, filter: 'highpass', freq: 4000, attack: 1.8 });
  },
  // ---- ally powers
  fireball: (a) => {
    noise(a, { dur: 0.5, gain: 0.25, filter: 'lowpass', freq: 1800, freqEnd: 300, attack: 0.05 });
    tone(a, { freq: 160, freqEnd: 60, dur: 0.4, gain: 0.15, type: 'sawtooth' });
  },
  water: (a) => noise(a, { dur: 0.45, gain: 0.22, filter: 'bandpass', freq: 900, freqEnd: 2500, q: 1.5, attack: 0.03 }),
  cosmic: (a) => {
    tone(a, { freq: 880, freqEnd: 1760, dur: 0.35, gain: 0.07, type: 'sine' });
    tone(a, { freq: 1320, freqEnd: 2640, dur: 0.3, gain: 0.05, type: 'triangle', delay: 0.04 });
  },
  sonic: (a) => {
    tone(a, { freq: 523, dur: 0.25, gain: 0.08, type: 'triangle' });
    tone(a, { freq: 659, dur: 0.25, gain: 0.07, type: 'triangle', delay: 0.06 });
    tone(a, { freq: 784, dur: 0.3, gain: 0.07, type: 'triangle', delay: 0.12 });
  },
  missile: (a) => {
    noise(a, { dur: 0.9, gain: 0.2, filter: 'bandpass', freq: 600, freqEnd: 1800, q: 0.8, attack: 0.05 });
    tone(a, { freq: 300, freqEnd: 900, dur: 0.6, gain: 0.05, type: 'sawtooth' });
  },
  plasma: (a) => tone(a, { freq: 1400, freqEnd: 500, dur: 0.18, gain: 0.08, type: 'square' }),
  grow: (a) => {
    tone(a, { freq: 80, freqEnd: 40, dur: 2, gain: 0.3, type: 'sawtooth', attack: 0.5 });
    tone(a, { freq: 200, freqEnd: 60, dur: 2, gain: 0.1, type: 'triangle', attack: 0.5 });
  },
  // Paladin's sword strike: metallic ring + impact
  punch: (a) => {
    tone(a, { freq: 1240, dur: 0.6, gain: 0.08, type: 'triangle' });
    tone(a, { freq: 1873, dur: 0.4, gain: 0.05, type: 'sine' });
    tone(a, { freq: 90, freqEnd: 40, dur: 0.35, gain: 0.5 });
    noise(a, { dur: 0.2, gain: 0.3, filter: 'bandpass', freq: 1800, q: 1 });
  },
};
