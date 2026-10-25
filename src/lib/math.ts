export const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const smoothstep = (t: number) => {
  const x = clamp(t);
  return x * x * (3 - 2 * x);
};
export const damp = (current: number, target: number, lambda: number, dt: number) =>
  lerp(current, target, 1 - Math.exp(-lambda * dt));

/** Deterministic PRNG (mulberry32) so the city layout is identical every run. */
export function seeded(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Cheap smooth 1D noise in [-1, 1] for handheld camera / jitter. */
export function noise1(x: number, seed = 0) {
  return (
    Math.sin(x * 1.7 + seed) * 0.5 +
    Math.sin(x * 3.1 + seed * 2.3) * 0.3 +
    Math.sin(x * 5.3 + seed * 4.1) * 0.2
  );
}
