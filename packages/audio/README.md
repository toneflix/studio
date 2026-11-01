# @toneflix/studio-audio

Playback for [Toneflix Studio](https://toneflix.github.io/studio/). It plays a multitrack timeline with Web Audio, with a mixer, effects, loops, a metronome and offline mixdown to WAV. What you hear always matches the timeline, and edits are heard at once while playing.

```sh
pnpm add @toneflix/studio-audio
```

```ts
import { AudioEngine } from '@toneflix/studio-audio';

const engine = new AudioEngine();

engine.load(project);
engine.setBuffer('vox.wav', await engine.context.decodeAudioData(bytes));
await engine.play();
```

It is one part of Toneflix Studio. Install [`@toneflix/studio`](https://www.npmjs.com/package/@toneflix/studio) to get every part from one import. See [Playback](https://toneflix.github.io/studio/guide/playback) for the full guide.

MIT License.
