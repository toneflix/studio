import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Grid, nearestSnap } from '../src/grid.ts';

test('beats follow the meter', () => {
  const grid = new Grid({ bpm: 120, meter: [4, 4], snap: 'beat' });

  assert.equal(grid.beat, 0.5);
  assert.equal(grid.bar, 2);
  assert.equal(grid.round(0.74), 0.5);
  assert.deepEqual(grid.position(2.5), { bar: 2, beat: 2, sixteenth: 1 });

  grid.set({ meter: [6, 8], snap: 'bar' });
  assert.equal(grid.beat, 0.25);
  assert.equal(grid.round(1.0), 1.5);

  grid.set({ snap: 'off' });
  assert.equal(grid.round(1.234), 1.234);
});

test('edge snapping picks the closest target in reach', () => {
  assert.ok(Math.abs(nearestSnap([1, 3], [3.1, 0.5], 0.2) - 0.1) < 1e-9);
  assert.equal(nearestSnap([1], [2], 0.2), 0);
});

test('tempo changes start new sections with their own bars and beats', () => {
  const grid = new Grid({ bpm: 120, meter: [4, 4], snap: 'beat' });

  // Two bars of 4/4 at 120 (4 s), then 3/4 at 60, where a bar lasts 3 s
  grid.setTempo([{ id: 'a', time: 4, bpm: 60, meter: [3, 4] }]);

  assert.deepEqual(
    grid.sections.map((s) => [s.start, s.bpm, s.meter.join('/'), s.firstBar]),
    [
      [0, 120, '4/4', 0],
      [4, 60, '3/4', 2],
    ],
  );
  assert.deepEqual(grid.position(5.5), { bar: 3, beat: 2, sixteenth: 3 });
  assert.equal(grid.barTime(4), 7);
  assert.equal(grid.round(5.4), 5);
  assert.equal(grid.round(3.9), 4);
  assert.deepEqual(
    grid.bars(0, 11).map((b) => [b.time, b.bar]),
    [
      [0, 1],
      [2, 2],
      [4, 3],
      [7, 4],
      [10, 5],
    ],
  );
  assert.deepEqual(
    grid.beats(3, 6).map((b) => [b.time, b.accent]),
    [
      [3, false],
      [3.5, false],
      [4, true],
      [5, false],
    ],
  );
});
