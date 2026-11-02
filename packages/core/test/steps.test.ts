import assert from 'node:assert/strict';
import { test } from 'node:test';
import { notesOnStep, setSwing, stepAt, stepStart, swingOf, toggleStep } from '../src/steps.ts';
import type { Note } from '../src/types.ts';

const step = 0.125;

test('every second step is delayed by the swing', () => {
  assert.equal(stepStart(2, step, 0.3), 0.25);
  assert.equal(stepStart(3, step, 0.3), 0.375 + 0.0375);
  assert.equal(stepAt(0.4125, step, 0.3), 3);
  assert.equal(stepAt(0.31, step, 0), -1);
});

test('a step turns on with a note and off by removing it', () => {
  const on = toggleStep([], 36, 3, step, 0.2, 0.8);

  assert.deepEqual(on, [{ pitch: 36, start: 0.4, duration: step, velocity: 0.8 }]);
  assert.deepEqual(notesOnStep(on, 36, 3, step, 0.2), [0]);
  assert.deepEqual(notesOnStep(on, 38, 3, step, 0.2), []);
  assert.deepEqual(toggleStep(on, 36, 3, step, 0.2, 0.8), []);
});

test('swing is read from the notes and changed on every second step only', () => {
  let notes: Note[] = [];

  for (const index of [0, 1, 2, 3]) notes = [...toggleStep(notes, 42, index, step, 0, 0.8)];

  assert.equal(swingOf(notes, step), 0);

  const swung = setSwing(notes, step, 0, 0.33);

  assert.deepEqual(
    swung.map((n) => n.start),
    [0, 0.125 + 0.04125, 0.25, 0.375 + 0.04125],
  );
  assert.equal(swingOf(swung, step), 0.33);
  assert.deepEqual(setSwing(swung, step, 0.33, 0).map((n) => n.start), [0, 0.125, 0.25, 0.375]);
});
