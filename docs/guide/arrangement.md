# Markers and tempo

The ruler holds the song's markers, above the bar numbers, and its tempo changes, beside the bar each one starts on. Both are part of the timeline state, so they undo, save and load with the tracks.

<StudioPlayground />

## Markers

Markers name places in the song, like Verse or Chorus.

| Gesture | What it does |
| --- | --- |
| Double-click above the bar numbers | Adds a marker there and puts its name up for editing |
| Right-click the ruler, Add marker here | The same, from a menu |
| Click a marker | Moves the playhead to it |
| Drag a marker | Moves it, snapping to the grid; hold <kbd>Alt</kbd> to move freely |
| Double-click a marker, or right-click it | Rename it, or open its menu to rename or delete it |

From code: `addMarker(time?, name?)`, `updateMarker(id, { name?, time?, color? })`, `removeMarker(id)` and `editMarkerName(id)`. `markers` lists them by time.

## Tempo and meter changes

The first tempo and meter come from the grid (`grid: { bpm, meter }`) and are changed in the transport display. A tempo change takes over from a bar later in the song:

| Gesture | What it does |
| --- | --- |
| Right-click the ruler, Add tempo change at this bar | Adds a change at the nearest bar, keeping the tempo there |
| Click a change | Set its tempo, pick a meter (2/4 to 12/8) or delete it |
| Drag a change | Moves it from bar line to bar line |

Each change starts a new section of the grid. Bar numbers, grid lines, snapping, the transport display, loops, the metronome and the tempo sent to plugins all follow the section under them. With the playhead past a change, the display's tempo and meter edit that change.

Clips keep their times in seconds when the tempo changes, so audio never moves or stretches.

From code: `addTempoChange(time?, bpm?, meter?)`, `updateTempoChange(id, { time?, bpm?, meter? })` and `removeTempoChange(id)`. On the `grid`, `sections` lists every stretch of one tempo, and `sectionAt(time)`, `position(time)`, `barTime(bar)`, `bars(from, to)` and `beats(from, to)` work across them, as do `quarters(time)` and `timeAtQuarters(quarters)`, which convert between seconds and quarter notes from the start.

The ruler grows a little taller to fit the markers. Pass `markers: false` or `tempoTrack: false` to leave either out, and `rulerLabels` to rename what they show.
