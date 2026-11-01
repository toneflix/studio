import assert from 'node:assert/strict';
import { test } from 'node:test';
import { makeClip, moveClips } from '../src/edits.ts';
import { History } from '../src/history.ts';
import { TimelineModel } from '../src/model.ts';

const model = (history = new History()) =>
  new TimelineModel(
    { tracks: [{ id: 't', name: 'Vox' }], clips: [makeClip({ id: 'c', track: 't', source: 's', start: 0, offset: 0, duration: 4 })] },
    history,
  );

test('a drag is one undo step', () => {
  const m = model();
  const ids = new Set(['c']);

  m.draft('Move', (s) => moveClips(s, ids, 1));
  m.draft('Move', (s) => moveClips(s, ids, 2));
  m.draft('Move', (s) => moveClips(s, ids, 3));
  m.commit('Move');

  assert.equal(m.state.clips[0]!.start, 3);
  assert.equal(m.history.info.undoLabel, 'Move');

  m.history.undo();
  assert.equal(m.state.clips[0]!.start, 0);
  assert.equal(m.history.canUndo, false);

  m.history.redo();
  assert.equal(m.state.clips[0]!.start, 3);
});

test('a cancelled drag leaves no trace', () => {
  const m = model();

  m.draft('Move', (s) => moveClips(s, new Set(['c']), 2));
  m.cancel();

  assert.equal(m.state.clips[0]!.start, 0);
  assert.equal(m.history.canUndo, false);
});

test('the app and the timeline share one history', () => {
  const history = new History();
  const m = model(history);
  const mixer = { volume: 1 };

  m.apply('Move', (s) => moveClips(s, new Set(['c']), 1));
  mixer.volume = 0.5;
  history.push({ label: 'Volume', undo: () => (mixer.volume = 1), redo: () => (mixer.volume = 0.5) });

  history.undo();
  assert.equal(mixer.volume, 1);
  assert.equal(m.state.clips[0]!.start, 1);

  history.undo();
  assert.equal(m.state.clips[0]!.start, 0);
});

test('a new step clears redo, and the limit drops the oldest', () => {
  const history = new History(2);
  const noop = { undo() {}, redo() {} };

  history.push({ label: 'a', ...noop });
  history.push({ label: 'b', ...noop });
  history.push({ label: 'c', ...noop });
  history.undo();
  history.undo();

  assert.equal(history.canUndo, false);
  assert.equal(history.info.redoLabel, 'b');

  history.push({ label: 'd', ...noop });
  assert.equal(history.canRedo, false);
});
