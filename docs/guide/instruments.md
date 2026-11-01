# Instruments and notes

An instrument track plays note clips through an instrument: the built-in synth or drum kit, or a Web Audio Module instrument. Its clips hold notes instead of audio, the timeline draws them as a small piano roll, and the piano roll editor draws and changes them.

<StudioPlayground />

```ts
import { makeNoteClip } from '@toneflix/studio';

timeline.load({
  tracks: [
    { id: 'lead', name: 'Lead', instrument: { id: 'synth' } },
    { id: 'beat', name: 'Beat', instrument: { id: 'drums' } },
  ],
  clips: [
    makeNoteClip({
      track: 'lead',
      start: 0,
      duration: 2,
      notes: [
        { pitch: 60, start: 0, duration: 0.5, velocity: 0.9 },
        { pitch: 64, start: 0.5, duration: 0.5, velocity: 0.7 },
      ],
    }),
  ],
});
```

A note's `pitch` is a MIDI note number (60 is middle C), its `start` counts in seconds from the clip's start, and its `velocity` runs from 0 to 1. The clip's gain scales every note's velocity. Notes are cut where the clip ends, and the clip can be moved, trimmed, split and duplicated like any other.

## Adding tracks and clips

The add track button asks what to add: an empty audio track, audio from a file on the device (with the `importAudio` option, see [Editing](./editing)), an instrument track or a drum track. Double-click an empty spot on an instrument track's lane to add a one-bar note clip there. Pass `instrumentTracks` to change the kinds on offer, or an empty list to offer only audio tracks.

| Method | What it does |
| --- | --- |
| `timeline.addNoteClip(track, time, bars?)` | Adds an empty note clip at the bar `time` falls in |
| `timeline.setNotes(clip, notes)` | Replaces a note clip's notes |
| `timeline.setInstrument(track, choice)` | Picks a track's instrument, or changes its settings |

Each one is a single undo step.

## Piano roll

`StudioPianoRoll` edits a note clip's notes on a grid of keys and time. Double-click or double-tap a note clip to open it. While it is open, picking another note clip on the timeline switches to it.

```ts
import { StudioPianoRoll } from '@toneflix/studio';

const pianoRoll = new StudioPianoRoll('#editor', { timeline, engine, hidden: true });

pianoRoll.edit(clip.id); // or open one yourself
```

| Gesture | What it does |
| --- | --- |
| Click or tap an empty cell | Draws a note there, as long as the last one drawn or resized |
| Drag a note | Moves it, and every picked note, in time and pitch; hold Alt to leave the grid |
| Drag a note's right edge | Changes its length |
| Double-click or double-tap a note, or right-click it | Deletes it |
| Drag on an empty spot with a mouse | Picks the notes in a box; Shift or Ctrl adds to the picked notes |
| Drag a stalk in the velocity lane | Sets that note's velocity, or moves every picked note's velocity together |
| Press a key on the left | Plays that note through the track's instrument |
| Delete, Ctrl+A, Ctrl+D, Q | Delete, pick all, duplicate and quantize the picked notes |
| Arrow keys | Move picked notes a semitone (an octave with Shift) or one snap step |

Notes snap to the piano roll's own grid (1/16 by default), which follows the timeline's tempo changes. **Quantize** puts the starts of the picked notes, or of every note, on that grid. Every finished edit is one step in the timeline's undo history. On drum tracks the keys show the drum names. On touch screens the rows grow, a drag on an empty spot scrolls, and a tap draws.

It slides up over the bottom of its container, like the mixer; pass `docked: true` to place it in the page flow. Set `--tfs-roll-height` (340px) to size it. The note helpers it uses, such as `moveNotes`, `quantizeNotes` and `duplicateNotes`, are exported for your own editors.

## Built-in instruments

| Id | Instrument | Settings (`state`) |
| --- | --- | --- |
| `synth` | Polyphonic subtractive synth: two detuned oscillators, a low-pass filter and an envelope | `wave`, `detune`, `attack`, `decay`, `sustain`, `release`, `cutoff`, `resonance`, `envelope`, `volume` |
| `drums` | Drum machine made of oscillators and noise, on General MIDI drum notes: kick 36, snare 38, clap 39, closed hat 42, open hat 46, toms 45, 47 and 50, crash 49, ride 51, cowbell 56 | `volume`, `tune`, `decay` |

## WAM instruments

With a `PluginRack`, any instrument choice whose id isn't built in loads as a Web Audio Module from that URL, and notes reach it as MIDI events:

```ts
const plugins = new PluginRack(engine);

engine.setInstruments(plugins.instruments());
timeline.setInstrument('lead', { id: 'https://example.com/wams/synth/index.js' });
```

`engine.instrument(track)` gives a track's instrument once it has loaded, with `noteOn` and `noteOff` for keys played live. Some WAM instruments play only live and stay silent in offline renders like Export mix, so test one in an export before you offer it. The built-in instruments render either way.

To make your own instrument, implement `Instrument` (`output`, `play`, `noteOn`, `noteOff`, `stopAll`, `destroy`) and pass an `InstrumentFactory` to `engine.setInstruments`.
