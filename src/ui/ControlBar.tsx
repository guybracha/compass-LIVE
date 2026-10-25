import { useEffect, useState, type ReactNode } from 'react';
import { togglePause } from '../App';
import { useStore } from '../state/store';

export function toggleFullscreen() {
  const el = document.documentElement;
  if (!document.fullscreenElement) void el.requestFullscreen?.().catch(() => undefined);
  else void document.exitFullscreen?.();
}

const Icon = {
  pause: <path d="M7 5h4v14H7zM13 5h4v14h-4z" />,
  play: <path d="M8 5v14l11-7z" />,
  cc: <path d="M3 6h18v12H3zM10 10.5a2 2 0 1 0 0 3M16 10.5a2 2 0 1 0 0 3" fill="none" stroke="currentColor" strokeWidth="1.6" />,
  vol: <path d="M4 9h4l5-4v14l-5-4H4zM16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="currentColor" strokeWidth="1.6" />,
  mute: <path d="M4 9h4l5-4v14l-5-4H4zM16 9l5 6M21 9l-5 6" fill="none" stroke="currentColor" strokeWidth="1.6" />,
  fs: <path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5" fill="none" stroke="currentColor" strokeWidth="1.8" />,
};

function Svg({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true">
      {children}
    </svg>
  );
}

function Slider({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="slider">
      <span>{label}</span>
      <input type="range" min={0} max={1} step={0.05} value={value} onChange={(e) => onChange(Number(e.target.value))} />
      <b>{Math.round(value * 100)}</b>
    </label>
  );
}

export function ControlBar() {
  const phase = useStore((s) => s.phase);
  const paused = useStore((s) => s.paused);
  const settings = useStore((s) => s.settings);
  const setSettings = useStore((s) => s.setSettings);
  const [open, setOpen] = useState(false);
  const [fs, setFs] = useState(false);

  useEffect(() => {
    const on = () => setFs(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', on);
    return () => document.removeEventListener('fullscreenchange', on);
  }, []);

  if (phase === 'loading') return null;
  return (
    <div className="controls">
      {open && (
        <div className="audio-panel" role="dialog" aria-label="Audio settings">
          <Slider label="Dialogue" value={settings.dialogue} onChange={(v) => setSettings({ dialogue: v })} />
          <Slider label="Music" value={settings.music} onChange={(v) => setSettings({ music: v })} />
          <Slider label="Effects" value={settings.sfx} onChange={(v) => setSettings({ sfx: v })} />
          <label className="check">
            <input type="checkbox" checked={settings.voice} onChange={(e) => setSettings({ voice: e.target.checked })} />
            Spoken voices
          </label>
          <label className="check">
            <input type="checkbox" checked={settings.muted} onChange={(e) => setSettings({ muted: e.target.checked })} />
            Mute all
          </label>
        </div>
      )}
      {phase === 'playing' && (
        <button className="ctl" onClick={togglePause} title={paused ? 'Resume (Space)' : 'Pause (Space)'} aria-label={paused ? 'Resume' : 'Pause'}>
          <Svg>{paused ? Icon.play : Icon.pause}</Svg>
        </button>
      )}
      <button
        className={`ctl${settings.subtitles ? ' on' : ''}`}
        onClick={() => setSettings({ subtitles: !settings.subtitles })}
        title="Subtitles (C)"
        aria-pressed={settings.subtitles}
        aria-label="Subtitles"
      >
        <Svg>{Icon.cc}</Svg>
      </button>
      <button
        className={`ctl${open ? ' on' : ''}`}
        onClick={() => setOpen(!open)}
        onDoubleClick={() => setSettings({ muted: !settings.muted })}
        title="Audio settings (M to mute)"
        aria-label="Audio settings"
      >
        <Svg>{settings.muted ? Icon.mute : Icon.vol}</Svg>
      </button>
      <button className={`ctl${fs ? ' on' : ''}`} onClick={toggleFullscreen} title="Fullscreen (F)" aria-label="Fullscreen">
        <Svg>{Icon.fs}</Svg>
      </button>
    </div>
  );
}
