import { useFrame } from '@react-three/fiber';
import { Suspense, useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { sim } from '../../battle/BattleSim';
import { buildHero } from '../../characters/buildHero';
import { HERO_BY_ID, HEROES } from '../../characters/heroes';
import { poseHero } from '../../characters/pose';
import { MODEL_OVERRIDES } from '../../config/characters';
import { useStore } from '../../state/store';
import { fx } from '../fx/ParticlePool';
import { GltfCharacter } from './GltfCharacter';

const additive = { transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false } as const;
const v = new THREE.Vector3();
const ARC_SEGMENTS = 36;

/** One Compass Alliance hero: procedural model (or GLB override) + signature effects. */
export function HeroActor({ id }: { id: string }) {
  const spec = HERO_BY_ID[id];
  const override = MODEL_OVERRIDES[id];
  const shadows = useStore((s) => s.quality === 'high');
  const rig = useMemo(() => buildHero(spec, { shadows: true }), [spec]);
  useEffect(() => () => rig.dispose(), [rig]);
  useEffect(() => {
    rig.root.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) o.castShadow = shadows && !((o as THREE.Mesh).material as THREE.Material).transparent;
    });
  }, [rig, shadows]);

  const fxGroup = useRef<THREE.Group>(null!);
  const glowBase = useMemo(() => rig.glow.map((m) => m.color.clone()), [rig]);

  useFrame(() => {
    const h = sim.heroById[id];
    const vis = h.visible;
    rig.root.visible = vis && !override?.model;
    fxGroup.current.visible = vis;
    if (!vis) return;
    for (const o of [rig.root, fxGroup.current]) {
      o.position.copy(h.pos);
      o.rotation.y = h.yaw;
      o.scale.setScalar(h.scale);
    }
    if (!override?.model) poseHero(rig, spec, h.anim, h.animT, sim.time, h.seed);
    const boost = h.anim === 'cast' || h.anim === 'charge' || h.anim === 'heal' ? 1.6 : 1;
    rig.glow.forEach((m, i) => m.color.copy(glowBase[i]).multiplyScalar(boost * (0.9 + Math.sin(sim.time * 6 + i) * 0.1)));
  });

  return (
    <>
      <primitive object={rig.root} />
      <group ref={fxGroup}>
        {override?.model && (
          <group scale={override.scale}>
            <Suspense fallback={null}>
              <GltfCharacter config={override} heroKey={id} />
            </Suspense>
          </group>
        )}
        <HeroFx id={id} />
        <BlobShadow size={0.55 * spec.body.height * (spec.anatomy === 'centaur' ? 1.8 : 1)} id={id} />
      </group>
    </>
  );
}

function HeroFx({ id }: { id: string }) {
  switch (id) {
    case 'paladin':
      return <PaladinBarrier />;
    case 'voltage':
      return <VoltageArcs />;
    case 'gigantic':
      return <Girder />;
    case 'hallethea':
      return <Aura color="#b8ff9a" radius={1.6} ground />;
    case 'jupiterian':
      return <Aura color="#cfe8ff" radius={1.2} />;
    case 'tsunami':
      return <WaterRing />;
    case 'captain-phoenix':
      return <Embers />;
    default:
      return null;
  }
}

function BlobShadow({ id, size }: { id: string; size: number }) {
  const ref = useRef<THREE.Mesh>(null!);
  const mat = useRef<THREE.MeshBasicMaterial>(null!);
  useFrame(() => {
    const h = sim.heroById[id];
    ref.current.position.y = (-h.pos.y + 0.27) / h.scale;
    const k = Math.max(0, 1 - h.pos.y / 12);
    mat.current.opacity = 0.45 * k;
    ref.current.scale.setScalar(size * (0.6 + 0.4 * k));
  });
  return (
    <mesh ref={ref} rotation-x={-Math.PI / 2} renderOrder={1}>
      <circleGeometry args={[1, 20]} />
      <meshBasicMaterial ref={mat} color="#000" transparent depthWrite={false} />
    </mesh>
  );
}

function PaladinBarrier() {
  const bubble = useRef<THREE.Mesh>(null!);
  const mat = useRef<THREE.MeshBasicMaterial>(null!);
  useFrame(() => {
    const sh = sim.shield;
    bubble.current.visible = sh.active;
    if (!sh.active) return;
    mat.current.opacity = 0.16 + sh.flash * 0.35 + Math.sin(sim.time * 12) * 0.03;
    bubble.current.scale.setScalar(1 + sh.flash * 0.05);
  });
  return (
    <mesh ref={bubble} position={[0, 1.9, -0.5]} rotation-x={Math.PI / 2} visible={false}>
      <sphereGeometry args={[2.6, 28, 16, 0, Math.PI * 2, 0, Math.PI / 2.2]} />
      <meshBasicMaterial ref={mat} color="#6fb6ff" opacity={0.2} side={THREE.DoubleSide} {...additive} />
    </mesh>
  );
}

function VoltageArcs() {
  const arcs = useRef<THREE.LineSegments>(null!);
  const orb = useRef<THREE.Mesh>(null!);
  const last = useRef(0);
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(ARC_SEGMENTS * 6), 3));
    return g;
  }, []);
  useFrame(() => {
    const h = sim.voltage;
    const charge = sim.voltageCharge;
    orb.current.visible = charge > 0.01;
    orb.current.scale.setScalar(0.15 + charge * 0.9 + Math.sin(sim.time * 30) * 0.04 * charge);
    if (Math.abs(sim.time - last.current) < 0.06) return;
    last.current = sim.time;
    const intensity = h.anim === 'cast' || h.anim === 'charge' ? 1 : h.anim === 'run' ? 0.8 : 0.45;
    const pos = geo.attributes.position as THREE.BufferAttribute;
    const r = Math.random;
    let i = 0;
    const bolts = Math.round(3 + intensity * 4);
    for (let b = 0; b < bolts && i < ARC_SEGMENTS; b++) {
      let x = (r() - 0.5) * 0.7;
      let y = 0.4 + r() * 1.6;
      let z = (r() - 0.5) * 0.5;
      const steps = 4 + Math.floor(r() * 3);
      for (let s = 0; s < steps && i < ARC_SEGMENTS; s++, i++) {
        const nx = x + (r() - 0.5) * 0.35 * (1 + intensity);
        const ny = y + (r() - 0.5) * 0.35;
        const nz = z + (r() - 0.5) * 0.35;
        pos.setXYZ(i * 2, x, y, z);
        pos.setXYZ(i * 2 + 1, nx, ny, nz);
        x = nx;
        y = ny;
        z = nz;
      }
    }
    for (; i < ARC_SEGMENTS; i++) {
      pos.setXYZ(i * 2, 0, -100, 0);
      pos.setXYZ(i * 2 + 1, 0, -100, 0);
    }
    pos.needsUpdate = true;
  });
  return (
    <>
      <lineSegments ref={arcs} geometry={geo} frustumCulled={false}>
        <lineBasicMaterial color={[2.2, 2.0, 0.9]} opacity={0.9} {...additive} />
      </lineSegments>
      <mesh ref={orb} position={[0, 1.4, 0.75]} visible={false}>
        <sphereGeometry args={[0.5, 16, 12]} />
        <meshBasicMaterial color={[2.5, 2.2, 0.8]} opacity={0.85} {...additive} />
      </mesh>
    </>
  );
}

/** The steel girder Gigantic holds over the civilians. */
function Girder() {
  const ref = useRef<THREE.Group>(null!);
  useFrame(() => {
    ref.current.visible = sim.heroById.gigantic.anim === 'lift';
  });
  return (
    <group ref={ref} position={[0, 3.35, 0]} visible={false}>
      {[0.32, -0.32].map((y) => (
        <mesh key={y} position={[0, y, 0]} castShadow>
          <boxGeometry args={[7, 0.08, 0.6]} />
          <meshStandardMaterial color="#5a6270" metalness={0.8} roughness={0.45} />
        </mesh>
      ))}
      <mesh castShadow>
        <boxGeometry args={[7, 0.6, 0.08]} />
        <meshStandardMaterial color="#4a525e" metalness={0.8} roughness={0.5} />
      </mesh>
    </group>
  );
}

function Aura({ color, radius, ground = false }: { color: string; radius: number; ground?: boolean }) {
  const ref = useRef<THREE.Mesh>(null!);
  const mat = useRef<THREE.MeshBasicMaterial>(null!);
  useFrame(() => {
    const p = 0.5 + 0.5 * Math.sin(sim.time * 3);
    mat.current.opacity = (ground ? 0.25 : 0.12) + p * 0.12;
    ref.current.scale.setScalar(1 + p * 0.1);
  });
  return ground ? (
    <mesh ref={ref} position={[0, 0.3, 0]} rotation-x={-Math.PI / 2}>
      <ringGeometry args={[radius * 0.6, radius, 32]} />
      <meshBasicMaterial ref={mat} color={new THREE.Color(color).multiplyScalar(1.6)} {...additive} />
    </mesh>
  ) : (
    <mesh ref={ref} position={[0, 1.1, 0]}>
      <sphereGeometry args={[radius, 20, 14]} />
      <meshBasicMaterial ref={mat} color={new THREE.Color(color).multiplyScalar(1.2)} side={THREE.BackSide} {...additive} />
    </mesh>
  );
}

function WaterRing() {
  const ref = useRef<THREE.Group>(null!);
  useFrame(() => {
    ref.current.rotation.y = sim.time * 1.6;
    ref.current.position.y = 0.9 + Math.sin(sim.time * 1.3) * 0.2;
  });
  return (
    <group ref={ref}>
      {[0, 1, 2].map((i) => (
        <mesh key={i} rotation={[Math.PI / 2 + i * 0.5, i * 1.1, 0]}>
          <torusGeometry args={[0.85 + i * 0.12, 0.018, 6, 40, Math.PI * 1.3]} />
          <meshBasicMaterial color={[0.25, 0.75, 1.2]} opacity={0.35} {...additive} />
        </mesh>
      ))}
    </group>
  );
}

function Embers() {
  useFrame((_, dt) => {
    const h = sim.heroById['captain-phoenix'];
    if (!h.visible || Math.random() > dt * 14) return;
    v.set((Math.random() - 0.5) * 2.4, 1.6 + Math.random() * 0.8, -0.3).applyAxisAngle(new THREE.Vector3(0, 1, 0), h.yaw).add(h.pos);
    fx.sparks.emit({ pos: v, count: 2, speed: 0.8, up: 2, life: [0.5, 1.1], size: [0.08, 0.18], color: '#ffae3a' });
  });
  return null;
}

/** All twenty heroes. */
export function HeroCast() {
  return (
    <>
      {HEROES.map((h) => (
        <HeroActor key={h.id} id={h.id} />
      ))}
    </>
  );
}
