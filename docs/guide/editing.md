# Editing

Clips are pieces of audio on a track. Each one says where it starts on the timeline (`start`), how far into its audio it begins (`offset`) and how long it plays (`duration`), so cuts and trims never touch the audio itself.

## Mouse and touch

| Gesture | What it does |
| --- | --- |
| Drag a clip | Moves it in time and to other tracks, past or over other clips |
| Drag below the last track | Makes a new track for the clip (needs `createTrack`) |
| Drag a clip edge | Trims it, up to the ends of its audio |
| Drag a corner handle | Fade in or fade out |
| Click / Shift click / Ctrl or ⌘ click | Select, add to the selection, toggle in the selection |
| Drag on an empty track or the ruler | Selects a time range |
| Shift + drag on an empty track | Selects every clip inside the box |
| Click the ruler or an empty track | Moves the playhead |
| Alt while dragging | Turns snapping off |
| Ctrl or ⌘ + wheel | Zooms around the pointer |
| Drag a track's bottom edge | Makes the track taller or shorter; double-click to reset |

On touch screens, drag clips with a finger and swipe empty space to scroll. Range selection works from the ruler.

## Keyboard

While the timeline has focus:

| Key | What it does |
| --- | --- |
| <kbd>S</kbd> | Split at the playhead: the selected clips, or every clip under the playhead |
| <kbd>Delete</kbd> / <kbd>Backspace</kbd> | Delete the selected clips |
| <kbd>Ctrl</kbd>+<kbd>D</kbd> | Duplicate the selected clips right after themselves |
| <kbd>Ctrl</kbd>+<kbd>A</kbd> | Select every clip |
| Arrow left / right | Nudge by one snap step (0.1 s with snapping off) |
| Arrow up / down | Move to the track above or below |
| <kbd>Ctrl</kbd>+<kbd>Z</kbd>, <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>Z</kbd> | Undo, redo |
| <kbd>Esc</kbd> | Cancel a drag, or clear the selection |

<kbd>⌘</kbd> works in place of <kbd>Ctrl</kbd> on macOS. Pass `keyboard: false` to handle shortcuts yourself.

After a split only the left pieces stay selected, so you can grab a right-hand piece and move it on its own.

## Snapping

With the grid on and a snap value other than `off`, a dragged clip's start lands on the grid. With snapping off, clips are pulled towards other clips' edges, the playhead and zero when they come within 8 pixels (`snapToClips: false` turns that off).

```ts
timeline.setGrid({ bpm: 96, meter: [6, 8], snap: '1/8' });
timeline.setGrid({ show: false });
```

Snap values are `'off'`, `'bar'`, `'beat'`, `'1/8'`, `'1/16'` and `'1/32'`. The tempo counts quarter notes, so a beat of 6/8 is an eighth note.

## Overlapping clips

Clips can sit on top of each other. Where they overlap, the clip that starts later is on top and is the one heard. `audibleRanges` gives the heard part of each clip, which is what a player or a mix renderer needs:

```ts
import { audibleRanges } from '@toneflix/studio';

const onTrack = timeline.state.clips.filter((clip) => clip.track === 'vox');

for (const { clip, start, end } of audibleRanges(onTrack)) {
  // play clip.source from clip.offset + (start - clip.start) for end - start seconds
}
```

## Editing from code

Everything the gestures do is also a method:

```ts
timeline.setTime(8);
timeline.select(['clip-1']);
timeline.split();
timeline.nudge(0.5, 1);
timeline.duplicateSelected();
timeline.deleteSelected();
timeline.setZoom(120);
timeline.fit();
```

For edits the view has no method for, use the pure [edit functions](../api/edits) through the model, so they land in the undo history:

```ts
import { setGain } from '@toneflix/studio';

timeline.model.apply('Gain', (state) => setGain(state, new Set(timeline.selection), 0.5));
```
