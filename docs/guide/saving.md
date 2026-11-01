# Saving projects

The timeline's state is plain data, so you can save it as JSON, in a database or alongside your own project format.

```ts
interface TimelineState {
  tracks: Track[];
  clips: Clip[];
}

interface Track {
  id: string;
  name: string;
  color?: string;
  height?: number; // row height in pixels, set by dragging its edge
  data?: unknown; // anything your app keeps with the track
}

interface Clip {
  id: string;
  track: string; // the track it sits on
  source: string; // the audio it plays
  start: number; // seconds on the timeline
  offset: number; // seconds into the audio
  duration: number; // seconds
  gain: number; // 1 is unchanged
  fadeIn: number; // seconds
  fadeOut: number; // seconds
  name?: string;
  color?: string;
}
```

A clip's `source` is any id you choose, such as a file id or a URL. Several clips can play the same source, which is what a split produces.

## Saving on change

```ts
timeline.on('change', ({ state, label, final }) => {
  if (!final) return; // a drag is still going

  saveSoon(state);
});
```

`label` names the edit (`Move`, `Trim`, `Split`, `Undo Move`…). Loading a project with `load()` also emits `change` with the label `Load`.

## Loading

```ts
timeline.load(await fetchProject(id));
```

`load` replaces everything without adding an undo step. Call `timeline.history.clear()` as well if the undo list shouldn't reach back into the previous project.
