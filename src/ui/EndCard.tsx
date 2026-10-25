import gsap from 'gsap';
import { useLayoutEffect, useRef } from 'react';
import { returnToTitle, startBroadcast } from '../App';
import { useStore } from '../state/store';

export function EndCard() {
  const phase = useStore((s) => s.phase);
  const ending = useStore((s) => s.ending);
  const st = useStore((s) => s.stats);
  const branch = useStore((s) => s.branch);
  const ref = useRef<HTMLDivElement>(null);
  const show = phase === 'ended' && !!ending;

  useLayoutEffect(() => {
    if (!show || !ref.current) return;
    const tl = gsap.timeline();
    tl.fromTo(ref.current, { opacity: 0 }, { opacity: 1, duration: 0.8 });
    tl.fromTo(ref.current.querySelectorAll('.reveal'), { y: 24, opacity: 0 }, { y: 0, opacity: 1, duration: 0.6, stagger: 0.18 }, '-=0.3');
  }, [show]);

  if (!show || !ending) return null;
  const other = branch === 'attack' ? 'EVACUATE CIVILIANS' : 'ATTACK THE ROBOT';
  return (
    <div className={`endcard tone-${ending.tone}`} ref={ref}>
      <div className="end-inner">
        <span className="end-kicker reveal">EPISODE 1 · THE BATTLE OF EARTH CITY</span>
        <h1 className="end-headline reveal">{ending.headline}</h1>
        <p className="end-sub reveal">{ending.subhead}</p>
        <div className="end-stats reveal">
          <div>
            <b>{st.civiliansSafe}/{st.civiliansTotal}</b>
            <span>civilians evacuated</span>
          </div>
          <div>
            <b>{st.cityDamage}%</b>
            <span>city damage</span>
          </div>
          <div>
            <b>{st.robotHP}%</b>
            <span>machine integrity</span>
          </div>
        </div>
        <p className="end-cliff reveal">{ending.cliffhanger}</p>
        <span className="end-tbc reveal">TO BE CONTINUED…</span>
        <div className="end-actions reveal">
          <button className="btn-primary" onClick={startBroadcast}>
            ↻ REPLAY BROADCAST
          </button>
          <button className="btn-ghost" onClick={returnToTitle}>
            Title screen
          </button>
        </div>
        <span className="end-hint reveal">You chose {branch === 'attack' ? 'ATTACK THE ROBOT' : 'EVACUATE CIVILIANS'}. Replay and choose {other} to see a different outcome.</span>
      </div>
    </div>
  );
}
