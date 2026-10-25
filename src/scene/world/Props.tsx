import { useFrame } from '@react-three/fiber';
import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { sim } from '../../battle/BattleSim';
import { seeded } from '../../lib/math';
import { getStore } from '../../state/store';
import { CROSS_STREETS, facadePoint, getCityLayout } from '../city/layout';

const m4 = new THREE.Matrix4();
const q = new THREE.Quaternion();
const v = new THREE.Vector3();
const s3 = new THREE.Vector3();
const additive = { transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false } as const;

/** The Sky 7 news helicopter circling the battle with its searchlight on the machine. */
export function NewsHelicopter() {
  const heli = useRef<THREE.Group>(null!);
  const rotor = useRef<THREE.Mesh>(null!);
  const beam = useRef<THREE.Mesh>(null!);
  const spot = useRef<THREE.Mesh>(null!);
  const blink = useRef<THREE.MeshBasicMaterial>(null!);
  const target = new THREE.Vector3();
  useFrame(({ clock }) => {
    const t = sim.time * 0.12 + 1;
    const r = sim.robot.pos;
    heli.current.position.set(Math.sin(t) * 7, 46 + Math.sin(t * 2.3) * 2, r.z + 34 + Math.cos(t) * 10);
    heli.current.lookAt(target.set(r.x, 46, r.z));
    heli.current.rotateX(0.12);
    rotor.current.rotation.y = clock.elapsedTime * 40;
    blink.current.color.setRGB(Math.sin(clock.elapsedTime * 7) > 0.6 ? 3 : 0.2, 0.1, 0.1);
    // searchlight from the helicopter to the robot's chest
    const from = heli.current.position;
    target.copy(r).setY(Math.max(1, 10 - sim.robot.collapse * 8));
    const len = from.distanceTo(target);
    beam.current.position.lerpVectors(from, target, 0.5);
    beam.current.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), v.subVectors(from, target).normalize());
    beam.current.scale.set(1, len, 1);
    spot.current.position.set(target.x, 0.3, target.z + 2);
  });
  return (
    <>
      <group ref={heli}>
        <mesh>
          <capsuleGeometry args={[0.9, 2.2, 4, 10]} />
          <meshStandardMaterial color="#d8dde6" metalness={0.5} roughness={0.4} />
        </mesh>
        <mesh position={[0, 0.2, 0.9]}>
          <sphereGeometry args={[0.8, 12, 10]} />
          <meshStandardMaterial color="#1a2a44" metalness={0.9} roughness={0.15} />
        </mesh>
        <mesh position={[0, 0, -2.6]} rotation-x={Math.PI / 2}>
          <cylinderGeometry args={[0.12, 0.25, 3, 8]} />
          <meshStandardMaterial color="#d8dde6" />
        </mesh>
        <mesh ref={rotor} position={[0, 1.15, 0]}>
          <boxGeometry args={[9, 0.05, 0.3]} />
          <meshStandardMaterial color="#222" transparent opacity={0.55} />
        </mesh>
        <mesh position={[0, -0.9, -0.2]}>
          <sphereGeometry args={[0.12, 8, 6]} />
          <meshBasicMaterial ref={blink} toneMapped={false} />
        </mesh>
      </group>
      <mesh ref={beam}>
        <cylinderGeometry args={[0.35, 2.6, 1, 16, 1, true]} />
        <meshBasicMaterial color={[0.5, 0.55, 0.6]} opacity={0.09} side={THREE.DoubleSide} {...additive} />
      </mesh>
      <mesh ref={spot} rotation-x={-Math.PI / 2}>
        <circleGeometry args={[4, 24]} />
        <meshBasicMaterial color={[0.6, 0.65, 0.7]} opacity={0.18} {...additive} />
      </mesh>
    </>
  );
}

const SIGNS = ['EARTH CITY', 'NEWS 7', 'HOTEL', 'CAFÉ', 'OPEN 24H', 'METRO', 'PHARMACY', 'CINEMA', 'NOODLES', 'BANK'];
const SIGN_COLORS = ['#ff3a7a', '#3ae0ff', '#ffcc3a', '#7aff5a', '#b06cff', '#ff7a2a'];

function signTexture(text: string, color: string) {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 64;
  const g = c.getContext('2d')!;
  g.fillStyle = '#000';
  g.fillRect(0, 0, 256, 64);
  g.font = 'bold 40px Arial Narrow, Arial, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.shadowColor = color;
  g.shadowBlur = 14;
  g.fillStyle = color;
  g.fillText(text, 128, 34);
  g.strokeStyle = color;
  g.lineWidth = 3;
  g.strokeRect(6, 6, 244, 52);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Neon signs on the avenue-facing facades (they flicker and die as buildings take damage). */
export function NeonSigns() {
  const signs = useMemo(() => {
    const rnd = seeded(77);
    const layout = getCityLayout();
    const front = layout.buildings.filter((b) => b.front && b.z0 > -110 && b.z0 < 70);
    return front
      .filter(() => rnd() < 0.45)
      .map((b, i) => {
        const f = facadePoint(b, 0.12 + rnd() * 0.25, 0.5);
        const color = SIGN_COLORS[i % SIGN_COLORS.length];
        const mat = new THREE.MeshBasicMaterial({ map: signTexture(SIGNS[i % SIGNS.length], color), toneMapped: false, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
        mat.color.setScalar(2.2);
        return { b, pos: new THREE.Vector3(f.x - b.side * 0.15, f.y, f.z), rotY: b.side === 1 ? -Math.PI / 2 : Math.PI / 2, mat, seed: rnd() * 10 };
      });
  }, []);
  useFrame(({ clock }) => {
    for (const s of signs) {
      const d = sim.buildingDamage[s.b.i];
      const flicker = d > 0.25 ? (Math.sin(clock.elapsedTime * 23 + s.seed) > 0.3 ? 1 : 0.1) : 1;
      s.mat.color.setScalar((d > 0.6 ? 0 : 2.2) * flicker);
    }
  });
  return (
    <>
      {signs.map((s, i) => (
        <mesh key={i} position={s.pos} rotation-y={s.rotY} material={s.mat}>
          <planeGeometry args={[4.2, 1.05]} />
        </mesh>
      ))}
    </>
  );
}

/** Traffic lights at the cross streets, stuck blinking amber during the emergency. */
export function TrafficLights() {
  const spots = useMemo(() => CROSS_STREETS.flatMap((z) => [new THREE.Vector3(8.6, 0, z - 4.6), new THREE.Vector3(-8.6, 0, z + 4.6)]), []);
  const amber = useRef<THREE.MeshBasicMaterial>(null!);
  const poles = useRef<THREE.InstancedMesh>(null!);
  const lamps = useRef<THREE.InstancedMesh>(null!);
  useLayoutEffect(() => {
    spots.forEach((p, i) => {
      poles.current.setMatrixAt(i, m4.compose(v.copy(p).setY(2.2), q.identity(), s3.set(1, 1, 1)));
      lamps.current.setMatrixAt(i, m4.compose(v.copy(p).setY(4.3), q.identity(), s3.set(1, 1, 1)));
    });
    poles.current.instanceMatrix.needsUpdate = true;
    lamps.current.instanceMatrix.needsUpdate = true;
  }, [spots]);
  useFrame(({ clock }) => {
    amber.current.color.setRGB(Math.sin(clock.elapsedTime * 4) > 0 ? 2.6 : 0.15, Math.sin(clock.elapsedTime * 4) > 0 ? 1.4 : 0.08, 0);
  });
  return (
    <>
      <instancedMesh ref={poles} args={[undefined, undefined, spots.length]} frustumCulled={false} castShadow>
        <cylinderGeometry args={[0.08, 0.1, 4.4, 6]} />
        <meshStandardMaterial color="#2a2c30" metalness={0.6} />
      </instancedMesh>
      <instancedMesh ref={lamps} args={[undefined, undefined, spots.length]} frustumCulled={false}>
        <boxGeometry args={[0.35, 0.9, 0.35]} />
        <meshBasicMaterial ref={amber} toneMapped={false} />
      </instancedMesh>
    </>
  );
}

/** Floating ash and embers drifting through the air around the battle. */
export function Ash() {
  const COUNT = 700;
  const { geo, speeds } = useMemo(() => {
    const rnd = seeded(31);
    const pos = new Float32Array(COUNT * 3);
    const speeds = new Float32Array(COUNT);
    for (let i = 0; i < COUNT; i++) {
      pos[i * 3] = (rnd() - 0.5) * 60;
      pos[i * 3 + 1] = rnd() * 40;
      pos[i * 3 + 2] = -60 + rnd() * 100;
      speeds[i] = 0.3 + rnd() * 0.8;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    return { geo, speeds };
  }, []);
  useFrame((_, dt) => {
    if (getStore().paused) return;
    const p = geo.attributes.position as THREE.BufferAttribute;
    const t = sim.time;
    for (let i = 0; i < COUNT; i++) {
      let y = p.getY(i) - speeds[i] * dt * 0.6;
      if (y < 0) y = 40;
      p.setXYZ(i, p.getX(i) + Math.sin(t * 0.5 + i) * dt * 0.3, y, p.getZ(i) + dt * 0.25);
    }
    p.needsUpdate = true;
  });
  return (
    <points geometry={geo} frustumCulled={false}>
      <pointsMaterial color="#c9a38a" size={0.12} transparent opacity={0.55} depthWrite={false} sizeAttenuation />
    </points>
  );
}

/** Rubble piles at the base of damaged buildings. */
export function Rubble() {
  const MAX = 220;
  const ref = useRef<THREE.InstancedMesh>(null!);
  const layout = getCityLayout();
  const pieces = useMemo(() => {
    const rnd = seeded(12);
    return layout.districtIds.flatMap((id) => {
      const b = layout.buildings[id];
      return Array.from({ length: 6 }, () => ({
        id,
        x: (b.side === 1 ? b.x0 - 0.4 : b.x0 + b.w + 0.4) - b.side * rnd() * 3,
        z: b.z0 + rnd() * b.d,
        s: 0.4 + rnd() * 1.4,
        r: rnd() * Math.PI,
        thr: 0.2 + rnd() * 0.6,
      }));
    }).slice(0, MAX);
  }, [layout]);
  const last = useRef(-1);
  useFrame(() => {
    let sum = 0;
    for (const id of layout.districtIds) sum += sim.buildingDamage[id];
    if (Math.abs(sum - last.current) < 0.01) return;
    last.current = sum;
    pieces.forEach((p, i) => {
      const on = sim.buildingDamage[p.id] > p.thr;
      q.setFromEuler(new THREE.Euler(p.r, p.r * 2, p.r * 0.5));
      m4.compose(v.set(p.x, on ? p.s * 0.25 : -10, p.z), q, s3.setScalar(on ? p.s : 0.001));
      ref.current.setMatrixAt(i, m4);
    });
    ref.current.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, pieces.length]} frustumCulled={false} castShadow receiveShadow>
      <dodecahedronGeometry args={[0.7, 0]} />
      <meshStandardMaterial color="#3d3a38" roughness={0.95} flatShading />
    </instancedMesh>
  );
}
