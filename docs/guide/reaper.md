# REAPER projects

`@toneflix/studio-exchange` saves a session as a [REAPER](https://www.reaper.fm) project and opens one again. REAPER's project file is plain text, and REAPER runs on Windows, macOS and Linux, so a session can go to a desktop studio for finishing and come back.

## From the toolbar

The toolbar has two buttons for this, beside the mixer button:

- **Save as a REAPER project** downloads a zip with the `.rpp` and every audio file the clips use, as WAV files in an `audio` folder. Unzip it and open the `.rpp` in REAPER.
- **Open a REAPER project** takes that zip back, any zip with an `.rpp` and its audio, or an `.rpp` picked together with its audio files.

```ts
new StudioToolbar('#toolbar', {
  timeline,
  engine,
  projectName: 'My song',
  // Draw waveforms for the audio of an opened project
  onProjectSource: (id, buffer) => void waveforms.get(`project:${id}`, () => buffer).then((peaks) => timeline.setSource({ id }, peaks)),
  onProjectOpen: ({ missing }) => missing.length && alert(`Audio not found: ${missing.join(', ')}`),
});
```

## What carries over

| | |
| --- | --- |
| Tracks | Names, colours, volume, pan, mute and solo |
| Clips | Position, length, where they start in the audio, gain, fade in and fade out |
| Automation | Volume and pan envelopes |
| Markers | Names and times; a REAPER region comes back as a marker at its start |
| Tempo | The starting tempo and meter, and every tempo or meter change |

Plugins and their settings don't carry over, since REAPER hosts VST, AU and CLAP plugins rather than Web Audio Modules. The master channel's volume and pan do.

## From code

```ts
import { openReaperProject, saveReaperProject, fromReaper, toReaper } from '@toneflix/studio';

const zip = await saveReaperProject(timeline, engine, { name: 'My song' });
const { missing } = await openReaperProject(file, timeline, engine);

// Or just the project text, without audio, on a server or in a worker
const rpp = toReaper(state, { bpm: 120, meter: [4, 4], mixer: engine.mixer.snapshot() });
const { state, bpm, meter, mixer, files } = fromReaper(rpp);
```

`toReaper` names each source's file `audio/<source>.wav` unless you pass `file: (source) => path`. `fromReaper` gives every audio file a source id made from its file name, and `files` maps those ids to the paths in the project. `zip(entries)` and `unzip(bytes)` are there too, for packing your own bundles.
