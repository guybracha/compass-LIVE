import gsap from 'gsap';
import { useLayoutEffect, useRef, type CSSProperties } from 'react';
import { useStore } from '../state/store';
import { director } from '../story/StoryDirector';

/** Time-limited viewer decision. Default is applied automatically when time runs out. */
export function DecisionPanel() {
  const choice = useStore((s) => s.choice);
  const remaining = useStore((s) => s.choiceRemaining);
  const paused = useStore((s) => s.paused);
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!choice || !ref.current) return;
    const cards = ref.current.querySelectorAll('.choice-card');
    gsap.fromTo(ref.current, { opacity: 0 }, { opacity: 1, duration: 0.3 });
    gsap.fromTo(cards, { y: 40, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, stagger: 0.12, ease: 'back.out(1.6)' });
  }, [choice]);

  if (!choice) return null;
  const frac = remaining / choice.timeout;
  const def = choice.options.find((o) => o.id === choice.defaultId);

  return (
    <div className="decision" ref={ref}>
      <div className="decision-head">
        <span className="decision-tag">VIEWER DECISION</span>
        <h2>{choice.prompt}</h2>
      </div>
      <div className="decision-cards">
        {choice.options.map((o, i) => (
          <button
            key={o.id}
            className="choice-card"
            style={{ '--accent': o.color } as CSSProperties}
            disabled={paused}
            onClick={() => director.choose(o.id)}
          >
            <span className="choice-key">{i + 1}</span>
            <span className="choice-hero">{o.hero}</span>
            <span className="choice-label">{o.label}</span>
            <span className="choice-desc">{o.description}</span>
          </button>
        ))}
      </div>
      <div className="countdown">
        <div className="countdown-bar">
          <div className="countdown-fill" style={{ transform: `scaleX(${frac})`, background: frac < 0.3 ? '#ff3b3b' : '#ffffff' }} />
        </div>
        <span className="countdown-num">{Math.ceil(remaining)}s</span>
        <span className="countdown-def">No choice → {def?.label}</span>
      </div>
    </div>
  );
}
