# Audio, voices and narration

## What runs today

- **SFX and music** are synthesized at runtime in `src/audio/synth.ts` and `src/audio/music.ts`, so there are no files and no licensing questions.
  Each sound has a name (`explosion`, `zap`, `missile`, …); replacing one with a sample only means changing that entry.
- **Three buses**: dialogue, music and effects, each with its own volume slider, plus a master mute (`src/audio/AudioEngine.ts`).
- **Voices**: each line in `src/story/episode01.ts` has an id (`n01`, `p10`, `r13`, …). `src/audio/Narrator.ts` picks the first available option:
  1. a pre-recorded file listed in `src/audio/voiceManifest.ts`
  2. the browser's speech synthesis, with a different voice, pitch and rate per character
  3. subtitles only
- The story waits for a line to finish speaking (up to 4 s extra), so subtitles and cuts stay in sync.

## Adding recorded voice lines

1. Save files as `public/audio/voice/<lineId>.mp3` (or `.wav`).
2. Map them in `src/audio/voiceManifest.ts`:
   ```ts
   export const VOICE_MANIFEST = { n01: '/audio/voice/n01.mp3', p10: '/audio/voice/p10.mp3' };
   ```

## AI text-to-speech (not implemented; secure pattern)

Never put API keys in frontend code. Instead:

1. Add a small server endpoint, e.g. `POST /api/tts { lineId, speaker, text }`, that calls ElevenLabs or OpenAI TTS
   with a key read from a server environment variable, and caches the resulting MP3 by `lineId`.
2. Either pre-generate every line at build time into `public/audio/voice/` and list them in the manifest
   (recommended: no runtime cost), or have `Narrator.speak()` fetch `/api/tts` before falling back to the browser voice.
