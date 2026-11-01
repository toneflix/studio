import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Grid, makeClip, type TimelineState } from '@toneflix/studio-core';
import { clicksIn, gainSteps, heardRanges, passesBetween, timelineAt, voicesIn, type Pass } from '../src/schedule.ts';

const clip = (id: string, track: string, start: number, duration: number, extra = {}) =>
  makeClip({ id, track, source: id, start, offset: 0, duration, ...extra });

const state: TimelineState = {
  tracks: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }],
  clips: [clip('a1', 'a', 0, 10), clip('a2', 'a', 4, 2), clip('b1', 'b', 3, 5)],
};

const voicesBetween = (origin: number, loop: { start: number; end: number } | null, windows: number[]) => {
  const ranges = heardRanges(state);
  const voices = [];

  for (let i = 1; i < windows.length; i++) {
    for (const pass of passesBetween(origin, loop, windows[i - 1]!, windows[i]!)) voices.push(...voicesIn(ranges, pass));
  }

  return voices.map((v) => [v.clip.id, v.start, v.end, v.at]);
};

test('the clip on top is the one scheduled where clips overlap', () => {
  assert.deepEqual(voicesBetween(0, null, [0, 20]), [
    ['a1', 0, 4, 0],
    ['b1', 3, 8, 3],
    ['a2', 4, 6, 4],
    ['a1', 6, 10, 6],
  ]);
});

test('every part starts once however playback is split into windows', () => {
  assert.deepEqual(voicesBetween(0, null, [0, 0.3, 3.5, 3.9, 6, 20]), voicesBetween(0, null, [0, 20]));
});

test('playing from the middle of a clip starts it part way', () => {
  assert.deepEqual(voicesBetween(5, null, [0, 2]), [
    ['b1', 5, 8, 0],
    ['a2', 5, 6, 0],
    ['a1', 6, 10, 1],
  ]);
});

test('a loop plays to its end, then repeats from its start', () => {
  const loop = { start: 2, end: 5 };

  assert.equal(timelineAt(0, loop, 4), 4);
  assert.equal(timelineAt(0, loop, 5.5), 2.5);
  assert.equal(timelineAt(0, loop, 8.5), 2.5);
  assert.deepEqual(voicesBetween(4.5, loop, [0, 0.2, 1, 4]), [
    ['b1', 4.5, 5, 0],
    ['a2', 4.5, 5, 0],
    ['a1', 2, 4, 0.5],
    ['b1', 3, 5, 1.5],
    ['a2', 4, 5, 2.5],
    ['a1', 2, 4, 3.5],
  ]);
});

test('a loop is skipped when playback starts after it', () => {
  assert.equal(timelineAt(6, { start: 2, end: 5 }, 1), 7);
});

test('gain steps follow the clip gain and fades', () => {
  const faded = clip('f', 'a', 10, 10, { gain: 0.5, fadeIn: 2, fadeOut: 4 });

  assert.deepEqual(gainSteps({ clip: faded, start: 10, end: 20 }), [
    { at: 0, gain: 0 },
    { at: 2, gain: 0.5 },
    { at: 6, gain: 0.5 },
    { at: 10, gain: 0 },
  ]);
  assert.deepEqual(gainSteps({ clip: faded, start: 11, end: 17 }), [
    { at: 0, gain: 0.25 },
    { at: 1, gain: 0.5 },
    { at: 5, gain: 0.5 },
    { at: 6, gain: 0.375 },
  ]);
});

test('metronome clicks land on beats, accented on the first beat of a bar', () => {
  const grid = new Grid({ bpm: 120, meter: [4, 4] });
  const pass: Pass = { start: 0, end: Infinity, from: 1.6, to: 2.6, at: 0 };

  assert.deepEqual(clicksIn(grid, pass), [
    { time: 2, accent: true, at: 2 },
    { time: 2.5, accent: false, at: 2.5 },
  ]);
});
