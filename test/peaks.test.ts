import assert from 'node:assert/strict';
import { test } from 'node:test';
import { decodePeaks, encodePeaks, peakAt, peaksOf } from '../src/peaks.ts';
import { PeaksCache } from '../src/peaks-cache.ts';
import { Waveforms } from '../src/waveforms.ts';
import { PeaksWorker } from '../src/peaks-worker.ts';

const sine = (seconds: number, rate = 8000, amp = 0.5) =>
  Float32Array.from({ length: seconds * rate }, (_, i) => amp * Math.sin((i / rate) * 2 * Math.PI * 220));

test('peaks follow the audio at any span', () => {
  const quiet = sine(1, 8000, 0.25);
  const loud = sine(1, 8000, 1);
  const audio = new Float32Array(16000);
  audio.set(quiet);
  audio.set(loud, 8000);

  const peaks = peaksOf([audio], 8000, 4);

  assert.ok(peaks.levels.length > 1);
  assert.ok(Math.abs(peakAt(peaks, 0, 0.9)[1] - 0.25) < 0.01);
  assert.ok(Math.abs(peakAt(peaks, 1, 2)[1] - 1) < 0.01);
  assert.ok(Math.abs(peakAt(peaks, 0, 2)[0] + 1) < 0.01);
  assert.ok(Math.abs(peakAt(peaks, 0.5, 0.501)[1] - 0.25) < 0.02);
});

test('peaks survive the device cache format', () => {
  const peaks = peaksOf([sine(2)], 8000);
  const back = decodePeaks(encodePeaks(peaks))!;

  assert.equal(back.sampleRate, 8000);
  assert.equal(back.length, 16000);
  assert.deepEqual(back.levels[0]!.data, peaks.levels[0]!.data);
  assert.equal(decodePeaks(new ArrayBuffer(8)), null);
});

test('waveforms are computed once per key', async () => {
  const waveforms = new Waveforms(new PeaksWorker(), new PeaksCache('test'));
  let decoded = 0;
  const audio = () => {
    decoded++;

    return { sampleRate: 8000, numberOfChannels: 1, getChannelData: () => sine(1) };
  };

  const [a, b] = await Promise.all([waveforms.get('k', audio), waveforms.get('k', audio)]);
  await waveforms.get('k', audio);

  assert.equal(decoded, 1);
  assert.equal(a, b);
});
