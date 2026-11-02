import assert from 'node:assert/strict';
import { test } from 'node:test';
import { duplicateClips, makeClip, makeNoteClip, splitClips } from '../src/edits.ts';
import { replaceNotes } from '../src/notes.ts';
import { linkedClips, nextPatternName, patternsOf, unlinkClip, usePattern } from '../src/patterns.ts';
import type { TimelineState } from '../src/types.ts';

const kick = { pitch: 36, start: 0, duration: 0.1, velocity: 1 };
const snare = { pitch: 38, start: 0.5, duration: 0.1, velocity: 1 };

const setup = (): TimelineState => {
  const beat = makeNoteClip({ id: 'b1', track: 'drums', name: 'Beat', start: 0, duration: 2, notes: [kick] });
  const state: TimelineState = {
    tracks: [{ id: 'drums', name: 'Drums', instrument: { id: 'drums' } }, { id: 'audio', name: 'Audio' }],
    clips: [beat, makeClip({ id: 'a1', track: 'audio', source: 'loop', start: 0, offset: 0, duration: 4 })],
  };

  return duplicateClips(state, new Set(['b1'])).state;
};

test('duplicated and split note clips play one pattern, so editing one edits them all', () => {
  const state = splitClips(setup(), new Set(['b1']), 1).state;
  const linked = linkedClips(state, 'b1');

  assert.equal(linked.length, 3);

  const edited = replaceNotes(state, 'b1', [kick, snare]);

  assert.ok(edited.clips.filter((clip) => clip.notes).every((clip) => clip.notes!.length === 2));
  assert.equal(edited.clips.find((clip) => clip.id === 'a1'), state.clips.find((clip) => clip.id === 'a1'));
});

test('a unique clip gets a numbered pattern of its own and stops following the others', () => {
  const state = setup();
  const copy = state.clips.find((clip) => clip.notes && clip.id !== 'b1')!;
  const { state: unique, source } = unlinkClip(state, copy.id);

  assert.ok(source && source !== copy.source);
  assert.equal(unique.clips.find((clip) => clip.id === copy.id)!.name, 'Beat 2');
  assert.equal(linkedClips(unique, 'b1').length, 1);

  const edited = replaceNotes(unique, 'b1', [snare]);

  assert.deepEqual(edited.clips.find((clip) => clip.id === copy.id)!.notes, [kick]);
  assert.deepEqual(
    patternsOf(edited, 'drums').map((pattern) => [pattern.name, pattern.clips.length]),
    [
      ['Beat', 1],
      ['Beat 2', 1],
    ],
  );
  assert.equal(nextPatternName(edited, 'drums', 'Beat 2'), 'Beat 3');
});

test('a clip can start an empty pattern, then switch back to another one', () => {
  const state = setup();
  const copy = state.clips.find((clip) => clip.notes && clip.id !== 'b1')!;
  const empty = unlinkClip(state, copy.id, { notes: [] }).state;

  assert.deepEqual(empty.clips.find((clip) => clip.id === copy.id)!.notes, []);

  const back = usePattern(empty, copy.id, state.clips.find((clip) => clip.id === 'b1')!.source);
  const clip = back.clips.find((c) => c.id === copy.id)!;

  assert.deepEqual(clip.notes, [kick]);
  assert.equal(clip.name, 'Beat');
  assert.equal(clip.start, copy.start);
  assert.equal(linkedClips(back, 'b1').length, 2);
});
