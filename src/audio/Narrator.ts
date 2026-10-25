import { getStore, useStore } from '../state/store';
import { lineDuration } from '../story/builder';
import type { SpeakerId } from '../story/types';
import { audio } from './AudioEngine';
import { VOICE_MANIFEST } from './voiceManifest';

// Voice priority per line: pre-recorded file (voiceManifest) → browser speech
// synthesis → subtitles only. The director reads `speaking` to keep the
// timeline in sync with real audio.

interface VoiceProfile {
  rate: number;
  pitch: number;
  /** Preferred voice name fragments, in order. */
  prefer: RegExp[];
}

const PROFILES: Record<SpeakerId, VoiceProfile> = {
  anchor: { rate: 1.0, pitch: 1.0, prefer: [/Google US English/i, /Aria|Jenny|Samantha|Zira/i] },
  reporter: { rate: 1.12, pitch: 1.1, prefer: [/Google UK English Female/i, /Sonia|Libby|Hazel|Karen/i] },
  paladin: { rate: 0.96, pitch: 0.82, prefer: [/Google UK English Male/i, /Guy|Ryan|Daniel|George|David/i] },
  voltage: { rate: 1.16, pitch: 1.15, prefer: [/Christopher|Eric|Mark|Alex|Fred/i, /Google US English/i] },
};

class Narrator {
  speaking = false;
  private audioEl: HTMLAudioElement | null = null;
  private voices: SpeechSynthesisVoice[] = [];
  private assigned = new Map<SpeakerId, SpeechSynthesisVoice | null>();
  private failSafe = 0;
  private paused = false;

  constructor() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      const load = () => {
        this.voices = speechSynthesis.getVoices().filter((v) => v.lang.toLowerCase().startsWith('en'));
        this.assigned.clear();
      };
      load();
      speechSynthesis.addEventListener?.('voiceschanged', load);
      useStore.subscribe((s, prev) => {
        if (s.paused !== prev.paused) (s.paused ? this.pause() : this.resume());
        if (s.settings.voice !== prev.settings.voice && !s.settings.voice) this.stop();
      });
    }
  }

  get available() {
    return typeof window !== 'undefined' && 'speechSynthesis' in window;
  }

  private voiceFor(speaker: SpeakerId) {
    if (this.assigned.has(speaker)) return this.assigned.get(speaker)!;
    const used = new Set([...this.assigned.values()].filter(Boolean).map((v) => v!.name));
    const profile = PROFILES[speaker];
    let pick: SpeechSynthesisVoice | undefined;
    for (const re of profile.prefer) {
      pick = this.voices.find((v) => re.test(v.name) && !used.has(v.name));
      if (pick) break;
    }
    pick ??= this.voices.find((v) => !used.has(v.name)) ?? this.voices[0];
    this.assigned.set(speaker, pick ?? null);
    return pick ?? null;
  }

  speak(id: string, speaker: SpeakerId, text: string) {
    this.stop();
    const s = getStore().settings;
    if (speaker === 'reporter') audio.play('radio');
    if (!s.voice) return;
    const volume = s.muted ? 0 : s.dialogue;
    const file = VOICE_MANIFEST[id];

    this.speaking = true;
    window.clearTimeout(this.failSafe);
    // never let a stuck voice engine hold the story forever
    this.failSafe = window.setTimeout(() => (this.speaking = false), (lineDuration(text) * 2 + 2) * 1000);

    if (file) {
      const el = new Audio(file);
      el.volume = volume;
      el.onended = el.onerror = () => (this.speaking = false);
      this.audioEl = el;
      void el.play().catch(() => (this.speaking = false));
      return;
    }
    if (!this.available) {
      this.speaking = false;
      return;
    }
    const p = PROFILES[speaker];
    const u = new SpeechSynthesisUtterance(text);
    const v = this.voiceFor(speaker);
    if (v) u.voice = v;
    u.lang = v?.lang ?? 'en-US';
    u.rate = p.rate;
    u.pitch = p.pitch;
    u.volume = volume;
    u.onend = u.onerror = () => (this.speaking = false);
    speechSynthesis.speak(u);
  }

  stop() {
    this.speaking = false;
    window.clearTimeout(this.failSafe);
    if (this.audioEl) {
      this.audioEl.pause();
      this.audioEl = null;
    }
    if (this.available) speechSynthesis.cancel();
  }

  pause() {
    this.paused = true;
    this.audioEl?.pause();
    if (this.available) speechSynthesis.pause();
  }

  resume() {
    if (!this.paused) return;
    this.paused = false;
    void this.audioEl?.play().catch(() => undefined);
    if (this.available) speechSynthesis.resume();
  }
}

export const narrator = new Narrator();
