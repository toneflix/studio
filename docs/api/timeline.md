# StudioTimeline

```ts
new StudioTimeline(container: HTMLElement | string, options?: TimelineOptions)
```

Renders into `container`, which should have a height. The timeline fills it. Pass the element itself or a CSS selector for it, like `'#editor'`. A selector that matches nothing throws an error.

## Options

| Option | Type | Default | |
| --- | --- | --- | --- |
| `model` | `TimelineModel` | new | Share a model between views |
| `history` | `History` | new | The editor's undo history ([guide](../guide/history)) |
| `grid` | `{ bpm, meter, snap }` | `120`, `[4, 4]`, `'beat'` | Tempo, meter and snap |
| `showGrid` | `boolean` | `true` | Bars and beats on the tracks and ruler |
| `pxPerSecond` | `number` | `40` | Starting zoom |
| `minPxPerSecond` / `maxPxPerSecond` | `number` | `2` / `2000` | Zoom limits |
| `trackHeight` | `number` | `72` | Default track height in pixels; a track's own `height` wins |
| `resizeTracks` | `boolean` | `true` | Drag a track's bottom edge to resize it |
| `minTrackHeight` / `maxTrackHeight` | `number` | `40` / `320` | Resize limits |
| `headerWidth` | `number` | `180` | Header column width; `0` hides it |
| `readonly` | `boolean` | `false` | No editing |
| `snapToClips` | `boolean` | `true` | Pull towards clip edges and the playhead when grid snap is off |
| `follow` | `boolean` | `true` | Keep the playhead on screen |
| `keyboard` | `boolean` | `true` | Editing shortcuts while focused |
| `palette` | `string[]` | 8 colours | Colours for tracks without one |
| `renderHeader` | `(track, cell) => void \| (() => void)` | | Your own header controls |
| `createTrack` | `() => Track` | | Lets clips be dragged onto a new track |

## Properties

| | |
| --- | --- |
| `state` | The current `TimelineState` |
| `model` | The `TimelineModel` |
| `history` | The `History` |
| `grid` | The `Grid` (tempo, meter, snap) |
| `selection` | Ids of the selected clips |
| `range` | The selected time range, or `null` |
| `time` | The playhead, in seconds |
| `pxPerSecond` | The zoom |
| `root` | The timeline's own element |

## Methods

| | |
| --- | --- |
| `load(state)` | Replace tracks and clips, without an undo step |
| `setSource(source, peaks?)` | A source's length, and its peaks once known |
| `select(ids)` | Select clips |
| `setRange(range \| null)` | Select a time range on some tracks |
| `setTime(seconds)` | Move the playhead |
| `setZoom(pxPerSecond, anchor?)` | Zoom, keeping the `anchor` time in place |
| `fit()` | Zoom to fit every clip |
| `timeAt(clientX)` | The time under a point on screen |
| `split(time?)` | Split at a time (the playhead by default) |
| `deleteSelected()` / `duplicateSelected()` | |
| `nudge(seconds, tracks?)` | Move the selected clips |
| `undo()` / `redo()` | |
| `setGrid({ bpm?, meter?, snap?, show? })` | |
| `setOptions({ readonly?, follow?, snapToClips?, trackHeight?, resizeTracks?, keyboard? })` | |
| `heightOf(track)` | The track's row height in pixels |
| `on(event, listener)` | Returns a function that removes the listener |
| `destroy()` | Remove the timeline and its listeners |

## Events

| Event | Payload | When |
| --- | --- | --- |
| `change` | `{ state, label, final }` | Tracks or clips changed; `final` is false while a drag is still going |
| `select` | `{ clips }` | The selection changed |
| `range` | `{ range }` | A time range was picked or cleared |
| `seek` | `{ time }` | Someone clicked to move the playhead |
| `zoom` | `{ pxPerSecond }` | The zoom changed |
