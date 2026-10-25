import { useFrame, useThree } from '@react-three/fiber';
import { useRef } from 'react';
import { PerspectiveCamera, Vector3 } from 'three';
import { sim } from '../../battle/BattleSim';
import { noise1, smoothstep } from '../../lib/math';
import { getStore } from '../../state/store';
import type { ShotName } from '../../story/types';
import { SHOTS, type ShotFrame } from './shots';

/**
 * Automatic cinematic camera: evaluates the active shot each frame, blends
 * (or hard-cuts) between shots, and adds handheld drift plus trauma-based shake.
 */
export function CameraDirector() {
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const state = useRef({
    shot: null as ShotName | null,
    target: '',
    shotT: 0,
    blend: 0,
    fromPos: new Vector3(),
    fromLook: new Vector3(),
    fromFov: 45,
    curLook: new Vector3(),
    clock: 0,
  });
  const frame = useRef<ShotFrame>({ pos: new Vector3(), look: new Vector3(), fov: 45, handheld: 0 });

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const s = state.current;
    const store = getStore();
    const paused = store.paused;
    const shot: ShotName =
      store.phase === 'playing' || store.phase === 'ended' ? store.shot : store.phase === 'gallery' ? 'gallery' : 'establishing';
    const target = store.shotTarget;

    if (shot !== s.shot || target !== s.target) {
      s.target = target;
      s.fromPos.copy(camera.position);
      s.fromLook.copy(s.curLook);
      s.fromFov = camera.fov;
      s.blend = s.shot === null ? 0 : store.shotBlend;
      s.shot = shot;
      s.shotT = 0;
    }
    if (!paused) {
      s.shotT += dt;
      s.clock += dt;
    }

    const f = frame.current;
    SHOTS[shot](sim, s.shotT, f, target);

    let pos = f.pos;
    let look = f.look;
    let fov = f.fov;
    if (s.blend > 0 && s.shotT < s.blend) {
      const k = smoothstep(s.shotT / s.blend);
      pos = s.fromPos.clone().lerp(f.pos, k);
      look = s.fromLook.clone().lerp(f.look, k);
      fov = s.fromFov + (f.fov - s.fromFov) * k;
    }

    camera.position.copy(pos);
    s.curLook.copy(look);

    // handheld drift + shake
    const c = s.clock;
    const hh = f.handheld * 0.35;
    const trauma = sim.trauma;
    const shake = trauma * trauma * 1.4;
    camera.position.x += noise1(c * 0.6, 1) * hh + noise1(c * 23, 4) * shake;
    camera.position.y += noise1(c * 0.7, 2) * hh * 0.6 + noise1(c * 27, 5) * shake;
    camera.position.z += noise1(c * 0.5, 3) * hh * 0.4;
    camera.lookAt(look);
    camera.rotateZ(noise1(c * 0.4, 7) * 0.012 * f.handheld + noise1(c * 19, 8) * shake * 0.05);
    if (!paused) sim.trauma = Math.max(0, trauma - dt * 1.1);

    if (Math.abs(camera.fov - fov) > 0.01) {
      camera.fov = fov;
      camera.updateProjectionMatrix();
    }
  });

  return null;
}
