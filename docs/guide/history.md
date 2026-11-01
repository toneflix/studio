# Undo history

Every finished edit is one step in a `History`. A drag adds a single step when it ends, however far it moved, and a drag cancelled with <kbd>Esc</kbd> adds nothing.

```ts
timeline.undo();
timeline.redo();

timeline.history.on('change', ({ canUndo, canRedo, undoLabel }) => {
  undoButton.disabled = !canUndo;
  undoButton.title = undoLabel ? `Undo ${undoLabel}` : '';
});
```

## One history for the whole editor

An editor has more than clips: volume, effects, tempo. Create one `History`, give it to the timeline, and push your own steps into it. Undo then walks back through everything in the order it happened.

```ts
import { History, StudioTimeline } from '@toneflix/studio';

const history = new History();
const timeline = new StudioTimeline(element, { history });

const setVolume = (track: string, next: number) => {
  const before = mixer.volume(track);

  mixer.setVolume(track, next);
  history.push({
    label: 'Volume',
    undo: () => mixer.setVolume(track, before),
    redo: () => mixer.setVolume(track, next),
  });
};
```

Push a step after its change is applied. Steps pushed while an undo or redo runs are ignored, so your `undo` and `redo` may call code that would normally record a step.

The history keeps the last 200 steps; pass another limit with `new History(500)`.
