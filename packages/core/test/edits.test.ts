import assert from 'node:assert/strict';
import { test } from 'node:test';
import { duplicateClips, makeClip, moveClips, removeTrack, setFades, splitClips, trimEnd, trimStart } from '../src/edits.ts';
import type { Source, TimelineState } from '../src/types.ts';

const state = (): TimelineState => ({
  tracks: [
    { id: 'a', name: 'Drums' },
    { id: 'b', name: 'Bass' },
  ],
  clips: [makeClip({ id: 'x', track: 'a', source: 's', start: 2, offset: 0, duration: 10, fadeIn: 1, fadeOut: 2 })],
});

const sources = new Map<string, Source>([['s', { id: 's', duration: 12 }]]);

test('a split piece moves past and over its neighbour', () => {
  const { state: split, created } = splitClips(state(), new Set(['x']), 6);
  const right = created[0]!;

  assert.equal(split.clips.length, 2);
  assert.deepEqual(
    split.clips.map((c) => [c.start, c.offset, c.duration, c.fadeIn, c.fadeOut]),
    [
      [2, 0, 4, 1, 0],
      [6, 4, 6, 0, 2],
    ],
  );

  const moved = moveClips(split, new Set([right]), -5);
  const clip = moved.clips.find((c) => c.id === right)!;

  assert.equal(clip.start, 1);
  assert.equal(clip.offset, 4);
});

test('clips stop at the timeline start and the outer lanes', () => {
  const moved = moveClips(state(), new Set(['x']), -10, 5);

  assert.equal(moved.clips[0]!.start, 0);
  assert.equal(moved.clips[0]!.track, 'b');
  assert.equal(moveClips(state(), new Set(['x']), 0, -3).clips[0]!.track, 'a');
});

test('trims stay inside the source audio', () => {
  const s = state();

  assert.deepEqual(
    [trimStart(s, sources, 'x', 0).clips[0]!.start, trimStart(s, sources, 'x', 0).clips[0]!.offset],
    [2, 0],
  );

  const front = trimStart(s, sources, 'x', 5).clips[0]!;
  assert.deepEqual([front.start, front.offset, front.duration], [5, 3, 7]);

  assert.equal(trimEnd(s, sources, 'x', 30).clips[0]!.duration, 12);
  assert.ok(Math.abs(trimEnd(s, sources, 'x', 1).clips[0]!.duration - 0.01) < 1e-9);
});

test('fades never add up to more than the clip', () => {
  const clip = setFades(state(), 'x', { fadeIn: 9, fadeOut: 9 }).clips[0]!;

  assert.equal(clip.fadeIn, 9);
  assert.equal(clip.fadeOut, 1);
});

test('duplicates land right after the originals', () => {
  const { state: next, created } = duplicateClips(state(), new Set(['x']));

  assert.equal(next.clips.find((c) => c.id === created[0])!.start, 12);
});

test('removing a track removes its clips', () => {
  assert.equal(removeTrack(state(), 'a').clips.length, 0);
});
