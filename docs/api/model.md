# Model and history

## TimelineModel

Holds the tracks and clips and records finished edits in a `History`. State objects are never changed in place, so comparing with `===` tells you whether something changed.

```ts
const model = new TimelineModel(state?, history?);
```

| | |
| --- | --- |
| `state` | The current `TimelineState` |
| `history` | Its `History` |
| `sources` | `Map` of source id to `{ id, duration? }` |
| `peaks` | `Map` of source id to `Peaks` |
| `apply(label, edit)` | Apply `edit(state) => state` as one undo step |
| `draft(label, edit)` | Show an edit in progress; each call starts again from the state before the draft |
| `commit(label)` | Finish the draft as one undo step |
| `cancel()` | Throw the draft away |
| `load(state)` | Replace everything without an undo step |
| `setSource(source, peaks?)` | Record a source's length and peaks |

Events: `change` (`{ state, label, final }`) and `source` (`{ id }`).

## History

```ts
const history = new History(limit = 200);
```

| | |
| --- | --- |
| `push({ label, undo, redo })` | Record a step that has already been applied |
| `undo()` / `redo()` | Return `false` when there is nothing to do |
| `clear()` | |
| `canUndo` / `canRedo` | |
| `info` | `{ canUndo, canRedo, undoLabel?, redoLabel? }` |

Event: `change` with `info`.

## Grid

```ts
const grid = new Grid({ bpm: 120, meter: [4, 4], snap: 'beat' });

grid.beat; // seconds per beat of the meter
grid.bar; // seconds per bar
grid.step; // seconds between snap points, 0 when off
grid.round(1.37); // the nearest snap point
grid.position(5.5); // { bar: 3, beat: 4 }
```
