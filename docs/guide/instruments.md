# Instruments and notes

An instrument track plays note clips through an instrument: the built-in synth, drum kit or sampler, or a Web Audio Module instrument. Its clips hold notes instead of audio, the timeline draws them as a small piano roll, and the piano roll editor draws and changes them.

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

The add track button asks what to add: an empty audio track, audio from a file on the device (with the `importAudio` option, see [Editing](./editing)), an instrument track, a drum track or a sampler track. Double-click an empty spot on an instrument track's lane to add a one-bar note clip there. Pass `instrumentTracks` to change the kinds on offer, or an empty list to offer only audio tracks.

| Method | What it does |
| --- | --- |
| `timeline.addNoteClip(track, time, bars?)` | Adds an empty note clip at the bar `time` falls in |
| `timeline.setNotes(clip, notes)` | Replaces a note clip's notes |
| `timeline.makeUnique(clip, notes?)` | Gives a note clip a pattern of its own |
| `timeline.usePattern(clip, source)` | Makes a note clip play another pattern |
| `timeline.setInstrument(track, choice)` | Picks a track's instrument, or changes its settings |

Each one is a single undo step.

## Patterns

Note clips that are copies of each other play one pattern: duplicate a note clip (Ctrl+D, or Duplicate in its right-click menu) or split it, and every copy plays the same notes. Editing any copy, in the piano roll or the step sequencer, changes them all, so a beat or a riff can be built once and placed through the song. Copies show a badge with how many there are, and changing a pattern's length in **Bars** changes the copies that show all of it.

| To | Do this |
| --- | --- |
| Edit one copy on its own | **Make unique** in the clip's right-click menu or the piano roll's pattern menu. It gets a numbered pattern, like Beat 2 |
| Start a fresh pattern in a clip's place | **New empty pattern** in the pattern menu |
| Switch a clip to another pattern on its track | Pick the pattern in the pattern menu, which opens from the clip's name in the piano roll |

A note clip's `source` names its pattern, so clips with the same `source` share it. A duplicated track gets patterns of its own.

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
| The play button beside Notes and Steps, or Space | Loops the open clip on its own from its start, without the rest of the song; again to stop |
| Delete, Ctrl+A, Ctrl+D, Q | Delete, pick all, duplicate and quantize the picked notes |
| Arrow keys | Move picked notes a semitone (an octave with Shift) or one snap step |

Notes snap to the piano roll's own grid (1/16 by default), which follows the timeline's tempo changes. **Quantize** puts the starts of the picked notes, or of every note, on that grid. Every finished edit is one step in the timeline's undo history. On drum tracks the keys show the drum names. On touch screens the rows grow, a drag on an empty spot scrolls, and a tap draws.

The play button works in both views, so a beat or a riff can be shaped while it repeats. It sets the engine's loop to the clip and plays only that clip, follows the clip as it grows or moves, and switches to another clip when you open one. Stopping it, or pausing from the toolbar, puts the earlier loop and play position back. From code: `pianoRoll.playPreview()`, `stopPreview()`, `togglePreview()` and `previewing`.

It slides up over the bottom of its container, like the mixer; pass `docked: true` to place it in the page flow. Set `--tfs-roll-height` (340px) to size it. The note helpers it uses, such as `moveNotes`, `quantizeNotes` and `duplicateNotes`, are exported for your own editors.

## Step sequencer

The piano roll's **Steps** view shows a note clip as a step sequencer: a row per drum and a column per step. Drum track clips open in it, and **Notes** switches back to the keys. Pass `stepsForDrums: false` to open them on keys, or call `pianoRoll.setView('steps')` for any clip; on other instruments the rows are C4 to C5 plus every note the clip uses.

| Gesture | What it does |
| --- | --- |
| Click or tap a step | Turns it on with a hit, or off |
| Drag across steps with a mouse | Paints them on, or off when the first one was on |
| **Accent**, then click a step | New hits play at full velocity; clicking a normal hit accents it |
| **Bars** | Makes the clip, and so the pattern, 1 to 16 bars long |
| **Swing** | Delays every second step, from 50% (straight) to 75% |
| The play button, or Space | Loops the pattern on its own while you build it |

A step is the snap when it is finer than a beat, a sixteenth otherwise. The grid is a view of the clip's notes, so steps drawn here show in the piano roll and the other way round; a note counts as on a step when it starts within a quarter of a step of it. Swing moves the notes already on swung steps, and new hits land swung. The playing step lights up during playback. Each change is one undo step.

## Custom samples

Drum kits and samplers play audio files you load, so a beat or a melody can use any sound.

- **Drum pads.** In the step sequencer, click a drum's name and pick **Load sample…** to replace its sound; **Use built-in sound** brings the kit's own back. **+ Add pad** adds a row for a new sound, on the first free note from C4 up, and **Remove pad** takes it away with its notes.
- **Sampler tracks.** A sampler repitches each sample from its root note, and every note plays the sample whose root is nearest. Press a key, then pick **Samples → Add sample on (that key)…**. The keys show the sample names, and the same menu removes them. A sampler's Steps view gets a row per sample too.
- **Drops.** Drop an audio file, or a sound dragged out of the [browser](./browser), on a step row or a piano roll key to put it on that note.

Each change is one undo step. The samples live in the instrument's settings as `samples`, so they are saved with the track:

```ts
timeline.setInstrument('beat', {
  id: 'drums',
  state: { samples: { 36: { source: 'my-kick', name: '808 kick' } } },
});
timeline.setInstrument('keys', {
  id: 'sampler',
  state: { samples: [{ source: 'piano-c3', name: 'Piano', root: 48 }, { source: 'piano-c5', name: 'Piano', root: 72 }] },
});
engine.setBuffer('my-kick', kickBuffer); // the audio, by source id, as for clips
```

A sample is `{ source, name?, root?, tune?, gain? }`. The engine looks each one up by `source` as it plays, so set its buffer before or after. App projects save the samples' audio with the clips', and `sourcesInUse(state)` lists every source a session needs. Pass `onSource` to the piano roll to get each loaded sample's audio, for example to upload it.

## Keys and MIDI

`StudioKeys` plays an instrument track live: on an on-screen keyboard with a mouse or touch, from the computer keyboard, or from MIDI devices. Pass it to the piano roll as `keys` to give the piano roll a **Keys** button, which shows the keys on the open clip's track.

```ts
import { linkNoteRecorder, NoteRecorder, StudioKeys, StudioPianoRoll, StudioToolbar } from '@toneflix/studio';

const notes = new NoteRecorder(engine);
const keys = new StudioKeys('#editor', { timeline, engine, recorder, notes, hidden: true });

new StudioPianoRoll('#editor', { timeline, engine, keys, hidden: true });
new StudioToolbar('#toolbar', { timeline, engine, recorder, notes, keys });
linkNoteRecorder(timeline, notes);
```

| Input | What it does |
| --- | --- |
| Press, or slide across, the on-screen keys | Plays them; several fingers play a chord, and lower on a key is louder |
| <kbd>A</kbd> to <kbd>;</kbd>, with <kbd>W</kbd> <kbd>E</kbd> <kbd>T</kbd> <kbd>Y</kbd> <kbd>U</kbd> <kbd>O</kbd> <kbd>P</kbd> as the black keys | Play the keys from the lowest C shown, while the keys are open. These letters play notes instead of the timeline's shortcuts then |
| <kbd>Z</kbd> / <kbd>X</kbd>, or − / + | Octave down or up |
| **MIDI** | Asks the browser for MIDI devices and plays every one; Note On and Note Off on any channel |
| **Velocity** | How hard the computer keys and screen keys play; MIDI devices send their own |

The keys play the track picked in the **Track** menu, or else the armed track, the selected clip's track, or the first instrument track. `keys.setTrack(id)` picks one, `press(pitch, velocity?)` and `release(pitch)` play notes from your own code, and the `note` event reports every note. MIDI needs a secure page (https or localhost) and a browser with Web MIDI, such as Chrome or Edge; the button is left out elsewhere.

### Recording notes

With a `NoteRecorder`, the record button records notes when the armed track (or, without an audio `Recorder`, the selected clip's track) is an instrument track. It opens the keys, starts playback, and records what is played on any input. The take grows on the track as a note clip in whole bars, and lands as one undo step when recording stops. Notes are moved earlier by the output latency, so they sit where they were heard.

## Built-in instruments

| Id | Instrument | Settings (`state`) |
| --- | --- | --- |
| `synth` | Polyphonic subtractive synth: two detuned oscillators, a low-pass filter and an envelope | `wave`, `detune`, `attack`, `decay`, `sustain`, `release`, `cutoff`, `resonance`, `envelope`, `volume` |
| `drums` | Drum machine made of oscillators and noise, on General MIDI drum notes: kick 36, snare 38, clap 39, closed hat 42, open hat 46, toms 45, 47 and 50, crash 49, ride 51, cowbell 56. A note with a sample plays the sample | `volume`, `tune`, `decay`, `samples` (by note number) |
| `sampler` | Plays samples repitched from their root notes, the nearest root for each note | `samples` (a list), `attack`, `release`, `volume` |

Saving as a REAPER project turns note clips into MIDI items, as [Project files and REAPER](./projects) explains.

## WAM instruments

With a `PluginRack`, any instrument choice whose id isn't built in loads as a Web Audio Module from that URL, and notes reach it as MIDI events:

```ts
const plugins = new PluginRack(engine);

engine.setInstruments(plugins.instruments());
timeline.setInstrument('lead', { id: 'https://example.com/wams/synth/index.js' });
```

`engine.instrument(track)` gives a track's instrument once it has loaded, with `noteOn` and `noteOff` for keys played live. Some WAM instruments play only live and stay silent in offline renders like Export mix, so test one in an export before you offer it. The built-in instruments render either way.

To make your own instrument, implement `Instrument` (`output`, `play`, `noteOn`, `noteOff`, `stopAll`, `destroy`) and pass an `InstrumentFactory` to `engine.setInstruments`. Its fourth argument looks up a sample's audio by source id.
