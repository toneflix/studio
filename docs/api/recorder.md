# Recording

From `@toneflix/studio-recorder`, also in `@toneflix/studio`. See the [Recording guide](/guide/recording).

## Recorder

| | |
| --- | --- |
| `new Recorder(engine, options?)` | `channels` (1), `latency` (worked out), `constraints`, `chunkSize` (4096 frames) |
| `Recorder.inputs()` | The audio inputs the browser can see |
| `recorder.open(deviceId?)` / `close()` | Ask for an input, or let it go. `start()` opens the default one when none is open and lets it go when the take ends; one opened with `open()` stays open until `close()` |
| `recorder.arm(track \| null)` / `armed` | The track that records |
| `recorder.start({ track?, from? })` | Record onto the armed track, or `track`. Starts playback from `from` (the play position) when stopped |
| `recorder.stop()` | Ends the take; resolves to a `Take` or null. Pausing, stopping or seeking the engine also ends it |
| `recorder.isRecording`, `isOpen` | |
| `recorder.setMonitor(on)` / `monitor` | Hear the input through the armed track's channel |
| `recorder.level()` | Input peak level, 0 to 1 |
| `recorder.latency` / `setLatency(seconds \| null)` | How far takes are moved earlier to line up |
| `recorder.destroy()` | |

Events: `arm { track }`, `start { id, track }`, `data { id, track, start, duration, channels, sampleRate }` (only the new samples), `stop { take }`, `error { error }`.

`Take`: `id` (source id, already given to the engine), `track`, `start`, `duration`, `buffer`.

## NoteRecorder

| | |
| --- | --- |
| `new NoteRecorder(engine, options?)` | `latency` (the output latency when left out) |
| `notes.start(track, from?)` | Record notes onto an instrument track, starting playback from `from` (the play position) when stopped |
| `notes.noteOn(pitch, velocity)` / `noteOff(pitch)` | Notes played live; `StudioKeys` sends them |
| `notes.notes()` | The notes so far, held ones lasting until now |
| `notes.stop()` | Ends the take; returns `{ track, from, to, notes }` (timeline times) or null. Pausing, stopping or seeking the engine also ends it |
| `notes.isRecording`, `track`, `latency`, `destroy()` | |

Events: `start { track, from }`, `note { track }`, `stop { take }`.

## Helpers

| | |
| --- | --- |
| `linkRecorder(timeline, recorder, options?)` | From `@toneflix/studio`. Shows takes on the timeline as they record and adds each as one undo step. `waveforms` works out the final waveform, `name(n)` names clips (`Take n`), `onTake(take)` gets each take. Returns an unlink function |
| `linkNoteRecorder(timeline, notes, options?)` | From `@toneflix/studio`. Shows a note take on the timeline as a growing note clip in whole bars and adds it as one undo step. `name(n)` names clips, `onTake(take)` gets each take |
| `NoteTake` | From core: turns key presses into notes; used by `NoteRecorder` |
| `TakeBuilder` | Collects recorded chunks into a take; used by `Recorder` |
| `loadCapture(context)` | Loads the capture audio worklet into a context once |
