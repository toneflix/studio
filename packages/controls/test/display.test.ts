import assert from 'node:assert/strict';
import { test } from 'node:test';
import { barsAndBeats, clockTime } from '../src/display.ts';
import { meterPosition } from '../src/meter.ts';

test('barsAndBeats counts bars, beats and sixteenths from 1', () => {
  assert.deepEqual(barsAndBeats(0, 120, [4, 4]), { bar: 1, beat: 1, sixteenth: 1 });
  assert.deepEqual(barsAndBeats(0.5, 120, [4, 4]), { bar: 1, beat: 2, sixteenth: 1 });
  assert.deepEqual(barsAndBeats(0.625, 120, [4, 4]), { bar: 1, beat: 2, sixteenth: 2 });
  assert.deepEqual(barsAndBeats(2, 120, [4, 4]), { bar: 2, beat: 1, sixteenth: 1 });
});

test('barsAndBeats follows eighth-note meters', () => {
  // 6/8 at 120 bpm: an eighth lasts 0.25s, a bar 1.5s.
  assert.deepEqual(barsAndBeats(1.5, 120, [6, 8]), { bar: 2, beat: 1, sixteenth: 1 });
  assert.deepEqual(barsAndBeats(0.375, 120, [6, 8]), { bar: 1, beat: 2, sixteenth: 2 });
});

test('clockTime formats minutes, seconds and milliseconds', () => {
  assert.equal(clockTime(0), '0:00.000');
  assert.equal(clockTime(65.25), '1:05.250');
  assert.equal(clockTime(600.001), '10:00.001');
});

test('meterPosition maps gain onto a -60 dB to 0 dB scale', () => {
  assert.equal(meterPosition(0), 0);
  assert.equal(meterPosition(1), 1);
  assert.equal(meterPosition(2), 1);
  assert.equal(meterPosition(0.001), 0);
  assert.ok(Math.abs(meterPosition(Math.pow(10, -30 / 20)) - 0.5) < 1e-9);
});
