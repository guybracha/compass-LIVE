import { Vector3 } from 'three';
import type { BattleSim, Hero } from './BattleSim';

// Role-based behaviour for the 18 Compass Alliance reinforcements.
// `careful` (evacuation before the counter-attack) means they protect civilians
// and only take safe shots; otherwise they go on the offensive, and their
// misses land on the city.

const RANGED_POWERS = new Set(['bolt', 'fire', 'water', 'cosmic', 'sonic', 'missile', 'plasma', 'nature']);
const HERDERS = new Set(['harkadius', 'hallethea', 'comrade', 'enforcer', 'mariposa']);
const a3 = new Vector3();

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

export function robotFloor(sim: BattleSim) {
  return sim.mode === 'evacuate' ? 34 : sim.flags.chargeFinal ? 0 : 12;
}

export function tickAllies(sim: BattleSim, dt: number, mode: 'evacuate' | 'attack') {
  const careful = mode === 'evacuate' && !sim.flags.counter;
  const over = sim.flags.downed || sim.flags.retreat;
  for (const h of sim.allies) {
    if (!h.visible || h.ai.phase !== 'active') continue;
    const spec = h.spec;
    const ai = h.ai;
    ai.cooldown -= dt;

    if (over) {
      if (spec.flies) {
        h.pos.lerp(a3.copy(h.slot).setY(Math.max(4, h.slot.y * 0.6)), Math.min(1, dt));
        sim.setHeroAnim(h, 'hover');
      } else if (ai.leapT < 0 && sim.moveHero(h, h.slot, 5, dt)) idleFacingRobot(sim, h, dt);
      if (ai.leapT >= 0) leapStrike(sim, h, dt);
      sim.faceRobot(h, dt);
      continue;
    }

    // Size grows to giant form once the fight is on
    if (spec.id === 'size' && !careful && h.scale < 4.5) {
      if (h.scale === 1) sim.bus.emit('sfx', 'grow');
      h.scale = Math.min(4.5, h.scale + dt * 1.8);
    }

    if (ai.leapT >= 0) {
      leapStrike(sim, h, dt);
      continue;
    }

    if (careful && HERDERS.has(spec.id)) {
      if (spec.id === 'hallethea') reviveNearby(sim, h);
      herdAlly(sim, h, dt, spec.id === 'harkadius' ? 11 : spec.flies ? 9 : 6.5);
      continue;
    }
    if (spec.id === 'gigantic' && careful) {
      // holds a fallen girder over the civilians
      if (sim.moveHero(h, a3.set(3.5, 0, 9), 4, dt)) {
        sim.setHeroAnim(h, 'lift');
        sim.faceRobot(h, dt);
      }
      continue;
    }
    if (spec.id === 'maltese-cross' && careful) {
      if (sim.moveHero(h, a3.set(-2.5, 0, -2), 5, dt)) {
        sim.setHeroAnim(h, 'shield');
        sim.faceRobot(h, dt);
      }
      continue;
    }

    if (spec.flies) {
      // circle in front of the machine and fire from the air
      ai.orbit += dt * (careful ? 0.15 : 0.35);
      a3.set(Math.sin(ai.orbit) * 8, h.slot.y + 4 + Math.sin(ai.orbit * 2) * 1.5, sim.robot.pos.z + 12 + Math.cos(ai.orbit) * 4);
      h.pos.lerp(a3, Math.min(1, dt * 1.2));
      sim.faceRobot(h, dt);
      rangedAttack(sim, h, careful, mode);
      continue;
    }

    if (RANGED_POWERS.has(spec.power)) {
      if (sim.moveHero(h, h.slot, 6, dt)) sim.faceRobot(h, dt);
      rangedAttack(sim, h, careful, mode);
      continue;
    }

    // melee: hold position while careful, otherwise leap in for strikes
    if (careful) {
      if (sim.moveHero(h, h.slot, 6, dt)) idleFacingRobot(sim, h, dt);
      continue;
    }
    if (spec.id === 'size' && h.scale > 3) {
      // giant Size fights on foot, face to face with the machine
      if (sim.moveHero(h, a3.set(4, 0, sim.robot.pos.z + 10), 5, dt)) {
        sim.faceRobot(h, dt);
        if (ai.cooldown <= 0) {
          ai.cooldown = 1.6;
          sim.setHeroAnim(h, 'punch');
          h.animT = 0;
          sim.robot.hp = Math.max(robotFloor(sim), sim.robot.hp - 4);
          sim.explode(sim.robotCore(new Vector3()).add(a3.set(1.5, -2, 1)), 3, 'spark');
          sim.addTrauma(0.4);
          sim.bus.emit('sfx', 'punch');
        } else if (h.animT > 0.5) sim.setHeroAnim(h, 'idle');
      }
      continue;
    }
    if (ai.cooldown <= 0) {
      ai.cooldown = 2.4 + (h.seed % 4) * 0.5;
      ai.leapT = 0;
      ai.from.copy(h.pos);
      sim.robotCore(ai.to).add(a3.set((h.seed % 3) - 1, -3 - (h.seed % 2) * 3, 3));
      sim.setHeroAnim(h, 'leap');
      sim.bus.emit('sfx', 'whoosh');
    } else if (sim.moveHero(h, h.slot, 7, dt)) idleFacingRobot(sim, h, dt);
  }
}

function leapStrike(sim: BattleSim, h: Hero, dt: number) {
  const ai = h.ai;
  const before = ai.leapT;
  ai.leapT += dt * 1.8;
  const k = ai.leapT < 1 ? ai.leapT : 2 - ai.leapT;
  h.pos.lerpVectors(ai.from, ai.to, Math.max(0, k));
  h.pos.y += Math.sin(Math.max(0, k) * Math.PI) * 3.5;
  sim.faceRobot(h, dt);
  if (before < 1 && ai.leapT >= 1) {
    sim.setHeroAnim(h, 'punch');
    h.animT = 0;
    const dmg = h.spec.role === 'tank' ? 6 : 4;
    sim.robot.hp = Math.max(robotFloor(sim), sim.robot.hp - dmg);
    sim.explode(ai.to.clone(), h.spec.power === 'blade' ? 1.6 : 2.4, 'spark', h.spec.colors.glow);
    sim.addTrauma(0.3);
    sim.bus.emit('sfx', 'punch');
  }
  if (ai.leapT >= 2) {
    ai.leapT = -1;
    h.pos.copy(ai.from);
    sim.setHeroAnim(h, 'idle');
  } else if (ai.leapT < 1) sim.setHeroAnim(h, 'leap');
}

function rangedAttack(sim: BattleSim, h: Hero, careful: boolean, mode: 'evacuate' | 'attack') {
  const ai = h.ai;
  if (ai.cooldown > 0) {
    if (h.animT > 0.35) sim.setHeroAnim(h, h.spec.flies ? 'hover' : 'idle');
    return;
  }
  const missile = h.spec.power === 'missile';
  ai.cooldown = (careful ? 2.6 : 1.0) * (missile ? 2.4 : 1) + (h.seed % 5) * 0.12;
  sim.setHeroAnim(h, 'cast');
  h.animT = 0;
  const hit = mode === 'evacuate' ? 1 : 0.62;
  const from = h.pos.clone().add(a3.set(0, (missile ? 2.2 : 1.4) * h.spec.body.height * h.scale, 0));
  const shots = missile ? 4 : 1;
  for (let i = 0; i < shots; i++) {
    sim.fireBolt(from.clone().add(a3.set((i - 1.5) * 0.4, i * 0.1, 0)), sim.random() < hit, missile ? 2 : 1.6, {
      color: h.spec.colors.glow,
      kind: h.spec.power,
      speed: missile ? 32 : h.spec.power === 'sonic' ? 40 : 52,
      splash: 0.1,
    });
  }
}

/** Escort: run to the nearest stranded civilian and send nearby people to safety. */
function herdAlly(sim: BattleSim, h: Hero, dt: number, speed: number) {
  const target = nearestPanicking(sim, h.pos);
  if (!target) {
    if (sim.moveHero(h, h.slot, speed * 0.6, dt)) idleFacingRobot(sim, h, dt);
    return;
  }
  if (h.spec.flies) {
    target.y = 2.5;
    h.pos.lerp(target, Math.min(1, dt * 2));
    sim.setHeroAnim(h, 'fly');
    if (h.pos.distanceTo(target) < 1.5) sim.setCivilianFlee(h.pos.clone().setY(0), 7);
    return;
  }
  if (sim.moveHero(h, target, speed, dt)) sim.setCivilianFlee(h.pos, 6);
}

function reviveNearby(sim: BattleSim, h: Hero) {
  for (const c of sim.civilians)
    if (c.state === 'hurt' && c.pos.distanceTo(h.pos) < 4) {
      c.state = 'flee';
      c.speed = 3.5;
      sim.explode(c.pos.clone().setY(1), 1.2, 'spark', '#b8ff9a');
    }
}

/** Pick any visible hero for the machine to shoot at. */
export function randomHeroTarget(sim: BattleSim): Hero {
  const list = sim.heroes.filter((x) => x.visible && x.ai.phase === 'active');
  return list[Math.floor(sim.random() * list.length)] ?? sim.voltage;
}
