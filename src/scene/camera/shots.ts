import { Vector3 } from 'three';
import type { BattleSim, Hero } from '../../battle/BattleSim';
import { headHeight } from '../../characters/buildHero';
import type { ShotName } from '../../story/types';

// Each shot is a function of the live simulation, so framing follows the action.

export interface ShotFrame {
  pos: Vector3;
  look: Vector3;
  fov: number;
  /** 0..1 amount of handheld wobble */
  handheld: number;
}

type ShotFn = (sim: BattleSim, t: number, out: ShotFrame, target: string) => void;

const a = new Vector3();
const b = new Vector3();

/** eye-line height of a hero, including size changes */
const hh = (h: Hero) => headHeight(h.spec) * h.scale;

function head(h: Hero, height: number, out: Vector3) {
  return out.copy(h.pos).setY(h.pos.y + height);
}

function forward(yaw: number, out: Vector3) {
  return out.set(Math.sin(yaw), 0, Math.cos(yaw));
}

function closeUp(h: Hero, height: number, side: number, out: ShotFrame, t: number) {
  head(h, height, out.look);
  forward(h.yaw, a);
  b.set(a.z, 0, -a.x); // right vector
  out.pos.copy(out.look).addScaledVector(a, 2.7 - t * 0.04).addScaledVector(b, side * 0.9).add(new Vector3(0, -0.15, 0));
  out.look.y -= 0.1;
  out.fov = 34;
  out.handheld = 0.25;
}

function overShoulder(subject: Hero, sh: number, target: Hero, th: number, out: ShotFrame) {
  head(target, th, out.look);
  head(subject, sh, a);
  b.subVectors(a, out.look).setY(0).normalize(); // from target toward subject
  const right = new Vector3(b.z, 0, -b.x);
  out.pos.copy(a).addScaledVector(b, 1.9).addScaledVector(right, 0.85).add(new Vector3(0, 0.25, 0));
  out.fov = 38;
  out.handheld = 0.2;
}

function heroesMid(sim: BattleSim, out: Vector3) {
  return out.addVectors(sim.paladin.pos, sim.voltage.pos).multiplyScalar(0.5).setY(0);
}

export const SHOTS: Record<ShotName, ShotFn> = {
  establishing(_sim, t, o) {
    // slow aerial push down Central Avenue toward the attack
    o.pos.set(Math.sin(t * 0.05) * 3, Math.max(26, 42 - t * 0.35), Math.max(25, 110 - t * 1.1));
    o.look.set(0, 10, -45);
    o.fov = 50;
    o.handheld = 0.15;
  },
  heli(sim, t, o) {
    // high over the avenue (the only airspace guaranteed clear of towers)
    const r = sim.robot.pos;
    o.pos.set(5 + Math.sin(t * 0.12) * 2.5, 50 - t * 0.2, r.z + 52 - t * 0.5);
    o.look.set(r.x * 0.5, 7, r.z + 6);
    o.fov = 44;
    o.handheld = 1;
  },
  robotLow(sim, t, o) {
    const r = sim.robot;
    forward(r.yaw, a);
    b.set(a.z, 0, -a.x);
    o.pos.copy(r.pos).addScaledVector(a, 15 + t * 0.3).addScaledVector(b, 7).setY(1.2);
    o.look.copy(r.pos).setY(14 - r.collapse * 8);
    o.fov = 58;
    o.handheld = 0.35;
  },
  tracking(sim, t, o) {
    const r = sim.robot.pos;
    o.pos.set(-7.5, 3.5, r.z + 22 - t * 0.6);
    o.look.set(r.x, 9, r.z);
    o.fov = 50;
    o.handheld = 0.5;
  },
  horizon(sim, t, o) {
    o.pos.set(2.5, 5 + t * 0.1, 30);
    const far = sim.flags.secondSignal ? -200 : sim.flags.retreat ? -120 : -60;
    o.look.set(sim.flags.secondSignal ? 18 : 0, sim.flags.secondSignal ? 18 : 16, far);
    o.fov = 46;
    o.handheld = 0.3;
  },
  heroLanding(sim, t, o) {
    heroesMid(sim, a);
    o.pos.set(a.x + 1, 1.3, a.z + 13 - t * 0.3);
    o.look.set(a.x, 2.2, a.z - 2);
    o.fov = 58;
    o.handheld = 0.4;
  },
  lowAngleHero(sim, t, o) {
    heroesMid(sim, a);
    o.pos.set(a.x + 2.2, 0.6, a.z + 6.5 - t * 0.15);
    o.look.set(a.x - 0.5, 6.5, a.z - 14);
    o.fov = 54;
    o.handheld = 0.15;
  },
  closePaladin(sim, t, o) {
    closeUp(sim.paladin, hh(sim.paladin), 1, o, t);
  },
  closeVoltage(sim, t, o) {
    closeUp(sim.voltage, hh(sim.voltage), -1, o, t);
  },
  otsPaladin(sim, _t, o) {
    overShoulder(sim.paladin, hh(sim.paladin), sim.voltage, hh(sim.voltage), o);
  },
  otsVoltage(sim, _t, o) {
    overShoulder(sim.voltage, hh(sim.voltage), sim.paladin, hh(sim.paladin), o);
  },
  heroClose(sim, t, o, target) {
    const h = sim.heroById[target] ?? sim.paladin;
    closeUp(h, hh(h), h.seed % 2 ? 1 : -1, o, t);
    const k = h.scale * Math.max(0.8, h.spec.body.height);
    o.pos.sub(o.look).multiplyScalar(k).add(o.look);
  },
  heroAction(sim, t, o, target) {
    // medium shot from the city side, the machine in the background
    const h = sim.heroById[target] ?? sim.paladin;
    const k = h.scale * Math.max(0.8, h.spec.body.height);
    const side = h.seed % 2 ? 1 : -1;
    o.look.copy(h.pos).setY(h.pos.y + hh(h) * 0.75);
    o.pos.set(h.pos.x + side * 2.6 * k, h.pos.y + 1.3 * k, h.pos.z + 5.5 * k - t * 0.2);
    o.pos.x = Math.max(-8, Math.min(8, o.pos.x));
    o.look.lerp(a.copy(sim.robot.pos).setY(9), 0.15);
    o.fov = 44;
    o.handheld = 0.4;
  },
  alliesWide(_sim, t, o) {
    o.pos.set(-4 + t * 0.25, 4.5 + t * 0.15, 30 - t * 0.4);
    o.look.set(0, 6, -6);
    o.fov = 58;
    o.handheld = 0.35;
  },
  gallery(sim, t, o, target) {
    const h = sim.heroById[target] ?? sim.paladin;
    const k = Math.max(0.85, h.spec.body.height * h.scale);
    const centaur = h.spec.anatomy === 'centaur';
    const ang = h.yaw + Math.sin(t * 0.3) * 0.45;
    const dist = 3.6 * k * (centaur ? 1.25 : 1) + (h.spec.parts.some((p) => p.k === 'wings') ? 1.2 : 0);
    o.look.copy(h.pos).setY(h.pos.y + hh(h) * 0.62);
    o.pos.set(h.pos.x + Math.sin(ang) * dist, h.pos.y + hh(h) * 0.7, h.pos.z + Math.cos(ang) * dist);
    // frame the hero left of centre, clear of the info card
    const right = a.set(Math.cos(ang), 0, -Math.sin(ang)).multiplyScalar(dist * 0.32);
    o.look.add(right);
    o.pos.add(right);
    o.fov = 40;
    o.handheld = 0.05;
  },
  wideBattle(_sim, t, o) {
    // elevated wide from behind the heroes, down the avenue toward the machine
    o.pos.set(-5.5 + t * 0.15, 13, 44 - t * 0.35);
    o.look.set(0, 6.5, -12);
    o.fov = 52;
    o.handheld = 0.25;
  },
  shieldClose(sim, t, o) {
    const p = sim.paladin.pos;
    o.pos.set(p.x + 2.4, 2.1, p.z + 4.8 - t * 0.1);
    o.look.set(p.x * 0.3, 7.5, sim.robot.pos.z + 4);
    o.fov = 52;
    o.handheld = 0.45;
  },
  voltageTrack(sim, _t, o) {
    const v = sim.voltage.pos;
    o.pos.set(v.x - 4.5, v.y + 1.8, v.z + 6.5);
    a.copy(sim.robot.pos).setY(9);
    o.look.copy(v).setY(v.y + 1.5).lerp(a, 0.35);
    o.fov = 52;
    o.handheld = 0.5;
  },
  robotDown(sim, t, o) {
    const r = sim.robot.pos;
    o.pos.set(r.x + 6 + Math.sin(t * 0.1) * 1.5, 8 - t * 0.1, r.z + 34 - t * 0.3);
    o.look.set(r.x, 2.5, r.z + 8);
    o.fov = 48;
    o.handheld = 0.3;
  },
};

export const CAMERA_LABELS: Record<ShotName, string> = {
  establishing: 'CAM 1 — SKYLINE',
  heli: 'CAM 2 — SKY 7 HELI',
  robotLow: 'CAM 4 — STREET LEVEL',
  tracking: 'CAM 3 — CENTRAL AVE',
  horizon: 'CAM 5 — ROOFTOP',
  heroLanding: 'CAM 4 — STREET LEVEL',
  lowAngleHero: 'CAM 6 — FIELD UNIT',
  closePaladin: 'CAM 6 — FIELD UNIT',
  closeVoltage: 'CAM 6 — FIELD UNIT',
  otsPaladin: 'CAM 6 — FIELD UNIT',
  otsVoltage: 'CAM 6 — FIELD UNIT',
  wideBattle: 'CAM 3 — CENTRAL AVE',
  shieldClose: 'CAM 7 — DRONE',
  voltageTrack: 'CAM 7 — DRONE',
  robotDown: 'CAM 2 — SKY 7 HELI',
  heroClose: 'CAM 6 — FIELD UNIT',
  heroAction: 'CAM 8 — ALLIANCE FEED',
  alliesWide: 'CAM 3 — CENTRAL AVE',
  gallery: 'ALLIANCE ARCHIVE',
};
