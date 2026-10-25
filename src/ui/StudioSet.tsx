import gsap from 'gsap';
import { useLayoutEffect, useRef } from 'react';
import { useStore } from '../state/store';
import { CompassLogo } from './CompassLogo';

/**
 * News-studio composite for the cold open: anchor desk on the left, the live 3D
 * feed visible through a transparent "monitor" on the right.
 */
export function StudioSet() {
  const active = useStore((s) => s.phase === 'playing' && s.overlayMode === 'studio');
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (active && ref.current) gsap.fromTo(ref.current, { opacity: 0 }, { opacity: 1, duration: 0.6 });
  }, [active]);
  if (!active) return null;
  return (
    <div className="studio" ref={ref}>
      <div className="studio-left">
        <div className="studio-wall">
          <div className="studio-glow" />
          <CompassLogo size={120} />
        </div>
        <div className="anchor" aria-hidden="true">
          <div className="anchor-hair" />
          <div className="anchor-head" />
          <div className="anchor-body">
            <div className="anchor-tie" />
          </div>
        </div>
        <div className="desk">
          <span>COMPASS ALLIANCE: LIVE</span>
        </div>
      </div>
      <div className="studio-monitor">
        <span className="monitor-label">
          <i /> LIVE · EARTH CITY
        </span>
      </div>
    </div>
  );
}
