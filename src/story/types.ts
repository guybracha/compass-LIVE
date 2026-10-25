// Story data model. An episode is pure data; StoryDirector interprets it.

export type SpeakerId = 'anchor' | 'reporter' | 'paladin' | 'voltage';

export type ShotName =
  | 'establishing'
  | 'heli'
  | 'robotLow'
  | 'tracking'
  | 'heroLanding'
  | 'lowAngleHero'
  | 'closePaladin'
  | 'closeVoltage'
  | 'otsPaladin'
  | 'otsVoltage'
  | 'wideBattle'
  | 'shieldClose'
  | 'voltageTrack'
  | 'robotDown'
  | 'horizon'
  | 'heroClose'
  | 'heroAction'
  | 'alliesWide'
  | 'gallery';

export type BranchId = 'evacuate' | 'attack';

export interface ChoiceOption {
  id: BranchId;
  label: string;
  hero: string;
  description: string;
  color: string;
}

export interface EndingInfo {
  headline: string;
  subhead: string;
  cliffhanger: string;
  tone: 'hopeful' | 'grim';
}

/** Cue payloads (without timing). */
export type CueBody =
  | { type: 'line'; id: string; speaker: SpeakerId; text: string }
  | { type: 'camera'; shot: ShotName; blend?: number; target?: string }
  | { type: 'event'; name: string }
  | { type: 'sfx'; name: string }
  | { type: 'music'; mood: MusicMood }
  | { type: 'banner'; text: string | null }
  | { type: 'ticker'; text: string }
  | { type: 'lowerThird'; name: string; title: string; hold: number }
  | { type: 'alert'; text: string; hold: number }
  | { type: 'overlay'; mode: OverlayMode }
  | { type: 'missionStatus'; visible: boolean }
  | { type: 'ending'; info: EndingInfo }
  | { type: 'choice'; prompt: string; options: ChoiceOption[]; timeout: number; defaultId: BranchId };

export type Cue = CueBody & { t: number };

export type MusicMood = 'none' | 'tense' | 'battle' | 'hopeful' | 'grim';
export type OverlayMode = 'studio' | 'field';

export interface Scene {
  id: string;
  label: string;
  cues: Cue[];
  /** Seconds; scene ends when its clock reaches this. */
  duration: number;
  /** Next scene id, or a function of the chosen branch. Undefined = episode ends. */
  next?: string | ((branch: BranchId) => string);
}

export interface Episode {
  id: string;
  title: string;
  subtitle: string;
  firstScene: string;
  scenes: Record<string, Scene>;
}
