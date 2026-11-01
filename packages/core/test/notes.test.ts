import assert from 'node:assert/strict';
import { test } from 'node:test';
import { changeVelocity, deleteNotes, duplicateNotes, isBlackKey, moveNotes, noteName, quantizeNotes, replaceNotes, resizeNotes } from '../src/notes.ts';
import { makeNoteClip } from '../src/edits.ts';
import type { Note, TimelineState } from '../src/types.ts';

const notes: Note[] = [
  { pitch: 60, start: 0, duration: 0.5, velocity: 0.8 },
  { pitch: 64, start: 0.5, duration: 0.5, velocity: 0.5 },
  { pitch: 120, start: 1.1, duration: 0.25, velocity: 1 },
];

test('note names put middle C at C4 and know the black keys', () => {
  assert.equal(noteName(60), 'C4');
  assert.equal(noteName(61), 'C#4');
  assert.equal(noteName(21), 'A0');
  assert.deepEqual([60, 61, 63, 64, 66].map(isBlackKey), [false, true, true, false, true]);
});

test('moving notes keeps them after 0 and on the keyboard', () => {
  const moved = moveNotes(notes, new Set([1, 2]), -2, 20);

  // Held back so the earlier note lands on 0, and the high note on 127
  assert.deepEqual(moved.map((n) => [n.pitch, n.start]), [
    [60, 0],
    [71, 0],
    [127, 0.6000000000000001],
  ]);
  assert.equal(moved[0], notes[0]);
  assert.equal(moveNotes(notes, new Set(), 1, 1), notes);
});

test('resizing, velocity and deleting touch only the picked notes', () => {
  assert.deepEqual(resizeNotes(notes, new Set([0, 1]), -0.6, 0.1).map((n) => n.duration), [0.1, 0.1, 0.25]);
  assert.deepEqual(changeVelocity(notes, new Set([1, 2]), 0.3).map((n) => n.velocity), [0.8, 0.8, 1]);
  assert.deepEqual(deleteNotes(notes, new Set([0, 2])), [notes[1]]);
});

test('quantize rounds the picked starts, or every note when none are picked', () => {
  const round = (t: number) => Math.round(t / 0.25) * 0.25;

  assert.deepEqual(quantizeNotes(notes, new Set(), round).map((n) => n.start), [0, 0.5, 1]);
  assert.deepEqual(quantizeNotes(notes, new Set([1]), round).map((n) => n.start), [0, 0.5, 1.1]);
});

test('duplicates go right after the picked notes, rounded up to the gap', () => {
  const { notes: out, created } = duplicateNotes(notes, new Set([0, 1]), 0.75);

  assert.deepEqual([...created], [3, 4]);
  assert.deepEqual(out.slice(3).map((n) => [n.pitch, n.start]), [
    [60, 1.5],
    [64, 2],
  ]);
});

test('replacing notes changes only that note clip', () => {
  const clip = makeNoteClip({ id: 'n', track: 't', start: 0, duration: 2 });
  const state: TimelineState = { tracks: [{ id: 't', name: 'Lead' }], clips: [clip] };

  assert.deepEqual(replaceNotes(state, 'n', notes).clips[0]!.notes, notes);
  assert.equal(replaceNotes(state, 'other', notes).clips[0], clip);
});
