import assert from 'node:assert/strict';
import { test } from 'node:test';
import { faderToGain, formatDb, formatPan, gainToFader } from '../src/fader.ts';

test('fader positions and gains map both ways', () => {
  assert.equal(faderToGain(0), 0);
  assert.equal(faderToGain(1), 2);
  assert.equal(faderToGain(2), 2);

  for (const gain of [0.01, 0.5, 1, 1.5, 2]) assert.ok(Math.abs(faderToGain(gainToFader(gain)) - gain) < 1e-9);

  assert.equal(gainToFader(4), 1);
  assert.ok(gainToFader(1) > 0.75 && gainToFader(1) < 0.85);
});

test('formatDb shows signed dB with one decimal', () => {
  assert.equal(formatDb(0), '-∞');
  assert.equal(formatDb(1), '0.0');
  assert.equal(formatDb(2), '+6.0');
  assert.equal(formatDb(0.5), '-6.0');
});

test('formatPan shows the side and amount', () => {
  assert.equal(formatPan(0), 'C');
  assert.equal(formatPan(-0.4), 'L 40');
  assert.equal(formatPan(1), 'R 100');
  assert.equal(formatPan(0.004), 'C');
});
