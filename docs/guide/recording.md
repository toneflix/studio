# Recording

`Recorder` records a microphone or line input onto a track while the music plays, so the new part lines up with what the performer heard. It comes in `@toneflix/studio-recorder` and in `@toneflix/studio`.

## Record onto a track

```ts
import { AudioEngine, linkPlayback, linkRecorder, Recorder, StudioTimeline, StudioToolbar, trackStrip, Waveforms } from '@toneflix/studio';

const engine = new AudioEngine();
const recorder = new Recorder(engine);
const waveforms = new Waveforms();
const timeline = new StudioTimeline(element, { renderHeader: trackStrip(engine, { recorder }) });

new StudioToolbar(bar, { timeline, engine, recorder });
linkPlayback(timeline, engine);
linkRecorder(timeline, recorder, { waveforms, onTake: (take) => upload(take) });
```

With that in place:

- The **R** button on a track strip arms that track. One track is armed at a time.
- The red record button starts recording onto the armed track from the playhead, and starts playback if it was stopped. With no track armed, it arms the selected clip's track, or the first track.
- Pressing it again, pause, stop or a seek ends the take. Playback keeps going when you press record again, so you can listen back at once.
- While recording, the take grows on its track with its waveform. Editing is paused until the take ends.
- The finished take lands as one undo step, named Take 1, Take 2 and so on. Undo removes it.

An instrument track records notes instead, played on the keys or a MIDI device; see [Keys and MIDI](./instruments#keys-and-midi).

The first recording asks the user for the microphone. Browsers only allow that on secure pages (https or localhost).

## Without the toolbar

```ts
recorder.arm('vocals');
await recorder.start(); // or start({ track: 'vocals', from: 8 })
const take = await recorder.stop();
```

`stop()` gives a `Take`, or null when nothing was recorded:

| Field | |
| --- | --- |
| `id` | The take's source id. Its audio is already given to the engine under this id |
| `track` | The track it was recorded onto |
| `start`, `duration` | Where it sits on the timeline, in seconds |
| `buffer` | The recorded `AudioBuffer` |

Save it with `encodeWav(take.buffer)` and store the file under `take.id`, the same way as any other source.

## Inputs and monitoring

```ts
const inputs = await Recorder.inputs(); // audio inputs; names show once the user has allowed one
await recorder.open(inputs[1].deviceId);

recorder.setMonitor(true); // hear the input through the armed track, with its volume and effects
recorder.level(); // input peak level, 0 to 1, for a meter
recorder.close();
```

Echo cancellation, noise suppression and automatic gain are off, as recording needs the plain signal. Pass `constraints` to change that, and `channels: 2` to record in stereo.

## Lining takes up

Sound takes time to leave the speakers and get back through the microphone. The recorder moves each take earlier by `recorder.latency`, worked out from what the browser reports about its output and input. Browsers don't always report every part of it, so a take can still land a few milliseconds late. Set it by hand when you know it better, for example from a loopback test:

```ts
const recorder = new Recorder(engine, { latency: 0.012 });
recorder.setLatency(0.015);
recorder.setLatency(null); // work it out again
```

## Loops

A take runs straight on. While recording, the loop is switched off, and playback goes on past the last clip; both come back when the take ends.
