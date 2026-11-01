# @toneflix/studio-core

The project model of [Toneflix Studio](https://toneflix.github.io/studio/): tracks, clips, pure edits, snapping and one undo history. It has no DOM or audio code, so it runs in browsers, workers and on servers.

```sh
pnpm add @toneflix/studio-core
```

```ts
import { makeClip, splitClips, TimelineModel } from '@toneflix/studio-core';
```

It is one part of Toneflix Studio. Install [`@toneflix/studio`](https://www.npmjs.com/package/@toneflix/studio) to get every part from one import. See [Packages](https://toneflix.github.io/studio/guide/packages) for what each package does.

MIT License.
