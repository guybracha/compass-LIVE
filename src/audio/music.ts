import type { MusicMood } from '../story/types';
import type { AudioEngine } from './AudioEngine';

// Generative score: a drone/pad layer per mood plus a beat scheduler that uses
// the AudioContext clock (so it pauses naturally when the context is suspended).

interface Layer {
  out: GainNode;
  nodes: (OscillatorNode | AudioBufferSourceNode)[];
}

const MOODS: Record<Exclude<MusicMood, 'none'>, { chord: number[]; type: OscillatorType; cutoff: number; bpm: number; bass: number[]; hats: boolean }> = {
  tense: { chord: [55, 82.4, 110.0, 116.5], type: 'sawtooth', cutoff: 380, bpm: 52, bass: [55], hats: false },
  battle: { chord: [55, 82.4, 110], type: 'sawtooth', cutoff: 650, bpm: 132, bass: [55, 55, 65.4, 55, 49, 55, 73.4, 65.4], hats: true },
  hopeful: { chord: [130.8, 196, 261.6, 329.6, 392], type: 'triangle', cutoff: 1800, bpm: 0, bass: [], hats: false },
  grim: { chord: [41.2, 61.7, 82.4, 98], type: 'sawtooth', cutoff: 300, bpm: 40, bass: [41.2], hats: false },
};

export class MusicPlayer {
  private layer: Layer | null = null;
  private timer = 0;
  private nextBeat = 0;
  private step = 0;
  private mood: MusicMood = 'none';

  constructor(private a: AudioEngine) {}

  setMood(mood: MusicMood) {
    if (mood === this.mood) return;
    this.mood = mood;
    const ctx = this.a.ctx!;
    if (this.layer) {
      const old = this.layer;
      const t = ctx.currentTime;
      old.out.gain.setTargetAtTime(0.0001, t, 0.6);
      old.nodes.forEach((n) => n.stop(t + 3));
    }
    this.layer = null;
    window.clearInterval(this.timer);
    if (mood === 'none') return;

    const cfg = MOODS[mood];
    const out = ctx.createGain();
    out.gain.setValueAtTime(0.0001, ctx.currentTime);
    out.gain.exponentialRampToValueAtTime(0.5, ctx.currentTime + 2);
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = cfg.cutoff;
    filter.Q.value = 2;
    // slow filter sweep for movement
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.07;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = cfg.cutoff * 0.4;
    lfo.connect(lfoGain).connect(filter.frequency);
    filter.connect(out).connect(this.a.buses.music);
    const nodes: Layer['nodes'] = [lfo];
    for (const f of cfg.chord) {
      for (const detune of [-7, 7]) {
        const o = ctx.createOscillator();
        o.type = cfg.type;
        o.frequency.value = f;
        o.detune.value = detune;
        const g = ctx.createGain();
        g.gain.value = 0.06;
        o.connect(g).connect(filter);
        o.start();
        nodes.push(o);
      }
    }
    lfo.start();
    this.layer = { out, nodes };

    if (cfg.bpm > 0) {
      this.nextBeat = ctx.currentTime + 0.1;
      this.step = 0;
      const beat = 60 / cfg.bpm / (mood === 'battle' ? 2 : 1);
      this.timer = window.setInterval(() => {
        if (ctx.state !== 'running') return;
        while (this.nextBeat < ctx.currentTime + 0.25) {
          this.scheduleStep(mood, this.nextBeat, cfg.bass, cfg.hats);
          this.nextBeat += beat;
          this.step++;
        }
      }, 80);
    }
  }

  private scheduleStep(mood: MusicMood, t: number, bass: number[], hats: boolean) {
    const ctx = this.a.ctx!;
    const bus = this.a.buses.music;
    const kick = mood === 'battle' ? this.step % 4 === 0 : true;
    if (kick) {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.setValueAtTime(110, t);
      o.frequency.exponentialRampToValueAtTime(38, t + 0.25);
      g.gain.setValueAtTime(mood === 'battle' ? 0.6 : 0.35, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);
      o.connect(g).connect(bus);
      o.start(t);
      o.stop(t + 0.45);
    }
    if (bass.length && mood === 'battle') {
      const o = ctx.createOscillator();
      const f = ctx.createBiquadFilter();
      const g = ctx.createGain();
      o.type = 'sawtooth';
      o.frequency.value = bass[this.step % bass.length];
      f.type = 'lowpass';
      f.frequency.value = 500;
      g.gain.setValueAtTime(0.22, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
      o.connect(f).connect(g).connect(bus);
      o.start(t);
      o.stop(t + 0.22);
    }
    if (hats && this.step % 2 === 1) {
      const s = ctx.createBufferSource();
      s.buffer = this.a.noise;
      const f = ctx.createBiquadFilter();
      f.type = 'highpass';
      f.frequency.value = 7000;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.08, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
      s.connect(f).connect(g).connect(bus);
      s.start(t, Math.random());
      s.stop(t + 0.06);
    }
  }
}
