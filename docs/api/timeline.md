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
| `createTrack` | `() => Track` | | Makes new tracks: for the add button and the menu, and for clips dragged below the last track |
| `editTracks` | `boolean` | `true` | The add track button and the track menu |
| `trackLabels` | `Partial<TrackLabels>` | `DEFAULT_TRACK_LABELS` | Names of the add button, menu items and automation lanes; `newTrack` is `'Track {n}'` |
| `automationHeight` | `number` | `64` | Height of the automation lane under a track |
| `markers` | `boolean` | `true` | Markers in the ruler, above the bar numbers |
| `tempoTrack` | `boolean` | `true` | Tempo and meter changes beside the bar numbers |
| `rulerLabels` | `Partial<RulerLabels>` | `DEFAULT_RULER_LABELS` | Names for markers and tempo changes in the ruler; `newMarker` is `'Marker {n}'` |

## Properties

| | |
| --- | --- |
| `state` | The current `TimelineState` |
| `model` | The `TimelineModel` |
| `history` | The `History` |
| `grid` | The `Grid` (tempo, meter, snap, and the tempo sections) |
| `markers` | The markers, by time |
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
| `split(time?)` | Split the selected clips at a time (the playhead by default), or a selected range at its edges; nothing happens when nothing is selected |
| `canSplit` | Whether there's a selection or range to split |
| `deleteSelected()` / `duplicateSelected()` | |
| `nudge(seconds, tracks?)` | Move the selected clips |
| `undo()` / `redo()` | |
| `addTrack(track?, index?)` | Add a track (a new one by default) at the end or an index; returns it |
| `removeTrack(id)` | Delete a track and its clips |
| `renameTrack(id, name)` / `editTrackName(id)` | Rename from code, or put the name up for editing in its header |
| `duplicateTrack(id)` | Copy a track and its clips just below it; returns the copy |
| `moveTrack(id, index)` | |
| `showTrackMenu(id, at?)` | Open a track's menu, under its header or at `{ x, y }` |
| `showClipMenu(id, at)` | Open a clip's right-click menu at `{ x, y }`: Edit notes, Make unique, Split at playhead, Duplicate, Delete. `clipLabels` renames them |
| `makeUnique(clip, notes?)` / `usePattern(clip, source)` | Give a note clip a pattern of its own (empty with `notes: []`), or switch it to another pattern; one undo step each |
| `addTrackMenuItems(items)` | Add items to every track menu above Delete: `items(track)` returns `{ label, onSelect, disabled?, danger? }` entries. Returns a function that takes them out |
| `showAutomation(id, 'volume' \| 'pan' \| null)` / `automationView(id)` | Open, switch or hide a track's automation lane |
| `setAutomation(id, param, points)` | Replace a track's points for volume or pan, as one undo step; `[]` clears them |
| `removeAutomationPoint(id, param, index)` | |
| `setGrid({ bpm?, meter?, snap?, show? })` | The tempo and meter at the start |
| `addMarker(time?, name?)` / `updateMarker(id, patch)` / `removeMarker(id)` / `editMarkerName(id)` | Markers, each change one undo step |
| `addTempoChange(time?, bpm?, meter?)` / `updateTempoChange(id, patch)` / `removeTempoChange(id)` / `editTempo(id)` | Tempo changes, each one undo step |
| `readonly` | Whether editing is off |
| `setOptions({ readonly?, follow?, snapToClips?, trackHeight?, resizeTracks?, keyboard?, editTracks? })` | |
| `heightOf(track)` | Height of the track's clip lane in pixels |
| `colorOf(track)` | The track's colour, its own or from the palette |
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
| `automation` | `{ track, param }` | An automation lane opened, switched or closed (`param` is `null`) |
| `open` | `{ clip }` | A clip was double-clicked or double-tapped; the piano roll opens note clips this way |

## Helpers

| Export | Description |
| --- | --- |
| `onDoubleTap(element, handler)` | Calls `handler` on a double click, or a double tap with a finger or pen (iOS sends no `dblclick` for touches). Returns a function that stops listening |
