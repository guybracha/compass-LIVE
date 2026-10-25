import gsap from 'gsap';
import { useEffect, useLayoutEffect, useRef } from 'react';
import { returnToTitle } from '../App';
import { audio } from '../audio/AudioEngine';
import { sim, type HeroAnim } from '../battle/BattleSim';
import { HEROES } from '../characters/heroes';
import { getStore, useStore } from '../state/store';

const POWER_ANIM: Record<string, HeroAnim> = {
  gigantic: 'lift',
  'maltese-cross': 'shield',
  hallethea: 'heal',
  mariposa: 'fly',
  harkadius: 'run',
};

function showPower(id: string) {
  const h = sim.heroById[id];
  const spec = h.spec;
  const anim: HeroAnim = POWER_ANIM[id] ?? (spec.role === 'melee' || spec.role === 'leader' ? 'punch' : spec.flies ? 'cast' : 'cast');
  h.anim = anim;
  h.animT = 0;
  if (spec.id === 'size') h.scale = 2.2;
  const hand = h.pos.clone().setY(1.4 * spec.body.height * h.scale);
  sim.explode(hand, 1.6, 'spark', spec.colors.glow);
  if (!['fists', 'blade', 'sword', 'shield', 'heal'].includes(spec.power))
    sim.fireBolt(hand, false, 0, { color: spec.colors.glow, kind: spec.power, speed: 40, splash: 0 });
  audio.play(spec.power === 'missile' ? 'missile' : spec.power === 'fire' ? 'fireball' : spec.power === 'bolt' ? 'zap' : 'cosmic');
  window.setTimeout(() => {
    h.anim = 'gallery';
    h.animT = 0;
    h.scale = 1;
  }, 1800);
}

export function Gallery() {
  const phase = useStore((s) => s.phase);
  const target = useStore((s) => s.shotTarget);
  const card = useRef<HTMLDivElement>(null);
  const idx = Math.max(0, HEROES.findIndex((h) => h.id === target));
  const spec = HEROES[idx];

  const go = (d: number) => getStore().set({ shotTarget: HEROES[(idx + d + HEROES.length) % HEROES.length].id });

  useEffect(() => {
    if (phase !== 'gallery') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') go(1);
      if (e.key === 'ArrowLeft') go(-1);
      if (e.key === 'Enter') showPower(spec.id);
      if (e.key === 'Escape') returnToTitle();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  useLayoutEffect(() => {
    if (phase === 'gallery') sim.galleryFocus(spec.id);
    if (phase === 'gallery' && card.current) gsap.fromTo(card.current, { x: 30, opacity: 0 }, { x: 0, opacity: 1, duration: 0.45, ease: 'power3.out' });
  }, [phase, target]);

  if (phase !== 'gallery') return null;
  return (
    <div className="gallery">
      <div className="gal-list" role="listbox" aria-label="Compass Alliance heroes">
        <div className="gal-head">COMPASS ALLIANCE · ROSTER</div>
        {HEROES.map((h, i) => (
          <button
            key={h.id}
            role="option"
            aria-selected={i === idx}
            className={`gal-item${i === idx ? ' on' : ''}`}
            onClick={() => getStore().set({ shotTarget: h.id })}
          >
            <i style={{ background: h.palette[0] }} />
            <span>{h.name}</span>
          </button>
        ))}
      </div>
      <div className="gal-card" ref={card}>
        <span className="gal-kicker">
          {String(idx + 1).padStart(2, '0')} / {HEROES.length}
        </span>
        <h2>{spec.name.toUpperCase()}</h2>
        <div className="gal-epithet">{spec.epithet}</div>
        <div className="gal-tags">
          <span>{spec.gender}{spec.age ? `, ${spec.age}` : ''}</span>
          <span>{spec.anatomy === 'humanoid' ? 'humanoid' : spec.anatomy}</span>
          <span>{spec.role}</span>
          <span>power: {spec.power}</span>
        </div>
        <div className="gal-swatches">
          {spec.palette.map((c) => (
            <i key={c} style={{ background: c }} title={c} />
          ))}
        </div>
        <p><b>Look.</b> {spec.appearance}</p>
        <p><b>Costume.</b> {spec.costume}</p>
        <p><b>Presence.</b> {spec.bodyLanguage}</p>
        <div className="gal-actions">
          <button className="btn-ghost" onClick={() => go(-1)} aria-label="Previous hero">◀</button>
          <button className="btn-primary" onClick={() => showPower(spec.id)}>SHOW POWER</button>
          <button className="btn-ghost" onClick={() => go(1)} aria-label="Next hero">▶</button>
        </div>
        <button className="gal-back" onClick={returnToTitle}>← Back to title</button>
      </div>
    </div>
  );
}
