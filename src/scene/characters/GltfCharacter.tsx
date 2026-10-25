import { useAnimations, useGLTF } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { sim } from '../../battle/BattleSim';
import type { CharacterConfig } from '../../config/characters';

/**
 * Drop-in replacement for a procedural hero: loads a GLB, plays the clip mapped
 * to the hero's current simulation animation, cross-fading between clips.
 * Not exercised by the bundled prototype (no model files ship with it).
 */
export function GltfCharacter({ config, heroKey }: { config: CharacterConfig; heroKey: string }) {
  const gltf = useGLTF(config.model!);
  const scene = useMemo(() => cloneSkinned(gltf.scene), [gltf.scene]);
  const group = useRef<THREE.Group>(null!);
  const { actions } = useAnimations(gltf.animations, group);
  const current = useRef<string | null>(null);

  useEffect(() => {
    scene.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) o.frustumCulled = false;
    });
  }, [scene]);

  useFrame(() => {
    const clip = config.clips[sim.heroById[heroKey].anim] ?? config.clips.idle;
    if (!clip || clip === current.current) return;
    const next = actions[clip];
    if (!next) return;
    const prev = current.current ? actions[current.current] : null;
    next.reset().fadeIn(0.2).play();
    prev?.fadeOut(0.2);
    current.current = clip;
  });

  return (
    <group ref={group} rotation-y={config.yawOffset}>
      <primitive object={scene} />
    </group>
  );
}
