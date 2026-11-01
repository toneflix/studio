import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AUTOMATION_RANGES, automationAt, automationSteps, cleanPoints, setAutomation } from '../src/automation.ts';

const points = [
  { time: 1, value: 0 },
  { time: 3, value: 1 },
];

test('values follow straight lines between points and hold past the ends', () => {
  assert.equal(automationAt(points, 0, 0.5), 0);
  assert.equal(automationAt(points, 2, 0.5), 0.5);
  assert.equal(automationAt(points, 9, 0.5), 1);
  assert.equal(automationAt([], 2, 0.5), 0.5);
});

test('steps hold both ends of a window and the points inside it', () => {
  assert.deepEqual(automationSteps(points, 2, 4, 0), [
    { time: 2, value: 0.5 },
    { time: 3, value: 1 },
    { time: 4, value: 1 },
  ]);
});

test('points are sorted, kept in range and never share a time', () => {
  assert.deepEqual(
    cleanPoints('pan', [
      { time: 2, value: 4 },
      { time: -1, value: 0 },
      { time: 2, value: -0.5 },
    ]),
    [
      { time: 0, value: 0 },
      { time: 2, value: -0.5 },
    ],
  );
});

test('volume sits on a fader curve, so 0 dB is high in the lane', () => {
  const { toLevel, fromLevel } = AUTOMATION_RANGES.volume;

  assert.ok(toLevel(1) > 0.75 && toLevel(1) < 0.8);
  assert.ok(Math.abs(fromLevel(toLevel(0.3)) - 0.3) < 1e-9);
});

test('clearing the last points removes the automation from the track', () => {
  const state = { tracks: [{ id: 'a', name: 'A' }], clips: [] };
  const drawn = setAutomation(state, 'a', 'volume', points);

  assert.deepEqual(drawn.tracks[0]!.automation, { volume: points });
  assert.deepEqual(setAutomation(drawn, 'a', 'volume', []).tracks[0], { id: 'a', name: 'A' });
});
