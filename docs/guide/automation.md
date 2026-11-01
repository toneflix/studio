# Automation

Automation changes a track's volume or pan over time. Each track keeps its own points, so they move, copy, save and undo with the track.

<StudioPlayground />

## Drawing

Open a track's menu (click its name or right-click its header) and pick **Show volume automation** or **Show pan automation**. A lane opens under the track:

| Gesture | What it does |
| --- | --- |
| Click the lane | Add a point there; keep the button down to place it |
| Drag a point | Move it. It snaps to the grid; hold <kbd>Alt</kbd> to move freely |
| Double-click a point | Remove it |
| The lane's name | Switch between volume and pan, clear the points, or hide the lane |

The value at the playhead shows beside the lane's name, in dB for volume and L/C/R for pan. Every change is one undo step.

## How it plays

Straight lines join the points. Before the first point the track holds the first value, and after the last it holds the last one. A track with no points plays as it did before.

Automation runs on top of the mixer: volume automation is a gain after the fader, from silence to +6 dB, and pan automation is a pan after the pan knob. The fader and knob keep working as a trim, so you can still balance an automated track. Playback, loops and `engine.render()` all follow it.

## From code

Points live on the track as `automation: { volume?, pan? }`, each a list of `{ time, value }` sorted by time. Volume is linear gain from 0 to 2 and pan runs from -1 to 1.

```ts
timeline.setAutomation('keys', 'volume', [
  { time: 4, value: 0.15 },
  { time: 8, value: 1 },
]);
timeline.showAutomation('keys', 'volume');
```

`setAutomation(track, param, [])` clears a setting, `removeAutomationPoint(track, param, index)` drops one point, and `automationView(track)` says which lane is open. The `automation` event fires when a lane opens, switches or closes. Pure helpers for servers and tests: `setAutomation(state, track, param, points)` and `automationAt(points, time, fallback)` from `@toneflix/studio-core`.
