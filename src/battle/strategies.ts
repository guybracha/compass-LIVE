import { Vector3 } from 'three';
import { randomHeroTarget, tickAllies } from './allies';
import type { BattleSim, Hero, SimMode } from './BattleSim';

// Hero behaviour profiles. The viewer's decision selects which one runs,
// which changes targeting, civilian safety and how much of the city survives.

export interface StrategyState {
  voltageTarget?: Vector3;
  paladinTarget?: Vector3;
  boltT?: number;
  orbitT?: number;
  leap?: { phase: 'ground' | 'air'; t: number; from: Vector3; to: Vector3 };
}

const tmp = new Vector3();
const SHIELD_POST = new Vector3(0, 0, -5);

/** Nearest civilian still standing around (not fleeing, safe or hurt). */
function nearestPanicking(sim: BattleSim, from: Vector3) {
  let best: Vector3 | undefined;
  let bestD = Infinity;
  for (const c of sim.civilians) {
    if (c.state !== 'panic') continue;
    const d = c.pos.distanceToSquared(from);
    if (d < bestD) {
      bestD = d;
      best = c.pos;
    }
  }
  return best?.clone();
}

function idleFacingRobot(sim: BattleSim, h: Hero, dt: number) {
  sim.setHeroAnim(h, 'idle');
  sim.faceRobot(h, dt);
}

/** A hero sweeps the streets, sending nearby civilians running to safety. */
function herd(sim: BattleSim, h: Hero, key: 'voltageTarget' | 'paladinTarget', speed: number, radius: number, dt: number, rest: Vector3) {
  const s = sim.strategy;
  if (!s[key]) s[key] = nearestPanicking(sim, h.pos) ?? rest.clone();
  if (sim.moveHero(h, s[key]!, speed, dt)) {
    sim.setCivilianFlee(h.pos, radius);
    s[key] = nearestPanicking(sim, h.pos);
    if (!s[key]) {
      if (sim.moveHero(h, rest, speed, dt)) idleFacingRobot(sim, h, dt);
      s[key] = undefined;
      return false;
    }
    return true;
  }
  return true;
}

function voltageHoverShoot(sim: BattleSim, dt: number, interval: number, hitChance: number, damage: number) {
  const v = sim.voltage;
  const s = sim.strategy;
  s.orbitT = (s.orbitT ?? 0) + dt;
  const t = s.orbitT;
  tmp.set(Math.sin(t * 0.7) * 9, 6 + Math.sin(t * 1.3) * 2, -2 + Math.cos(t * 0.5) * 5);
  v.pos.lerp(tmp, Math.min(1, dt * 2));
  sim.faceRobot(v, dt);
  s.boltT = (s.boltT ?? 0.3) - dt;
  if (s.boltT <= 0 && sim.robot.state !== 'down') {
    s.boltT = interval;
    sim.setHeroAnim(v, 'cast');
    v.animT = 0;
    sim.fireBolt(v.pos.clone().add(tmp.set(0, 1.5, 0)), sim.random() < hitChance, damage);
  } else if (v.animT > 0.3) sim.setHeroAnim(v, 'hover');
}

/** Robot AI decision when idle and cooled down. */
function robotThink(sim: BattleSim, dt: number, pick: () => void) {
  const r = sim.robot;
  if (r.state !== 'idle') return;
  r.cooldown -= dt;
  if (r.cooldown <= 0) {
    r.cooldown = 1;
    pick();
  }
}

function standoff(sim: BattleSim, dt: number) {
  for (const h of [sim.paladin, sim.voltage]) if (h.anim === 'idle') sim.faceRobot(h, dt);
}

function evacuate(sim: BattleSim, dt: number) {
  tickAllies(sim, dt, 'evacuate');
  const p = sim.paladin;
  const v = sim.voltage;
  const r = sim.robot;
  const s = sim.strategy;

  if (!sim.flags.counter) {
    // Paladin holds a shield line between the robot and the civilians.
    if (sim.moveHero(p, SHIELD_POST, 8, dt)) {
      sim.setHeroAnim(p, 'shield');
      sim.faceRobot(p, dt);
      sim.shield.active = true;
    }
    herd(sim, v, 'voltageTarget', 15, 8, dt, tmp.set(7, 0, -2).clone());
    robotThink(sim, dt, () => {
      if (sim.random() < 0.9) sim.startLaser('shield', p.pos, p.pos, 1.3);
      else sim.setRobot('swipe');
    });
    // anyone still standing around after a while starts running on their own
    if (sim.time % 1 < dt) for (const c of sim.civilians) if (c.state === 'panic' && sim.random() < 0.06) c.state = 'flee';
    return;
  }

  if (sim.flags.retreat) {
    idleFacingRobot(sim, p, dt);
    if (sim.moveHero(v, tmp.set(6, 0, -4), 10, dt)) idleFacingRobot(sim, v, dt);
    return;
  }

  // Counter-attack: Voltage blasts from the air, Paladin leaps in for heavy strikes.
  sim.shield.active = false;
  voltageHoverShoot(sim, dt, 0.42, 1, 3);
  if (!s.leap) s.leap = { phase: 'ground', t: 0.4, from: new Vector3(), to: new Vector3() };
  const L = s.leap;
  L.t -= dt;
  if (L.phase === 'ground') {
    sim.moveHero(p, SHIELD_POST, 8, dt);
    if (L.t <= 0) {
      L.phase = 'air';
      L.t = 0;
      L.from.copy(p.pos);
      sim.robotCore(L.to).add(tmp.set(0, -2, 4));
      sim.setHeroAnim(p, 'leap');
      sim.bus.emit('sfx', 'whoosh');
    } else if (p.pos.distanceTo(SHIELD_POST) < 0.5) idleFacingRobot(sim, p, dt);
  } else {
    L.t += dt * 2; // L.t counts up 0..2 while airborne (there and back)
    const k = L.t < 1 ? L.t : 2 - L.t;
    p.pos.lerpVectors(L.from, L.to, k);
    p.pos.y += Math.sin(k * Math.PI) * 4;
    sim.faceRobot(p, dt);
    if (L.t >= 1 && L.t - dt * 2 < 1) {
      sim.setHeroAnim(p, 'punch');
      r.hp = Math.max(34, r.hp - 9);
      sim.explode(L.to.clone(), 3, 'spark');
      sim.addTrauma(0.55);
      sim.bus.emit('sfx', 'punch');
      if (r.state === 'idle') sim.setRobot('stagger');
    }
    if (L.t >= 2) {
      L.phase = 'ground';
      L.t = 1.6;
      p.pos.copy(L.from);
      sim.setHeroAnim(p, 'idle');
    }
  }
  robotThink(sim, dt, () => {
    if (sim.random() < 0.8) sim.startLaser('voltage', tmp.copy(v.pos).add(new Vector3(0, 5, -3)), tmp.clone().add(new Vector3(0, 14, -6)), 1);
    else sim.setRobot('swipe');
  });
}

function attack(sim: BattleSim, dt: number) {
  tickAllies(sim, dt, 'attack');
  const p = sim.paladin;
  const v = sim.voltage;
  const r = sim.robot;

  // Paladin tries to protect civilians alone, slowly, cluster by cluster.
  herd(sim, p, 'paladinTarget', 5.5, 4.5, dt, tmp.set(-4, 0, 4).clone());

  if (sim.flags.downed) {
    sim.moveHero(v, tmp.set(4, 0, 2), 6, dt, 'hover');
    if (v.pos.y < 0.3) idleFacingRobot(sim, v, dt);
    else sim.setHeroAnim(v, 'hover');
    return;
  }

  if (sim.flags.chargeFinal) {
    v.pos.lerp(tmp.set(0, 7.5, 6), Math.min(1, dt * 2));
    sim.faceRobot(v, dt);
    sim.setHeroAnim(v, 'charge');
    sim.voltageCharge = Math.min(1, sim.voltageCharge + dt / 2.2);
    if (r.state === 'idle' || r.state === 'charge') sim.setRobot('stagger');
    return;
  }

  // Voltage goes all-out: fast bolts, many of them miss and hit the buildings.
  voltageHoverShoot(sim, dt, 0.4, 0.62, 4.5);
  robotThink(sim, dt, () => {
    if (sim.random() < 0.7) {
      // The robot shoots at Voltage; she dodges and the beam rakes the street and facades.
      const side = sim.random() < 0.5 ? -1 : 1;
      const target = randomHeroTarget(sim);
      const start = tmp.copy(target.pos).add(new Vector3(side * 3, -1, -2)).clone();
      const end = new Vector3(side * 11, 4 + sim.random() * 14, r.pos.z + 10 + sim.random() * 20);
      sim.startLaser('voltage', start, end, 1.1);
    } else sim.setRobot('swipe');
  });
}

export const strategies: Partial<Record<SimMode, (sim: BattleSim, dt: number) => void>> = {
  standoff,
  evacuate,
  attack,
  aftermath: standoff,
};
