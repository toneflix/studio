# @toneflix/studio

A browser DAW timeline from [Toneflix Music](https://toneflix.net): lanes of audio clips you can split, drag freely by the body, stack over each other, move between lanes, trim, fade and snap, with canvas waveforms and one undo history for the whole editor. No dependencies, no framework.

> Status: early. This release has the timeline and waveforms. Playback and recording come next.

## Use

```ts
import { StudioTimeline, Waveforms, makeClip, uid } from '@toneflix/studio';

const timeline = new StudioTimeline(document.getElementById('editor')!, {
  grid: { bpm: 120, meter: [4, 4], snap: 'beat' },
  createTrack: () => ({ id: uid('t'), name: 'New stem' }),
});

timeline.load({
  tracks: [{ id: 'vox', name: 'Vocals' }],
  clips: [makeClip({ track: 'vox', source: 'vox.wav', start: 0, offset: 0, duration: 12 })],
});

// Peaks are worked out in a worker and kept in Cache Storage, so a stem is analysed once per device
const waveforms = new Waveforms();
const peaks = await waveforms.get('vox.wav:v1', () => audioContext.decodeAudioData(bytes));
timeline.setSource({ id: 'vox.wav', duration: 12 }, peaks);

timeline.on('change', ({ state, final }) => final && save(state));
```

## Editing

| Gesture | What it does |
| --- | --- |
| Drag a clip | Moves it in time and to other lanes; past or over other clips. Below the last lane makes a new one (with `createTrack`) |
| Drag a clip edge | Trims it, up to the ends of its audio |
| Drag a corner handle | Fade in or out |
| Click, Shift or Ctrl/Cmd click | Select, add to or toggle the selection |
| Drag on an empty lane or the ruler | Selects a time range; with Shift, selects the clips inside it |
| Alt while dragging | Turns snapping off |
| Ctrl/Cmd + wheel | Zoom around the pointer |
| S, Delete, Ctrl+D, Ctrl+A | Split at the playhead, delete, duplicate, select all |
| Arrows | Nudge by the snap step, or move up and down a lane |
| Ctrl+Z, Ctrl+Shift+Z | Undo and redo |

Where clips overlap on a lane, the one that starts later is on top and is the one heard. `audibleRanges(clips)` gives the heard part of each clip, for players and mix renderers.

## Pieces

- `StudioTimeline`: the view. Tiles waveform canvases so only what is on screen is drawn. Restyle it with the `--tfs-*` CSS variables or fill track headers with `renderHeader`.
- `TimelineModel` and `History`: tracks and clips as plain immutable data, and the undo list. Pass your own `History` to put your app's steps (mixer, effects) in the same list.
- Pure edits (`splitClips`, `moveClips`, `trimStart`, `setFades`…): usable without the view, on the server or in tests.
- `Waveforms`, `PeaksWorker`, `PeaksCache`: peaks off the main thread, cached on the device.

## Develop

```sh
yarn install
yarn test        # node --test, no browser needed
yarn demo        # the demo page with made-up audio
yarn build       # dist/ with type declarations
```

## License

MIT
