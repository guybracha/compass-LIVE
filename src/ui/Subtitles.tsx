import { useStore } from '../state/store';
import type { SpeakerId } from '../story/types';

const SPEAKERS: Record<SpeakerId, { name: string; color: string }> = {
  anchor: { name: 'ANCHOR', color: '#e8eefc' },
  reporter: { name: 'REPORTER', color: '#9fe3ff' },
  paladin: { name: 'PALADIN', color: '#7fa8ff' },
  voltage: { name: 'VOLTAGE', color: '#ffd23d' },
};

export function Subtitles() {
  const sub = useStore((s) => s.subtitle);
  const on = useStore((s) => s.settings.subtitles);
  const choice = useStore((s) => !!s.choice);
  if (!sub || !on || choice) return null;
  const sp = SPEAKERS[sub.speaker];
  return (
    <div className="subtitles" aria-live="polite">
      <span className="sub-speaker" style={{ color: sp.color }}>
        {sp.name}
      </span>
      <span className="sub-text">{sub.text}</span>
    </div>
  );
}
