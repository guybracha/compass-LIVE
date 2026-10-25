import { Color, Vector3 } from 'three';
import { ALLY_IDS, HEROES, HERO_BY_ID, type HeroSpec, type PowerKind } from '../characters/heroes';
import { Emitter } from '../lib/emitter';
import { clamp, seeded } from '../lib/math';
import { getCityLayout, facadePoint, type Building } from '../scene/city/layout';
import { getStore } from '../state/store';
import { strategies, type StrategyState } from './strategies';

// Lightweight real-time battle simulation. Plain TypeScript, updated once per
// frame; renderers read its state through refs, so it never causes React renders.

export type SimMode = 'prelude' | 'standoff' | 'evacuate' | 'attack' | 'aftermath' | 'gallery';

export type HeroAnim =
  | 'hidden'
  | 'fall'
  | 'land'
  | 'idle'
  | 'run'
  | 'shield'
  | 'leap'
  | 'punch'
  | 'hover'
  | 'cast'
  | 'charge'
  | 'fly'
  | 'heal'
  | 'lift'
  | 'gallery';

export interface AllyAI {
  phase: 'queued' | 'arriving' | 'active';
  t: number;
  cooldown: number;
  from: Vector3;
  to: Vector3;
  leapT: number;
  orbit: number;
}

export interface Hero {
  id: string;
  spec: HeroSpec;
  /** size multiplier (Size can grow) */
  scale: number;
  seed: number;
  /** battle position assigned on arrival */
  slot: Vector3;
  ai: AllyAI;
  pos: Vector3;
  yaw: number;
  anim: HeroAnim;
  animT: number;
  hp: number;
  visible: boolean;
}

export type RobotState = 'walk' | 'idle' | 'swipe' | 'charge' | 'fire' | 'stagger' | 'retreat' | 'down';
export type LaserAim = 'shield' | 'voltage' | 'point';

export interface Robot {
  pos: Vector3;
  yaw: number;
  hp: number;
  state: RobotState;
  stateT: number;
  walkTarget: Vector3;
  stepPhase: number;
  swipeSide: -1 | 1;
  eyeFlare: number;
  collapse: number;
  cooldown: number;
  aim: LaserAim;
  aimStart: Vector3;
  aimEnd: Vector3;
  fireDuration: number;
}

export interface Projectile {
  active: boolean;
  pos: Vector3;
  target: Vector3;
  speed: number;
  hitsRobot: boolean;
  damage: number;
  big: boolean;
  color: Color;
  kind: PowerKind;
  /** building damage when it misses */
  splash: number;
}

export interface BoltOptions {
  big?: boolean;
  color?: string;
  kind?: PowerKind;
  speed?: number;
  splash?: number;
}

export type CivState = 'panic' | 'flee' | 'safe' | 'hurt';
export interface Civilian {
  pos: Vector3;
  home: Vector3;
  heading: number;
  speed: number;
  state: CivState;
  turnT: number;
  phase: number;
  color: number;
}

export interface Crater {
  x: number;
  z: number;
  r: number;
}

export type ExplosionKind = 'fire' | 'spark' | 'electric' | 'dust';
export interface SimEvents extends Record<string, unknown> {
  explosion: { pos: Vector3; size: number; kind: ExplosionKind; color?: string };
  sfx: string;
  [key: string]: unknown;
}

export const ROBOT_EYE_HEIGHT = 17.6;
export const ROBOT_CORE_HEIGHT = 12.8;
const ROBOT_SPEED = 3.4;
const SAFE_Z = 64;
const CIVILIAN_COUNT = 56;
const PROJECTILES = 160;

const tmp = new Vector3();
const tmp2 = new Vector3();

export class BattleSim {
  readonly bus = new Emitter<SimEvents>();
  readonly layout = getCityLayout();

  time = 0;
  mode: SimMode = 'prelude';
  trauma = 0;
  heroes: Hero[] = [];
  heroById: Record<string, Hero> = {};
  get paladin() {
    return this.heroById.paladin;
  }
  get voltage() {
    return this.heroById.voltage;
  }
  get allies() {
    return this.heroes.filter((h) => h.id !== 'paladin' && h.id !== 'voltage');
  }
  robot!: Robot;
  projectiles: Projectile[] = [];
  civilians: Civilian[] = [];
  craters: Crater[] = [];
  buildingDamage = new Float32Array(this.layout.buildings.length);
  buildingDirty = true;
  laser = { active: false, charge: 0, from: new Vector3(), to: new Vector3() };
  shield = { active: false, flash: 0 };
  voltageCharge = 0;
  flags = { counter: false, retreat: false, chargeFinal: false, downed: false, secondSignal: false, reactivated: false };
  strategy: StrategyState = {};

  private rnd = seeded(7);
  private statsT = 0;
  private laserTickT = 0;
  private preludeShotT = 0;

  constructor() {
    this.reset();
  }

  reset() {
    this.rnd = seeded(7);
    this.time = 0;
    this.mode = 'prelude';
    this.trauma = 0;
    this.heroes = HEROES.map((spec, i) => {
      const start = spec.id === 'paladin' ? new Vector3(-3, 60, 9) : spec.id === 'voltage' ? new Vector3(4, 60, 11) : new Vector3(0, 80, 20);
      const h: Hero = {
        id: spec.id,
        spec,
        scale: 1,
        seed: i,
        slot: start.clone().setY(0),
        ai: { phase: 'queued', t: 0, cooldown: 0, from: new Vector3(), to: new Vector3(), leapT: -1, orbit: i * 0.7 },
        pos: start,
        yaw: Math.PI,
        anim: 'hidden',
        animT: 0,
        hp: 100,
        visible: false,
      };
      return h;
    });
    this.heroById = Object.fromEntries(this.heroes.map((h) => [h.id, h]));
    assignSlots(this.heroes);
    this.robot = {
      pos: new Vector3(0, 0, -78),
      yaw: 0,
      hp: 100,
      state: 'walk',
      stateT: 0,
      walkTarget: new Vector3(0, 0, -24),
      stepPhase: 0,
      swipeSide: 1,
      eyeFlare: 0,
      collapse: 0,
      cooldown: 1,
      aim: 'point',
      aimStart: new Vector3(),
      aimEnd: new Vector3(),
      fireDuration: 1,
    };
    this.projectiles = Array.from({ length: PROJECTILES }, () => ({
      active: false,
      pos: new Vector3(),
      target: new Vector3(),
      speed: 60,
      hitsRobot: false,
      damage: 0,
      big: false,
      color: new Color(),
      kind: 'bolt' as PowerKind,
      splash: 0.24,
    }));
    this.civilians = Array.from({ length: CIVILIAN_COUNT }, (_, i) => {
      const lane = this.rnd() < 0.5 ? -1 : 1;
      const x = lane * (2 + this.rnd() * 8);
      const z = -4 + this.rnd() * 32;
      return {
        pos: new Vector3(x, 0, z),
        home: new Vector3(x, 0, z),
        heading: this.rnd() * Math.PI * 2,
        speed: 1 + this.rnd(),
        state: 'panic' as CivState,
        turnT: this.rnd() * 2,
        phase: this.rnd() * 10,
        color: i,
      };
    });
    this.craters = [];
    this.buildingDamage.fill(0);
    this.buildingDirty = true;
    this.laser.active = false;
    this.laser.charge = 0;
    this.shield.active = false;
    this.shield.flash = 0;
    this.voltageCharge = 0;
    this.flags = { counter: false, retreat: false, chargeFinal: false, downed: false, secondSignal: false, reactivated: false };
    this.strategy = {};
    this.statsT = 0;
    this.preludeShotT = 2;
    this.pushStats(true);
  }

  // ---------------------------------------------------------------- story hooks

  handleStoryEvent(name: string) {
    const r = this.robot;
    switch (name) {
      case 'robotSwipe':
        this.setRobot('swipe');
        break;
      case 'robotRoar':
        r.eyeFlare = 1;
        this.addTrauma(0.35);
        this.bus.emit('sfx', 'roar');
        break;
      case 'heroesLand':
        this.mode = 'standoff';
        for (const h of [this.paladin, this.voltage]) {
          h.visible = true;
          h.anim = 'fall';
          h.animT = 0;
          h.pos.y = 55;
        }
        this.bus.emit('sfx', 'whoosh');
        break;
      case 'alliesArrive':
        this.allies.forEach((h, i) => {
          h.ai.phase = 'queued';
          h.ai.t = 0.15 + i * 0.16;
        });
        this.bus.emit('sfx', 'whoosh');
        break;
      case 'beginEvacuate':
        this.mode = 'evacuate';
        r.cooldown = 0.6;
        break;
      case 'beginAttack':
        this.mode = 'attack';
        r.cooldown = 1.2;
        break;
      case 'counter':
        this.flags.counter = true;
        this.shield.active = false;
        break;
      case 'retreat':
        this.flags.retreat = true;
        this.laser.active = false;
        this.laser.charge = 0;
        this.setRobot('retreat');
        break;
      case 'chargeFinal':
        this.flags.chargeFinal = true;
        this.bus.emit('sfx', 'chargeUp');
        break;
      case 'finalBlast':
        this.fireBolt(this.voltage.pos.clone().add(tmp.set(0, 1.4, 0)), true, 999, true);
        this.voltageCharge = 0;
        break;
      case 'secondSignal':
        this.flags.secondSignal = true;
        break;
      case 'reactivate':
        this.flags.reactivated = true;
        this.addTrauma(0.3);
        break;
    }
  }

  // ---------------------------------------------------------------- update

  update(dt: number) {
    this.time += dt;
    this.updateRobot(dt);
    this.updateHeroes(dt);
    strategies[this.mode]?.(this, dt);
    this.updateProjectiles(dt);
    this.updateCivilians(dt);
    this.shield.flash = Math.max(0, this.shield.flash - dt * 4);
    this.robot.eyeFlare = Math.max(0, this.robot.eyeFlare - dt * 0.8);
    this.statsT -= dt;
    if (this.statsT <= 0) this.pushStats();
  }

  addTrauma(v: number) {
    this.trauma = clamp(this.trauma + v, 0, 1);
  }

  setRobot(state: RobotState) {
    const r = this.robot;
    if (r.state === 'down') return;
    r.state = state;
    r.stateT = 0;
    if (state === 'swipe') {
      r.swipeSide = this.rnd() < 0.5 ? -1 : 1;
      this.bus.emit('sfx', 'servo');
    }
    if (state === 'charge') this.bus.emit('sfx', 'laserCharge');
    if (state !== 'fire' && state !== 'charge') {
      this.laser.active = false;
      this.laser.charge = 0;
    }
  }

  robotEye(out: Vector3) {
    const r = this.robot;
    return out.set(Math.sin(r.yaw) * 2.4, ROBOT_EYE_HEIGHT, Math.cos(r.yaw) * 2.4).add(r.pos);
  }

  robotCore(out: Vector3) {
    const r = this.robot;
    return out.set(Math.sin(r.yaw) * 2.2, ROBOT_CORE_HEIGHT - r.collapse * 8, Math.cos(r.yaw) * 2.2).add(r.pos);
  }

  /** Start a laser attack. The aim decides where the beam starts and sweeps to. */
  startLaser(aim: LaserAim, start: Vector3, end: Vector3, duration = 1) {
    const r = this.robot;
    r.aim = aim;
    r.aimStart.copy(start);
    r.aimEnd.copy(end);
    r.fireDuration = duration;
    this.setRobot('charge');
  }

  private updateRobot(dt: number) {
    const r = this.robot;
    r.stateT += dt;
    switch (r.state) {
      case 'walk': {
        tmp.subVectors(r.walkTarget, r.pos).setY(0);
        const d = tmp.length();
        if (d < 0.4) {
          this.setRobot('idle');
          break;
        }
        tmp.normalize();
        r.yaw = turnToward(r.yaw, Math.atan2(tmp.x, tmp.z), 2, dt);
        r.pos.addScaledVector(tmp, Math.min(d, ROBOT_SPEED * dt));
        this.step(dt, ROBOT_SPEED);
        if (this.mode === 'prelude') {
          this.preludeShotT -= dt;
          if (this.preludeShotT <= 0) {
            this.preludeShotT = 7;
            const z = r.pos.z + 14 + this.rnd() * 6;
            const x = (this.rnd() - 0.5) * 10;
            this.startLaser('point', tmp.set(x, 0, Math.min(z, -14)), tmp2.set(x * 0.4 + 4, 0, Math.min(z + 6, -12)), 0.9);
          }
        }
        break;
      }
      case 'idle': {
        this.faceFocus(dt);
        if (this.mode === 'prelude' || this.mode === 'standoff') {
          if (r.pos.distanceTo(r.walkTarget) > 0.5) this.setRobot('walk');
        }
        break;
      }
      case 'swipe': {
        const hitT = 0.6;
        if (r.stateT - dt < hitT && r.stateT >= hitT) this.swipeImpact();
        if (r.stateT > 1.4) this.setRobot('idle');
        break;
      }
      case 'charge': {
        this.faceFocus(dt);
        this.laser.charge = clamp(r.stateT / 1.2);
        this.robotEye(this.laser.from);
        if (r.stateT > 1.2) {
          this.setRobot('fire');
          this.laser.active = true;
          this.laserTickT = 0;
          this.bus.emit('sfx', 'laserFire');
        }
        break;
      }
      case 'fire': {
        const t = clamp(r.stateT / r.fireDuration);
        this.robotEye(this.laser.from);
        if (r.aim === 'shield') this.laser.to.copy(this.paladin.pos).add(tmp.set(0, 1.9, -1.9));
        else this.laser.to.lerpVectors(r.aimStart, r.aimEnd, t);
        this.laserTickT -= dt;
        if (this.laserTickT <= 0) {
          this.laserTickT = 0.16;
          this.laserImpact();
        }
        this.addTrauma(dt * 0.5);
        if (t >= 1) {
          this.setRobot('idle');
          r.cooldown = 0.8 + this.rnd() * 0.8;
        }
        break;
      }
      case 'stagger':
        if (r.stateT > 0.7) this.setRobot('idle');
        break;
      case 'retreat': {
        tmp.set(0, 0, -170).sub(r.pos).setY(0).normalize();
        r.yaw = turnToward(r.yaw, Math.PI, 1.2, dt);
        r.pos.addScaledVector(tmp, ROBOT_SPEED * 1.5 * dt);
        this.step(dt, ROBOT_SPEED * 1.5);
        break;
      }
      case 'down': {
        const before = r.collapse;
        r.collapse = clamp(r.stateT / 2.4);
        r.collapse = r.collapse * r.collapse * (3 - 2 * r.collapse);
        if (before < 0.92 && r.collapse >= 0.92) {
          this.explode(tmp.copy(r.pos).add(tmp2.set(0, 1, 8)), 9, 'dust');
          this.addTrauma(0.9);
          this.bus.emit('sfx', 'crash');
          this.damageAt(r.pos, 22, 0.35);
        }
        break;
      }
    }
  }

  private step(dt: number, speed: number) {
    const r = this.robot;
    const before = r.stepPhase;
    r.stepPhase += (dt * speed) / 5;
    if (Math.floor(before * 2) !== Math.floor(r.stepPhase * 2)) {
      this.addTrauma(0.18);
      this.bus.emit('sfx', 'stomp');
    }
  }

  private faceFocus(dt: number) {
    const r = this.robot;
    if (this.voltage.visible) tmp.addVectors(this.paladin.pos, this.voltage.pos).multiplyScalar(0.5);
    else tmp.set(0, 0, 30);
    tmp.sub(r.pos);
    r.yaw = turnToward(r.yaw, Math.atan2(tmp.x, tmp.z), 1.5, dt);
  }

  private swipeImpact() {
    const r = this.robot;
    // hit the nearest front building on the swipe side
    let best: Building | null = null;
    let bestD = Infinity;
    for (const b of this.layout.buildings) {
      if (!b.front || b.side !== r.swipeSide) continue;
      const d = Math.abs(b.z0 + b.d / 2 - r.pos.z);
      if (d < bestD) {
        bestD = d;
        best = b;
      }
    }
    if (best && bestD < 22) {
      const p = facadePoint(best, 0.55, 0.5);
      this.explode(tmp.set(p.x, p.y, p.z), 4.5, 'fire');
      this.damageBuilding(best.i, 0.45);
      this.bus.emit('sfx', 'debris');
    }
    this.addTrauma(0.45);
  }

  private laserImpact() {
    const p = this.laser.to;
    if (this.robot.aim === 'shield') {
      this.shield.flash = 1;
      this.explode(p, 1.2, 'spark');
      this.paladin.hp = Math.max(55, this.paladin.hp - 1.2);
      return;
    }
    if (this.mode === 'evacuate') {
      // during the evacuation the beam is drawn skyward / onto the barrier: no collateral damage
      this.explode(p, 1.4, 'spark');
      return;
    }
    this.explode(p, p.y < 1 ? 2.6 : 3.2, 'fire');
    if (p.y < 1 && this.rnd() < 0.5) this.addCrater(p.x, p.z, 1.4 + this.rnd());
    this.damageAt(p, 7, 0.12);
  }

  // ---------------------------------------------------------------- heroes

  private updateHeroes(dt: number) {
    for (const h of this.heroes) {
      if (!h.visible && h.ai.phase === 'queued' && h.ai.t > 0 && this.mode !== 'gallery') {
        h.ai.t -= dt;
        if (h.ai.t <= 0) this.arrive(h);
        continue;
      }
      if (!h.visible) continue;
      if (h.ai.phase === 'arriving' && h.spec.flies) {
        // flyers swoop in and stay airborne
        h.animT += dt;
        h.pos.lerp(h.slot, Math.min(1, dt * 2.5));
        this.faceRobot(h, dt);
        if (h.pos.distanceTo(h.slot) < 0.6) {
          h.ai.phase = 'active';
          h.anim = 'hover';
        }
        continue;
      }
      h.animT += dt;
      if (h.anim === 'fall') {
        h.pos.y = Math.max(0, 55 * (1 - h.animT / 1.0) ** 2);
        if (h.animT >= 1.0) {
          h.pos.y = 0;
          h.anim = 'land';
          h.animT = 0;
          this.explode(tmp.copy(h.pos), 3.5, 'dust');
          this.addCrater(h.pos.x, h.pos.z, 2.2);
          this.addTrauma(0.6);
          this.bus.emit('sfx', 'land');
          h.ai.phase = 'active';
        }
      } else if (h.anim === 'land' && h.animT > 0.9) {
        h.anim = 'idle';
        h.animT = 0;
      }
    }
  }

  private arrive(h: Hero) {
    h.visible = true;
    h.ai.phase = 'arriving';
    h.animT = 0;
    if (h.spec.flies) {
      h.pos.set(h.slot.x * 2.5, h.slot.y + 30, h.slot.z + 40);
      h.anim = 'fly';
    } else {
      h.pos.set(h.slot.x, 45 + this.rnd() * 10, h.slot.z);
      h.anim = 'fall';
    }
  }

  /** Line all 20 heroes up for the gallery screen. */
  setupGallery() {
    this.reset();
    this.mode = 'gallery';
    this.heroes.forEach((h, i) => {
      // 4 staggered rows of 5 across the avenue
      const row = Math.floor(i / 5);
      const col = i % 5;
      h.visible = true;
      h.ai.phase = 'active';
      h.pos.set(-6 + col * 3 + (row % 2) * 1.2, 0, 52 - row * 6);
      h.slot.copy(h.pos);
      h.yaw = 0;
      h.anim = 'gallery';
    });
    this.galleryFocus(this.heroes[0].id);
    this.robot.pos.set(0, 0, -78);
    this.robot.state = 'idle';
    this.trauma = 0;
    for (const c of this.civilians) c.state = 'safe';
  }

  /** Gallery: show one hero alone at centre stage so nothing blocks the camera. */
  galleryFocus(id: string) {
    for (const h of this.heroes) {
      h.visible = h.id === id;
      h.pos.set(0, 0, 46);
      h.yaw = 0;
      h.scale = 1;
      h.anim = 'gallery';
      h.animT = 0;
    }
  }

  setHeroAnim(h: Hero, anim: HeroAnim) {
    if (h.anim === anim || h.anim === 'fall' || h.anim === 'land') return;
    h.anim = anim;
    h.animT = 0;
  }

  /** Moves a hero toward a point; returns true on arrival. */
  moveHero(h: Hero, target: Vector3, speed: number, dt: number, run: HeroAnim = 'run'): boolean {
    tmp.subVectors(target, h.pos);
    const d = tmp.length();
    if (d < 0.3) return true;
    tmp.normalize();
    h.pos.addScaledVector(tmp, Math.min(d, speed * dt));
    if (Math.abs(tmp.x) + Math.abs(tmp.z) > 0.2) h.yaw = turnToward(h.yaw, Math.atan2(tmp.x, tmp.z), 10, dt);
    this.setHeroAnim(h, run);
    return false;
  }

  faceRobot(h: Hero, dt: number) {
    tmp.subVectors(this.robot.pos, h.pos);
    h.yaw = turnToward(h.yaw, Math.atan2(tmp.x, tmp.z), 6, dt);
  }

  // ---------------------------------------------------------------- projectiles

  fireBolt(from: Vector3, hitsRobot: boolean, damage: number, bigOrOpts: boolean | BoltOptions = false) {
    const o: BoltOptions = typeof bigOrOpts === 'boolean' ? { big: bigOrOpts } : bigOrOpts;
    const big = !!o.big;
    const p = this.projectiles.find((q) => !q.active);
    if (!p) return;
    p.active = true;
    p.pos.copy(from);
    p.hitsRobot = hitsRobot;
    p.damage = damage;
    p.big = big;
    p.kind = o.kind ?? 'bolt';
    p.color.set(o.color ?? '#ffe14a');
    p.splash = o.splash ?? 0.24;
    p.speed = o.speed ?? (big ? 70 : 55);
    if (hitsRobot) {
      this.robotCore(p.target).add(tmp.set((this.rnd() - 0.5) * 3, (this.rnd() - 0.5) * 4, 0));
    } else {
      // miss: strike a nearby building facade instead
      const r = this.robot;
      const candidates = this.layout.buildings.filter((b) => b.front && Math.abs(b.z0 + b.d / 2 - r.pos.z) < 26);
      const b = candidates[Math.floor(this.rnd() * candidates.length)];
      if (b) {
        const f = facadePoint(b, this.rnd(), this.rnd());
        p.target.set(f.x, f.y, f.z);
      } else p.target.copy(r.pos).add(tmp.set(8, 4, 0));
    }
    this.bus.emit('sfx', big ? 'megaZap' : SFX_FOR_POWER[p.kind] ?? 'zap');
  }

  private updateProjectiles(dt: number) {
    for (const p of this.projectiles) {
      if (!p.active) continue;
      tmp.subVectors(p.target, p.pos);
      const d = tmp.length();
      const stepLen = p.speed * dt;
      if (d <= stepLen) {
        p.active = false;
        p.pos.copy(p.target);
        this.boltImpact(p);
      } else p.pos.addScaledVector(tmp.normalize(), stepLen);
    }
  }

  private boltImpact(p: Projectile) {
    if (p.hitsRobot) {
      const r = this.robot;
      const floor = this.mode === 'evacuate' ? 34 : this.flags.chargeFinal ? 0 : 12;
      r.hp = Math.max(p.big ? 0 : floor, r.hp - p.damage);
      this.explode(p.pos, p.big ? 10 : 2.2, p.kind === 'missile' || p.kind === 'fire' ? 'fire' : 'electric', '#' + p.color.getHexString());
      this.addTrauma(p.big ? 1 : 0.12);
      if (p.big || r.hp <= 0) {
        r.hp = 0;
        this.flags.downed = true;
        this.setRobot('down');
        this.explode(tmp.copy(p.pos).add(tmp2.set(3, 2, 0)), 8, 'fire');
        this.damageAt(r.pos, 26, 0.5);
        this.bus.emit('sfx', 'bigExplosion');
      } else if (this.rnd() < 0.18 && r.state === 'idle') this.setRobot('stagger');
    } else {
      this.explode(p.pos, 3, 'fire');
      this.damageAt(p.pos, 6, p.splash);
    }
  }

  // ---------------------------------------------------------------- environment

  explode(pos: Vector3, size: number, kind: ExplosionKind, color?: string) {
    this.bus.emit('explosion', { pos: pos.clone(), size, kind, color });
    if (kind === 'fire') this.bus.emit('sfx', size > 6 ? 'bigExplosion' : 'explosion');
    if (kind === 'fire' || kind === 'dust') this.addTrauma(Math.min(0.5, size * 0.05));
    // civilians close to blasts get hurt
    if (kind === 'fire') {
      for (const c of this.civilians) {
        if (c.state === 'safe' || c.state === 'hurt') continue;
        if (c.pos.distanceTo(tmp2.set(pos.x, 0, pos.z)) < size * 1.1 && pos.y < 8) c.state = 'hurt';
      }
    }
  }

  damageBuilding(i: number, amount: number) {
    this.buildingDamage[i] = clamp(this.buildingDamage[i] + amount);
    this.buildingDirty = true;
  }

  damageAt(p: Vector3, radius: number, amount: number) {
    for (const b of this.layout.buildings) {
      const dx = Math.max(b.x0 - p.x, 0, p.x - (b.x0 + b.w));
      const dz = Math.max(b.z0 - p.z, 0, p.z - (b.z0 + b.d));
      const dy = Math.max(0, p.y - b.h);
      const d = Math.hypot(dx, dz, dy);
      if (d < radius) this.damageBuilding(b.i, amount * (1 - d / radius));
    }
  }

  addCrater(x: number, z: number, r: number) {
    if (this.craters.length >= 40) this.craters.shift();
    this.craters.push({ x, z, r });
  }

  private updateCivilians(dt: number) {
    for (const c of this.civilians) {
      c.phase += dt * (c.state === 'flee' ? 10 : 6);
      if (c.state === 'panic') {
        c.turnT -= dt;
        if (c.turnT <= 0) {
          c.turnT = 0.8 + this.rnd() * 1.5;
          c.heading = Math.atan2(c.home.x - c.pos.x + (this.rnd() - 0.5) * 6, c.home.z - c.pos.z + (this.rnd() - 0.5) * 6);
        }
        c.pos.x += Math.sin(c.heading) * c.speed * dt;
        c.pos.z += Math.cos(c.heading) * c.speed * dt;
      } else if (c.state === 'flee') {
        const lane = c.pos.x < 0 ? -4 : 4;
        const hx = lane - c.pos.x;
        c.heading = Math.atan2(hx * 0.3, 1);
        c.pos.x += Math.sin(c.heading) * c.speed * dt;
        c.pos.z += Math.cos(c.heading) * c.speed * dt;
        if (c.pos.z > SAFE_Z) c.state = 'safe';
      }
      c.pos.x = clamp(c.pos.x, -10, 10);
    }
  }

  setCivilianFlee(center: Vector3, radius: number) {
    for (const c of this.civilians) {
      if (c.state === 'panic' && c.pos.distanceTo(center) < radius) {
        c.state = 'flee';
        c.speed = 4.5 + this.rnd() * 2;
      }
    }
  }

  random() {
    return this.rnd();
  }

  // ---------------------------------------------------------------- stats

  cityDamagePct() {
    const ids = this.layout.districtIds;
    let sum = 0;
    for (const i of ids) sum += this.buildingDamage[i];
    return Math.round(clamp((sum / ids.length) * 100 * 1.6 + this.craters.length * 0.4, 0, 100));
  }

  pushStats(force = false) {
    this.statsT = 0.2;
    const s = getStore();
    if (!force && s.phase !== 'playing') return;
    let safe = 0;
    let risk = 0;
    for (const c of this.civilians) {
      if (c.state === 'safe') safe++;
      else if (c.state === 'hurt') risk++;
    }
    s.set({
      stats: {
        robotHP: Math.round(this.robot.hp),
        paladinHP: Math.round(this.paladin.hp),
        voltageHP: Math.round(this.voltage.hp),
        cityDamage: this.cityDamagePct(),
        civiliansSafe: safe,
        civiliansAtRisk: risk + this.civilians.filter((c) => c.state === 'panic').length,
        civiliansTotal: this.civilians.length,
      },
    });
  }
}

function turnToward(current: number, target: number, rate: number, dt: number) {
  let d = target - current;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return current + d * Math.min(1, rate * dt);
}

const SFX_FOR_POWER: Partial<Record<PowerKind, string>> = {
  bolt: 'zap',
  fire: 'fireball',
  water: 'water',
  cosmic: 'cosmic',
  sonic: 'sonic',
  missile: 'missile',
  plasma: 'plasma',
  nature: 'cosmic',
};

/** Battle stations for the 18 allies, spread around Central Avenue by role. */
function assignSlots(heroes: Hero[]) {
  let ground = 0;
  let air = 0;
  for (const id of ALLY_IDS) {
    const h = heroes.find((x) => x.id === id)!;
    const spec = HERO_BY_ID[id];
    if (spec.flies) {
      const a = -0.9 + air * 0.6;
      h.slot.set(Math.sin(a) * 6, 8 + (air % 2) * 4, -2 + Math.cos(a) * 3);
      air++;
    } else {
      const row = ground % 2;
      const col = Math.floor(ground / 2);
      const x = (col % 2 ? -1 : 1) * (1.8 + (col >> 1) * 1.9);
      h.slot.set(Math.max(-7, Math.min(7, x)), 0, 2 + row * 4 + (col >> 1) * 1.2);
      ground++;
    }
  }
  // big units up front
  heroes.find((x) => x.id === 'rocket-prime')!.slot.set(-5.5, 0, -1);
  heroes.find((x) => x.id === 'gigantic')!.slot.set(5.5, 0, 0);
}

export const sim = new BattleSim();
