// Optional GLB/GLTF replacements for the procedural placeholder heroes.
//
// Add an entry keyed by hero id (see src/characters/heroes.ts) to load a real
// model from /public/models instead. `clips` maps the simulation's animation
// names to clip names inside the file. See docs/ASSETS.md.

import type { HeroAnim } from '../battle/BattleSim';

export interface CharacterConfig {
  model: string | null;
  scale: number;
  /** Rotation (radians) applied so the model faces +Z. */
  yawOffset: number;
  clips: Partial<Record<HeroAnim, string>>;
}

export const MODEL_OVERRIDES: Partial<Record<string, CharacterConfig>> = {
  // paladin: {
  //   model: '/models/paladin.glb',
  //   scale: 1,
  //   yawOffset: 0,
  //   clips: { idle: 'Idle', run: 'Run', shield: 'Block', leap: 'Jump', punch: 'Slash', fall: 'Fall', land: 'Land' },
  // },
};
