# @toneflix/studio-controls

Ready-made controls for [Toneflix Studio](https://toneflix.github.io/studio/): a toolbar for playback and editing, and track strips with mute, solo and volume. They're drawn with [Lucide](https://lucide.dev) icons, which are built in and can each be replaced.

```sh
pnpm add @toneflix/studio-controls
```

```ts
import { StudioToolbar, trackStrip } from '@toneflix/studio-controls';

new StudioToolbar('#toolbar', { timeline, engine, icons: { play: mySvg } });
```

It is one part of Toneflix Studio. Install [`@toneflix/studio`](https://www.npmjs.com/package/@toneflix/studio) to get every part from one import. See [Toolbar and controls](https://toneflix.github.io/studio/guide/controls) for the full guide.

Default icons: Lucide, ISC License, Copyright (c) Lucide Icons and Contributors.

MIT License.
