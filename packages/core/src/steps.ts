import type { Note } from './types.ts';

/**
 * Steps of a step sequencer, laid over a note clip's notes. `step` is a step's
 * length in seconds and `swing` (0 to 0.5) delays every second step by that part of a step.
 */
export const stepStart = (index: number, step: number, swing = 0) => index * step + (index % 2 ? swing * step : 0);

/** How far from its step a note may sit and still count as on it, as a part of a step. */
const REACH = 0.25;

/** The step a time falls on, or -1 when it sits between steps. */
export const stepAt = (time: number, step: number, swing = 0) => {
  const near = Math.round(time / step);

  for (const index of [near - 1, near, near + 1]) {
    if (index >= 0 && Math.abs(stepStart(index, step, swing) - time) < step * REACH) return index;
  }

  return -1;
};

/** Indices of the notes of a pitch on a step. */
export const notesOnStep = (notes: readonly Note[], pitch: number, index: number, step: number, swing = 0) => {
  const at = stepStart(index, step, swing);

  return notes.flatMap((note, i) => (note.pitch === pitch && Math.abs(note.start - at) < step * REACH ? [i] : []));
};

/** The swing the notes on every second step already have, to the nearest percent. */
export const swingOf = (notes: readonly Note[], step: number) => {
  const delays = notes
    .map((note) => note.start / step)
    .filter((position) => Math.floor(position + 1e-6) % 2 === 1)
    .map((position) => position - Math.floor(position + 1e-6))
    .filter((delay) => delay < 0.5 + 1e-6)
    .sort((a, b) => a - b);

  if (!delays.length) return 0;

  return Math.round(delays[Math.floor(delays.length / 2)]! * 100) / 100;
};

/** Move the notes on every second step from one swing to another. */
export const setSwing = (notes: readonly Note[], step: number, from: number, to: number) =>
  notes.map((note) => {
    const index = stepAt(note.start, step, from);

    return index % 2 === 1 ? { ...note, start: stepStart(index, step, to) } : note;
  });

/** Turn a step of a pitch on with a new note, or off by removing its notes. */
export const toggleStep = (notes: readonly Note[], pitch: number, index: number, step: number, swing: number, velocity: number) => {
  const on = new Set(notesOnStep(notes, pitch, index, step, swing));

  if (on.size) return notes.filter((_, i) => !on.has(i));

  return [...notes, { pitch, start: stepStart(index, step, swing), duration: step, velocity }];
};
