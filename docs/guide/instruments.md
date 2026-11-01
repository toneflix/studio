# Instruments and notes

An instrument track plays note clips through an instrument: the built-in synth or drum kit, or a Web Audio Module instrument. Its clips hold notes instead of audio, and the timeline draws them as a small piano roll.

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

The add track button offers an audio track, an instrument track and a drum track. Double-click an empty spot on an instrument track's lane to add a one-bar note clip there. Pass `instrumentTracks` to change the kinds on offer, or an empty list to offer only audio tracks.

| Method | What it does |
| --- | --- |
| `timeline.addNoteClip(track, time, bars?)` | Adds an empty note clip at the bar `time` falls in |
| `timeline.setNotes(clip, notes)` | Replaces a note clip's notes |
| `timeline.setInstrument(track, choice)` | Picks a track's instrument, or changes its settings |

Each one is a single undo step.

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

`engine.instrument(track)` gives a track's instrument once it has loaded, with `noteOn` and `noteOff` for keys played live. Some WAM instruments play only live and stay silent in offline renders like Export mix. The built-in instruments render either way.

To make your own instrument, implement `Instrument` (`output`, `play`, `noteOn`, `noteOff`, `stopAll`, `destroy`) and pass an `InstrumentFactory` to `engine.setInstruments`.
