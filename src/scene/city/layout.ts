import { seeded } from '../../lib/math';

// Shared, deterministic city layout. Used by both the renderer and the battle
// simulation (so damage lands on the buildings you actually see).
//
// Central Avenue runs along the Z axis at x = 0. The robot approaches from -Z.

export const AVENUE_HALF = 8; // road half-width
export const SIDEWALK = 10.5; // building line
export const CROSS_STREETS = [-108, -84, -60, -36, -12, 12, 36, 60];
export const CROSS_HALF = 4;
export const CITY_Z_MIN = -132;
export const CITY_Z_MAX = 84;
export const CITY_X_MAX = 74;

export interface Building {
  i: number;
  /** min corner x/z and size */
  x0: number;
  z0: number;
  w: number;
  d: number;
  h: number;
  side: -1 | 1;
  front: boolean;
  tint: number;
}

export interface CityLayout {
  buildings: Building[];
  /** Buildings around the battle zone; drives the city damage percentage. */
  districtIds: number[];
}

let cached: CityLayout | null = null;

export function getCityLayout(): CityLayout {
  if (cached) return cached;
  const rnd = seeded(1337);
  const buildings: Building[] = [];
  const zEdges = [CITY_Z_MIN, ...CROSS_STREETS, CITY_Z_MAX];

  for (let b = 0; b < zEdges.length - 1; b++) {
    const zStart = zEdges[b] + (b === 0 ? 0 : CROSS_HALF) + 0.8;
    const zEnd = zEdges[b + 1] - (b === zEdges.length - 2 ? 0 : CROSS_HALF) - 0.8;
    for (const side of [-1, 1] as const) {
      let x = SIDEWALK;
      let row = 0;
      while (x < CITY_X_MAX) {
        const w = 7 + rnd() * 6;
        // split the block along z into 1–3 buildings
        const splits = row === 0 ? 1 + Math.floor(rnd() * 2.2) : 1 + Math.floor(rnd() * 1.6);
        const len = (zEnd - zStart) / splits;
        for (let s = 0; s < splits; s++) {
          const gap = splits > 1 ? 0.6 : 0;
          const z0 = zStart + s * len + gap;
          const d = len - gap * 2;
          const centrality = 1 - Math.min(1, Math.abs(z0 + d / 2 + 20) / 110);
          const base = row === 0 ? 12 + rnd() * 22 : 16 + rnd() * 32;
          const h = base * (0.6 + centrality * 0.8) + (rnd() < 0.08 ? 18 : 0);
          const x0 = side === 1 ? x : -x - w;
          buildings.push({ i: buildings.length, x0, z0, w, d, h, side, front: row === 0, tint: rnd() });
        }
        x += w + 1.5 + rnd() * 2;
        row++;
      }
    }
  }

  const districtIds = buildings.filter((b) => b.front && b.z0 + b.d > -70 && b.z0 < 40).map((b) => b.i);
  cached = { buildings, districtIds };
  return cached;
}

/** Point on the avenue-facing wall of a building, at a given height fraction. */
export function facadePoint(b: Building, heightFrac: number, alongFrac: number) {
  const x = b.side === 1 ? b.x0 : b.x0 + b.w;
  return { x, y: Math.min(b.h - 1, 3 + heightFrac * (b.h - 4)), z: b.z0 + alongFrac * b.d };
}
