import assert from 'node:assert/strict';
import { test } from 'node:test';
import { sampleFor } from '../src/instruments.ts';

test('a sampler plays the sample whose root is nearest, the lower one on a tie', () => {
  const samples = [
    { source: 'low', root: 48 },
    { source: 'mid', root: 60 },
    { source: 'high', root: 72 },
  ];

  assert.equal(sampleFor(samples, 50)?.source, 'low');
  assert.equal(sampleFor(samples, 54)?.source, 'low');
  assert.equal(sampleFor(samples, 55)?.source, 'mid');
  assert.equal(sampleFor(samples, 100)?.source, 'high');
  assert.equal(sampleFor([{ source: 'any' }], 30)?.source, 'any');
  assert.equal(sampleFor([], 60), undefined);
});
