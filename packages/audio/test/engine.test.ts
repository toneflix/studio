import assert from 'node:assert/strict';
import { test } from 'node:test';
import { makeClip, makeNoteClip } from '@toneflix/studio-core';
import { AudioEngine } from '../src/engine.ts';

/** Just enough of Web Audio to see what the engine schedules. */
class FakeParam {
  value = 1;
  events: [string, number, number][] = [];
  setValueAtTime(value: number, when: number) {
    this.value = value;
    this.events.push(['set', value, when]);
  }
  linearRampToValueAtTime(value: number, when: number) {
    this.events.push(['ramp', value, when]);
  }
  exponentialRampToValueAtTime() {}
  setTargetAtTime(value: number) {
    this.value = value;
  }
  cancelScheduledValues() {
    this.events = [];
  }
}

class FakeNode {
  gain = new FakeParam();
  pan = new FakeParam();
  connect<T>(target: T) {
    return target;
  }
  disconnect() {}
}

class FakeSource extends FakeNode {
  buffer: { id: string; duration: number } | null = null;
  started: [number, number, number] | null = null;
  stopped: number | null = null;
  onended: (() => void) | null = null;
  start(when: number, offset: number, duration: number) {
    this.started = [when, offset, duration];
  }
  stop(when: number) {
    this.stopped = when;
  }
}

const fakeContext = () => {
  const sources: FakeSource[] = [];
  const context = {
    currentTime: 0,
    sampleRate: 48000,
    destination: new FakeNode(),
    createGain: () => new FakeNode(),
    createStereoPanner: () => new FakeNode(),
    createBufferSource: () => {
      const source = new FakeSource();

      sources.push(source);

      return source;
    },
  };

  return { context, sources };
};

const setup = () => {
  const { context, sources } = fakeContext();
  const engine = new AudioEngine({ context: context as unknown as BaseAudioContext, lookahead: 100, stopAtEnd: false });

  engine.load({
    tracks: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }],
    clips: [
      makeClip({ id: 'a1', track: 'a', source: 'drums', start: 0, offset: 1, duration: 4 }),
      makeClip({ id: 'b1', track: 'b', source: 'bass', start: 2, offset: 0, duration: 4 }),
    ],
  });
  engine.setBuffer('drums', { id: 'drums', duration: 30 } as unknown as AudioBuffer);
  engine.setBuffer('bass', { id: 'bass', duration: 30 } as unknown as AudioBuffer);

  const started = () =>
    sources.filter((s) => s.started).map((s) => [s.buffer!.id, +(s.started![0] - 0.04).toFixed(3), s.started![1], s.started![2]]);

  return { engine, context, sources, started };
};

test('play schedules each clip at its place with its offset into the audio', async () => {
  const { engine, started } = setup();

  await engine.play(1);
  assert.deepEqual(started(), [
    ['drums', 0, 2, 3],
    ['bass', 1, 0, 4],
  ]);
  engine.destroy();
});

test('a loop schedules the clips again on every lap', async () => {
  const { engine, started } = setup();

  engine.setLoop({ start: 0, end: 3 });
  await engine.play(0);
  assert.deepEqual(started().slice(0, 4), [
    ['drums', 0, 1, 3],
    ['bass', 2, 0, 1],
    ['drums', 3, 1, 3],
    ['bass', 5, 0, 1],
  ]);
  engine.destroy();
});

test('pause stops what is scheduled and keeps the position', async () => {
  const { engine, context, sources } = setup();

  await engine.play(0);
  context.currentTime = 1.04;
  engine.pause();

  assert.equal(engine.isPlaying, false);
  assert.equal(engine.time, 1);
  assert.ok(sources.every((s) => s.stopped !== null));
  engine.destroy();
});

test('solo silences the other tracks and mute silences its own', () => {
  const { engine } = setup();
  const output = (track: string) => (engine.mixer.channel(track).output.gain as unknown as FakeParam).value;

  engine.mixer.set('a', { solo: true });
  assert.deepEqual([output('a'), output('b')], [1, 0]);

  engine.mixer.set('a', { solo: false, mute: true });
  assert.deepEqual([output('a'), output('b')], [0, 1]);
  assert.deepEqual(engine.mixer.snapshot().tracks.a, { volume: 1, pan: 0, mute: true, solo: false });
  engine.destroy();
});

test('volume automation ramps through its points while playing', async () => {
  const { engine } = setup();
  const param = () => engine.mixer.channel('a').automation.volume as unknown as FakeParam;
  const round = (events: [string, number, number][]) => events.map(([kind, value, when]) => [kind, +value.toFixed(3), +(when - 0.04).toFixed(3)]);

  engine.load({
    ...engine.state,
    tracks: [
      {
        id: 'a',
        name: 'A',
        automation: {
          volume: [
            { time: 1, value: 1 },
            { time: 3, value: 0 },
          ],
        },
      },
      { id: 'b', name: 'B' },
    ],
  });
  assert.equal(param().value, 1);

  await engine.play(2);
  assert.deepEqual(round(param().events).slice(-3), [
    ['set', 0.5, 0],
    ['ramp', 0, 1],
    ['ramp', 0, 100],
  ]);

  engine.pause();
  engine.seek(3);
  assert.equal(param().value, 0);
  assert.equal((engine.mixer.channel('b').automation.volume as unknown as FakeParam).value, 1);
  engine.destroy();
});

/** An instrument that writes down what it is asked to play. */
const fakeInstrument = () => {
  const played: [number, number, number, number][] = [];
  const stops: number[] = [];

  return {
    played,
    stops,
    instrument: {
      output: new FakeNode() as unknown as AudioNode,
      play: (pitch: number, velocity: number, when: number, duration: number) => void played.push([pitch, velocity, +(when - 0.04).toFixed(3), +duration.toFixed(3)]),
      noteOn() {},
      noteOff() {},
      stopAll: (when: number) => void stops.push(when),
      destroy() {},
    },
  };
};

const noteSetup = async () => {
  const { context } = fakeContext();
  const fake = fakeInstrument();
  const asked: string[] = [];
  const engine = new AudioEngine({
    context: context as unknown as BaseAudioContext,
    lookahead: 100,
    stopAtEnd: false,
    instruments: (choice) => {
      asked.push(choice.id);
      return fake.instrument;
    },
  });

  engine.load({
    tracks: [{ id: 'keys', name: 'Keys', instrument: { id: 'synth' } }],
    clips: [
      makeNoteClip({
        id: 'n1',
        track: 'keys',
        start: 2,
        duration: 2,
        gain: 0.5,
        notes: [
          { pitch: 60, start: 0, duration: 0.5, velocity: 1 },
          { pitch: 64, start: 1, duration: 3, velocity: 0.8 },
        ],
      }),
    ],
  });
  await engine.instrumentsReady();

  return { engine, context, asked, ...fake };
};

test('note clips play their notes through the track instrument, cut at the clip end', async () => {
  const { engine, asked, played } = await noteSetup();

  await engine.play(0);
  assert.deepEqual(asked, ['synth']);
  assert.deepEqual(played, [
    [60, 0.5, 2, 0.5],
    [64, 0.4, 3, 1],
  ]);
  engine.destroy();
});

test('notes that started before the play position are not played, and pause stops the instrument', async () => {
  const { engine, played, stops } = await noteSetup();

  await engine.play(2.2);
  assert.deepEqual(played, [[64, 0.4, 0.8, 1]]);
  engine.pause();
  assert.equal(stops.length, 1);
  engine.destroy();
});

test('a track loses its instrument when it stops asking for one', async () => {
  const { engine } = await noteSetup();

  assert.ok(engine.instrument('keys'));
  engine.load({ tracks: [{ id: 'keys', name: 'Keys' }], clips: [] });
  assert.equal(engine.instrument('keys'), null);
  engine.destroy();
});

test('instruments look samples up in the engine as they play', async () => {
  const { context } = fakeContext();
  const fake = fakeInstrument();
  let lookup: ((source: string) => AudioBuffer | undefined) | null = null;
  const engine = new AudioEngine({
    context: context as unknown as BaseAudioContext,
    stopAtEnd: false,
    instruments: (_choice, _context, _track, samples) => {
      lookup = samples;
      return fake.instrument;
    },
  });
  const buffer = { duration: 1 } as AudioBuffer;

  engine.load({ tracks: [{ id: 'pads', name: 'Pads', instrument: { id: 'sampler', state: { samples: [{ source: 'kick', root: 60 }] } } }], clips: [] });
  await engine.instrumentsReady();
  assert.equal(lookup!('kick'), undefined);
  engine.setBuffer('kick', buffer);
  assert.equal(lookup!('kick'), buffer);
  engine.destroy();
});
