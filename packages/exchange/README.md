# @toneflix/studio-exchange

Project exchange for [Toneflix Studio](https://toneflix.github.io/studio/). Save a session, with its audio, in the app's own format (plugins included) or as a REAPER project, and open either again: tracks, clips, fades, volume and pan automation, markers, tempo changes and mixer settings carry over.

```sh
pnpm add @toneflix/studio-exchange
```

```ts
import { openProject, saveProject } from '@toneflix/studio-exchange';

// 'app' keeps plugins; 'reaper' makes a project REAPER opens
const { blob, fileName } = await saveProject('app', timeline, engine, { app: { name: 'My app', extension: 'myapp' }, plugins });
const { format, missing } = await openProject(file, timeline, engine, { plugins });
```

`toReaper(state)` and `fromReaper(text)` work on the project text alone, on servers too. It is one part of Toneflix Studio. Install [`@toneflix/studio`](https://www.npmjs.com/package/@toneflix/studio) to get every part from one import. See [Saving projects](https://toneflix.github.io/studio/guide/projects) for the full guide.

MIT License.
