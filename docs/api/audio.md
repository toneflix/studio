# Playback, mixer and controls

From `@toneflix/studio-audio`, also exported by `@toneflix/studio`.

## AudioEngine

| | |
| --- | --- |
| `new AudioEngine(options?)` | `context`, `lookahead` (0.25 s), `interval` (25 ms), `stopAtEnd` (true) |
| `engine.load(state)` | The timeline to play. While playing, the change is heard at once |
| `engine.setBuffer(source, buffer)` | Decoded audio for a source id; `hasBuffer`, `deleteBuffer` |
| `engine.play(from?)` | Start from the current position or a time. Resumes a suspended context |
| `engine.pause()` / `engine.toggle()` | |
| `engine.stop()` | Back to where playback began, or to 0 when already stopped |
| `engine.seek(time)` | |
| `engine.setLoop({ start, end } \| null)` | |
| `engine.isolate(clipIds \| null)` | Hear only those clips, like a pattern played on its own; null hears every clip. `isolated` reads it, and the `isolate` event reports changes |
| `engine.render(options?)` | Offline mix to an `AudioBuffer`: `from`, `to`, `sampleRate`, `channels`, `effects(track, context)`, which may be async. Pauses briefly after each note of an instrument with `mainThread`, so WAM instruments that play from the main thread are heard |
| `engine.time`, `isPlaying`, `loop`, `state` | |
| `engine.stopAtEnd` | Read or change the `stopAtEnd` option |
| `engine.positionAt(contextTime)` | The timeline time playing at a context time, counted on from where playback began without wrapping at the loop; null while paused |
| `engine.mixer`, `engine.metronome`, `engine.context` | |
| `engine.destroy()` | Stops playback and closes the context it made |

Events: `play`, `pause`, `seek` and `end` with `{ time }`, and `loop` with `{ loop }`.

## Mixer

| | |
| --- | --- |
| `mixer.set(track \| null, settings)` | `volume`, `pan`, `mute`, `solo`; `null` is the master |
| `mixer.channel(track)` | The track's `Channel`, made on first use |
| `mixer.master` | The master `Channel` |
| `mixer.snapshot()` / `mixer.restore(snapshot)` | Every channel's settings, to save and load |
| `channel.setEffects(effects)` | `AudioNode` or `{ input, output }`, in order |
| `channel.levels()` | Peak level of the left and right sides right now, as gains |
| `channel.automation` | `{ volume, pan }` AudioParams the engine drives from the track's automation |
| `channel.settings`, `channel.effects`, `channel.input`, `channel.output` | |
| `dbToGain(db)` / `gainToDb(gain)` | |

Event: `change` with `{ track, settings }`.

## Metronome

| | |
| --- | --- |
| `metronome.enabled` | Off by default |
| `metronome.volume` | 0.5 by default |
| `metronome.grid` | A `Grid`: `set({ bpm, meter })` |

## Helpers

| | |
| --- | --- |
| `linkPlayback(timeline, engine, { space? })` | From `@toneflix/studio`. Keeps a timeline and an engine together; returns an unlink function |
| `encodeWav(audio, bitDepth = 16)` | PCM WAV bytes from an `AudioBuffer` or anything shaped like one |
| `heardRanges(state)` | The heard part of every clip on every track |
| `timelineAt(origin, loop, elapsed)` | Where playback is after some seconds, with a loop |

## Controls

From `@toneflix/studio-controls`, also exported by `@toneflix/studio`. See [Toolbar and track controls](../guide/controls).

| | |
| --- | --- |
| `new StudioToolbar(container, options)` | `timeline`, `engine?`, `recorder?`, `plugins?` (in the exported mix), `items?`, `icons?`, `labels?`, `exportName?`, `actions?`, `onSave?`, `info?`, `mixer?`, `browser?`; `addAction()`, `removeAction()`, `showInfo()`, `refresh()`, `destroy()` |
| `sessionInfo(timeline)` | The info dialog's default rows |
| `new StudioMixer(container, options)` | `timeline`, `engine`, `plugins?`, `catalog?`, `pickPlugin?`, `icons?`, `labels?`, `maxVolume?` (2), `hidden?`, `docked?`; `show()`, `hide()`, `toggle()`, `visible`, `destroy()`; event `toggle` |
| `new StudioPianoRoll(container, options)` | `timeline`, `engine`, `snap?` ('1/16'), `beatWidth?` (64), `stepsForDrums?` (true), `onSource?`, `keys?`, `instrumentPanel?` (adds a Sound button), `icons?`, `labels?`, `hidden?`, `docked?`; `edit(clip \| null)`, `clip`, `setView('notes' \| 'steps')`, `playPreview()`, `stopPreview()`, `togglePreview()`, `previewing`, `select(indices)`, `selection`, `setSnap()`, `quantize()`, `useSample(pitch, file \| sound \| null)`, `show()`, `hide()`, `toggle()`, `visible`, `destroy()`; events `toggle`, `open`, `select`. See [Instruments and notes](../guide/instruments#piano-roll) |
| `new StudioInstrumentPanel(options)` | `timeline`, `engine`, `instruments?` (picker choices, the built-in synth, drums and sampler by default), `trackMenu?` (true), `icons?`, `labels?`; `open(track)`, `close(track)`, `toggle(track)`, `isOpen(track)`, `openTracks`, `destroy()`; event `toggle`. See [Instrument settings](../guide/instruments#instrument-settings) |
| `openFloatingWindow(document, options)` | The draggable window plugin editors and instrument settings open in: `title`, `close`, `icons?`, `onClose?`; returns `element`, `body`, `raise()`, `fit()`, `close()` |
| `new StudioKeys(container, options)` | `timeline`, `engine`, `recorder?`, `notes?`, `octave?` (3), `computerKeys?` (true), `icons?`, `labels?`, `hidden?`, `docked?`; `track`, `setTrack(id \| null)`, `octave`, `setOctave(n)`, `press(pitch, velocity?)`, `release(pitch)`, `releaseAll()`, `show()`, `hide()`, `toggle()`, `visible`, `destroy()`; events `toggle`, `note`, `midi`. See [Keys and MIDI](../guide/instruments#keys-and-midi) |
| `faderToGain(position, max?)` / `gainToFader(gain, max?)` | The fader curve |
| `formatDb(gain)` / `formatPan(pan)` | Readouts like `-3.5` and `L 40` |
| `createKnob(document, options)` | The rotary knob the mixer and instrument settings use: `label`, `min`, `max`, `initial`, `step`, `format`, `log?`, `onInput`, `onCommit?` (once a drag, key press or reset is done) |
| `DEFAULT_TOOLBAR`, `DEFAULT_LABELS` | The default buttons and their names |
| `trackStrip(engine, options?)` | A `renderHeader` for the timeline; `icons?`, `labels?`, `maxVolume?` (1.5), `meter?` (true), `recorder?` (adds the R arm button) |
| `createMeter(document, engine, channel)` | A level meter for a channel; returns `{ element, stop }` |
| `createDisplay(document, timeline, engine?, labels)` | The transport display; returns `{ element, update, destroy }` |
| `barsAndBeats(time, bpm, meter)` / `clockTime(time)` | Format a time like the display does |
| `setDefaultIcons(icons)` | Replace icons for every control made afterwards |
| `renderIcon(document, name, icons?)` | An icon element, to use the same icons in your own UI |
| `lucideIcons` | The default icons, as SVG shapes |
