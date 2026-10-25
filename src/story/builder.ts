import type { BranchId, Cue, CueBody, Scene, ShotName, SpeakerId } from './types';

/** Estimated on-screen time for a line; also the fallback when no voice is playing. */
export function lineDuration(text: string): number {
  return Math.max(1.8, text.length * 0.062 + 0.7);
}

/**
 * Small authoring helper: keeps a time cursor so dialogue is laid out
 * sequentially and other cues can be placed relative to it.
 */
export class SceneBuilder {
  cues: Cue[] = [];
  cursor = 0;

  private push(body: CueBody, t = this.cursor) {
    this.cues.push({ ...body, t } as Cue);
    return this;
  }

  /** Move the cursor to an absolute time. */
  at(t: number) {
    this.cursor = t;
    return this;
  }
  wait(s: number) {
    this.cursor += s;
    return this;
  }
  line(speaker: SpeakerId, id: string, text: string, gap = 0.35) {
    this.push({ type: 'line', id, speaker, text });
    this.cursor += lineDuration(text) + gap;
    return this;
  }
  cam(shot: ShotName, blend = 0, target?: string) {
    return this.push({ type: 'camera', shot, blend, target });
  }
  event(name: string) {
    return this.push({ type: 'event', name });
  }
  sfx(name: string) {
    return this.push({ type: 'sfx', name });
  }
  add(body: CueBody) {
    return this.push(body);
  }

  private rollEnd = 0;
  /**
   * Broadcast "roll call": quick camera cuts to each hero with a name strap.
   * Runs in parallel with following dialogue; call `afterRoll()` to wait for it.
   */
  rollCall(heroes: { id: string; name: string; epithet: string }[], each = 1.1) {
    heroes.forEach((h, i) => {
      const t = this.cursor + i * each;
      this.push({ type: 'camera', shot: i % 3 === 2 ? 'heroClose' : 'heroAction', blend: 0, target: h.id }, t);
      this.push({ type: 'lowerThird', name: h.name.toUpperCase(), title: h.epithet, hold: each * 0.95 }, t);
    });
    this.rollEnd = this.cursor + heroes.length * each;
    return this;
  }
  afterRoll() {
    this.cursor = Math.max(this.cursor, this.rollEnd);
    return this;
  }

  scene(id: string, label: string, opts: { tail?: number; next?: string | ((b: BranchId) => string) } = {}): Scene {
    const duration = Math.max(this.cursor, ...this.cues.map((c) => c.t)) + (opts.tail ?? 0.5);
    return { id, label, cues: [...this.cues].sort((a, b) => a.t - b.t), duration, next: opts.next };
  }
}

export const scene = () => new SceneBuilder();
