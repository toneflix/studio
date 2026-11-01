import assert from 'node:assert/strict';
import { test } from 'node:test';
import { encodeWav } from '../src/wav.ts';

test('encodes interleaved 16-bit PCM with a WAV header', () => {
  const left = new Float32Array([0, 1, -1]);
  const right = new Float32Array([0.5, 0, 2]);
  const wav = encodeWav({ sampleRate: 8000, numberOfChannels: 2, length: 3, getChannelData: (c) => (c ? right : left) });
  const view = new DataView(wav);

  assert.equal(wav.byteLength, 44 + 3 * 2 * 2);
  assert.equal(String.fromCharCode(...new Uint8Array(wav, 0, 4)), 'RIFF');
  assert.equal(view.getUint16(22, true), 2);
  assert.equal(view.getUint32(24, true), 8000);
  assert.deepEqual(
    Array.from({ length: 6 }, (_, i) => view.getInt16(44 + i * 2, true)),
    [0, 16384, 32767, 0, -32767, 32767],
  );
});
