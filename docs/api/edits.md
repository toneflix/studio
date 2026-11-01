# Edits

Pure functions that take a `TimelineState` and return a new one. They work without a page, so you can use them on a server, in tests or in a worker. Inside an editor, run them through `model.apply` so they land in the undo history.

| Function | |
| --- | --- |
| `makeClip(input)` | A clip with defaults for `id`, `gain` and fades |
| `addClips(state, clips)` | |
| `removeClips(state, ids)` | |
| `moveClips(state, ids, seconds, tracks?)` | Move by a time and a number of tracks; stops only at zero and the outer tracks |
| `trimStart(state, sources, id, time)` | Move the left edge, kept inside the audio |
| `trimEnd(state, sources, id, time)` | Move the right edge, kept inside the audio |
| `setFades(state, id, { fadeIn?, fadeOut? })` | Fades never add up to more than the clip |
| `setGain(state, ids, gain)` | |
| `splitClips(state, ids, time)` | Returns `{ state, created }`; the right pieces get new ids |
| `duplicateClips(state, ids)` | Returns `{ state, created }`; copies land right after the originals |
| `addTrack(state, track, index?)` | |
| `removeTrack(state, id)` | Removes its clips too |
| `moveTrack(state, id, index)` | |
| `updateTrack(state, id, patch)` | |
| `setAutomation(state, track, 'volume' \| 'pan', points)` | Sorts and clamps the points; `[]` removes them |
| `automationAt(points, time, fallback)` | The value at a time, on the lines between points |
| `timelineEnd(state)` | End of the last clip, in seconds |
| `audibleRanges(clips)` | The heard parts of one track's clips |
| `stackOrder(clips)` | One track's clips from bottom to top |
| `uid(prefix?)` | A short id unique in the page |

`ids` is a `Set<string>`. `sources` is the model's `sources` map; trims use it to stay inside the audio.

```ts
import { moveClips, splitClips } from '@toneflix/studio';

const { state: split, created } = splitClips(state, new Set(['a']), 6);
const moved = moveClips(split, new Set(created), -4);
```
