import type { HeroAnim } from '../battle/BattleSim';
import { RIG, type HeroRig, type JointName } from './buildHero';
import type { HeroSpec } from './heroes';

// Procedural animation for the generic hero rig. Facing is +Z; a negative X
// rotation swings a limb forward. `t` = time in the current animation,
// `clock` = global playback time (frozen while paused).

const ROT_JOINTS: JointName[] = [
  'hips', 'torso', 'head', 'armL', 'foreL', 'armR', 'foreR', 'legL', 'shinL', 'legR', 'shinR',
  'legFL', 'shinFL', 'legFR', 'shinFR', 'legBL', 'shinBL', 'legBR', 'shinBR', 'horseTail',
  'wingL', 'wingR', 'wing2L', 'wing2R', 'tail', 'cape', 'hairBack', 'horse',
];

export function poseHero(rig: HeroRig, spec: HeroSpec, anim: HeroAnim, t: number, clock: number, seed = 0) {
  const j = rig.j;
  const S = Math.sin;
  for (const n of ROT_JOINTS) j[n].rotation.set(0, 0, 0);
  const centaur = spec.anatomy === 'centaur';
  const restHip = centaur ? 1.42 : RIG.hipY;
  j.hips.position.y = restHip;
  rig.body.position.y = 0;
  const c = clock + seed * 1.7;
  const heavy = spec.body.height > 1.3 ? 0.6 : 1; // big heroes move slower
  const bipedLegs = !centaur;

  // ---------------- upper body + legs by animation
  switch (anim) {
    case 'idle':
    case 'gallery': {
      const b = S(c * 1.6 * heavy) * 0.02;
      j.torso.rotation.x = 0.02 + b;
      j.head.rotation.y = S(c * 0.37) * 0.18;
      j.head.rotation.x = S(c * 0.23) * 0.04;
      j.armL.rotation.z = 0.14 + b;
      j.armR.rotation.z = -0.14 - b;
      j.foreL.rotation.x = j.foreR.rotation.x = -0.2;
      if (bipedLegs) {
        j.legL.rotation.z = 0.05;
        j.legR.rotation.z = -0.05;
        j.hips.position.y = restHip + b * 0.4;
      }
      if (spec.id === 'paladin' || spec.id === 'enforcer') {
        j.armR.rotation.set(-0.25, 0, -0.25);
        j.foreR.rotation.x = -0.5;
      }
      if (spec.id === 'maltese-cross') {
        j.armL.rotation.set(-0.35, 0, 0.35);
        j.foreL.rotation.set(-1.2, 0, 0);
      }
      if (spec.id === 'melody') {
        j.armR.rotation.set(-1.4, 0, -0.5);
        j.foreR.rotation.x = -1.4;
      }
      if (spec.id === 'dragon-ceasar') {
        j.armL.rotation.set(-1.0, 0, 0.3);
        j.foreL.rotation.x = -1.3;
        j.armR.rotation.set(-0.5, 0, -0.4);
        j.foreR.rotation.x = -1.6;
        if (bipedLegs) {
          j.legL.rotation.set(-0.35, 0, 0.25);
          j.shinL.rotation.x = 0.5;
          j.legR.rotation.set(0.2, 0, -0.25);
          j.shinR.rotation.x = 0.35;
          j.hips.position.y = restHip - 0.07;
        }
      }
      break;
    }
    case 'run': {
      const w = t * 11 * heavy;
      if (bipedLegs) {
        j.legL.rotation.x = S(w) * 0.9;
        j.legR.rotation.x = -S(w) * 0.9;
        j.shinL.rotation.x = Math.max(0, -S(w + 1.2)) * 1.3;
        j.shinR.rotation.x = Math.max(0, S(w + 1.2)) * 1.3;
        j.hips.position.y = restHip - 0.03 + Math.abs(S(w)) * 0.07;
      }
      j.armL.rotation.x = -S(w) * 0.8;
      j.armR.rotation.x = S(w) * 0.8;
      j.foreL.rotation.x = j.foreR.rotation.x = -1.1;
      j.torso.rotation.x = 0.28;
      break;
    }
    case 'shield': {
      const brace = S(c * 9) * 0.015;
      if (bipedLegs) {
        j.legL.rotation.set(-0.5, 0, 0.18);
        j.shinL.rotation.x = 0.6;
        j.legR.rotation.set(0.35, 0, -0.18);
        j.shinR.rotation.x = 0.25;
        j.hips.position.y = restHip - 0.12;
      }
      j.torso.rotation.x = 0.2 + brace;
      j.armL.rotation.set(-1.45, 0, -0.35);
      j.foreL.rotation.set(-0.6, 0, 0);
      j.armR.rotation.set(-0.3, 0, -0.35);
      j.foreR.rotation.x = -1.2;
      break;
    }
    case 'lift': {
      // both arms overhead (Gigantic holding debris)
      j.armL.rotation.set(-2.9, 0, -0.25);
      j.armR.rotation.set(-2.9, 0, 0.25);
      j.foreL.rotation.x = j.foreR.rotation.x = -0.35;
      if (bipedLegs) {
        j.legL.rotation.set(-0.2, 0, 0.2);
        j.legR.rotation.set(0.15, 0, -0.2);
        j.shinL.rotation.x = j.shinR.rotation.x = 0.3;
        j.hips.position.y = restHip - 0.06 + S(c * 3) * 0.01;
      }
      break;
    }
    case 'leap': {
      if (bipedLegs) {
        j.legL.rotation.x = -1.2;
        j.shinL.rotation.x = 1.8;
        j.legR.rotation.x = -0.4;
        j.shinR.rotation.x = 1.2;
      }
      j.armR.rotation.set(-2.6, 0, 0);
      j.foreR.rotation.x = -0.4;
      j.armL.rotation.set(-0.6, 0, 0.6);
      j.torso.rotation.x = 0.4;
      break;
    }
    case 'punch': {
      const k = Math.min(1, t * 6);
      j.armR.rotation.set(-1.55 * k, 0, 0);
      j.foreR.rotation.x = -0.1;
      j.armL.rotation.set(-0.9, 0, 0.3);
      j.foreL.rotation.x = -1.6;
      j.torso.rotation.set(0.3, -0.5 * k, 0);
      if (bipedLegs) {
        j.legL.rotation.x = -0.9;
        j.shinL.rotation.x = 1.2;
        j.legR.rotation.x = 0.3;
      }
      break;
    }
    case 'hover':
    case 'fly': {
      rig.body.position.y = S(c * 2.2) * 0.1;
      if (bipedLegs) {
        j.legL.rotation.x = -0.15;
        j.shinL.rotation.x = 0.45;
        j.legR.rotation.x = 0.12;
        j.shinR.rotation.x = 0.75;
      }
      if (anim === 'fly') {
        j.torso.rotation.x = 0.55;
        j.armR.rotation.set(-2.9, 0, 0.1);
        j.armL.rotation.set(0.3, 0, 0.3);
      } else {
        j.armL.rotation.set(0, 0, 0.55);
        j.armR.rotation.set(0, 0, -0.55);
        j.torso.rotation.x = 0.1;
      }
      j.foreL.rotation.x = j.foreR.rotation.x = -0.3;
      break;
    }
    case 'cast':
    case 'heal': {
      const recoil = Math.max(0, 1 - t * 4);
      if (anim === 'heal') {
        j.armL.rotation.set(-1.4, 0, -0.5);
        j.armR.rotation.set(-1.4, 0, 0.5);
        j.foreL.rotation.x = j.foreR.rotation.x = -0.2;
        j.head.rotation.x = 0.15;
      } else {
        j.armR.rotation.set(-1.55 + recoil * 0.3, 0, 0);
        j.foreR.rotation.x = -0.05;
        j.armL.rotation.set(0.45, 0, 0.5);
        j.foreL.rotation.x = -0.6;
        j.torso.rotation.set(0.08 - recoil * 0.12, -0.35, 0);
      }
      if (bipedLegs) {
        j.legL.rotation.x = -0.35;
        j.shinL.rotation.x = 0.35;
        j.legR.rotation.x = 0.25;
        j.hips.position.y = restHip - 0.04;
      }
      if (spec.flies) rig.body.position.y = S(c * 2.2) * 0.1;
      break;
    }
    case 'charge': {
      const shake = S(c * 40) * 0.03;
      j.armL.rotation.set(-1.5, 0, -0.25 + shake);
      j.armR.rotation.set(-1.5, 0, 0.25 - shake);
      j.foreL.rotation.x = j.foreR.rotation.x = -0.1;
      j.torso.rotation.x = -0.15 + shake;
      j.head.rotation.x = -0.2;
      if (bipedLegs) {
        j.legL.rotation.x = 0.3;
        j.legR.rotation.x = -0.2;
        j.shinL.rotation.x = j.shinR.rotation.x = 0.5;
      }
      break;
    }
    case 'fall': {
      j.armL.rotation.set(-2.8, 0, 0.2);
      j.armR.rotation.set(-0.4, 0, -0.9);
      if (bipedLegs) {
        j.legL.rotation.x = -0.3;
        j.shinL.rotation.x = 0.6;
        j.legR.rotation.x = 0.2;
      }
      break;
    }
    case 'land': {
      const up = Math.max(0, (t - 0.45) / 0.45);
      const k = 1 - Math.min(1, up);
      if (bipedLegs) {
        j.hips.position.y = restHip - 0.48 * k;
        j.legL.rotation.x = -1.4 * k;
        j.shinL.rotation.x = 1.9 * k;
        j.legR.rotation.x = 0.7 * k;
        j.shinR.rotation.x = 1.9 * k;
      }
      j.torso.rotation.x = 0.7 * k;
      j.armR.rotation.set(-0.9 * k, 0, -0.2);
      j.foreR.rotation.x = -0.2;
      j.armL.rotation.set(0.6 * k, 0, 0.6 * k);
      j.head.rotation.x = -0.4 * k;
      break;
    }
    case 'hidden':
      break;
  }

  // ---------------- centaur legs
  if (centaur) {
    const moving = anim === 'run' || anim === 'leap';
    const w = (moving ? t * 9 : 0);
    if (moving) {
      // rotary gallop
      const legs: [JointName, JointName, number][] = [['legFL', 'shinFL', 0], ['legFR', 'shinFR', 0.4], ['legBL', 'shinBL', 2.2], ['legBR', 'shinBR', 2.6]];
      for (const [l, sh, ph] of legs) {
        j[l].rotation.x = S(w + ph) * 0.7;
        j[sh].rotation.x = Math.max(0, S(w + ph + 1.2)) * (l.startsWith('legF') ? -1.2 : 1.1);
      }
      j.horse.rotation.x = S(w * 2) * 0.04;
      rig.body.position.y = Math.abs(S(w)) * 0.12;
    } else {
      const shift = S(c * 0.8) * 0.04;
      j.legFL.rotation.x = shift;
      j.legBR.rotation.x = -shift;
      if (anim === 'shield' || anim === 'punch') {
        j.legFL.rotation.x = -0.9;
        j.shinFL.rotation.x = -1.4;
      }
    }
    j.horseTail.rotation.x = 0.2 + S(c * 2.1) * 0.12 + (moving ? 0.5 : 0);
    j.horseTail.rotation.z = S(c * 1.3) * 0.15;
  }

  // ---------------- secondary motion
  const flying = anim === 'fly' || anim === 'hover' || ((anim === 'cast' || anim === 'charge') && spec.flies);
  const flap = flying ? S(c * (spec.id === 'mariposa' ? 14 : 5)) : S(c * 1.2) * 0.25;
  const open = flying ? 1 : 0.35;
  j.wingL.rotation.y = -0.3 - flap * 0.35 * open;
  j.wingR.rotation.y = 0.3 + flap * 0.35 * open;
  j.wingL.rotation.z = -0.1 + (1 - open) * -0.5;
  j.wingR.rotation.z = 0.1 + (1 - open) * 0.5;
  j.wing2L.rotation.y = j.wingL.rotation.y * 0.9;
  j.wing2R.rotation.y = j.wingR.rotation.y * 0.9;
  j.tail.rotation.y = S(c * 1.7) * 0.35;
  j.tail.rotation.x = S(c * 1.1) * 0.12;
  const speed = anim === 'run' || anim === 'fly' || anim === 'leap' || anim === 'fall' ? 1 : 0;
  j.cape.rotation.x = 0.12 + speed * 0.75 + S(c * 2.3) * 0.06;
  j.hairBack.rotation.x = 0.08 + speed * 0.45 + S(c * 1.9) * 0.05 + (spec.id === 'tsunami' ? S(c * 1.1) * 0.15 : 0);
  j.hairBack.rotation.z = S(c * 1.3) * 0.06;
  j.drones.rotation.y = c * 0.9;
  j.propL.position.y = 2.2 + S(c * 2) * 0.15;
  j.propR.position.y = 2.4 + S(c * 2 + 1) * 0.15;
}
