import { useEffect, useRef } from 'react';
import { audio } from './audio/AudioEngine';
import { narrator } from './audio/Narrator';
import { sim } from './battle/BattleSim';
import { Stage } from './scene/Stage';
import { fx } from './scene/fx/ParticlePool';
import { getStore, playbackDefaults, useStore } from './state/store';
import { episode01 } from './story/episode01';
import { director, storyBus } from './story/StoryDirector';
import { BroadcastOverlay } from './ui/BroadcastOverlay';
import { ControlBar, toggleFullscreen } from './ui/ControlBar';
import { DecisionPanel } from './ui/DecisionPanel';
import { EndCard } from './ui/EndCard';
import { Gallery } from './ui/Gallery';
import { StudioSet } from './ui/StudioSet';
import { Subtitles } from './ui/Subtitles';
import { TitleScreen } from './ui/TitleScreen';

// Wire the decoupled systems together once.
storyBus.on('event', (name) => sim.handleStoryEvent(name));
sim.bus.on('sfx', (name) => audio.play(name));

// Dev-only hook for scripted testing (fast-forwarding the timeline from the console).
if (import.meta.env.DEV) {
  (window as unknown as Record<string, unknown>).__compass = {
    director,
    sim,
    store: useStore,
    /** advance story + sim by `seconds` in fixed steps */
    step(seconds: number, dt = 1 / 30) {
      for (let t = 0; t < seconds; t += dt) {
        const s = getStore();
        if (s.phase === 'playing') director.update(dt);
        if (s.phase === 'playing' || s.phase === 'ended') sim.update(dt);
      }
    },
  };
}

export function startBroadcast() {
  audio.unlock(); // explicit user gesture → audio allowed
  audio.stopAll();
  narrator.stop();
  sim.reset();
  fx.sparks.clear();
  fx.smoke.clear();
  director.start(episode01);
}

export function openGallery() {
  audio.unlock();
  audio.stopAll();
  narrator.stop();
  director.reset();
  sim.setupGallery();
  fx.sparks.clear();
  fx.smoke.clear();
  useStore.setState({ ...playbackDefaults, phase: 'gallery', shotTarget: 'paladin' });
}

export function returnToTitle() {
  director.reset();
  audio.stopAll();
  sim.reset();
  useStore.setState({ ...playbackDefaults, phase: 'title' });
}

export function togglePause() {
  const s = getStore();
  if (s.phase !== 'playing') return;
  s.set({ paused: !s.paused });
}

export function App() {
  const phase = useStore((s) => s.phase);
  const paused = useStore((s) => s.paused);
  const stageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // never leave the viewer on the loading screen if the canvas is slow to initialise
    const id = window.setTimeout(() => getStore().phase === 'loading' && getStore().set({ phase: 'title' }), 4000);
    return () => window.clearTimeout(id);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      const s = getStore();
      switch (e.key.toLowerCase()) {
        case ' ':
          e.preventDefault();
          if (s.phase === 'title') startBroadcast();
          else togglePause();
          break;
        case 'f':
          toggleFullscreen();
          break;
        case 'c':
          s.setSettings({ subtitles: !s.settings.subtitles });
          break;
        case 'm':
          s.setSettings({ muted: !s.settings.muted });
          break;
        case '1':
        case '2':
          if (s.choice && !s.paused) director.choose(s.choice.options[Number(e.key) - 1].id);
          break;
      }
    };
    const onHide = () => {
      const s = getStore();
      if (document.hidden && s.phase === 'playing' && !s.paused) s.set({ paused: true });
    };
    window.addEventListener('keydown', onKey);
    document.addEventListener('visibilitychange', onHide);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('visibilitychange', onHide);
    };
  }, []);

  return (
    <div className="app">
      <div className="stage" ref={stageRef}>
        <Stage />
        <div className="overlay-root">
          <StudioSet />
          {(phase === 'playing' || phase === 'ended') && <BroadcastOverlay />}
          <Subtitles />
          <DecisionPanel />
          <EndCard />
          <Gallery />
          <TitleScreen />
          {paused && (
            <button className="paused-veil" onClick={togglePause} aria-label="Resume broadcast">
              <span className="paused-badge">❚❚ BROADCAST PAUSED</span>
              <span className="paused-hint">Click or press Space to resume</span>
            </button>
          )}
          <ControlBar />
        </div>
      </div>
    </div>
  );
}
