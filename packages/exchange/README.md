# @toneflix/studio-exchange

Project exchange for [Toneflix Studio](https://toneflix.github.io/studio/). Save a session as a REAPER project, with its audio, and open REAPER projects again: tracks, clips, fades, volume and pan automation, markers, tempo changes and mixer settings carry over.

```sh
pnpm add @toneflix/studio-exchange
```

```ts
import { openReaperProject, saveReaperProject } from '@toneflix/studio-exchange';

const zip = await saveReaperProject(timeline, engine, { name: 'My song' });
const { missing } = await openReaperProject(file, timeline, engine);
```

`toReaper(state)` and `fromReaper(text)` work on the project text alone, on servers too. It is one part of Toneflix Studio. Install [`@toneflix/studio`](https://www.npmjs.com/package/@toneflix/studio) to get every part from one import. See [REAPER projects](https://toneflix.github.io/studio/guide/reaper) for the full guide.

MIT License.
