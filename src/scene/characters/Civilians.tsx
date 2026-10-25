import { useFrame } from '@react-three/fiber';
import { useLayoutEffect, useRef } from 'react';
import * as THREE from 'three';
import { sim } from '../../battle/BattleSim';

const COLORS = ['#c94b3a', '#3a6fc9', '#d9b23a', '#5aa36a', '#8a5ac9', '#d0d0d0', '#2a2a2a', '#c97a3a'];
const m4 = new THREE.Matrix4();
const q = new THREE.Quaternion();
const e = new THREE.Euler();
const p = new THREE.Vector3();
const s = new THREE.Vector3(1, 1, 1);
const geo = new THREE.CapsuleGeometry(0.22, 0.95, 3, 8).translate(0, 0.7, 0);

/** Instanced civilians: idle panic, running to safety, or knocked down. */
export function Civilians() {
  const ref = useRef<THREE.InstancedMesh>(null!);
  const n = sim.civilians.length;
  useLayoutEffect(() => {
    const c = new THREE.Color();
    for (let i = 0; i < n; i++) ref.current.setColorAt(i, c.set(COLORS[i % COLORS.length]));
    ref.current.instanceColor!.needsUpdate = true;
  }, [n]);
  useFrame(() => {
    sim.civilians.forEach((civ, i) => {
      if (civ.state === 'safe') {
        m4.makeScale(0, 0, 0);
      } else if (civ.state === 'hurt') {
        e.set(Math.PI / 2, civ.heading, 0, 'YXZ');
        q.setFromEuler(e);
        m4.compose(p.copy(civ.pos).setY(0.45), q, s);
      } else {
        const run = civ.state === 'flee' ? 1 : 0.4;
        const bob = Math.abs(Math.sin(civ.phase)) * 0.12 * run;
        e.set(0.25 * run, civ.heading, Math.sin(civ.phase) * 0.08, 'YXZ');
        q.setFromEuler(e);
        m4.compose(p.copy(civ.pos).setY(0.24 + bob), q, s);
      }
      ref.current.setMatrixAt(i, m4);
    });
    ref.current.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh ref={ref} args={[geo, undefined, n]} frustumCulled={false}>
      <meshStandardMaterial roughness={0.8} />
    </instancedMesh>
  );
}
