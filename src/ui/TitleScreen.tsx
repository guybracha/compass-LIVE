import gsap from 'gsap';
import { useLayoutEffect, useRef } from 'react';
import { openGallery, startBroadcast } from '../App';
import { useStore } from '../state/store';
import { episode01 } from '../story/episode01';
import { CompassLogo } from './CompassLogo';

export function TitleScreen() {
  const phase = useStore((s) => s.phase);
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (phase === 'title' && ref.current)
      gsap.fromTo(ref.current.querySelectorAll('.t-reveal'), { y: 30, opacity: 0 }, { y: 0, opacity: 1, duration: 0.8, stagger: 0.12, ease: 'power3.out' });
  }, [phase]);

  if (phase === 'loading')
    return (
      <div className="loading">
        <div className="spinner" />
        <span>ESTABLISHING SATELLITE UPLINK…</span>
      </div>
    );
  if (phase !== 'title') return null;
  return (
    <div className="title" ref={ref}>
      <div className="title-inner">
        <div className="t-reveal title-logo">
          <CompassLogo size={84} />
        </div>
        <h1 className="t-reveal">
          COMPASS ALLIANCE<span>: LIVE</span>
        </h1>
        <p className="t-reveal title-ep">
          {episode01.subtitle} — <b>{episode01.title}</b>
        </p>
        <div className="t-reveal title-actions">
          <button className="btn-start" onClick={startBroadcast}>
            <i /> START BROADCAST
          </button>
          <button className="btn-ghost" onClick={openGallery}>
            HERO GALLERY · 20 HEROES
          </button>
        </div>
        <p className="t-reveal title-note">
          An interactive live broadcast. You will decide how the heroes respond. Sound on recommended — voices use your browser’s speech engine.
        </p>
      </div>
    </div>
  );
}
