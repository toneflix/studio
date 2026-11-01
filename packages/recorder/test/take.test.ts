import assert from 'node:assert/strict';
import { test } from 'node:test';
import { TakeBuilder } from '../src/take.ts';

const ramp = (from: number, length: number) => Float32Array.from({ length }, (_, i) => from + i);

test('the first chunk sets the start and later chunks follow on', () => {
  const take = new TakeBuilder(10, 1, 0);

  take.push(2, [ramp(0, 5)]);
  take.push(99, [ramp(5, 5)]);

  assert.equal(take.start, 2);
  assert.equal(take.duration, 1);
  assert.deepEqual([...take.build()[0]!], [...ramp(0, 10)]);
});

test('audio from before the start time is dropped', () => {
  const take = new TakeBuilder(10, 1, 1);

  assert.equal(take.push(0, [ramp(0, 5)]), null);
  assert.equal(take.start, null);

  const kept = take.push(0.7, [ramp(0, 5)]);

  assert.deepEqual([...kept![0]!], [3, 4]);
  assert.equal(take.start, 1);
  assert.equal(take.length, 2);
});

test('channels are fitted to the take', () => {
  const stereo = new TakeBuilder(10, 2);

  stereo.push(0, [ramp(0, 3)]);
  assert.deepEqual(stereo.build().map((c) => [...c]), [[0, 1, 2], [0, 1, 2]]);

  const mono = new TakeBuilder(10, 1);

  mono.push(0, [ramp(0, 2), ramp(10, 2)]);
  assert.deepEqual(mono.build().map((c) => [...c]), [[0, 1]]);
});
