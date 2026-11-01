# Saving projects

`@toneflix/studio-exchange` saves a whole session, audio included, and opens it again. It has two formats:

| Format | File | Plugins | Opens in |
| --- | --- | --- | --- |
| Your app's own | `.tfstudio`, or the extension you choose | Kept, with their settings | Your app, or any app built on Toneflix Studio |
| REAPER | `.zip` with an `.rpp` and the audio | Left out | [REAPER](https://www.reaper.fm), on Windows, macOS and Linux, and back in your app |

Pick the app format to keep working later, and REAPER to finish a song in a desktop studio. The format decides whether plugins go along: REAPER hosts VST, AU and CLAP plugins rather than Web Audio Modules, so a REAPER project carries none.

## From the toolbar

The toolbar has two buttons for this, beside the mixer button:

- **Save project** asks which format to save in, then downloads the file.
- **Open a project** takes either format back: an app project, a zip with an `.rpp` and its audio, or an `.rpp` picked together with its audio files.

```ts
new StudioToolbar('#toolbar', {
  timeline,
  engine,
  plugins,
  app: {
    name: 'Toneflix Music',
    id: 'toneflix-music',
    version: '2.1',
    description: 'Songs made on Toneflix Music',
    copyright: '© Toneflix',
    url: 'https://toneflix.net',
    extension: 'tfmusic',
  },
  projectName: 'My song',
  // Draw waveforms for the audio of an opened project
  onProjectSource: (id, buffer) => void waveforms.get(`project:${id}`, () => buffer).then((peaks) => timeline.setSource({ id }, peaks)),
  onProjectOpen: ({ format, missing }) => missing.length && alert(`Audio not found: ${missing.join(', ')}`),
});
```

`app` says who is saving. Its name labels your format in the save menu, its extension names the file, and every detail is written into each project: into `project.json` in your format, and into REAPER's project notes (View > Project notes). Without it the format is called Toneflix Studio and the files end in `.tfstudio`. `projectFormats: ['app']` or `['reaper']` saves straight to one format with no menu.

## What carries over

| | App format | REAPER |
| --- | --- | --- |
| Tracks: names, colours, volume, pan, mute, solo | Yes | Yes |
| Clips: position, length, offset, gain, fades | Yes | Yes |
| Volume and pan automation | Yes | Yes |
| Markers | Yes | Yes; a REAPER region comes back as a marker at its start |
| Tempo, meter and their changes | Yes | Yes |
| Master volume and pan | Yes | Yes |
| Plugins on tracks and the master, with their settings | Yes | No |
| Who saved it | `app` in `project.json` | Project notes |

Plugins are saved by URL with their settings, and load again from that URL when the project opens, so the plugin files must still be reachable. Opening a REAPER project clears the plugins that were loaded.

## From code

```ts
import { openProject, saveProject, fromReaper, toReaper } from '@toneflix/studio';

const { blob, fileName } = await saveProject('app', timeline, engine, { app, name: 'My song', plugins });
const { format, missing } = await openProject(file, timeline, engine, { plugins });

// Or the REAPER project text alone, without audio, on a server or in a worker
const rpp = toReaper(state, { bpm: 120, meter: [4, 4], mixer: engine.mixer.snapshot(), notes: 'Made with Toneflix Music' });
const { state, bpm, meter, mixer, files, notes } = fromReaper(rpp);
```

`saveAppProject` and `saveReaperProject` save one format each, and `openReaperProject` opens REAPER projects only. An app project is a zip with `project.json` (a `ProjectManifest`) beside an `audio` folder of WAV files.

`toReaper` names each source's file `audio/<source>.wav` unless you pass `file: (source) => path`. `fromReaper` gives every audio file a source id made from its file name, and `files` maps those ids to the paths in the project. `zip(entries)` and `unzip(bytes)` are there too, for packing your own bundles.
