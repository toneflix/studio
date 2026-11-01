# @toneflix/studio-recorder

Recording for [Toneflix Studio](https://toneflix.github.io/studio/). Record a microphone or line input onto a track while the music plays, and the take lands right where it was sung or played.

```sh
pnpm add @toneflix/studio-recorder
```

```ts
import { AudioEngine } from '@toneflix/studio-audio';
import { Recorder } from '@toneflix/studio-recorder';

const engine = new AudioEngine();
const recorder = new Recorder(engine);

recorder.arm('vocals');
await recorder.start();
// …
const take = await recorder.stop(); // { id, track, start, duration, buffer }
```

It is one part of Toneflix Studio. Install [`@toneflix/studio`](https://www.npmjs.com/package/@toneflix/studio) to get every part from one import, with `linkRecorder` to show takes on the timeline as they record. See [Recording](https://toneflix.github.io/studio/guide/recording) for the full guide.

MIT License.
