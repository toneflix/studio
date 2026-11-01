import assert from 'node:assert/strict';
import { test } from 'node:test';
import { makeClip, sourcesInUse, trackSamples, type TimelineState } from '../src/index.ts';

const state: TimelineState = {
  tracks: [
    { id: 'drums', name: 'Drums', instrument: { id: 'drums', state: { volume: 1, samples: { 36: { source: 'kick', name: 'Kick' }, 60: { source: 'vox' } } } } },
    { id: 'keys', name: 'Keys', instrument: { id: 'sampler', state: { samples: [{ source: 'piano', root: 60 }, { source: 'kick' }] } } },
    { id: 'synth', name: 'Synth', instrument: { id: 'synth' } },
    { id: 'audio', name: 'Audio' },
  ],
  clips: [makeClip({ id: 'c1', track: 'audio', source: 'loop', start: 0, offset: 0, duration: 1 })],
};

test('a track lists the samples of its instrument, by pad or zone', () => {
  assert.deepEqual(
    trackSamples(state.tracks[0]!).map((s) => s.source),
    ['kick', 'vox'],
  );
  assert.deepEqual(
    trackSamples(state.tracks[1]!).map((s) => s.source),
    ['piano', 'kick'],
  );
  assert.deepEqual(trackSamples(state.tracks[2]!), []);
});

test('the sources in use are the clips and every sample, once each', () => {
  assert.deepEqual(sourcesInUse(state), ['loop', 'kick', 'vox', 'piano']);
});
