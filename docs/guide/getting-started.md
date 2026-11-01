# Getting started

## Install

::: code-group

```sh [pnpm]
pnpm add @toneflix/studio
```

```sh [npm]
npm install @toneflix/studio
```

```sh [yarn]
yarn add @toneflix/studio
```

:::

The package ships ES modules with type declarations and has no third-party dependencies. It includes every part of Toneflix Studio; to install only some of them, see [Packages](./packages). It runs in any modern browser and needs no bundler setup, including for its Web Worker.

## Your first timeline

Give the timeline an element with a height, or a CSS selector for one, then load tracks and clips into it.

```ts
import { StudioTimeline, makeClip, uid } from '@toneflix/studio';

const timeline = new StudioTimeline('#editor', {
  grid: { bpm: 120, meter: [4, 4], snap: 'beat' },
  createTrack: () => ({ id: uid('t'), name: 'New track' }),
});

timeline.load({
  tracks: [
    { id: 'drums', name: 'Drums' },
    { id: 'vox', name: 'Vocals' },
  ],
  clips: [
    makeClip({ track: 'drums', source: 'drums.wav', start: 0, offset: 0, duration: 16 }),
    makeClip({ track: 'vox', source: 'vox.wav', start: 4, offset: 0, duration: 12 }),
  ],
});
```

```css
#editor {
  height: 480px;
}
```

## Add waveforms

Tell the timeline how long each source is and give it peaks. `Waveforms` works them out in a Web Worker and keeps them on the device, so each file is analysed once.

```ts
import { Waveforms } from '@toneflix/studio';

const waveforms = new Waveforms();
const context = new AudioContext();

const bytes = await fetch('/audio/vox.wav').then((r) => r.arrayBuffer());
const audio = await context.decodeAudioData(bytes);

timeline.setSource({ id: 'vox.wav', duration: audio.duration });
timeline.setSource({ id: 'vox.wav' }, await waveforms.get('vox.wav:v1', () => audio));
```

The key passed to `waveforms.get` names the cached peaks. Change it whenever the audio changes.

## Save changes

Every finished edit emits `change` with the whole state, which is plain JSON.

```ts
timeline.on('change', ({ state, final }) => {
  if (final) save(state);
});
```

See [Saving projects](./saving) for what the state looks like.

## Try it locally

```sh
git clone https://github.com/toneflix/studio
cd studio
pnpm install
pnpm demo
```
