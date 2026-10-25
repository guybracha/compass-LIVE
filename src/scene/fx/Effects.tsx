import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { sim, type ExplosionKind } from '../../battle/BattleSim';
import { getStore, useStore } from '../../state/store';
import { fx } from './ParticlePool';

// Explosions (pooled fireballs + particles + one shared flash light),
// building smoke, energy projectiles and police emergency lights.

const FIREBALLS = 24;
const v = new THREE.Vector3();

interface Fireball {
  mesh: THREE.Mesh;
  mat: THREE.MeshBasicMaterial;
  t: number;
  dur: number;
  size: number;
}

const FIRE_COLORS: Record<ExplosionKind, THREE.Color> = {
  fire: new THREE.Color(1.8, 0.75, 0.2),
  spark: new THREE.Color(1, 1.35, 1.8),
  electric: new THREE.Color(1.6, 1.5, 0.5),
  dust: new THREE.Color(0.5, 0.42, 0.35),
};

export function Explosions() {
  const group = useRef<THREE.Group>(null!);
  const flash = useRef<THREE.PointLight>(null!);
  const viewport = useThree((s) => s.size);
  const quality = useStore((s) => s.quality);

  const balls = useMemo<Fireball[]>(() => {
    const geo = new THREE.SphereGeometry(1, 16, 12);
    return Array.from({ length: FIREBALLS }, () => {
      const mat = new THREE.MeshBasicMaterial({ transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.visible = false;
      return { mesh, mat, t: 0, dur: 1, size: 1 };
    });
  }, []);
  const next = useRef(0);

  useEffect(() => {
    balls.forEach((b) => group.current.add(b.mesh));
  }, [balls]);

  useEffect(() => {
    const scale = quality === 'low' ? 0.5 : 1;
    fx.sparks.scale = fx.smoke.scale = scale;
  }, [quality]);

  useEffect(() => {
    const px = viewport.height * 0.9;
    fx.sparks.setViewportScale(px);
    fx.smoke.setViewportScale(px);
  }, [viewport.height]);

  useEffect(
    () =>
      sim.bus.on('explosion', ({ pos, size, kind, color }) => {
        if (kind !== 'dust') {
          const b = balls[next.current];
          next.current = (next.current + 1) % FIREBALLS;
          b.mesh.position.copy(pos);
          b.mesh.visible = true;
          b.t = 0;
          b.dur = kind === 'spark' ? 0.25 : 0.45 + size * 0.04;
          b.size = kind === 'spark' ? size * 0.6 : size;
          if (color && kind !== 'fire') b.mat.color.set(color).multiplyScalar(1.3);
          else b.mat.color.copy(FIRE_COLORS[kind]);
          flash.current.position.copy(pos).add(v.set(0, 1.5, 0));
          flash.current.color.copy(b.mat.color).multiplyScalar(0.4);
          flash.current.intensity = Math.max(flash.current.intensity, kind === 'spark' ? 40 : 120 * size);
        }
        switch (kind) {
          case 'fire':
            fx.sparks.emit({ pos, count: 14 * size, speed: 6 + size * 2, spread: 0.6, up: 4, life: [0.5, 1.3], size: [0.15, 0.4], color: '#ffb347', gravity: 14, drag: 0.6 });
            fx.smoke.emit({ pos, count: 5 * size, speed: 1.5, spread: 0.3, up: 2.5, life: [2.5, 5], size: [1.5, 3 + size * 0.4], color: '#2b2622', grow: 0.5, drag: 0.4, radius: size * 0.4 });
            break;
          case 'spark':
            fx.sparks.emit({ pos, count: 10, speed: 9, spread: 1, life: [0.2, 0.5], size: [0.08, 0.18], color: color ?? '#bfe4ff', gravity: 10 });
            break;
          case 'electric':
            fx.sparks.emit({ pos, count: 16 * Math.min(size, 6), speed: 10 + size, spread: 1, life: [0.2, 0.7], size: [0.1, 0.3], color: color ?? '#fff27a', gravity: 6, drag: 1 });
            if (size > 5) fx.smoke.emit({ pos, count: 30, speed: 3, up: 3, life: [3, 6], size: [3, 6], color: '#252220', grow: 0.4, drag: 0.5, radius: 3 });
            break;
          case 'dust':
            fx.smoke.emit({ pos, count: 8 * size, speed: 6 + size, flat: true, up: 0.8, life: [1.2, 2.6], size: [1.2, 2.6], color: '#6b6158', grow: 0.9, drag: 1.8, radius: 0.5 });
            fx.sparks.emit({ pos, count: 6 * size, speed: 5, spread: 0.4, up: 3, life: [0.4, 0.9], size: [0.06, 0.14], color: '#d9c6a5', gravity: 12 });
            break;
        }
      }),
    [balls],
  );

  useFrame((_, rawDt) => {
    if (getStore().paused) return;
    const dt = Math.min(rawDt, 0.05);
    for (const b of balls) {
      if (!b.mesh.visible) continue;
      b.t += dt;
      const k = b.t / b.dur;
      if (k >= 1) {
        b.mesh.visible = false;
        continue;
      }
      b.mesh.scale.setScalar(b.size * (0.3 + Math.sqrt(k) * 0.9));
      b.mat.opacity = (1 - k) * (1 - k);
    }
    flash.current.intensity *= Math.exp(-dt * 9);
  });

  return (
    <group ref={group}>
      <pointLight ref={flash} intensity={0} distance={60} decay={1.5} />
    </group>
  );
}

/** Advances particle pools and feeds smoke from damaged buildings. */
export function ParticleSystems() {
  const layout = sim.layout;
  useEffect(() => {
    fx.sparks.clear();
    fx.smoke.clear();
  }, []);
  useFrame((_, rawDt) => {
    if (getStore().paused) return;
    const dt = Math.min(rawDt, 0.05);
    for (const i of layout.districtIds) {
      const d = sim.buildingDamage[i];
      if (d < 0.25) continue;
      if (Math.random() < dt * d * 2.2) {
        const b = layout.buildings[i];
        v.set(b.x0 + Math.random() * b.w, b.h * (1 - d * 0.1), b.z0 + Math.random() * b.d);
        fx.smoke.emit({ pos: v, count: 1, speed: 0.6, spread: 0.2, up: 3.5, life: [5, 9], size: [3, 5], color: '#1d1a19', grow: 0.35, drag: 0.1 });
        if (d > 0.5 && Math.random() < 0.5) fx.sparks.emit({ pos: v, count: 2, speed: 1, up: 3, life: [1, 2], size: [0.1, 0.2], color: '#ff7a1a' });
      }
    }
    // the robot leaks smoke when badly damaged
    if (sim.robot.hp < 60 && Math.random() < dt * 4) {
      sim.robotCore(v).add(new THREE.Vector3((Math.random() - 0.5) * 4, 2, -1));
      fx.smoke.emit({ pos: v, count: 1, speed: 0.4, up: 2.5, life: [3, 5], size: [1.2, 2.4], color: '#222', grow: 0.4 });
    }
    fx.sparks.update(dt);
    fx.smoke.update(dt);
  });
  return (
    <>
      <primitive object={fx.smoke.points} />
      <primitive object={fx.sparks.points} />
    </>
  );
}

const MAX_PROJ = 160;
const projGeo = new THREE.SphereGeometry(1, 10, 8);
const m4 = new THREE.Matrix4();
const qq = new THREE.Quaternion();
const sc = new THREE.Vector3();
const fwd = new THREE.Vector3(0, 0, 1);
const dir = new THREE.Vector3();
const hot = new THREE.Color();

/** All energy projectiles in two instanced draw calls, coloured per hero power. */
export function Projectiles() {
  const core = useRef<THREE.InstancedMesh>(null!);
  const halo = useRef<THREE.InstancedMesh>(null!);
  useEffect(() => {
    for (const m of [core.current, halo.current]) {
      m.setColorAt(0, hot.set('#fff'));
      m.instanceColor!.setUsage(THREE.DynamicDrawUsage);
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    }
  }, []);
  useFrame(() => {
    let n = 0;
    for (const p of sim.projectiles) {
      if (!p.active || n >= MAX_PROJ) continue;
      dir.subVectors(p.target, p.pos).normalize();
      qq.setFromUnitVectors(fwd, dir);
      const big = p.big ? 3.2 : p.kind === 'missile' ? 0.8 : 1;
      const sonic = p.kind === 'sonic';
      sc.set(0.22 * big, 0.22 * big, (sonic ? 0.3 : 1.4) * big);
      core.current.setMatrixAt(n, m4.compose(p.pos, qq, sc));
      core.current.setColorAt(n, hot.copy(p.color).lerp(new THREE.Color('#ffffff'), 0.55).multiplyScalar(3));
      sc.set((sonic ? 1.1 : 0.6) * big, (sonic ? 1.1 : 0.6) * big, (sonic ? 0.25 : 2.2) * big);
      halo.current.setMatrixAt(n, m4.compose(p.pos, qq, sc));
      halo.current.setColorAt(n, hot.copy(p.color).multiplyScalar(1.6));
      n++;
      // trails
      if (p.kind === 'missile') fx.smoke.emit({ pos: p.pos, count: 1, speed: 0.3, up: 0.3, life: [0.8, 1.6], size: [0.5, 0.9], color: '#8a8580', grow: 0.8 });
      else if (Math.random() < 0.6)
        fx.sparks.emit({ pos: p.pos, count: p.big ? 6 : 1, speed: p.kind === 'water' ? 2.5 : 1.5, life: [0.15, 0.4], size: [0.1, 0.25], color: '#' + p.color.getHexString(), gravity: p.kind === 'water' ? 9 : 0 });
    }
    for (const m of [core.current, halo.current]) {
      m.count = n;
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
    }
  });
  return (
    <>
      <instancedMesh ref={core} args={[projGeo, undefined, MAX_PROJ]} frustumCulled={false}>
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>
      <instancedMesh ref={halo} args={[projGeo, undefined, MAX_PROJ]} frustumCulled={false}>
        <meshBasicMaterial transparent opacity={0.45} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
      </instancedMesh>
    </>
  );
}

/** Two police cruisers with alternating red/blue light bars (two dynamic lights total). */
export function EmergencyLights() {
  const red = useRef<THREE.PointLight>(null!);
  const blue = useRef<THREE.PointLight>(null!);
  const mats = useRef<THREE.MeshBasicMaterial[]>([]);
  const cars = [
    { x: -5.2, z: 30, yaw: 0.5 },
    { x: 5.6, z: 36, yaw: -0.3 },
  ];
  useFrame(({ clock }) => {
    const t = clock.elapsedTime * 6;
    const a = Math.sin(t) > 0 ? 1 : 0;
    red.current.intensity = 30 * a;
    blue.current.intensity = 30 * (1 - a);
    mats.current.forEach((m, i) => {
      const on = i % 2 === 0 ? a : 1 - a;
      if (i % 2 === 0) m.color.setRGB(3 * on + 0.2, 0.05, 0.05);
      else m.color.setRGB(0.05, 0.2, 3 * on + 0.2);
    });
  });
  return (
    <group>
      {cars.map((c, i) => (
        <group key={i} position={[c.x, 0, c.z]} rotation-y={c.yaw}>
          <mesh position={[0, 0.55, 0]}>
            <boxGeometry args={[1.85, 0.7, 4.4]} />
            <meshStandardMaterial color="#e8e8ea" metalness={0.5} roughness={0.35} />
          </mesh>
          <mesh position={[0, 0.56, 0]}>
            <boxGeometry args={[1.87, 0.25, 2.2]} />
            <meshStandardMaterial color="#0d1b3d" />
          </mesh>
          <mesh position={[0, 1.1, -0.2]}>
            <boxGeometry args={[1.6, 0.5, 2.2]} />
            <meshStandardMaterial color="#0d1117" metalness={0.8} roughness={0.2} />
          </mesh>
          {[-0.4, 0.4].map((x, k) => (
            <mesh key={x} position={[x, 1.42, -0.2]}>
              <boxGeometry args={[0.6, 0.14, 0.3]} />
              <meshBasicMaterial ref={(m) => void (mats.current[i * 2 + k] = m!)} toneMapped={false} />
            </mesh>
          ))}
        </group>
      ))}
      <pointLight ref={red} position={[-5, 3, 30]} color="#ff2a2a" distance={26} decay={1.5} />
      <pointLight ref={blue} position={[5.5, 3, 36]} color="#2a5bff" distance={26} decay={1.5} />
    </group>
  );
}
