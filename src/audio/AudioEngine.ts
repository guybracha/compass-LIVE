import { getStore, useStore } from '../state/store';
import type { MusicMood } from '../story/types';
import { MusicPlayer } from './music';
import { SFX } from './synth';

/**
 * Event-driven Web Audio engine with three buses (dialogue / music / sfx) and a
 * master mute. The AudioContext is created only from an explicit user gesture
 * (START BROADCAST), as browsers require.
 */
export class AudioEngine {
  ctx: AudioContext | null = null;
  master!: GainNode;
  buses!: { dialogue: GainNode; music: GainNode; sfx: GainNode };
  noise!: AudioBuffer;
  private music: MusicPlayer | null = null;
  private loops = new Map<string, { stop: (fade?: number) => void }>();

  /** Must be called from a click/tap handler. */
  unlock() {
    if (!this.ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      const ctx = new Ctor();
      this.ctx = ctx;
      this.master = ctx.createGain();
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.ratio.value = 4;
      this.master.connect(comp).connect(ctx.destination);
      this.buses = { dialogue: ctx.createGain(), music: ctx.createGain(), sfx: ctx.createGain() };
      Object.values(this.buses).forEach((b) => b.connect(this.master));
      // shared white-noise buffer
      this.noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const d = this.noise.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      this.music = new MusicPlayer(this);
      this.applySettings();
      useStore.subscribe((s, prev) => {
        if (s.settings !== prev.settings) this.applySettings();
        if (s.paused !== prev.paused) (s.paused ? this.pause() : this.resume());
      });
    }
    void this.ctx.resume();
  }

  private applySettings() {
    if (!this.ctx) return;
    const s = getStore().settings;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(s.muted ? 0 : 1, t, 0.05);
    this.buses.dialogue.gain.setTargetAtTime(s.dialogue, t, 0.05);
    this.buses.music.gain.setTargetAtTime(s.music * 0.6, t, 0.05);
    this.buses.sfx.gain.setTargetAtTime(s.sfx, t, 0.05);
  }

  private lastPlayed = new Map<string, number>();

  play(name: string) {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const fn = SFX[name];
    if (!fn) return;
    // with twenty heroes in a fight, cap how often the same sound can retrigger
    const now = this.ctx.currentTime;
    if (now - (this.lastPlayed.get(name) ?? -1) < 0.07) return;
    this.lastPlayed.set(name, now);
    const loop = fn(this);
    if (loop) {
      this.loops.get(name)?.stop(0.3);
      this.loops.set(name, loop);
    }
  }

  stopLoop(name: string, fade = 1) {
    this.loops.get(name)?.stop(fade);
    this.loops.delete(name);
  }

  setMusicMood(mood: MusicMood) {
    this.music?.setMood(mood);
  }

  stopAll() {
    this.music?.setMood('none');
    this.loops.forEach((l) => l.stop(0.2));
    this.loops.clear();
  }

  pause() {
    void this.ctx?.suspend();
  }
  resume() {
    void this.ctx?.resume();
  }
}

export const audio = new AudioEngine();
