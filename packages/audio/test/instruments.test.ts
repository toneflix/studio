import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loopPoints, Sampler, sampleFor } from '../src/instruments.ts';

test('a sampler plays the sample whose root is nearest, the lower one on a tie', () => {
  const samples = [
    { source: 'low', root: 48 },
    { source: 'mid', root: 60 },
    { source: 'high', root: 72 },
  ];

  assert.equal(sampleFor(samples, 50)?.source, 'low');
  assert.equal(sampleFor(samples, 54)?.source, 'low');
  assert.equal(sampleFor(samples, 55)?.source, 'mid');
  assert.equal(sampleFor(samples, 100)?.source, 'high');
  assert.equal(sampleFor([{ source: 'any' }], 30)?.source, 'any');
  assert.equal(sampleFor([], 60), undefined);
});

/** Just enough of Web Audio for the sampler, recording what its voices do. */
const fakeAudio = () => {
  const sources: { loop: boolean; loopStart: number; loopEnd: number; stops: number[] }[] = [];
  const param = () => ({ value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, setTargetAtTime() {}, cancelScheduledValues() {} });
  class Node {
    gain = param();
    connect<T>(to: T) {
      return to;
    }
    disconnect() {}
  }
  class Source extends Node {
    loop = false;
    loopStart = 0;
    loopEnd = 0;
    stops: number[] = [];
    playbackRate = { value: 1 };
    onended: (() => void) | null = null;
    constructor(_context: unknown, options: { playbackRate?: number }) {
      super();
      this.playbackRate.value = options.playbackRate ?? 1;
      sources.push(this);
    }
    start() {}
    stop(when: number) {
      this.stops.push(when);
    }
  }
  const globals = globalThis as Record<string, unknown>;

  globals.GainNode = Node;
  globals.AudioBufferSourceNode = Source;

  return { sources, context: { currentTime: 0 } as unknown as BaseAudioContext };
};

test('sampler modes: gate stops at the note end, one-shot plays on, loop repeats its points while held', () => {
  const { sources, context } = fakeAudio();
  const buffer = { duration: 2 } as AudioBuffer;
  const play = (sample: Record<string, unknown>) => {
    const sampler = new Sampler(context, { samples: [{ source: 's', root: 60, ...sample }], release: 0.1 }, () => buffer);

    sampler.play(60, 1, 0, 0.5);
    sampler.noteOn(60, 1);
    sampler.noteOff(60);

    return sampler;
  };

  play({});
  assert.deepEqual(sources[0]!.stops, [0.65]);

  const oneShot = play({ mode: 'oneShot' });

  assert.deepEqual(sources[2]!.stops, [], 'a one-shot ignores the note end');
  assert.deepEqual(sources[3]!.stops, [], 'and the key being let go');
  oneShot.stopAll(0.2);
  assert.equal(sources[2]!.stops.length, 1, 'but stops when playback does');

  const looped = play({ mode: 'loop', loopStart: 0.5, loopEnd: 1.5 });

  assert.deepEqual([sources[4]!.loop, sources[4]!.loopStart, sources[4]!.loopEnd, sources[4]!.stops], [true, 0.5, 1.5, [0.65]]);
  looped.stopAll(1);
  assert.equal(sources[5]!.stops.length, 1, 'stopping everything stops held loops');
  assert.equal(loopPoints({ source: 's', loopStart: 1, loopEnd: 1 }, 2), null);
  assert.deepEqual(loopPoints({ source: 's', loopStart: -1, loopEnd: 9 }, 2), { start: 0, end: 2 });
});
