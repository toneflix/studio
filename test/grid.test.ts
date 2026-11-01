import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Grid, nearestSnap } from '../src/grid.ts';

test('beats follow the meter', () => {
  const grid = new Grid({ bpm: 120, meter: [4, 4], snap: 'beat' });

  assert.equal(grid.beat, 0.5);
  assert.equal(grid.bar, 2);
  assert.equal(grid.round(0.74), 0.5);
  assert.deepEqual(grid.position(2.5), { bar: 2, beat: 2 });

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
