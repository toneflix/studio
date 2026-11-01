import assert from 'node:assert/strict';
import { test } from 'node:test';
import { makeClip } from '../src/edits.ts';
import { audibleRanges } from '../src/overlap.ts';

const clip = (id: string, start: number, duration: number) => makeClip({ id, track: 't', source: 's', start, offset: 0, duration });

test('the later clip plays where clips overlap', () => {
  const ranges = audibleRanges([clip('a', 0, 10), clip('b', 4, 2)]);

  assert.deepEqual(
    ranges.map((r) => [r.clip.id, r.start, r.end]),
    [
      ['a', 0, 4],
      ['b', 4, 6],
      ['a', 6, 10],
    ],
  );
});

test('a clip fully covered is not heard', () => {
  const ranges = audibleRanges([clip('a', 3, 2), clip('b', 3, 5)]);

  assert.deepEqual(ranges.map((r) => [r.clip.id, r.start, r.end]), [['b', 3, 8]]);
});
