import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef, type RefObject } from 'react';
import * as THREE from 'three';
import { sim } from '../../battle/BattleSim';
import { clamp } from '../../lib/math';

// The unidentified machine: a procedural multi-part mech (~18 units tall) with
// stomping walk, arm swipe, eye laser, stagger, collapse and reactivation states.

const Y_AXIS = new THREE.Vector3(0, 1, 0);
const tmp = new THREE.Vector3();
const tmp2 = new THREE.Vector3();

export function Robot() {
  const root = useRef<THREE.Group>(null!);
  const tilt = useRef<THREE.Group>(null!);
  const hips = useRef<THREE.Group>(null!);
  const torso = useRef<THREE.Group>(null!);
  const head = useRef<THREE.Group>(null!);
  const legL = useRef<THREE.Group>(null!);
  const legR = useRef<THREE.Group>(null!);
  const shinL = useRef<THREE.Group>(null!);
  const shinR = useRef<THREE.Group>(null!);
  const armL = useRef<THREE.Group>(null!);
  const armR = useRef<THREE.Group>(null!);
  const foreL = useRef<THREE.Group>(null!);
  const foreR = useRef<THREE.Group>(null!);
  const coreLight = useRef<THREE.PointLight>(null!);
  const beam = useRef<THREE.Mesh>(null!);
  const beamCore = useRef<THREE.Mesh>(null!);
  const chargeGlow = useRef<THREE.Mesh>(null!);
  const transmit = useRef<THREE.Mesh>(null!);
  const signal = useRef<THREE.Mesh>(null!);

  const m = useMemo(
    () => ({
      hull: new THREE.MeshStandardMaterial({ color: '#3a3f48', metalness: 0.85, roughness: 0.38 }),
      dark: new THREE.MeshStandardMaterial({ color: '#1b1e24', metalness: 0.7, roughness: 0.5 }),
      rust: new THREE.MeshStandardMaterial({ color: '#6e2b18', metalness: 0.6, roughness: 0.55 }),
      eye: new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 0.25, 0.1), toneMapped: false }),
      core: new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 0.9, 0.2), toneMapped: false }),
      vent: new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 0.35, 0.05), toneMapped: false }),
    }),
    [],
  );

  const leg = (side: 1 | -1, legRef: RefObject<THREE.Group>, shinRef: RefObject<THREE.Group>) => (
    <group ref={legRef} position={[side * 2.1, -0.4, 0]}>
      <mesh material={m.hull} position={[0, -2, 0]}>
        <boxGeometry args={[1.7, 4.2, 2]} />
      </mesh>
      <mesh material={m.rust} position={[side * 0.9, -1.6, 0]}>
        <boxGeometry args={[0.3, 2.4, 1.6]} />
      </mesh>
      <group ref={shinRef} position={[0, -4.1, 0]}>
        <mesh material={m.dark} position={[0, 0, 0]}>
          <sphereGeometry args={[0.95, 12, 10]} />
        </mesh>
        <mesh material={m.hull} position={[0, -1.9, -0.2]}>
          <boxGeometry args={[1.5, 3.6, 1.8]} />
        </mesh>
        <mesh material={m.hull} position={[0, -3.75, 0.5]}>
          <boxGeometry args={[2.2, 0.7, 3.4]} />
        </mesh>
        <mesh material={m.vent} position={[0, -1.4, 0.72]}>
          <boxGeometry args={[0.8, 0.18, 0.05]} />
        </mesh>
      </group>
    </group>
  );

  const arm = (side: 1 | -1, armRef: RefObject<THREE.Group>, foreRef: RefObject<THREE.Group>) => (
    <group ref={armRef} position={[side * 4.4, 4.6, 0]}>
      <mesh material={m.rust}>
        <sphereGeometry args={[1.35, 14, 10]} />
      </mesh>
      <mesh material={m.hull} position={[side * 0.3, -2.1, 0]}>
        <boxGeometry args={[1.3, 3.6, 1.4]} />
      </mesh>
      <group ref={foreRef} position={[side * 0.3, -4.1, 0]}>
        <mesh material={m.dark}>
          <sphereGeometry args={[0.8, 10, 8]} />
        </mesh>
        <mesh material={m.hull} position={[0, -2, 0]}>
          <boxGeometry args={[1.7, 3.8, 1.7]} />
        </mesh>
        {[-0.55, 0, 0.55].map((x) => (
          <mesh key={x} material={m.dark} position={[x, -4.4, 0.3]} rotation-x={0.35}>
            <boxGeometry args={[0.35, 1.5, 0.4]} />
          </mesh>
        ))}
      </group>
    </group>
  );

  useEffect(() => {
    root.current.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) o.castShadow = true;
    });
  }, []);

  useFrame(() => {
    const r = sim.robot;
    const t = sim.time;
    root.current.position.copy(r.pos);
    root.current.rotation.y = r.yaw;

    // reset joints
    for (const g of [hips, torso, head, legL, legR, shinL, shinR, armL, armR, foreL, foreR]) g.current.rotation.set(0, 0, 0);
    hips.current.position.y = 8.6;

    const walking = r.state === 'walk' || r.state === 'retreat';
    const ph = r.stepPhase * Math.PI * 2;
    if (walking) {
      legL.current.rotation.x = Math.sin(ph) * 0.38;
      legR.current.rotation.x = -Math.sin(ph) * 0.38;
      shinL.current.rotation.x = Math.max(0, -Math.sin(ph + 1)) * 0.6;
      shinR.current.rotation.x = Math.max(0, Math.sin(ph + 1)) * 0.6;
      hips.current.position.y = 8.6 - Math.abs(Math.cos(ph)) * 0.35;
      torso.current.rotation.z = Math.sin(ph) * 0.05;
      armL.current.rotation.x = -Math.sin(ph) * 0.25;
      armR.current.rotation.x = Math.sin(ph) * 0.25;
    } else {
      const breathe = Math.sin(t * 1.3) * 0.03;
      torso.current.rotation.x = breathe;
      armL.current.rotation.z = 0.12;
      armR.current.rotation.z = -0.12;
      head.current.rotation.y = Math.sin(t * 0.5) * 0.2;
    }
    foreL.current.rotation.x = -0.3;
    foreR.current.rotation.x = -0.3;

    switch (r.state) {
      case 'swipe': {
        const k = r.stateT;
        const arm = r.swipeSide === 1 ? armL.current : armR.current;
        const fore = r.swipeSide === 1 ? foreL.current : foreR.current;
        const wind = clamp(k / 0.5);
        const strike = clamp((k - 0.5) / 0.25);
        arm.rotation.z = r.swipeSide * (wind * 1.6 - strike * 1.1);
        arm.rotation.x = -wind * 0.6 - strike * 0.6;
        fore.rotation.x = -1 + strike * 0.8;
        torso.current.rotation.y = r.swipeSide * (wind * 0.35 - strike * 0.6);
        break;
      }
      case 'charge':
      case 'fire': {
        // aim the head at the beam target
        torso.current.rotation.x = 0.12;
        if (r.state === 'fire') {
          sim.robotEye(tmp);
          const pitch = Math.atan2(tmp.y - sim.laser.to.y, tmp.distanceTo(tmp2.copy(sim.laser.to).setY(tmp.y)));
          head.current.rotation.x = clamp(pitch - 0.12, -0.5, 0.9);
        } else head.current.rotation.x = 0.3;
        armL.current.rotation.z = 0.35;
        armR.current.rotation.z = -0.35;
        break;
      }
      case 'stagger': {
        const k = Math.sin(clamp(r.stateT / 0.7) * Math.PI);
        torso.current.rotation.x = -0.3 * k;
        head.current.rotation.x = -0.25 * k;
        armL.current.rotation.z = 0.6 * k;
        armR.current.rotation.z = -0.6 * k;
        break;
      }
      case 'down': {
        head.current.rotation.x = 0.4 * r.collapse;
        armL.current.rotation.set(-1.4 * r.collapse, 0, 0.5);
        armR.current.rotation.set(-1.2 * r.collapse, 0, -0.4);
        shinL.current.rotation.x = 0.9 * r.collapse;
        shinR.current.rotation.x = 0.7 * r.collapse;
        break;
      }
    }
    // fall forward around the feet
    tilt.current.rotation.x = r.collapse * 1.32;
    tilt.current.position.y = -r.collapse * 1.6;

    // eye / core glow
    const alive = r.state !== 'down';
    const re = sim.flags.reactivated;
    const pulse = 0.6 + 0.4 * Math.sin(t * (re ? 7 : 2.4));
    const eyeI = alive ? 1 + r.eyeFlare * 2 + sim.laser.charge * 2 : re ? pulse * 2.5 : Math.max(0, 1 - r.collapse * 3) * 0.6;
    m.eye.color.setRGB(3 * eyeI, 0.25 * eyeI, 0.1 * eyeI);
    const coreI = alive ? pulse : re ? 2 * pulse : 0.15;
    m.core.color.setRGB(3 * coreI, 0.9 * coreI, 0.2 * coreI);
    coreLight.current.intensity = 60 * coreI + sim.laser.charge * 120;

    // laser beam
    const L = sim.laser;
    chargeGlow.current.visible = L.charge > 0.02 && alive;
    if (chargeGlow.current.visible) {
      chargeGlow.current.position.copy(L.from);
      chargeGlow.current.scale.setScalar(0.4 + L.charge * 1.8 + (L.active ? Math.sin(t * 50) * 0.2 : 0));
    }
    beam.current.visible = beamCore.current.visible = L.active;
    if (L.active) {
      const len = L.from.distanceTo(L.to);
      tmp.addVectors(L.from, L.to).multiplyScalar(0.5);
      const dir = tmp2.subVectors(L.to, L.from).normalize();
      for (const b of [beam.current, beamCore.current]) {
        b.position.copy(tmp);
        b.quaternion.setFromUnitVectors(Y_AXIS, dir);
      }
      const w = 1 + Math.sin(t * 60) * 0.15;
      beam.current.scale.set(w, len, w);
      beamCore.current.scale.set(1, len, 1);
    }

    // transmission beam after reactivation
    transmit.current.visible = re;
    if (re) {
      sim.robotCore(transmit.current.position);
      transmit.current.position.y += 60;
      (transmit.current.material as THREE.MeshBasicMaterial).opacity = 0.25 + 0.2 * Math.sin(t * 9);
    }
    // distant second signal
    signal.current.visible = sim.flags.secondSignal;
    if (sim.flags.secondSignal) signal.current.scale.setScalar(3 + Math.sin(t * 4) * 1.2);
  });

  return (
    <>
      <group ref={root}>
        <group ref={tilt}>
          <group ref={hips} position={[0, 8.6, 0]}>
            <mesh material={m.dark}>
              <boxGeometry args={[4.6, 1.6, 2.8]} />
            </mesh>
            {leg(1, legL, shinL)}
            {leg(-1, legR, shinR)}
            <group ref={torso} position={[0, 0.8, 0]}>
              {/* main hull */}
              <mesh material={m.hull} position={[0, 3.6, 0]}>
                <boxGeometry args={[7.2, 5.6, 4.4]} />
              </mesh>
              <mesh material={m.rust} position={[0, 1.2, 0]}>
                <boxGeometry args={[5.4, 1.4, 3.6]} />
              </mesh>
              <mesh material={m.dark} position={[0, 6.6, -0.6]}>
                <boxGeometry args={[5.6, 0.8, 3]} />
              </mesh>
              {/* chest core */}
              <mesh material={m.dark} position={[0, 3.4, 2.2]} rotation-x={Math.PI / 2}>
                <cylinderGeometry args={[1.25, 1.25, 0.4, 20]} />
              </mesh>
              <mesh material={m.core} position={[0, 3.4, 2.35]}>
                <sphereGeometry args={[0.95, 18, 12]} />
              </mesh>
              {[-2.6, 2.6].map((x) => (
                <mesh key={x} material={m.vent} position={[x, 4.4, 2.21]}>
                  <boxGeometry args={[1, 0.2, 0.05]} />
                </mesh>
              ))}
              {/* back exhausts */}
              {[-1.6, 1.6].map((x) => (
                <mesh key={x} material={m.dark} position={[x, 5.6, -2.6]}>
                  <cylinderGeometry args={[0.5, 0.6, 2.4, 10]} />
                </mesh>
              ))}
              <pointLight ref={coreLight} position={[0, 3.4, 4]} color="#ff6a2a" distance={45} decay={1.6} intensity={60} />
              {arm(1, armL, foreL)}
              {arm(-1, armR, foreR)}
              <group ref={head} position={[0, 7.2, 0.6]}>
                <mesh material={m.hull} position={[0, 0.9, 0]}>
                  <boxGeometry args={[3, 2, 2.8]} />
                </mesh>
                <mesh material={m.eye} position={[0, 1, 1.42]}>
                  <boxGeometry args={[2.2, 0.32, 0.06]} />
                </mesh>
                <mesh material={m.dark} position={[1, 2.6, -0.4]}>
                  <cylinderGeometry args={[0.07, 0.07, 1.8, 6]} />
                </mesh>
              </group>
            </group>
          </group>
        </group>
      </group>

      {/* beam + charge glow live in world space */}
      <mesh ref={chargeGlow} visible={false}>
        <sphereGeometry args={[1, 16, 12]} />
        <meshBasicMaterial color={[3, 0.4, 0.15]} transparent opacity={0.8} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
      </mesh>
      <mesh ref={beam} visible={false}>
        <cylinderGeometry args={[0.55, 0.55, 1, 10, 1, true]} />
        <meshBasicMaterial color={[2.5, 0.25, 0.1]} transparent opacity={0.5} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
      </mesh>
      <mesh ref={beamCore} visible={false}>
        <cylinderGeometry args={[0.16, 0.16, 1, 8]} />
        <meshBasicMaterial color={[4, 3, 2.5]} toneMapped={false} />
      </mesh>
      <mesh ref={transmit} visible={false}>
        <cylinderGeometry args={[0.6, 1.4, 120, 12, 1, true]} />
        <meshBasicMaterial color={[2.5, 0.5, 0.2]} transparent opacity={0.35} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} side={THREE.DoubleSide} />
      </mesh>
      <mesh ref={signal} position={[38, 26, -230]} visible={false}>
        <sphereGeometry args={[1, 16, 12]} />
        <meshBasicMaterial color={[3, 0.3, 0.2]} transparent opacity={0.9} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} fog={false} />
      </mesh>
    </>
  );
}
