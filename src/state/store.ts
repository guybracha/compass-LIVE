import { create } from 'zustand';
import type { BranchId, ChoiceOption, EndingInfo, OverlayMode, ShotName, SpeakerId } from '../story/types';

export type Phase = 'loading' | 'title' | 'playing' | 'ended' | 'gallery';

export interface Stats {
  robotHP: number;
  paladinHP: number;
  voltageHP: number;
  cityDamage: number;
  civiliansSafe: number;
  civiliansAtRisk: number;
  civiliansTotal: number;
}

export interface ActiveChoice {
  prompt: string;
  options: ChoiceOption[];
  timeout: number;
  defaultId: BranchId;
}

export interface Settings {
  dialogue: number;
  music: number;
  sfx: number;
  muted: boolean;
  subtitles: boolean;
  voice: boolean;
}

export type Quality = 'high' | 'low';

interface StoreState {
  phase: Phase;
  runId: number;
  sceneId: string;
  sceneLabel: string;
  branch: BranchId | null;
  paused: boolean;

  shot: ShotName;
  shotBlend: number;
  /** hero id for hero-targeted shots */
  shotTarget: string;
  camLabel: string;
  overlayMode: OverlayMode;
  banner: string | null;
  ticker: string;
  subtitle: { speaker: SpeakerId; text: string } | null;
  lowerThird: { name: string; title: string } | null;
  alert: string | null;
  missionStatus: boolean;
  choice: ActiveChoice | null;
  choiceRemaining: number;
  ending: EndingInfo | null;
  stats: Stats;

  settings: Settings;
  quality: Quality;

  set: (partial: Partial<StoreState>) => void;
  setSettings: (partial: Partial<Settings>) => void;
}

export const DEFAULT_TICKER =
  'EARTH CITY — Emergency services report an unidentified machine in the financial district  •  Residents urged to shelter in place  •  Central Avenue transit suspended  •  Compass Alliance responding  •  Stay tuned for live coverage';

export const initialStats: Stats = {
  robotHP: 100,
  paladinHP: 100,
  voltageHP: 100,
  cityDamage: 0,
  civiliansSafe: 0,
  civiliansAtRisk: 0,
  civiliansTotal: 0,
};

/** Fields reset on every new broadcast. */
export const playbackDefaults = {
  sceneId: '',
  sceneLabel: '',
  branch: null,
  paused: false,
  shot: 'establishing' as ShotName,
  shotBlend: 0,
  shotTarget: 'paladin',
  camLabel: 'CAM 1 — SKYLINE',
  overlayMode: 'field' as OverlayMode,
  banner: null,
  ticker: DEFAULT_TICKER,
  subtitle: null,
  lowerThird: null,
  alert: null,
  missionStatus: false,
  choice: null,
  choiceRemaining: 0,
  ending: null,
  stats: initialStats,
} satisfies Partial<StoreState>;

export const useStore = create<StoreState>((set) => ({
  phase: 'loading',
  runId: 0,
  ...playbackDefaults,
  settings: { dialogue: 0.9, music: 0.55, sfx: 0.8, muted: false, subtitles: true, voice: true },
  quality: 'high',
  set: (partial) => set(partial),
  setSettings: (partial) => set((s) => ({ settings: { ...s.settings, ...partial } })),
}));

export const getStore = () => useStore.getState();
