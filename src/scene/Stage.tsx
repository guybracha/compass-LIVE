import { PerformanceMonitor } from '@react-three/drei';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { sim } from '../battle/BattleSim';
import { getStore, useStore } from '../state/store';
import { director } from '../story/StoryDirector';
import { CameraDirector } from './camera/CameraDirector';
import { Civilians } from './characters/Civilians';
import { HeroCast } from './characters/HeroActor';
import { Robot } from './characters/Robot';
import { City } from './city/City';
import { EmergencyLights, Explosions, ParticleSystems, Projectiles } from './fx/Effects';
import { PostFX } from './PostFX';
import { Ash, NeonSigns, NewsHelicopter, Rubble, TrafficLights } from './world/Props';

/** Drives story + simulation from the render loop (frozen while paused). */
function Ticker() {
  useFrame((_, rawDt) => {
    const s = getStore();
    if (s.paused) return;
    const dt = Math.min(rawDt, 0.05);
    if (s.phase === 'playing') director.update(dt);
    if (s.phase === 'playing' || s.phase === 'ended' || s.phase === 'gallery') sim.update(dt);
  });
  return null;
}

/** Night sky with stars, a moon and smoke-lit clouds — all in one shader, one draw call. */
function SkyDome() {
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
        uniforms: { uTime: { value: 0 } },
        vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
        fragmentShader: `
          uniform float uTime;
          varying vec3 vDir;
          float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
          float noise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
            return mix(mix(hash(i), hash(i+vec2(1,0)), f.x), mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), f.x), f.y); }
          float fbm(vec2 p){ float v = 0.0, a = 0.5; for (int i = 0; i < 5; i++){ v += a * noise(p); p *= 2.03; a *= 0.5; } return v; }
          void main(){
            vec3 d = normalize(vDir);
            float h = d.y;
            vec3 top = vec3(0.012, 0.02, 0.06);
            vec3 mid = vec3(0.08, 0.06, 0.12);
            vec3 glow = vec3(0.6, 0.24, 0.1);
            float side = smoothstep(0.2, -1.0, d.z) * 0.75 + 0.25;
            vec3 c = mix(glow * side, mid, smoothstep(-0.02, 0.2, h));
            c = mix(c, top, smoothstep(0.15, 0.75, h));
            // stars
            vec2 sp = vec2(atan(d.x, d.z) * 120.0, h * 240.0);
            float st = step(0.996, hash(floor(sp))) * smoothstep(0.12, 0.5, h);
            c += st * (0.6 + 0.4 * sin(uTime * 3.0 + hash(floor(sp)) * 40.0)) * vec3(0.9, 0.95, 1.0);
            // moon
            vec3 md = normalize(vec3(-0.45, 0.42, 0.78));
            float m = dot(d, md);
            c += smoothstep(0.9993, 0.9996, m) * vec3(1.6, 1.55, 1.4);
            c += pow(max(m, 0.0), 220.0) * vec3(0.25, 0.28, 0.35);
            // clouds lit from below by the burning city
            vec2 cp = d.xz / max(0.08, h + 0.15) * 1.6 + vec2(uTime * 0.01, 0.0);
            float cl = smoothstep(0.45, 0.85, fbm(cp)) * smoothstep(0.0, 0.12, h) * smoothstep(0.7, 0.2, h);
            vec3 cloudCol = mix(vec3(0.05, 0.05, 0.08), glow * 0.55 * side + vec3(0.04), smoothstep(0.35, 0.0, h));
            c = mix(c, cloudCol, cl * 0.85);
            gl_FragColor = vec4(c, 1.0);
          }`,
      }),
    [],
  );
  useFrame((_, dt) => (mat.uniforms.uTime.value += dt));
  return (
    <mesh material={mat} renderOrder={-1}>
      <sphereGeometry args={[600, 48, 24]} />
    </mesh>
  );
}

/** Moonlight with soft shadows; the shadow map is refreshed every other frame. */
function MoonLight() {
  const light = useRef<THREE.DirectionalLight>(null!);
  const gl = useThree((s) => s.gl);
  const quality = useStore((s) => s.quality);
  const frame = useRef(0);
  useEffect(() => {
    const l = light.current;
    l.castShadow = quality === 'high';
    l.shadow.mapSize.set(2048, 2048);
    const cam = l.shadow.camera;
    cam.left = -48;
    cam.right = 48;
    cam.top = 48;
    cam.bottom = -48;
    cam.near = 10;
    cam.far = 260;
    cam.updateProjectionMatrix();
    l.shadow.bias = -0.0006;
    l.shadow.normalBias = 0.04;
    l.target.position.set(0, 0, -6);
    l.target.updateMatrixWorld();
    gl.shadowMap.autoUpdate = false;
    gl.shadowMap.needsUpdate = true;
  }, [quality, gl]);
  useFrame(() => {
    if (++frame.current % 2 === 0) gl.shadowMap.needsUpdate = true;
  });
  return <directionalLight ref={light} position={[-60, 95, 45]} intensity={1.25} color="#a9bcff" />;
}

export function Stage() {
  const [dpr, setDpr] = useState(1.5);
  const setQuality = (q: 'high' | 'low') => useStore.getState().set({ quality: q });
  return (
    <Canvas
      dpr={dpr}
      shadows={{ type: THREE.PCFSoftShadowMap }}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
      camera={{ fov: 45, near: 0.1, far: 1200, position: [80, 50, 60] }}
      onCreated={({ gl, scene }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.15;
        scene.fog = new THREE.FogExp2('#17141c', 0.0068);
        scene.background = new THREE.Color('#07080d');
        // subtle image-based lighting so metal armor and the robot hull pick up reflections
        const pmrem = new THREE.PMREMGenerator(gl);
        scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
        scene.environmentIntensity = 0.28;
        pmrem.dispose();
        // let the first frame compile shaders before showing the title (timer fallback for background tabs)
        const ready = () => getStore().phase === 'loading' && getStore().set({ phase: 'title' });
        requestAnimationFrame(() => requestAnimationFrame(ready));
        window.setTimeout(ready, 1500);
      }}
    >
      <PerformanceMonitor
        onDecline={() => {
          setDpr(1);
          setQuality('low');
        }}
        onIncline={() => {
          setDpr(1.5);
          setQuality('high');
        }}
      />
      <Ticker />
      <CameraDirector />
      <SkyDome />
      <hemisphereLight args={['#5a6b9a', '#3a2418', 0.85]} />
      <MoonLight />
      <directionalLight position={[20, 20, -120]} intensity={0.75} color="#ff7a3a" />
      <City />
      <Rubble />
      <NeonSigns />
      <TrafficLights />
      <NewsHelicopter />
      <Civilians />
      <Robot />
      <HeroCast />
      <EmergencyLights />
      <Projectiles />
      <Explosions />
      <ParticleSystems />
      <Ash />
      <PostFX />
    </Canvas>
  );
}
