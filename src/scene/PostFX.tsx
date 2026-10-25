import { Bloom, EffectComposer, Noise, ToneMapping, Vignette } from '@react-three/postprocessing';
import { BlendFunction, ToneMappingMode } from 'postprocessing';
import { useStore } from '../state/store';

/**
 * Broadcast-camera look: bloom on emissive energy (eyes, lasers, windows),
 * vignette and a touch of sensor grain. Disabled automatically on slow devices.
 */
export function PostFX() {
  const quality = useStore((s) => s.quality);
  if (quality === 'low') return null;
  return (
    <EffectComposer multisampling={0}>
      <Bloom mipmapBlur intensity={0.6} luminanceThreshold={1.0} luminanceSmoothing={0.25} radius={0.7} />
      <Vignette offset={0.28} darkness={0.62} />
      <Noise premultiply blendFunction={BlendFunction.SCREEN} opacity={0.12} />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
    </EffectComposer>
  );
}
