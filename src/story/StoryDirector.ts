import { getStore, playbackDefaults, useStore } from '../state/store';
import type { ActiveChoice } from '../state/store';
import { Emitter } from '../lib/emitter';
import { audio } from '../audio/AudioEngine';
import { narrator } from '../audio/Narrator';
import { lineDuration } from './builder';
import { CAMERA_LABELS } from '../scene/camera/shots';
import type { BranchId, Cue, Episode, Scene } from './types';

/** Story events consumed by the battle simulation (and anything else that cares). */
export const storyBus = new Emitter<{ event: string; branch: BranchId }>();

const MAX_SPEECH_HOLD = 4;

/**
 * Plays an Episode: runs each scene's cue timeline on the frame clock,
 * pauses with the app, waits for spoken lines to finish, and handles
 * the timed viewer choice and branching.
 */
export class StoryDirector {
  private episode: Episode | null = null;
  private scene: Scene | null = null;
  private st = 0; // scene time
  private gt = 0; // global playback time
  private cueIdx = 0;
  private choice: ActiveChoice | null = null;
  private choiceLeft = 0;
  private speechHold = 0;
  private branch: BranchId | null = null;
  private timers = { subtitle: 0, lowerThird: 0, alert: 0 };

  start(episode: Episode) {
    this.reset();
    this.episode = episode;
    useStore.setState({ ...playbackDefaults, phase: 'playing', runId: getStore().runId + 1 });
    this.enter(episode.firstScene);
  }

  reset() {
    narrator.stop();
    this.episode = null;
    this.scene = null;
    this.st = this.gt = this.speechHold = 0;
    this.cueIdx = 0;
    this.choice = null;
    this.branch = null;
    this.timers = { subtitle: 0, lowerThird: 0, alert: 0 };
  }

  get sceneTime() {
    return this.st;
  }

  private enter(id: string) {
    const scene = this.episode?.scenes[id];
    if (!scene) throw new Error(`Unknown scene "${id}"`);
    this.scene = scene;
    this.st = 0;
    this.cueIdx = 0;
    this.speechHold = 0;
    getStore().set({ sceneId: scene.id, sceneLabel: scene.label });
  }

  update(dt: number) {
    if (!this.scene || getStore().paused) return;
    this.gt += dt;
    this.expireTimers();

    if (this.choice) {
      this.choiceLeft -= dt;
      const shown = Math.max(0, Math.ceil(this.choiceLeft * 10) / 10);
      if (shown !== getStore().choiceRemaining) getStore().set({ choiceRemaining: shown });
      if (this.choiceLeft <= 0) this.choose(this.choice.defaultId, true);
      return;
    }

    // Keep dialogue in sync with real speech: hold the timeline while a voice is still talking.
    let nextLine: Cue | undefined;
    for (let i = this.cueIdx; i < this.scene.cues.length; i++)
      if (this.scene.cues[i].type === 'line') {
        nextLine = this.scene.cues[i];
        break;
      }
    const needsHold =
      narrator.speaking &&
      this.speechHold < MAX_SPEECH_HOLD &&
      ((nextLine && nextLine.t <= this.st + dt) || (!nextLine && this.st + dt >= this.scene.duration));
    if (needsHold) {
      this.speechHold += dt;
      return;
    }

    this.st += dt;
    while (this.scene && this.cueIdx < this.scene.cues.length && this.scene.cues[this.cueIdx].t <= this.st) {
      const cue = this.scene.cues[this.cueIdx++];
      this.fire(cue);
      if (this.choice) return;
    }
    if (this.scene && this.cueIdx >= this.scene.cues.length && this.st >= this.scene.duration) this.advance();
  }

  private expireTimers() {
    const s = getStore();
    const t = this.timers;
    if (s.subtitle && this.gt > t.subtitle && !narrator.speaking) s.set({ subtitle: null });
    if (s.lowerThird && this.gt > t.lowerThird) s.set({ lowerThird: null });
    if (s.alert && this.gt > t.alert) s.set({ alert: null });
  }

  private fire(cue: Cue) {
    const s = getStore();
    switch (cue.type) {
      case 'line':
        this.speechHold = 0;
        s.set({ subtitle: { speaker: cue.speaker, text: cue.text } });
        this.timers.subtitle = this.gt + lineDuration(cue.text);
        narrator.speak(cue.id, cue.speaker, cue.text);
        break;
      case 'camera':
        s.set({ shot: cue.shot, shotBlend: cue.blend ?? 0, shotTarget: cue.target ?? s.shotTarget, camLabel: CAMERA_LABELS[cue.shot] });
        break;
      case 'event':
        storyBus.emit('event', cue.name);
        break;
      case 'sfx':
        audio.play(cue.name);
        break;
      case 'music':
        audio.setMusicMood(cue.mood);
        break;
      case 'banner':
        s.set({ banner: cue.text });
        break;
      case 'ticker':
        s.set({ ticker: cue.text });
        break;
      case 'lowerThird':
        s.set({ lowerThird: { name: cue.name, title: cue.title } });
        this.timers.lowerThird = this.gt + cue.hold;
        break;
      case 'alert':
        s.set({ alert: cue.text });
        this.timers.alert = this.gt + cue.hold;
        audio.play('alertShort');
        break;
      case 'overlay':
        s.set({ overlayMode: cue.mode });
        break;
      case 'missionStatus':
        s.set({ missionStatus: cue.visible });
        break;
      case 'ending':
        s.set({ ending: cue.info });
        break;
      case 'choice': {
        const { prompt, options, timeout, defaultId } = cue;
        this.choice = { prompt, options, timeout, defaultId };
        this.choiceLeft = timeout;
        s.set({ choice: this.choice, choiceRemaining: timeout });
        audio.play('choiceOpen');
        break;
      }
    }
  }

  /** Called by the decision panel, or automatically when the timer runs out. */
  choose(id: BranchId, timedOut = false) {
    if (!this.choice) return;
    this.choice = null;
    this.branch = id;
    getStore().set({ choice: null, branch: id });
    audio.play(timedOut ? 'choiceTimeout' : 'choiceConfirm');
    storyBus.emit('branch', id);
  }

  private advance() {
    const next = this.scene?.next;
    if (next === undefined) {
      this.scene = null;
      getStore().set({ phase: 'ended', subtitle: null, choice: null });
      return;
    }
    this.enter(typeof next === 'function' ? next(this.branch ?? 'evacuate') : next);
  }
}

export const director = new StoryDirector();
