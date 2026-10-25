import { useFrame } from '@react-three/fiber';
import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { sim } from '../../battle/BattleSim';
import { seeded } from '../../lib/math';
import { AVENUE_HALF, CITY_X_MAX, CITY_Z_MAX, CITY_Z_MIN, CROSS_HALF, CROSS_STREETS, SIDEWALK, getCityLayout } from './layout';

// Procedural Earth City: instanced buildings with shader-generated windows,
// roads, sidewalks, streetlights, parked cars and a distant skyline.

const boxGeo = new THREE.BoxGeometry(1, 1, 1).translate(0.5, 0.5, 0.5);
const m4 = new THREE.Matrix4();
const m4b = new THREE.Matrix4();
const q = new THREE.Quaternion();
const v = new THREE.Vector3();
const s3 = new THREE.Vector3();
const col = new THREE.Color();

function makeBuildingMaterial() {
  const mat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.85, metalness: 0.15 });
  mat.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
         attribute float aDamage;
         attribute float aSeed;
         varying float vDamage;
         varying float vSeed;
         varying vec3 vWPos;
         varying vec3 vWNorm;`,
      )
      .replace(
        '#include <worldpos_vertex>',
        `#include <worldpos_vertex>
         vec4 wp = modelMatrix * instanceMatrix * vec4(transformed, 1.0);
         vWPos = wp.xyz;
         vWNorm = normalize(mat3(modelMatrix * instanceMatrix) * objectNormal);
         vDamage = aDamage;
         vSeed = aSeed;`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
         varying float vDamage;
         varying float vSeed;
         varying vec3 vWPos;
         varying vec3 vWNorm;
         float hash21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }`,
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
         {
           float wall = 1.0 - step(0.6, abs(vWNorm.y));
           vec2 wuv = (abs(vWNorm.x) > 0.5 ? vWPos.zy : vWPos.xy) * vec2(1.0 / 2.3, 1.0 / 3.1);
           vec2 cell = floor(wuv);
           vec2 f = fract(wuv);
           float win = step(0.2, f.x) * step(f.x, 0.8) * step(0.28, f.y) * step(f.y, 0.82) * step(2.5, vWPos.y) * wall;
           float h = hash21(cell + vSeed * 17.0);
           float lit = step(0.66, h) * (1.0 - smoothstep(0.15, 0.6, vDamage));
           vec3 warm = mix(vec3(1.0, 0.72, 0.38), vec3(0.75, 0.88, 1.0), step(0.9, h));
           diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.04, 0.05, 0.08), win * 0.85);
           totalEmissiveRadiance += win * lit * warm * (0.6 + 0.5 * fract(h * 7.0));
           // scorch + embers on damaged facades
           float scorch = smoothstep(0.1, 0.9, vDamage);
           diffuseColor.rgb *= 1.0 - scorch * 0.75;
           float ember = step(0.93, hash21(floor(vWPos.xy * 0.7) + vSeed)) * smoothstep(0.35, 0.9, vDamage) * wall;
           totalEmissiveRadiance += ember * vec3(1.0, 0.35, 0.05) * 1.5;
         }`,
      );
  };
  return mat;
}

function Buildings() {
  const layout = getCityLayout();
  const ref = useRef<THREE.InstancedMesh>(null!);
  const material = useMemo(makeBuildingMaterial, []);
  const count = layout.buildings.length;
  const damageAttr = useMemo(() => new THREE.InstancedBufferAttribute(new Float32Array(count), 1), [count]);
  const seedAttr = useMemo(
    () => new THREE.InstancedBufferAttribute(Float32Array.from(layout.buildings.map((b) => b.tint)), 1),
    [layout, count],
  );

  const writeMatrices = () => {
    const mesh = ref.current;
    for (const b of layout.buildings) {
      const dmg = sim.buildingDamage[b.i];
      // tilt toward the avenue around the facade's base edge, and sink a little
      const pivotX = b.side === 1 ? b.x0 : b.x0 + b.w;
      const tilt = dmg > 0.3 ? (dmg - 0.3) * 0.16 * b.side : 0;
      m4.makeTranslation(pivotX, -dmg * b.h * 0.06, 0);
      q.setFromAxisAngle(v.set(0, 0, 1), tilt);
      m4b.makeRotationFromQuaternion(q);
      m4.multiply(m4b);
      m4b.compose(v.set(b.x0 - pivotX, 0, b.z0), q.identity(), s3.set(b.w, b.h, b.d));
      m4.multiply(m4b);
      mesh.setMatrixAt(b.i, m4);
      damageAttr.setX(b.i, dmg);
    }
    mesh.instanceMatrix.needsUpdate = true;
    damageAttr.needsUpdate = true;
  };

  useLayoutEffect(() => {
    const mesh = ref.current;
    mesh.geometry.setAttribute('aDamage', damageAttr);
    mesh.geometry.setAttribute('aSeed', seedAttr);
    for (const b of layout.buildings) {
      const t = b.tint;
      col.setHSL(0.58 + t * 0.08, 0.08 + t * 0.1, 0.16 + t * 0.14);
      mesh.setColorAt(b.i, col);
    }
    mesh.instanceColor!.needsUpdate = true;
    writeMatrices();
  }, []);

  useFrame(() => {
    if (!sim.buildingDirty) return;
    sim.buildingDirty = false;
    writeMatrices();
  });

  const geo = useMemo(() => boxGeo.clone(), []);
  return <instancedMesh ref={ref} args={[geo, material, count]} frustumCulled={false} castShadow receiveShadow />;
}

function Rooftops() {
  const layout = getCityLayout();
  const items = useMemo(() => {
    const rnd = seeded(99);
    const out: { pos: THREE.Vector3; scale: THREE.Vector3; beacon: boolean }[] = [];
    for (const b of layout.buildings) {
      const n = 1 + Math.floor(rnd() * 2);
      for (let k = 0; k < n; k++) {
        const w = 1.5 + rnd() * 2.5;
        out.push({
          pos: new THREE.Vector3(b.x0 + rnd() * (b.w - w), b.h, b.z0 + rnd() * (b.d - w)),
          scale: new THREE.Vector3(w, 0.8 + rnd() * 2, w),
          beacon: false,
        });
      }
      if (b.h > 45) out.push({ pos: new THREE.Vector3(b.x0 + b.w / 2, b.h, b.z0 + b.d / 2), scale: new THREE.Vector3(0.25, 7, 0.25), beacon: true });
    }
    return out;
  }, [layout]);
  const ref = useRef<THREE.InstancedMesh>(null!);
  const beacons = useMemo(() => items.filter((i) => i.beacon), [items]);
  const beaconRef = useRef<THREE.InstancedMesh>(null!);
  useLayoutEffect(() => {
    items.forEach((it, i) => {
      m4.compose(it.pos, q.identity(), it.scale);
      ref.current.setMatrixAt(i, m4);
    });
    ref.current.instanceMatrix.needsUpdate = true;
    beacons.forEach((it, i) => {
      m4.compose(v.copy(it.pos).setY(it.pos.y + it.scale.y), q.identity(), s3.set(0.6, 0.6, 0.6));
      beaconRef.current.setMatrixAt(i, m4);
    });
    beaconRef.current.instanceMatrix.needsUpdate = true;
  }, [items, beacons]);
  const beaconMat = useRef<THREE.MeshBasicMaterial>(null!);
  useFrame(({ clock }) => {
    beaconMat.current.color.setRGB(Math.sin(clock.elapsedTime * 3) > 0 ? 1.6 : 0.25, 0.05, 0.05);
  });
  return (
    <>
      <instancedMesh ref={ref} args={[boxGeo, undefined, items.length]} frustumCulled={false}>
        <meshStandardMaterial color="#2a2f3a" roughness={0.9} />
      </instancedMesh>
      <instancedMesh ref={beaconRef} args={[undefined, undefined, beacons.length]} frustumCulled={false}>
        <sphereGeometry args={[0.5, 8, 6]} />
        <meshBasicMaterial ref={beaconMat} color="#ff2020" toneMapped={false} />
      </instancedMesh>
    </>
  );
}

function Streets() {
  const zLen = CITY_Z_MAX - CITY_Z_MIN;
  const zMid = (CITY_Z_MAX + CITY_Z_MIN) / 2;
  const dashes = useMemo(() => {
    const arr: number[] = [];
    for (let z = CITY_Z_MIN; z < CITY_Z_MAX; z += 6) {
      if (CROSS_STREETS.some((c) => Math.abs(c - z) < CROSS_HALF + 1)) continue;
      arr.push(z);
    }
    return arr;
  }, []);
  const dashRef = useRef<THREE.InstancedMesh>(null!);
  useLayoutEffect(() => {
    dashes.forEach((z, i) => {
      m4.compose(v.set(0, 0.03, z), q.identity(), s3.set(0.25, 1, 2.6));
      dashRef.current.setMatrixAt(i, m4);
    });
    dashRef.current.instanceMatrix.needsUpdate = true;
  }, [dashes]);

  return (
    <group>
      {/* ground / asphalt */}
      <mesh rotation-x={-Math.PI / 2} position={[0, 0, zMid]} receiveShadow>
        <planeGeometry args={[CITY_X_MAX * 2 + 200, zLen + 400]} />
        <meshStandardMaterial color="#14161b" roughness={0.55} metalness={0.35} />
      </mesh>
      {/* sidewalks */}
      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * (AVENUE_HALF + (SIDEWALK - AVENUE_HALF) / 2), 0.12, zMid]} receiveShadow>
          <boxGeometry args={[SIDEWALK - AVENUE_HALF, 0.24, zLen]} />
          <meshStandardMaterial color="#2b2d33" roughness={0.9} />
        </mesh>
      ))}
      {/* center dashes */}
      <instancedMesh ref={dashRef} args={[undefined, undefined, dashes.length]} frustumCulled={false}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial color="#a8862a" />
      </instancedMesh>
      {/* cross streets (slightly lighter asphalt) */}
      {CROSS_STREETS.map((z) => (
        <mesh key={z} rotation-x={-Math.PI / 2} position={[0, 0.01, z]}>
          <planeGeometry args={[CITY_X_MAX * 2, CROSS_HALF * 2]} />
          <meshStandardMaterial color="#191b21" roughness={0.95} />
        </mesh>
      ))}
    </group>
  );
}

function StreetLights() {
  const spots = useMemo(() => {
    const arr: THREE.Vector3[] = [];
    for (let z = CITY_Z_MIN + 6; z < CITY_Z_MAX; z += 14) for (const side of [-1, 1]) arr.push(new THREE.Vector3(side * 9.6, 0, z + (side > 0 ? 7 : 0)));
    return arr;
  }, []);
  const poles = useRef<THREE.InstancedMesh>(null!);
  const heads = useRef<THREE.InstancedMesh>(null!);
  const pools = useRef<THREE.InstancedMesh>(null!);
  useLayoutEffect(() => {
    spots.forEach((p, i) => {
      m4.compose(v.copy(p).setY(3), q.identity(), s3.set(1, 1, 1));
      poles.current.setMatrixAt(i, m4);
      m4.compose(v.set(p.x - Math.sign(p.x) * 1.2, 6.1, p.z), q.identity(), s3.set(1, 1, 1));
      heads.current.setMatrixAt(i, m4);
      q.setFromAxisAngle(v.set(1, 0, 0), -Math.PI / 2);
      m4.compose(v.set(p.x - Math.sign(p.x) * 1.6, 0.05, p.z), q, s3.set(1, 1, 1));
      pools.current.setMatrixAt(i, m4);
      q.identity();
    });
    for (const r of [poles, heads, pools]) r.current.instanceMatrix.needsUpdate = true;
  }, [spots]);
  return (
    <>
      <instancedMesh ref={poles} args={[undefined, undefined, spots.length]} frustumCulled={false}>
        <cylinderGeometry args={[0.09, 0.12, 6, 6]} />
        <meshStandardMaterial color="#3a3d44" metalness={0.6} roughness={0.5} />
      </instancedMesh>
      <instancedMesh ref={heads} args={[undefined, undefined, spots.length]} frustumCulled={false}>
        <boxGeometry args={[1.4, 0.18, 0.4]} />
        <meshBasicMaterial color={[2.2, 1.6, 0.9]} toneMapped={false} />
      </instancedMesh>
      {/* fake light pools on the road — no dynamic lights needed */}
      <instancedMesh ref={pools} args={[undefined, undefined, spots.length]} frustumCulled={false}>
        <circleGeometry args={[4.2, 24]} />
        <meshBasicMaterial color="#ffb565" transparent opacity={0.09} depthWrite={false} blending={THREE.AdditiveBlending} />
      </instancedMesh>
    </>
  );
}

const CAR_COLORS = ['#8a1c1c', '#1f3b70', '#c9c9c9', '#202020', '#5a5f66', '#b88a2a', '#2f5a3a'];

function Vehicles() {
  const cars = useMemo(() => {
    const rnd = seeded(4242);
    const arr: { x: number; z: number; yaw: number; color: string }[] = [];
    for (let i = 0; i < 16; i++) {
      const side = rnd() < 0.5 ? -1 : 1;
      const z = -70 + rnd() * 120;
      const crashed = rnd() < 0.35;
      arr.push({ x: side * (6.2 + rnd() * 0.8), z, yaw: crashed ? (rnd() - 0.5) * 1.6 : 0, color: CAR_COLORS[i % CAR_COLORS.length] });
    }
    return arr;
  }, []);
  return (
    <group>
      {cars.map((c, i) => (
        <group key={i} position={[c.x, 0, c.z]} rotation-y={c.yaw}>
          <mesh position={[0, 0.55, 0]}>
            <boxGeometry args={[1.8, 0.7, 4.2]} />
            <meshStandardMaterial color={c.color} metalness={0.6} roughness={0.35} />
          </mesh>
          <mesh position={[0, 1.1, -0.2]}>
            <boxGeometry args={[1.6, 0.5, 2.2]} />
            <meshStandardMaterial color="#0d1117" metalness={0.8} roughness={0.2} />
          </mesh>
          <mesh position={[0, 0.6, 2.11]}>
            <boxGeometry args={[1.4, 0.15, 0.02]} />
            <meshBasicMaterial color={[1.6, 1.5, 1.2]} toneMapped={false} />
          </mesh>
          <mesh position={[0, 0.6, -2.11]}>
            <boxGeometry args={[1.4, 0.12, 0.02]} />
            <meshBasicMaterial color={[1.4, 0.1, 0.1]} toneMapped={false} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function DistantSkyline() {
  const items = useMemo(() => {
    const rnd = seeded(5);
    const arr: THREE.Matrix4[] = [];
    for (let i = 0; i < 160; i++) {
      const ang = rnd() * Math.PI * 2;
      const r = 170 + rnd() * 120;
      const w = 10 + rnd() * 20;
      const h = 20 + rnd() * 90;
      arr.push(new THREE.Matrix4().compose(new THREE.Vector3(Math.cos(ang) * r, 0, Math.sin(ang) * r - 20), new THREE.Quaternion(), new THREE.Vector3(w, h, w)));
    }
    return arr;
  }, []);
  const ref = useRef<THREE.InstancedMesh>(null!);
  useLayoutEffect(() => {
    items.forEach((m, i) => ref.current.setMatrixAt(i, m));
    ref.current.instanceMatrix.needsUpdate = true;
  }, [items]);
  return (
    <instancedMesh ref={ref} args={[new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), undefined, items.length]} frustumCulled={false}>
      <meshStandardMaterial color="#0e1018" roughness={1} />
    </instancedMesh>
  );
}

function Craters() {
  const ref = useRef<THREE.InstancedMesh>(null!);
  const last = useRef(-1);
  useFrame(() => {
    const list = sim.craters;
    const key = list.length + (list[0]?.x ?? 0);
    if (key === last.current) return;
    last.current = key;
    q.setFromAxisAngle(v.set(1, 0, 0), -Math.PI / 2);
    for (let i = 0; i < 40; i++) {
      const c = list[i];
      if (c) m4.compose(v.set(c.x, 0.27, c.z), q, s3.set(c.r, c.r, 1));
      else m4.compose(v.set(0, -10, 0), q, s3.set(0.001, 0.001, 1));
      ref.current.setMatrixAt(i, m4);
    }
    q.identity();
    ref.current.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, 40]} frustumCulled={false}>
      <circleGeometry args={[1, 16]} />
      <meshBasicMaterial color="#050505" transparent opacity={0.8} depthWrite={false} />
    </instancedMesh>
  );
}

export function City() {
  return (
    <group>
      <Streets />
      <Buildings />
      <Rooftops />
      <StreetLights />
      <Vehicles />
      <DistantSkyline />
      <Craters />
    </group>
  );
}
