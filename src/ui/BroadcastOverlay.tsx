import gsap from 'gsap';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useStore } from '../state/store';
import { CompassLogo } from './CompassLogo';

function Clock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 10000);
    return () => window.clearInterval(id);
  }, []);
  return <span className="clock">{now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>;
}

function Bug() {
  return (
    <div className="bug">
      <CompassLogo size={44} />
      <div className="bug-text">
        <span className="bug-name">COMPASS ALLIANCE</span>
        <span className="bug-row">
          <span className="live-pill">
            <i /> LIVE
          </span>
          <Clock />
        </span>
      </div>
    </div>
  );
}

function CamTag() {
  const cam = useStore((s) => s.camLabel);
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (ref.current) gsap.fromTo(ref.current, { opacity: 0.2 }, { opacity: 1, duration: 0.35 });
  }, [cam]);
  return (
    <div className="cam-tag" ref={ref}>
      <span className="rec" />
      <span>{cam}</span>
      <span className="loc">EARTH CITY · FINANCIAL DISTRICT</span>
    </div>
  );
}

function LowerThird() {
  const lt = useStore((s) => s.lowerThird);
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(lt);
  useLayoutEffect(() => {
    const el = ref.current;
    if (lt) {
      setShown(lt);
      if (el) gsap.fromTo(el, { xPercent: -110, opacity: 0 }, { xPercent: 0, opacity: 1, duration: 0.55, ease: 'power3.out' });
    } else if (el && shown) {
      gsap.to(el, { xPercent: -110, opacity: 0, duration: 0.4, ease: 'power2.in', onComplete: () => setShown(null) });
    }
  }, [lt]);
  if (!shown) return null;
  return (
    <div className="lower-third" ref={ref}>
      <div className="lt-name">{shown.name}</div>
      <div className="lt-title">{shown.title}</div>
    </div>
  );
}

function Banner() {
  const text = useStore((s) => s.banner);
  const ref = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    if (ref.current) gsap.fromTo(ref.current, { y: '100%', opacity: 0 }, { y: '0%', opacity: 1, duration: 0.45, ease: 'power3.out' });
  }, [text]);
  if (!text) return null;
  return (
    <div className="banner">
      <span className="banner-tag">BREAKING NEWS</span>
      <span className="banner-text">
        <span ref={ref}>{text}</span>
      </span>
    </div>
  );
}

function Ticker() {
  const text = useStore((s) => s.ticker);
  const paused = useStore((s) => s.paused);
  return (
    <div className="ticker">
      <span className="ticker-label">EARTH CITY NOW</span>
      <div className="ticker-track">
        <div key={text} className={`ticker-move${paused ? ' is-paused' : ''}`}>
          <span>{text}</span>
          <span aria-hidden="true">{text}</span>
        </div>
      </div>
    </div>
  );
}

function Alert() {
  const alert = useStore((s) => s.alert);
  if (!alert) return null;
  return (
    <div className="alert" role="alert">
      <span className="alert-icon">⚠</span>
      {alert}
    </div>
  );
}

function Bar({ value, color }: { value: number; color: string }) {
  return (
    <div className="bar">
      <div className="bar-fill" style={{ width: `${Math.max(0, Math.min(100, value))}%`, background: color }} />
    </div>
  );
}

function MissionStatus() {
  const visible = useStore((s) => s.missionStatus);
  const st = useStore((s) => s.stats);
  const branch = useStore((s) => s.branch);
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (visible && ref.current) gsap.fromTo(ref.current, { x: -30, opacity: 0 }, { x: 0, opacity: 1, duration: 0.5 });
  }, [visible]);
  if (!visible) return null;
  return (
    <div className="mission" ref={ref}>
      <div className="mission-head">MISSION STATUS · {branch === 'attack' ? 'ENGAGE' : 'EVACUATE'}</div>
      <div className="mission-row">
        <span>MACHINE INTEGRITY</span>
        <b>{st.robotHP}%</b>
      </div>
      <Bar value={st.robotHP} color="#ff4a2e" />
      <div className="mission-row">
        <span>CITY DAMAGE</span>
        <b>{st.cityDamage}%</b>
      </div>
      <Bar value={st.cityDamage} color="#ffae2e" />
      <div className="mission-row">
        <span>CIVILIANS SAFE</span>
        <b>
          {st.civiliansSafe}/{st.civiliansTotal}
        </b>
      </div>
      <Bar value={(st.civiliansSafe / Math.max(1, st.civiliansTotal)) * 100} color="#3dd68c" />
      <div className="mission-row small">
        <span>STILL IN DANGER ZONE</span>
        <b>{st.civiliansAtRisk}</b>
      </div>
      <div className="mission-heroes">
        <span style={{ color: '#6fa0ff' }}>PALADIN {st.paladinHP}%</span>
        <span style={{ color: '#ffcf3d' }}>VOLTAGE {st.voltageHP}%</span>
      </div>
    </div>
  );
}

export function BroadcastOverlay() {
  const studio = useStore((s) => s.overlayMode === 'studio');
  return (
    <div className="broadcast">
      <Bug />
      {!studio && <CamTag />}
      <Alert />
      <MissionStatus />
      <LowerThird />
      <div className="bottom-stack">
        <Banner />
        <Ticker />
      </div>
    </div>
  );
}
