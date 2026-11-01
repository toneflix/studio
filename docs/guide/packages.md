# Packages

Toneflix Studio is split into small packages, so an app installs only what it uses. `@toneflix/studio` includes all of them and is the simplest place to start.

| Package | Install it when you need | Depends on |
| --- | --- | --- |
| `@toneflix/studio` | Everything, from one import | all packages below |
| `@toneflix/studio-core` | The project model: tracks, clips, edits, snapping and undo history, without a view. Works on servers and in workers | nothing |
| `@toneflix/studio-waveforms` | Waveform peaks worked out in a worker, cached on the device and drawn on a canvas | core |
| `@toneflix/studio-timeline` | The multitrack editor view, `StudioTimeline` | core, waveforms |
| `@toneflix/studio-audio` | Playback, mixer, effects, loops, metronome and mixdown, `AudioEngine` | core |
| `@toneflix/studio-recorder` | Recording a microphone or line input onto a track, lined up with playback, `Recorder` | core, audio |
| `@toneflix/studio-plugins` | Web Audio Module (WAM 2) plugins as live track and master inserts, `PluginRack` | core, audio |
| `@toneflix/studio-exchange` | Saving and opening projects in the app's own format or REAPER's (`saveProject`, `openProject`, `toReaper`, `fromReaper`) | core, audio, timeline, plugins |
| `@toneflix/studio-controls` | A toolbar, track strips, a mixer and a browser of sounds and plugins, with Lucide icons you can replace | core, timeline, audio, recorder, plugins, exchange |

## Examples

Check or change a saved project on a server, with no browser code:

```sh
pnpm add @toneflix/studio-core
```

```ts
import { audibleRanges, splitClips, type TimelineState } from '@toneflix/studio-core';

const project: TimelineState = JSON.parse(saved);
const { state } = splitClips(project, new Set(['vox-1']), 12);
const heard = audibleRanges(state.clips.filter((c) => c.track === 'vox'));
```

Show waveforms in your own player:

```sh
pnpm add @toneflix/studio-waveforms
```

```ts
import { Waveforms } from '@toneflix/studio-waveforms';

const peaks = await new Waveforms().get('song.mp3:v1', () => audioContext.decodeAudioData(bytes));
```

## Versions

All packages are released together with the same version number. Keep them on the same version in your app, or install `@toneflix/studio` and let it bring the matching set.

Every name exported by a package is also exported by `@toneflix/studio`, so switching between them only changes the import path.
