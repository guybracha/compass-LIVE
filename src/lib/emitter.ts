/** Minimal typed event emitter used to decouple story, simulation, FX and audio. */
export class Emitter<Events extends Record<string, unknown>> {
  private handlers = new Map<keyof Events, Set<(p: never) => void>>();

  on<K extends keyof Events>(name: K, fn: (payload: Events[K]) => void): () => void {
    let set = this.handlers.get(name);
    if (!set) this.handlers.set(name, (set = new Set()));
    set.add(fn as (p: never) => void);
    return () => set!.delete(fn as (p: never) => void);
  }

  emit<K extends keyof Events>(name: K, payload: Events[K]) {
    this.handlers.get(name)?.forEach((fn) => (fn as (p: Events[K]) => void)(payload));
  }
}
