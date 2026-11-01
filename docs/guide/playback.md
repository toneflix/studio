# Playback

`AudioEngine` plays a timeline with Web Audio. It plays exactly what the timeline shows: where clips overlap, you hear the one on top, with each clip's gain and fades. It schedules audio a moment ahead of the playhead, so edits, seeks and loop changes are heard straight away, even while playing.

## Play a timeline

```ts
import { AudioEngine, linkPlayback, StudioTimeline } from '@toneflix/studio';

const engine = new AudioEngine();
const timeline = new StudioTimeline(element);

timeline.load(project);
engine.setBuffer('vox.wav', await engine.context.decodeAudioData(bytes));

linkPlayback(timeline, engine);

playButton.onclick = () => engine.toggle();
```

`linkPlayback` connects the two:

- Each finished edit, undo and redo is played straight away.
- Clicking the ruler moves playback there.
- The playhead follows playback.
- Space plays and pauses while the timeline has focus.
- The loop is drawn on the ruler.

It returns a function that disconnects them.

Browsers only start audio after the user interacts with the page, so call `play()` from a click or key press.

## Transport

```ts
await engine.play(); // from the playhead
await engine.play(12); // from 12 seconds
engine.pause();
engine.stop(); // back to where playback began; again to go to the start
engine.seek(30);
engine.time; // where playback is now
```

Playback stops after the last clip ends unless it loops. Pass `stopAtEnd: false` to keep going.

## Loops

```ts
engine.setLoop({ start: 8, end: 16 });
engine.setLoop(null);
```

Playback that starts before the loop's end plays up to it, then repeats the loop. It's a natural fit for the timeline's range selection:

```ts
const range = timeline.range;
if (range) engine.setLoop({ start: range.start, end: range.end });
```

## Mixer

Each track gets a channel: its effects, then volume, pan, mute and solo. Every channel feeds the master channel, which has the same controls.

```ts
engine.mixer.set('vox', { volume: 0.8, pan: -0.2 });
engine.mixer.set('drums', { solo: true });
engine.mixer.set(null, { volume: dbToGain(-3) }); // the master

engine.mixer.on('change', ({ track, settings }) => updateFader(track, settings));
```

Volume is linear gain, where 1 leaves the track unchanged. `dbToGain` and `gainToDb` convert from and to decibels. Mixer settings aren't part of the timeline's undo history. Save them with `engine.mixer.snapshot()` and bring them back with `engine.mixer.restore(snapshot)`.

## Effects

A channel's effects are any Web Audio nodes, applied in order. Use built-in nodes, an AudioWorklet, or a chain with its own input and output:

```ts
const ctx = engine.context;
const low = new BiquadFilterNode(ctx, { type: 'lowshelf', frequency: 200, gain: -6 });
const space = new ConvolverNode(ctx, { buffer: impulse });

engine.mixer.channel('vox').setEffects([low, { input: reverbIn, output: reverbOut }]);
engine.mixer.master.setEffects([new DynamicsCompressorNode(ctx)]);
```

The nodes must belong to `engine.context`.

## Metronome

```ts
engine.metronome.enabled = true;
engine.metronome.grid.set({ bpm: 96, meter: [3, 4] });
engine.metronome.volume = 0.4;
```

It clicks on every beat, with a higher click on the first beat of each bar. The clicks are not part of a render.

## Export a mix

`render()` mixes the timeline faster than real time, with the mixer's settings. Web Audio nodes can't move between contexts, so give it the effects to build for the render:

```ts
const mix = await engine.render({
  from: 0,
  to: 60,
  sampleRate: 48000,
  effects: (track, context) => (track === 'vox' ? [new BiquadFilterNode(context, { type: 'highpass', frequency: 90 })] : []),
});

const wav = new Blob([encodeWav(mix, 24)], { type: 'audio/wav' });
```

`effects` may return a promise. For plugins, pass `plugins.renderEffects` (see [Plugins](./plugins#mixdown)).

`encodeWav` writes 16-bit or 24-bit PCM.

## Without the full package

Playback is in `@toneflix/studio-audio`. It only needs `@toneflix/studio-core`, so it can play saved projects with no editor on the page. `linkPlayback` is in `@toneflix/studio`.
