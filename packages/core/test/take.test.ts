import assert from 'node:assert/strict';
import { test } from 'node:test';
import { NoteTake } from '../src/index.ts';

test('a take turns key presses into notes, in order of their starts', () => {
  const take = new NoteTake();

  assert.equal(take.empty, true);
  take.down(64, 0.5, 1.5);
  take.down(60, 0.8, 1);
  take.up(60, 2);
  assert.deepEqual(take.notes(3), [
    { pitch: 60, start: 1, duration: 1, velocity: 0.8 },
    { pitch: 64, start: 1.5, duration: 1.5, velocity: 0.5 },
  ]);
  assert.deepEqual(take.finish(2.5).at(-1), { pitch: 64, start: 1.5, duration: 1, velocity: 0.5 });
});

test('pressing a held key again ends the first note there', () => {
  const take = new NoteTake();

  take.down(60, 1, 0);
  take.down(60, 1, 0.5);
  take.up(60, 0.75);
  take.up(61, 1);
  assert.deepEqual(
    take.finish(2).map((n) => [n.start, n.duration]),
    [
      [0, 0.5],
      [0.5, 0.25],
    ],
  );
});
