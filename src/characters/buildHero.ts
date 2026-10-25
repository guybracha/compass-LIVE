import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { HeroSpec, Part } from './heroes';

// Procedural, stylized ("anime-inspired toon") character builder.
//
// One builder serves all 20 heroes: shared humanoid proportions plus anatomy
// variants (centaur, mecha, dragon), hairstyles and accessories, all driven by
// the HeroSpec data. Geometry is merged per joint and per material, so a hero
// costs roughly 20–35 draw calls regardless of how many parts it has.

export const RIG = {
  hipY: 1.0,
  torsoY: 0.05,
  shoulderY: 0.6,
  neckY: 0.74,
  headR: 0.13,
  scale: 0.9,
};

/** World height of the hero's eye line, used by the camera. */
export function headHeight(spec: HeroSpec) {
  const hip = spec.anatomy === 'centaur' ? 1.42 : RIG.hipY;
  return (hip + RIG.torsoY + RIG.neckY + 0.15) * RIG.scale * spec.body.height;
}

export interface HeroRig {
  root: THREE.Group;
  body: THREE.Group;
  j: Record<JointName, THREE.Group>;
  /** materials that pulse with the hero's power */
  glow: THREE.MeshBasicMaterial[];
  dispose: () => void;
}

export type JointName =
  | 'hips' | 'torso' | 'head' | 'armL' | 'foreL' | 'armR' | 'foreR' | 'legL' | 'shinL' | 'legR' | 'shinR'
  | 'horse' | 'legFL' | 'shinFL' | 'legFR' | 'shinFR' | 'legBL' | 'shinBL' | 'legBR' | 'shinBR' | 'horseTail'
  | 'wingL' | 'wingR' | 'wing2L' | 'wing2R' | 'tail' | 'cape' | 'hairBack' | 'drones' | 'propR' | 'propL';

// ------------------------------------------------------------------ materials

const gradientMap = (() => {
  const t = new THREE.DataTexture(new Uint8Array([70, 150, 255]), 3, 1, THREE.RedFormat);
  t.minFilter = t.magFilter = THREE.NearestFilter;
  t.needsUpdate = true;
  return t;
})();

function toon(color: string, rim = 0.45, extra: Partial<THREE.MeshToonMaterialParameters> = {}) {
  const m = new THREE.MeshToonMaterial({ color, gradientMap, ...extra });
  const rimColor = new THREE.Color('#8fb0ff').multiplyScalar(rim);
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uRim = { value: rimColor };
    sh.fragmentShader =
      'uniform vec3 uRim;\n' +
      sh.fragmentShader.replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
         float fres = pow(1.0 - abs(dot(normalize(vViewPosition), normal)), 3.0);
         totalEmissiveRadiance += uRim * fres;`,
      );
  };
  m.customProgramCacheKey = () => 'toon-rim';
  return m;
}

function glowMat(color: string, intensity = 2.2, opts: Partial<THREE.MeshBasicMaterialParameters> = {}) {
  const c = new THREE.Color(color).multiplyScalar(intensity);
  return new THREE.MeshBasicMaterial({ color: c, toneMapped: false, ...opts });
}

function stripeTexture(a: string, b: string) {
  const c = document.createElement('canvas');
  c.width = 4;
  c.height = 64;
  const g = c.getContext('2d')!;
  for (let i = 0; i < 8; i++) {
    g.fillStyle = i % 2 ? b : a;
    g.fillRect(0, i * 8, 4, 8);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.magFilter = THREE.NearestFilter;
  return t;
}

// ------------------------------------------------------------------ geometry helpers

const m4 = new THREE.Matrix4();
const q = new THREE.Quaternion();
const e = new THREE.Euler();
const v = new THREE.Vector3();
const s = new THREE.Vector3();

type V3 = [number, number, number];
function place(g: THREE.BufferGeometry, p: V3 = [0, 0, 0], r: V3 = [0, 0, 0], sc: V3 = [1, 1, 1]) {
  q.setFromEuler(e.set(r[0], r[1], r[2]));
  g.applyMatrix4(m4.compose(v.set(...p), q, s.set(...sc)));
  return g;
}
const sphere = (r: number, ws = 14, hs = 10, ps = 0, pl = Math.PI * 2, ts = 0, tl = Math.PI) => new THREE.SphereGeometry(r, ws, hs, ps, pl, ts, tl);
const box = (x: number, y: number, z: number) => new THREE.BoxGeometry(x, y, z);
const cyl = (rt: number, rb: number, h: number, seg = 12, open = false) => new THREE.CylinderGeometry(rt, rb, h, seg, 1, open);
const cone = (r: number, h: number, seg = 8) => new THREE.ConeGeometry(r, h, seg);
/** tapered limb hanging down from the joint origin */
const limb = (rTop: number, rBot: number, len: number) => place(cyl(rBot, rTop, len, 12), [0, -len / 2, 0]);

class Collector {
  map = new Map<THREE.Object3D, Map<THREE.Material, THREE.BufferGeometry[]>>();
  add(joint: THREE.Object3D, mat: THREE.Material, geo: THREE.BufferGeometry) {
    let byMat = this.map.get(joint);
    if (!byMat) this.map.set(joint, (byMat = new Map()));
    let list = byMat.get(mat);
    if (!list) byMat.set(mat, (list = []));
    let g = geo.index ? geo.toNonIndexed() : geo;
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    for (const name of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(name)) g.deleteAttribute(name);
    if (!g.attributes.normal) g.computeVertexNormals();
    if (g !== geo) geo.dispose();
    g = g as THREE.BufferGeometry;
    list.push(g);
  }
  build(shadows: boolean) {
    const geos: THREE.BufferGeometry[] = [];
    for (const [joint, byMat] of this.map) {
      for (const [mat, list] of byMat) {
        const merged = list.length === 1 ? list[0] : mergeGeometries(list, false)!;
        list.forEach((g) => g !== merged && g.dispose());
        const mesh = new THREE.Mesh(merged, mat);
        mesh.castShadow = shadows && !(mat as THREE.MeshBasicMaterial).transparent;
        mesh.frustumCulled = false;
        joint.add(mesh);
        geos.push(merged);
      }
    }
    return geos;
  }
}

// ------------------------------------------------------------------ builder

export function buildHero(spec: HeroSpec, opts: { shadows?: boolean } = {}): HeroRig {
  const C = spec.colors;
  const B = spec.body;
  const fem = B.feminine;
  const has = <K extends Part['k']>(k: K) => spec.parts.find((p) => p.k === k) as Extract<Part, { k: K }> | undefined;
  const mats: THREE.Material[] = [];
  const track = <T extends THREE.Material>(m: T) => (mats.push(m), m);

  const M = {
    skin: track(toon(C.skin, 0.35)),
    suit: track(toon(C.suit)),
    sleeves: track(toon(C.sleeves ?? C.suit)),
    legs: track(toon(C.legs ?? C.suit)),
    accent: track(toon(C.accent, 0.5)),
    accent2: track(toon(C.accent2 ?? C.accent, 0.5)),
    gloves: track(toon(C.gloves ?? C.suit)),
    boots: track(toon(C.boots ?? C.suit)),
    belt: track(toon(C.belt ?? C.accent)),
    hair: track(toon(C.hair, 0.6)),
    hair2: track(toon(C.hair2 ?? C.hair, 0.6)),
    metal: track(toon('#b8c0cc', 0.8)),
    dark: track(toon('#16171c', 0.3)),
    white: track(new THREE.MeshBasicMaterial({ color: '#f4f4f4' })),
    iris: track(new THREE.MeshBasicMaterial({ color: C.eyes })),
    pupil: track(new THREE.MeshBasicMaterial({ color: '#0a0a0e' })),
    mouth: track(new THREE.MeshBasicMaterial({ color: '#5a2a26' })),
    glow: track(glowMat(C.glow, 2.2)),
  };
  const glow: THREE.MeshBasicMaterial[] = [M.glow as THREE.MeshBasicMaterial];

  // stripes (Gigantic) live on the torso material
  const stripes = has('stripes');
  if (stripes) (M.suit as THREE.MeshToonMaterial).map = stripeTexture(C.suit, stripes.color);
  if (stripes) (M.suit as THREE.MeshToonMaterial).color.set('#ffffff');

  // ---- joints
  const root = new THREE.Group();
  const body = new THREE.Group();
  body.scale.setScalar(RIG.scale * B.height);
  root.add(body);
  const J = {} as Record<JointName, THREE.Group>;
  const joint = (name: JointName, parent: THREE.Object3D, p: V3) => {
    const g = new THREE.Group();
    g.name = name;
    g.position.set(...p);
    parent.add(g);
    J[name] = g;
    return g;
  };

  const centaur = spec.anatomy === 'centaur';
  const mecha = spec.anatomy === 'mecha';
  const dragon = spec.anatomy === 'dragon';
  const hipY = centaur ? 1.42 : RIG.hipY;
  const bulk = B.bulk;
  const mus = B.muscle;

  joint('hips', body, [0, hipY, centaur ? 0.42 : 0]);
  joint('torso', J.hips, [0, RIG.torsoY, 0]);
  joint('head', J.torso, [0, RIG.neckY, 0.01]);
  const shX = 0.2 * bulk + (mecha ? 0.06 : 0);
  joint('armL', J.torso, [shX, RIG.shoulderY, 0]);
  joint('armR', J.torso, [-shX, RIG.shoulderY, 0]);
  joint('foreL', J.armL, [0, -0.3, 0]);
  joint('foreR', J.armR, [0, -0.3, 0]);
  joint('hairBack', J.head, [0, 0.2, -0.1]);
  joint('cape', J.torso, [0, 0.66, -0.14]);
  joint('wingL', J.torso, [0.08, 0.5, -0.15]);
  joint('wingR', J.torso, [-0.08, 0.5, -0.15]);
  joint('wing2L', J.torso, [0.06, 0.38, -0.15]);
  joint('wing2R', J.torso, [-0.06, 0.38, -0.15]);
  joint('tail', J.hips, [0, -0.05, -0.12]);
  joint('drones', root, [0, 0, 0]);
  joint('propL', J.drones, [0.9, 2.2, 0.3]);
  joint('propR', J.drones, [-0.9, 2.4, -0.3]);
  const hipW = (fem ? 0.115 : 0.1) * Math.max(0.9, bulk * 0.9);
  if (!centaur) {
    joint('legL', J.hips, [hipW, -0.06, 0]);
    joint('legR', J.hips, [-hipW, -0.06, 0]);
    joint('shinL', J.legL, [0, -0.47, 0]);
    joint('shinR', J.legR, [0, -0.47, 0]);
  } else {
    joint('horse', body, [0, 0, 0]);
    joint('legFL', J.horse, [0.17, 1.08, 0.2]);
    joint('legFR', J.horse, [-0.17, 1.08, 0.2]);
    joint('legBL', J.horse, [0.17, 1.08, -0.85]);
    joint('legBR', J.horse, [-0.17, 1.08, -0.85]);
    joint('shinFL', J.legFL, [0, -0.5, 0.02]);
    joint('shinFR', J.legFR, [0, -0.5, 0.02]);
    joint('shinBL', J.legBL, [0, -0.5, -0.04]);
    joint('shinBR', J.legBR, [0, -0.5, -0.04]);
    joint('horseTail', J.horse, [0, 1.3, -1.22]);
  }
  // keep unused joints defined so posing code never has to null-check
  for (const n of ['legL', 'legR', 'shinL', 'shinR', 'horse', 'legFL', 'shinFL', 'legFR', 'shinFR', 'legBL', 'shinBL', 'legBR', 'shinBR', 'horseTail'] as JointName[])
    if (!J[n]) J[n] = new THREE.Group();

  const col = new Collector();
  const add = (jn: JointName, mat: THREE.Material, g: THREE.BufferGeometry) => col.add(J[jn], mat, g);

  // ---- legs (biped)
  if (!centaur) {
    const legMat = B.bareLegs ? M.skin : M.legs;
    for (const [leg, shin, side] of [['legL', 'shinL', 1], ['legR', 'shinR', -1]] as const) {
      add(leg, legMat, limb(0.105 * mus, 0.072 * mus, 0.47));
      add(leg, legMat, place(sphere(0.105 * mus), [0, 0, 0]));
      add(shin, legMat, place(sphere(0.074 * mus), [0, 0, 0]));
      add(shin, legMat, limb(0.074 * mus, 0.052 * mus, 0.44));
      if (B.bareFeet) {
        add(shin, M.skin, place(box(0.09, 0.05, 0.2), [0, -0.46, 0.05]));
      } else {
        const heel = fem && !has('ninja-mask') && !mecha;
        add(shin, M.boots, place(cyl(0.068 * mus, 0.06 * mus, heel ? 0.3 : 0.24, 12), [0, heel ? -0.3 : -0.33, 0]));
        add(shin, M.boots, place(box(0.11 * Math.max(1, mus * 0.9), 0.08, 0.24), [0, -0.46, 0.045]));
        if (heel) add(shin, M.boots, place(cyl(0.012, 0.018, 0.07, 6), [0, -0.5, -0.06]));
      }
      if (mecha) {
        add(leg, M.suit, place(box(0.22, 0.34, 0.24), [0, -0.24, 0.01]));
        add(shin, M.suit, place(box(0.2, 0.34, 0.24), [0, -0.2, 0.02]));
        add(shin, M.boots, place(box(0.22, 0.12, 0.36), [0, -0.45, 0.06]));
        add(shin, M.accent2, place(box(0.16, 0.12, 0.05), [0, -0.12, 0.14]));
      }
      void side;
    }
    const kp = has('knee-pads');
    if (kp) for (const sh of ['shinL', 'shinR'] as const) add(sh, track(toon(kp.color, 0.5)), place(box(0.11, 0.1, 0.06), [0, 0.0, 0.075 * mus]));
    if (has('cargo-pockets')) for (const [lg, sd] of [['legL', 1], ['legR', -1]] as const) add(lg, M.legs, place(box(0.05, 0.12, 0.1), [sd * 0.09 * mus, -0.28, 0]));
  }

  // ---- centaur horse body
  if (centaur) {
    const coat = M.boots;
    add('horse', coat, place(new THREE.CapsuleGeometry(0.3, 0.75, 6, 14), [0, 1.18, -0.36], [Math.PI / 2, 0, 0], [1, 1, 0.95]));
    add('horse', coat, place(sphere(0.3), [0, 1.25, 0.15], [0, 0, 0], [0.95, 1.05, 0.9]));
    add('horse', coat, place(sphere(0.28), [0, 1.2, -0.85], [0, 0, 0], [1.05, 1, 1]));
    for (const [lg, sh] of [['legFL', 'shinFL'], ['legFR', 'shinFR'], ['legBL', 'shinBL'], ['legBR', 'shinBR']] as const) {
      const back = lg.startsWith('legB');
      add(lg, coat, limb(back ? 0.11 : 0.09, 0.06, 0.5));
      add(lg, coat, place(sphere(back ? 0.12 : 0.1), [0, 0, 0]));
      add(sh, coat, limb(0.055, 0.045, 0.5));
      add(sh, coat, place(sphere(0.055), [0, 0, 0]));
      add(sh, M.dark, place(cyl(0.06, 0.07, 0.08, 10), [0, -0.53, 0.01]));
    }
    // tail
    const tailMat = spec.gender === 'female' ? M.hair : M.dark;
    for (let i = 0; i < 4; i++) add('horseTail', tailMat, place(cone(0.07 - i * 0.008, 0.36, 8), [0, -0.12 - i * 0.18, -0.05 - i * 0.05], [Math.PI - 0.35, 0, 0]));
    // human/horse join (coat-coloured "skirt" of fur up to the waist)
    add('hips', coat, place(cyl(0.16 * bulk, 0.26, 0.24, 14), [0, -0.08, 0]));
  }

  // ---- pelvis + torso
  const chestMat = B.bareChest ? M.skin : M.suit;
  add('hips', M.legs, place(sphere(0.15), [0, -0.01, 0], [0, 0, 0], [(fem ? 1.12 : 1.0) * Math.max(0.95, bulk * 0.85), 0.75, 0.82]));
  add('torso', chestMat, place(cyl(0.135 * bulk * (fem ? 0.82 : 1), 0.13 * (fem ? 1.0 : 1) * Math.max(0.95, bulk * 0.85), 0.32, 14), [0, 0.16, 0]));
  add('torso', chestMat, place(sphere(0.2), [0, 0.47, 0], [0, 0, 0], [bulk * (fem ? 0.84 : 1), 0.9, 0.66 * Math.max(1, mus * 0.85)]));
  if (!fem && mus > 1.05) for (const sd of [1, -1]) add('torso', chestMat, place(sphere(0.09 * mus), [sd * 0.075 * bulk, 0.5, 0.075], [0, 0, 0], [1.2, 0.8, 0.6]));
  if (fem) for (const sd of [1, -1]) add('torso', chestMat, place(sphere(0.065), [sd * 0.065, 0.46, 0.09], [0, 0, 0], [1, 0.95, 0.85]));
  // neck
  add('torso', M.skin, place(cyl(0.055 * Math.max(1, mus * 0.95), 0.065 * Math.max(1, mus), 0.16, 10), [0, 0.7, 0]));
  // belt
  add('torso', M.belt, place(cyl(0.142 * Math.max(0.95, bulk * 0.85), 0.142 * Math.max(0.95, bulk * 0.85), 0.055, 16), [0, 0.03, 0]));
  if (has('planet-belt')) {
    add('torso', M.accent2, place(cyl(0.05, 0.05, 0.012, 6), [0, 0.03, 0.145], [Math.PI / 2, 0, 0]));
    add('torso', M.accent, place(new THREE.TorusGeometry(0.022, 0.004, 4, 16), [0, 0.03, 0.155], [0.4, 0, 0.3]));
  }

  // ---- arms
  const upperMat = B.sleeves === 'full' ? M.sleeves : B.sleeves === 'short' ? M.sleeves : M.skin;
  const lowerMat = B.sleeves === 'full' ? M.sleeves : M.skin;
  for (const [arm, fore, sd] of [['armL', 'foreL', 1], ['armR', 'foreR', -1]] as const) {
    const mechArm = has('mech-arm') && sd === 1;
    const um = mechArm ? M.metal : upperMat;
    const lm = mechArm ? M.metal : lowerMat;
    add(arm, B.sleeves === 'short' ? M.skin : um, limb(0.068 * mus, 0.055 * mus, 0.3));
    if (B.sleeves === 'short') add(arm, M.sleeves, place(cyl(0.075 * mus, 0.07 * mus, 0.13, 12), [0, -0.05, 0]));
    add(arm, um, place(sphere(0.074 * mus), [0, 0, 0]));
    add(fore, lm, place(sphere(0.056 * mus), [0, 0, 0]));
    add(fore, lm, limb(0.056 * mus, 0.042 * mus, 0.27));
    // hand (fist)
    add(fore, mechArm ? M.metal : M.gloves, place(sphere(0.052 * Math.max(0.9, mus * 0.9)), [0, -0.31, 0.005], [0, 0, 0], [0.9, 1.15, 0.8]));
    if (B.sleeves !== 'full' && C.gloves && C.gloves !== C.skin) add(fore, M.gloves, place(cyl(0.05 * mus, 0.046 * mus, 0.12, 10), [0, -0.21, 0]));
    if (mechArm) {
      add(arm, glowMat(C.glow, 2.5), place(box(0.02, 0.06, 0.02), [0.06, -0.15, 0.03]));
      add(fore, M.dark, place(cyl(0.02, 0.02, 0.24, 6), [0.04, -0.13, -0.03]));
      add(fore, glowMat('#ff3a3a', 2), place(box(0.015, 0.04, 0.015), [0.03, -0.12, 0.045]));
      add(fore, glowMat('#3aff6a', 2), place(box(0.015, 0.04, 0.015), [0.03, -0.17, 0.045]));
    }
    if (mecha) {
      add(arm, M.suit, place(box(0.17, 0.26, 0.17), [0, -0.16, 0]));
      add(fore, M.suit, place(box(0.17, 0.24, 0.18), [0, -0.14, 0.01]));
      add(fore, M.gloves, place(box(0.13, 0.12, 0.11), [0, -0.33, 0.01]));
    }
  }
  const sp = has('shoulder-pads');
  if (sp) {
    const pm = track(toon(sp.color, 0.55));
    for (const [arm, sd] of [['armL', 1], ['armR', -1]] as const) {
      if (mecha) {
        // boxy mecha pauldrons
        add(arm, pm, place(box(0.26, 0.17, 0.28), [sd * 0.04, 0.04, 0], [0, 0, sd * -0.15]));
        if (sp.trim) add(arm, track(toon(sp.trim, 0.6)), place(box(0.27, 0.05, 0.29), [sd * 0.04, -0.05, 0], [0, 0, sd * -0.15]));
        continue;
      }
      add(arm, pm, place(sphere(0.1 * mus, 14, 8), [sd * 0.015, 0.015, 0], [0, 0, 0], [1.2, 0.85, 1.15]));
      if (sp.trim) add(arm, track(toon(sp.trim, 0.6)), place(new THREE.TorusGeometry(0.1 * mus, 0.012, 6, 18), [sd * 0.015, -0.02, 0], [Math.PI / 2, 0, 0], [1.15, 1.1, 1]));
    }
  }
  const ga = has('gauntlets');
  if (ga) {
    const gm = track(toon(ga.color, 0.55));
    for (const f of ['foreL', 'foreR'] as const) add(f, gm, place(cyl(0.064 * mus, 0.056 * mus, 0.16, 12), [0, -0.18, 0]));
  }
  const br = has('bracers');
  if (br) {
    const bm = track(toon(br.color, 0.6));
    for (const f of ['foreL', 'foreR'] as const) add(f, bm, place(cyl(0.06 * mus, 0.054 * mus, 0.11, 12), [0, -0.19, 0]));
  }
  if (has('wrist-device')) add('foreL', M.glow, place(box(0.06, 0.08, 0.02), [0.0, -0.17, 0.055]));

  // ---- head + face
  const hs = mecha ? 1.15 : 1;
  const headR = RIG.headR * hs;
  if (dragon) buildDragonHead();
  else {
    add('head', M.skin, place(sphere(headR, 20, 14), [0, 0.15, 0], [0, 0, 0], [0.92, 1.1, 1.0]));
    // jaw/chin
    add('head', M.skin, place(sphere(headR * 0.78, 14, 10), [0, 0.085, 0.025], [0, 0, 0], [fem ? 0.82 : 0.95, 0.8, 0.95]));
    if (!mecha) buildFace();
  }

  function buildFace() {
    const eyeY = 0.155;
    const eyeZ = headR * 0.86;
    const eyeX = 0.045;
    const big = fem ? 1.12 : 1;
    const masked = has('goggles');
    if (!masked) {
      for (const sd of [1, -1]) {
        add('head', M.white, place(sphere(0.026 * big, 12, 8), [sd * eyeX, eyeY, eyeZ - 0.004], [0, 0, 0], [1, 1.15, 0.45]));
        add('head', M.iris, place(sphere(0.017 * big, 10, 8), [sd * eyeX, eyeY - 0.002, eyeZ + 0.006], [0, 0, 0], [1, 1.25, 0.4]));
        add('head', M.pupil, place(sphere(0.008 * big, 8, 6), [sd * eyeX, eyeY - 0.002, eyeZ + 0.011], [0, 0, 0], [1, 1.3, 0.4]));
        // brows
        add('head', M.hair, place(box(0.042, 0.008, 0.01), [sd * eyeX, eyeY + 0.035, eyeZ + 0.002], [0, 0, sd * (fem ? 0.08 : -0.12)]));
      }
    }
    // nose + mouth
    add('head', M.skin, place(cone(0.012, 0.035, 6), [0, 0.12, headR * 0.98], [Math.PI / 2 + 0.3, 0, 0]));
    if (!has('ninja-mask')) add('head', M.mouth, place(box(0.034, 0.006, 0.008), [0, 0.085, headR * 0.9]));
    // ears
    if (has('fin-ears')) {
      for (const sd of [1, -1]) add('head', M.skin, place(cone(0.03, 0.12, 4), [sd * headR * 0.95, 0.17, -0.01], [0, 0, sd * -1.2], [0.4, 1, 1]));
      add('head', track(toon('#7fb8e0')), place(box(0.004, 0.04, 0.03), [0.105, 0.05, 0.02]));
    } else for (const sd of [1, -1]) add('head', M.skin, place(sphere(0.025, 8, 6), [sd * headR * 0.9, 0.145, 0], [0, 0, 0], [0.45, 1, 0.75]));
    if (has('birthmark')) add('head', track(toon('#a8323a', 0.2)), place(sphere(0.045, 10, 8), [-0.05, 0.15, headR * 0.72], [0, -0.35, 0], [1.1, 1.3, 0.35]));
    if (has('earrings')) for (const sd of [1, -1]) add('head', M.metal, place(new THREE.TorusGeometry(0.02, 0.003, 4, 12), [sd * headR * 0.92, 0.1, 0], [0, Math.PI / 2, 0]));
  }

  function buildDragonHead() {
    add('head', M.skin, place(sphere(headR, 18, 12), [0, 0.16, -0.01], [0, 0, 0], [0.95, 1.05, 1.05]));
    add('head', M.skin, place(box(0.12, 0.08, 0.17), [0, 0.12, 0.13], [0.1, 0, 0]));
    add('head', track(toon('#a8c890')), place(box(0.11, 0.03, 0.15), [0, 0.085, 0.13]));
    for (const sd of [1, -1]) {
      add('head', M.dark, place(sphere(0.008), [sd * 0.025, 0.155, 0.215]));
      add('head', glowMat(C.eyes, 2.4), place(sphere(0.018, 10, 8), [sd * 0.05, 0.19, 0.095], [0, 0, 0], [1.3, 0.7, 0.6]));
      add('head', track(toon('#b02a22', 0.5)), place(cone(0.025, 0.2, 8), [sd * 0.06, 0.32, -0.04], [-0.7, 0, sd * -0.25]));
      add('head', M.skin, place(cone(0.03, 0.1, 4), [sd * 0.12, 0.2, -0.03], [0, 0, sd * -1.1], [0.4, 1, 1]));
    }
    add('head', M.hair, place(cone(0.03, 0.08, 6), [0, 0.06, 0.16], [Math.PI, 0, 0]));
  }

  // ---- hair
  const hairStyle = spec.hair;
  const capR = headR * 1.06;
  const cap = (mat = M.hair, sy = 0.75) => add('head', mat, place(sphere(capR, 18, 10, ), [0, 0.19, -0.012], [0, 0, 0], [1.02, sy, 1.05]));
  const hairCone = (p: V3, r: V3, rad: number, len: number, mat = M.hair) => add('head', mat, place(cone(rad, len, 5), p, r));
  switch (hairStyle) {
    case 'short':
      cap();
      add('head', M.hair, place(box(0.2, 0.04, 0.05), [0, 0.25, 0.09], [0.4, 0, 0]));
      break;
    case 'swept':
      cap();
      for (const x of [-0.05, 0, 0.05]) hairCone([x, 0.3, 0.07], [-0.55, 0, x * -2], 0.045, 0.13);
      break;
    case 'slick':
      add('head', M.hair, place(sphere(capR, 18, 10), [0, 0.2, -0.02], [0, 0, 0], [1.02, 0.72, 1.08]));
      add('head', M.hair, place(sphere(capR * 0.9, 14, 8), [0, 0.22, 0.03], [0.4, 0, 0], [1, 0.5, 1]));
      break;
    case 'spiky':
    case 'flame': {
      cap(M.hair, 0.8);
      const n = hairStyle === 'flame' ? 13 : spec.id === 'gigantic' ? 9 : 12;
      const lenK = hairStyle === 'flame' ? 1.6 : spec.id === 'gigantic' ? 0.6 : 1.1;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 1.7 - Math.PI * 0.85;
        const mat = hairStyle === 'flame' && i % 2 ? M.hair2 : M.hair;
        hairCone([Math.sin(a) * 0.1, 0.28 + Math.cos(a) * 0.02, -0.015 + Math.cos(a) * 0.05], [-0.5 - Math.cos(a) * 0.3, 0, -a * 0.6], 0.04, (0.13 + (i % 3) * 0.04) * lenK, mat);
      }
      if (hairStyle === 'flame') {
        (M.hair as THREE.MeshToonMaterial).emissive.set(C.hair).multiplyScalar(0.55);
        (M.hair2 as THREE.MeshToonMaterial).emissive.set(C.hair2 ?? C.hair).multiplyScalar(0.8);
      }
      break;
    }
    case 'messy':
      cap();
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2;
        hairCone([Math.sin(a) * 0.11, 0.22 + Math.cos(i) * 0.03, Math.cos(a) * 0.11], [Math.cos(a) * 0.9, 0, -Math.sin(a) * 0.9], 0.04, 0.11);
      }
      break;
    case 'curly':
      for (let i = 0; i < 22; i++) {
        const a = (i / 22) * Math.PI * 2 * 2.3;
        const y = 0.17 + (i / 22) * 0.12;
        const rr = 0.125 - (i / 22) * 0.05;
        add('head', M.hair, place(sphere(0.045, 8, 6), [Math.sin(a) * rr, y, Math.cos(a) * rr - 0.01]));
      }
      add('head', M.hair, place(sphere(0.05, 8, 6), [0, 0.3, 0]));
      break;
    case 'afro':
      add('head', M.hair, place(sphere(0.24, 20, 14), [0, 0.31, -0.1], [0, 0, 0], [1.1, 0.95, 0.8]));
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * Math.PI * 2;
        add('head', i % 2 ? M.hair2 : track(toon('#f2c21b', 0.5)), place(sphere(0.07, 8, 6), [Math.sin(a) * 0.18, 0.44 + Math.cos(a * 2) * 0.03, Math.cos(a) * 0.13 - 0.06], [0, 0, 0], [1.3, 0.6, 1]));
      }
      break;
    case 'long':
    case 'wavy': {
      cap(M.hair, 0.82);
      const len = spec.id === 'hallethea' ? 1.0 : spec.id === 'mariposa' ? 0.55 : 0.6;
      // fringe / bangs
      if (spec.id === 'enforcer') add('head', M.hair, place(box(0.22, 0.05, 0.04), [0, 0.22, 0.11]));
      for (let i = 0; i < 7; i++) {
        const x = (i - 3) * 0.035;
        const wav = hairStyle === 'wavy' ? Math.sin(i * 1.7) * 0.03 : 0;
        add('hairBack', i % 3 === 1 ? M.hair2 : M.hair, place(new THREE.CapsuleGeometry(0.04, len, 3, 6), [x * 1.4, -len / 2 + 0.02, wav], [0, 0, x * 0.4], [1, 1, 0.8]));
      }
      for (const sd of [1, -1]) add('head', M.hair, place(new THREE.CapsuleGeometry(0.035, 0.24, 3, 6), [sd * 0.115, 0.06, 0.02], [0, 0, sd * 0.08]));
      break;
    }
    case 'bun':
      cap(M.hair, 0.82);
      add('head', M.hair, place(sphere(0.06, 10, 8), [0, 0.28, -0.11]));
      for (const sd of [1, -1]) add('head', M.hair, place(new THREE.CapsuleGeometry(0.025, 0.2, 3, 6), [sd * 0.11, 0.08, -0.02], [0.2, 0, sd * 0.1]));
      break;
    case 'ponytail': {
      if (!dragon) cap(M.hair, 0.82);
      else add('head', M.hair, place(sphere(capR * 0.7, 12, 8), [0, 0.26, -0.08], [0, 0, 0], [0.8, 0.6, 1]));
      add('head', M.accent, place(new THREE.TorusGeometry(0.028, 0.01, 6, 12), [0, 0.31, -0.08], [1.2, 0, 0]));
      const len = spec.id === 'lady-astral' ? 0.75 : 0.6;
      add('hairBack', M.hair, place(new THREE.CapsuleGeometry(0.055, len * 0.5, 4, 8), [0, 0.05 - len * 0.25, -0.02], [0.25, 0, 0]));
      add('hairBack', M.hair2, place(new THREE.CapsuleGeometry(0.045, len * 0.5, 4, 8), [0, 0.05 - len * 0.72, -0.1], [0.12, 0, 0]));
      break;
    }
    case 'none':
      break;
  }
  if (hairStyle === 'long' || hairStyle === 'wavy') J.hairBack.position.set(0, 0.23, -0.1);
  if (hairStyle === 'ponytail') J.hairBack.position.set(0, 0.3, -0.1);

  // ---- accessories
  for (const p of spec.parts) {
    switch (p.k) {
      case 'goggles':
        add('head', glowMat('#ffd23d', 2.4), place(box(0.2, 0.05, 0.05), [0, 0.158, headR * 0.86]));
        add('head', M.accent, place(new THREE.TorusGeometry(headR * 1.02, 0.012, 6, 24), [0, 0.158, 0], [Math.PI / 2, 0, 0]));
        for (const sd of [1, -1]) add('head', M.accent, place(cyl(0.035, 0.035, 0.03, 12), [sd * headR * 0.98, 0.158, 0.01], [0, 0, Math.PI / 2]));
        break;
      case 'hud-glasses':
        for (const sd of [1, -1]) {
          add('head', M.dark, place(new THREE.TorusGeometry(0.036, 0.006, 6, 18), [sd * 0.048, 0.155, headR * 0.95]));
          add('head', glowMat('#ff4a4a', 0.9, { transparent: true, opacity: 0.55 }), place(new THREE.CircleGeometry(0.034, 18), [sd * 0.048, 0.155, headR * 0.96]));
        }
        break;
      case 'eye-mask':
        add('head', track(toon(p.color, 0.5)), place(box(0.17, 0.045, 0.03), [0, 0.158, headR * 0.82], [0, 0, 0], [1, 1, 1]));
        for (const sd of [1, -1]) add('head', track(toon(p.color, 0.5)), place(cone(0.025, 0.06, 4), [sd * 0.1, 0.175, headR * 0.78], [0, 0, sd * -1.2]));
        break;
      case 'ninja-mask':
        add('head', M.suit, place(sphere(headR * 0.86, 14, 10), [0, 0.085, 0.03], [0, 0, 0], [1.02, 0.78, 1.05]));
        break;
      case 'hood':
        // hood open at the front (azimuth +Z) so the eyes stay visible above the mask
        add('head', M.suit, place(sphere(capR * 1.22, 18, 12, Math.PI / 2 + 0.95, Math.PI * 2 - 1.9, 0, Math.PI * 0.62), [0, 0.17, -0.025], [-0.15, 0, 0], [1.05, 1.1, 1.1]));
        add('head', M.suit, place(sphere(capR * 1.22, 18, 6, 0, Math.PI * 2, 0, Math.PI * 0.2), [0, 0.17, -0.025], [-0.15, 0, 0], [1.05, 1.1, 1.1]));
        add('torso', M.suit, place(cyl(0.12, 0.2, 0.14, 14, true), [0, 0.72, -0.02]));
        break;
      case 'astronaut-helmet':
        add('head', track(new THREE.MeshPhongMaterial({ color: '#cfe8ff', transparent: true, opacity: 0.18, shininess: 120, specular: '#ffffff', depthWrite: false })), place(sphere(headR * 1.6, 22, 16), [0, 0.16, 0.01]));
        add('head', M.suit, place(new THREE.TorusGeometry(headR * 1.25, 0.03, 8, 24), [0, -0.03, 0], [Math.PI / 2, 0, 0]));
        add('head', M.accent, place(new THREE.TorusGeometry(headR * 1.25, 0.012, 6, 24), [0, -0.0, 0], [Math.PI / 2, 0, 0]));
        add('head', M.suit, place(sphere(headR * 1.62, 22, 16, 0, Math.PI * 2, 0, Math.PI * 0.42), [0, 0.16, -0.02], [-1.0, 0, 0]));
        break;
      case 'antenna-helmet':
        add('head', M.suit, place(sphere(capR * 1.12, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.6), [0, 0.17, -0.01], [-0.28, 0, 0], [1.02, 1.08, 1.1]));
        for (const sd of [1, -1]) {
          add('head', M.metal, place(cyl(0.045, 0.045, 0.03, 14), [sd * capR * 1.05, 0.14, 0], [0, 0, Math.PI / 2]));
          add('head', M.metal, place(cone(0.022, 0.32, 8), [sd * 0.06, 0.45, -0.02], [-0.15, 0, sd * -0.22]));
          add('head', M.metal, place(sphere(0.022, 8, 6), [sd * 0.098, 0.61, -0.045]));
        }
        break;
      case 'phoenix-helmet':
        add('head', M.accent, place(box(0.22, 0.04, 0.05), [0, 0.215, headR * 0.82], [0.25, 0, 0]));
        for (const sd of [1, -1]) add('head', M.accent, place(cone(0.03, 0.16, 4), [sd * 0.1, 0.24, 0.06], [-0.3, 0, sd * -0.9]));
        add('head', M.accent, place(box(0.035, 0.11, 0.03), [0, 0.13, headR * 0.95]));
        break;
      case 'mecha-helmet':
        add('head', M.suit, place(box(0.26, 0.24, 0.27), [0, 0.15, 0]));
        add('head', M.accent, place(box(0.06, 0.06, 0.06), [0, 0.12, 0.14]));
        add('head', glowMat('#3fe0ff', 2.6), place(box(0.17, 0.035, 0.02), [0, 0.18, 0.137]));
        for (const sd of [1, -1]) add('head', M.accent, place(cone(0.02, 0.22, 4), [sd * 0.06, 0.32, 0.05], [-0.4, 0, sd * 0.5]));
        add('head', M.accent2, place(box(0.28, 0.06, 0.2), [0, 0.28, -0.02]));
        // pilot visible through the chest canopy would be overkill; a cyan core instead
        add('torso', glowMat('#3fe0ff', 2), place(sphere(0.05), [0, 0.46, 0.16]));
        add('torso', M.suit, place(box(0.46, 0.34, 0.3), [0, 0.42, 0]));
        add('torso', M.accent, place(box(0.3, 0.16, 0.06), [0, 0.32, 0.15]));
        add('torso', M.accent2, place(box(0.2, 0.12, 0.06), [0, 0.52, 0.15]));
        add('torso', track(toon('#f2c21b')), place(box(0.08, 0.05, 0.02), [0.13, 0.38, 0.18]));
        add('torso', track(toon('#f2c21b')), place(box(0.08, 0.05, 0.02), [-0.13, 0.38, 0.18]));
        break;
      case 'missile-pods':
        for (const sd of [1, -1]) {
          add('torso', M.metal, place(box(0.26, 0.24, 0.3), [sd * 0.3, 0.86, -0.12]));
          for (let r = 0; r < 3; r++)
            for (let c = 0; c < 3; c++) add('torso', M.accent, place(cyl(0.025, 0.025, 0.02, 10), [sd * 0.3 + (c - 1) * 0.07, 0.86 + (r - 1) * 0.07, 0.035], [Math.PI / 2, 0, 0]));
        }
        break;
      case 'galaxy-cape': {
        const capeMat = track(galaxyMaterial());
        add('cape', capeMat, place(new THREE.PlaneGeometry(0.62, 1.45, 1, 6), [0, -0.72, 0]));
        for (const sd of [1, -1]) add('cape', M.accent, place(box(0.04, 1.45, 0.02), [sd * 0.31, -0.72, 0]));
        break;
      }
      case 'wings':
        buildWings(p.style);
        break;
      case 'horn':
        add('head', glowMat(C.glow, 1.8, { transparent: true, opacity: 0.9 }), place(cone(0.022, 0.2, 8), [0, 0.29, headR * 0.72], [0.45, 0, 0]));
        break;
      case 'dragon-tail': {
        const curve = new THREE.CatmullRomCurve3([
          new THREE.Vector3(0, 0, 0),
          new THREE.Vector3(0, -0.35, -0.3),
          new THREE.Vector3(0.1, -0.75, -0.6),
          new THREE.Vector3(0.3, -0.95, -0.95),
        ]);
        add('tail', M.skin, new THREE.TubeGeometry(curve, 16, 0.06, 8, false));
        add('tail', M.hair, place(cone(0.07, 0.25, 8), [0.36, -0.98, -1.05], [Math.PI / 2 + 0.6, 0, 0]));
        break;
      }
      case 'emblem':
        buildEmblem(p.shape);
        break;
      case 'straps':
        for (const sd of [1, -1]) add('torso', M.accent, place(box(0.05, 0.6, 0.02), [0, 0.38, 0.14 * Math.max(1, mus * 0.85)], [0, 0, sd * 0.6]));
        add('torso', M.accent2, place(box(0.05, 0.05, 0.02), [0, 0.38, 0.16 * Math.max(1, mus * 0.85)], [0, 0, Math.PI / 4]));
        break;
      case 'collar':
        add('torso', track(toon(p.color)), place(cyl(0.075, 0.09, 0.09, 14, true), [0, 0.74, 0]));
        if (spec.id === 'jupiterian') for (const sd of [1, -1]) add('torso', glowMat('#a8d4ec', 2), place(box(0.02, 0.012, 0.01), [sd * 0.04, 0.76, 0.085]));
        break;
      case 'shells':
        for (const [x, y] of [[0.06, 0.52], [-0.06, 0.52], [0, 0.4], [0.1, 0.25], [-0.1, 0.25], [0.12, 0.05], [-0.12, 0.05]] as const)
          add('torso', track(toon('#f0b48a', 0.5)), place(sphere(0.025, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2), [x, y, 0.135], [Math.PI / 2, 0, 0], [1, 1, 0.5]));
        add('hips', M.suit, place(sphere(0.155, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), [0, -0.02, 0], [Math.PI, 0, 0], [1.08, 0.7, 0.85]));
        break;
      case 'mic':
        add('foreR', M.metal, place(cyl(0.012, 0.016, 0.13, 8), [0, -0.33, 0.04], [Math.PI / 2, 0, 0]));
        add('foreR', track(toon('#e8d8ff', 0.7)), place(sphere(0.025, 10, 8), [0, -0.33, 0.11]));
        break;
      case 'drones':
        for (const pr of ['propL', 'propR'] as const) {
          add(pr, M.metal, place(box(0.22, 0.05, 0.12), [0, 0, 0]));
          add(pr, glowMat('#3fe0ff', 2.2), place(box(0.08, 0.02, 0.02), [0, 0, 0.065]));
          for (const [x, z] of [[0.13, 0.08], [-0.13, 0.08], [0.13, -0.08], [-0.13, -0.08]] as const) add(pr, M.dark, place(cyl(0.05, 0.05, 0.005, 10), [x, 0.03, z]));
        }
        break;
      case 'vest':
        add('torso', M.suit, place(box(0.32, 0.36, 0.25), [0, 0.42, 0]));
        add('torso', M.accent, place(box(0.035, 0.36, 0.01), [0.08, 0.42, 0.128]));
        add('torso', M.accent, place(box(0.035, 0.36, 0.01), [-0.08, 0.42, 0.128]));
        add('torso', M.accent2, place(box(0.06, 0.04, 0.01), [0, 0.6, 0.12]));
        break;
      case 'chainmail':
        add('hips', M.sleeves, place(cyl(0.1, 0.15, 0.24, 12, true), [0, -0.14, 0.04], [0.1, 0, 0], [1, 1, 0.7]));
        break;
      case 'maltese-shield':
        buildShield();
        break;
      case 'sword':
      case 'katana':
        buildSword(p.k === 'katana');
        break;
      case 'skirt':
        if (p.style === 'tutu') {
          add('hips', M.suit, place(cyl(0.16, 0.36, 0.17, 20, true), [0, -0.09, 0]));
          add('hips', M.accent, place(cyl(0.2, 0.4, 0.12, 20, true), [0, -0.16, 0]));
          add('hips', M.accent2, place(new THREE.TorusGeometry(0.36, 0.008, 4, 28), [0, -0.175, 0], [Math.PI / 2, 0, 0]));
        } else if (p.style === 'leaf') {
          for (let i = 0; i < 8; i++) {
            const a = (i / 8) * Math.PI * 2;
            add('hips', M.accent, place(cone(0.1, 0.38, 4), [Math.sin(a) * 0.17, -0.2, Math.cos(a) * 0.15], [Math.PI + Math.cos(a) * 0.4, 0, -Math.sin(a) * 0.4], [1, 1, 0.35]));
          }
          add('hips', track(toon('#7a8ae8', 0.8)), place(cyl(0.15, 0.3, 0.2, 16, true), [0, -0.14, 0]));
        } else {
          add('hips', M.suit, place(box(0.16, 0.4, 0.02), [0, -0.22, 0.13]));
          add('hips', M.accent, place(box(0.05, 0.05, 0.01), [0, -0.12, 0.142], [0, 0, Math.PI / 4]));
        }
        break;
      default:
        break;
    }
  }

  function buildEmblem(shape: Extract<Part, { k: 'emblem' }>['shape']) {
    const z = 0.135 * Math.max(1, mus * 0.85) * (fem ? 1.0 : 1);
    const y = 0.48;
    switch (shape) {
      case 'bolt2':
        for (const sd of [1, -1]) {
          const gm = glowMat('#ffd23d', 1.8);
          add('torso', gm, place(box(0.025, 0.08, 0.01), [sd * 0.065 + 0.01, y + 0.04, z], [0, 0, -0.5]));
          add('torso', gm, place(box(0.025, 0.055, 0.01), [sd * 0.065, y, z], [0, 0, 1.1]));
          add('torso', gm, place(box(0.025, 0.08, 0.01), [sd * 0.065 - 0.01, y - 0.045, z], [0, 0, -0.5]));
        }
        break;
      case 'star': {
        const g = new THREE.ExtrudeGeometry(starShape(0.085, 0.035, 4), { depth: 0.012, bevelEnabled: false });
        add('torso', glowMat('#ff4a3a', 1.4), place(g, [0, y, z - 0.002]));
        const g2 = new THREE.ExtrudeGeometry(starShape(0.05, 0.02, 4), { depth: 0.012, bevelEnabled: false });
        add('torso', glowMat('#ffd23d', 1.6), place(g2, [0, y, z + 0.006], [0, 0, Math.PI / 4]));
        break;
      }
      case 'cross':
        add('torso', M.accent, malteseCross(0.11, [0, y, z]));
        break;
      case 'triangle': {
        const outer = new THREE.TorusGeometry(0.075, 0.014, 3, 3);
        add('torso', M.accent, place(outer, [0, y, z], [0, 0, -Math.PI / 2]));
        break;
      }
      case 'phoenix':
        for (const sd of [1, -1]) add('torso', glowMat('#ffb020', 1.6), place(cone(0.03, 0.17, 3), [sd * 0.065, y + 0.01, z], [0, 0, sd * 1.15], [1, 1, 0.2]));
        add('torso', glowMat('#ffd23d', 1.8), place(cone(0.025, 0.14, 3), [0, y - 0.04, z], [0, 0, Math.PI], [1, 1, 0.2]));
        break;
      case 'sigil': {
        const gm = glowMat('#5fe3ff', 2.4);
        add('torso', gm, place(new THREE.TorusGeometry(0.075, 0.007, 3, 3), [0, y, z], [0, 0, Math.PI / 2]));
        add('torso', gm, place(new THREE.TorusGeometry(0.075, 0.007, 3, 3), [0, y, z], [0, 0, -Math.PI / 2]));
        add('torso', gm, place(new THREE.TorusGeometry(0.035, 0.006, 3, 6), [0, y, z]));
        glow.push(gm);
        break;
      }
      case 'gem':
        add('torso', glowMat('#16ff8a', 1.3), place(new THREE.OctahedronGeometry(0.05), [0, y - 0.02, z + 0.01], [0, 0, 0], [1, 1.3, 0.5]));
        for (const sd of [1, -1]) add('torso', M.accent, place(new THREE.TorusGeometry(0.05, 0.008, 4, 10, Math.PI), [sd * 0.08, y, z - 0.005], [0, 0, sd * 1.2]));
        break;
      case 'notes':
        add('torso', M.accent2, place(new THREE.TorusGeometry(0.03, 0.006, 4, 10), [0.04, y - 0.02, z]));
        add('torso', M.accent2, place(box(0.006, 0.08, 0.006), [0.068, y + 0.02, z]));
        break;
    }
  }

  function malteseCross(size: number, at: V3) {
    const geos: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 4; i++) {
      const sh = new THREE.Shape();
      sh.moveTo(0, 0);
      sh.lineTo(-size * 0.55, size);
      sh.lineTo(0, size * 0.75);
      sh.lineTo(size * 0.55, size);
      sh.closePath();
      geos.push(place(new THREE.ShapeGeometry(sh), [0, 0, 0], [0, 0, (i * Math.PI) / 2]).toNonIndexed());
    }
    return place(mergeGeometries(geos)!, at);
  }

  function buildShield() {
    const sh = new THREE.Shape();
    sh.moveTo(-0.32, 0.36);
    sh.lineTo(0.32, 0.36);
    sh.quadraticCurveTo(0.34, -0.12, 0, -0.46);
    sh.quadraticCurveTo(-0.34, -0.12, -0.32, 0.36);
    const g = new THREE.ExtrudeGeometry(sh, { depth: 0.03, bevelEnabled: true, bevelSize: 0.025, bevelThickness: 0.02, bevelSegments: 1 });
    const grp: V3 = [0.09, -0.18, 0.02];
    const rot: V3 = [0, Math.PI / 2, 0];
    add('foreL', M.metal, place(g.clone(), grp, rot, [1.06, 1.06, 1]));
    add('foreL', M.accent, place(g, [grp[0] + 0.012, grp[1], grp[2]], rot));
    const cross = malteseCross(0.2, [0, 0, 0]);
    add('foreL', M.white, place(cross, [grp[0] + 0.065, grp[1] + 0.01, grp[2]], rot));
  }

  function buildSword(katana: boolean) {
    const blade = katana ? 0.95 : 1.15;
    const hand: JointName = 'foreR';
    const base: V3 = [0, -0.33, 0.03];
    const r: V3 = [2.0, 0, 0];
    add(hand, M.dark, place(cyl(0.018, 0.018, 0.2, 8), [base[0], base[1], base[2]], r));
    // guard + blade built along +Y then rotated with r
    const dir = new THREE.Vector3(0, 1, 0).applyEuler(new THREE.Euler(...r));
    const at = (d: number): V3 => [base[0] + dir.x * d, base[1] + dir.y * d, base[2] + dir.z * d];
    add(hand, katana ? M.dark : M.accent2, place(katana ? cyl(0.045, 0.045, 0.015, 12) : box(0.17, 0.03, 0.05), at(0.11), r));
    add(hand, M.metal, place(box(katana ? 0.035 : 0.06, blade, 0.012), at(0.11 + blade / 2), r));
    add(hand, katana ? M.white : M.glow, place(box(0.008, blade * 0.95, 0.014), at(0.11 + blade / 2), r).translate(katana ? 0.014 : 0.026, 0, 0));
    if (katana) add('torso', M.dark, place(cyl(0.02, 0.02, 0.9, 8), [0.05, 0.4, -0.16], [0, 0, 0.7]));
  }

  function buildWings(style: 'flame' | 'mech' | 'butterfly') {
    if (style === 'flame') {
      const fm = glowMat(C.glow, 1.9, { transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
      const fm2 = glowMat('#ffe14a', 2.2, { transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
      glow.push(fm, fm2);
      for (const [w, sd] of [['wingL', 1], ['wingR', -1]] as const)
        for (let i = 0; i < 7; i++) {
          const a = 0.25 + i * 0.2;
          const len = 0.9 - i * 0.07;
          add(w, i % 2 ? fm2 : fm, place(cone(0.07, len, 4), [sd * Math.cos(a) * len * 0.5, Math.sin(a) * len * 0.5 - 0.05, -0.02], [0, 0, sd * (a - Math.PI / 2)], [1, 1, 0.15]));
        }
    } else if (style === 'mech') {
      const blade = M.metal;
      const edge = glowMat('#5fe3ff', 2.2);
      glow.push(edge);
      for (const [w, sd] of [['wingL', 1], ['wingR', -1]] as const) {
        add(w, M.dark, place(cyl(0.06, 0.06, 0.06, 12), [sd * 0.08, 0.05, 0], [Math.PI / 2, 0, 0]));
        for (let i = 0; i < 8; i++) {
          const a = 0.55 - i * 0.16;
          const len = 1.05 - Math.abs(i - 2) * 0.08;
          const p: V3 = [sd * (0.1 + Math.cos(a) * len * 0.5), 0.05 + Math.sin(a) * len * 0.5, -0.01 * i];
          add(w, blade, place(box(len, 0.055, 0.015), p, [0, 0, sd * a]));
          if (i % 2 === 0) add(w, edge, place(box(len * 0.6, 0.008, 0.02), [p[0], p[1] - 0.03, p[2]], [0, 0, sd * a]));
        }
      }
    } else {
      const wm = track(butterflyMaterial());
      for (const [w, w2, sd] of [['wingL', 'wing2L', 1], ['wingR', 'wing2R', -1]] as const) {
        add(w, wm, place(new THREE.ShapeGeometry(wingShape(0.75, 0.55)), [0, 0, 0], [0, 0, 0], [sd, 1, 1]));
        add(w2, wm, place(new THREE.ShapeGeometry(wingShape(0.48, 0.42)), [0, 0, 0], [0, 0, Math.PI], [-sd, 1, 1]));
      }
    }
  }

  const geos = col.build(opts.shadows ?? true);

  // centaur human torso sits where the horse chest is; tilt the horse slightly
  if (centaur) J.hips.position.y = hipY;

  return {
    root,
    body,
    j: J,
    glow,
    dispose: () => {
      geos.forEach((g) => g.dispose());
      mats.forEach((m) => m.dispose());
    },
  };
}

// ------------------------------------------------------------------ special shapes & materials

function starShape(outer: number, inner: number, points: number) {
  const sh = new THREE.Shape();
  for (let i = 0; i <= points * 2; i++) {
    const r = i % 2 ? inner : outer;
    const a = (i / (points * 2)) * Math.PI * 2 + Math.PI / 2;
    if (i === 0) sh.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    else sh.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  return sh;
}

function wingShape(w: number, h: number) {
  const sh = new THREE.Shape();
  sh.moveTo(0, 0);
  sh.bezierCurveTo(w * 0.3, h * 1.1, w * 1.05, h * 1.05, w, h * 0.55);
  sh.bezierCurveTo(w * 0.95, h * 0.1, w * 0.5, -h * 0.1, 0, 0);
  return sh;
}

function butterflyMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false,
    vertexShader: `varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `varying vec3 vP;
      void main(){
        float d = length(vP.xy);
        vec3 a = vec3(0.55, 0.35, 1.0), b = vec3(0.3, 0.85, 1.0), c = vec3(1.0, 0.45, 0.85);
        vec3 col = mix(b, a, smoothstep(0.1, 0.5, d));
        col = mix(col, c, smoothstep(0.55, 0.8, d));
        float ang = atan(vP.y, abs(vP.x));
        float vein = smoothstep(0.03, 0.0, abs(fract(ang * 3.0) - 0.5) - 0.46);
        col = mix(col, vec3(0.15, 0.1, 0.4), vein * 0.7);
        gl_FragColor = vec4(col * 0.85, 0.75);
      }`,
  });
}

function galaxyMaterial() {
  return new THREE.ShaderMaterial({
    side: THREE.DoubleSide,
    transparent: true,
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `varying vec2 vUv;
      float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }
      void main(){
        vec3 col = mix(vec3(0.25, 0.1, 0.5), vec3(0.95, 0.45, 0.85), vUv.y * 0.8 + 0.1 * sin(vUv.x * 9.0));
        vec2 g = floor(vUv * vec2(40.0, 90.0));
        float star = step(0.985, h(g));
        col += star * vec3(1.4);
        gl_FragColor = vec4(col, 0.85);
      }`,
  });
}
