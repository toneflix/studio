import type { PeakLevel, Peaks } from '@toneflix/studio-core';

/**
 * Min/max peaks of the channels mixed down, `samplesPerPeak` samples per pair.
 * It uses nothing outside itself, so it can run as the peaks worker's source.
 */
export function computePeakData(channels: Float32Array[], samplesPerPeak: number): Int16Array {
  const length = channels.reduce((n, channel) => Math.max(n, channel.length), 0);
  const count = Math.ceil(length / samplesPerPeak);
  const out = new Int16Array(count * 2);

  for (let p = 0; p < count; p++) {
    const from = p * samplesPerPeak;
    const to = Math.min(length, from + samplesPerPeak);
    let min = 0;
    let max = 0;

    for (let c = 0; c < channels.length; c++) {
      const channel = channels[c]!;
      const end = Math.min(to, channel.length);

      for (let i = from; i < end; i++) {
        const v = channel[i]!;
        if (v < min) min = v;
        if (v > max) max = v;
      }
    }

    out[p * 2] = Math.max(-32768, Math.round(min * 32767));
    out[p * 2 + 1] = Math.min(32767, Math.round(max * 32767));
  }

  return out;
}

/** Coarser levels made from the finest one, each four times coarser. */
export const buildLevels = (base: PeakLevel, minPeaks = 512): PeakLevel[] => {
  const levels = [base];
  let level = base;

  while (level.data.length / 2 > minPeaks * 4) {
    const count = Math.ceil(level.data.length / 8);
    const data = new Int16Array(count * 2);

    for (let p = 0; p < count; p++) {
      let min = 0;
      let max = 0;

      for (let i = p * 4; i < Math.min(p * 4 + 4, level.data.length / 2); i++) {
        min = Math.min(min, level.data[i * 2]!);
        max = Math.max(max, level.data[i * 2 + 1]!);
      }

      data[p * 2] = min;
      data[p * 2 + 1] = max;
    }

    level = { samplesPerPeak: level.samplesPerPeak * 4, data };
    levels.push(level);
  }

  return levels;
};

export const makePeaks = (data: Int16Array, samplesPerPeak: number, sampleRate: number, length: number): Peaks => ({
  sampleRate,
  length,
  levels: buildLevels({ samplesPerPeak, data }),
});

/** Peaks worked out on this thread, for tests and places without workers. */
export const peaksOf = (channels: Float32Array[], sampleRate: number, samplesPerPeak = 64): Peaks => {
  const length = channels.reduce((n, channel) => Math.max(n, channel.length), 0);

  return makePeaks(computePeakData(channels, samplesPerPeak), samplesPerPeak, sampleRate, length);
};

/**
 * Min and max (-1 to 1) of the audio between two times in seconds, read from
 * the coarsest level that still has detail at that span.
 */
export const peakAt = (peaks: Peaks, from: number, to: number): [number, number] => {
  const span = (to - from) * peaks.sampleRate;
  let level = peaks.levels[0]!;

  for (const candidate of peaks.levels) {
    if (candidate.samplesPerPeak * 2 <= span) level = candidate;
  }

  const count = level.data.length / 2;
  const a = Math.max(0, Math.floor((from * peaks.sampleRate) / level.samplesPerPeak));
  const b = Math.min(count, Math.max(a + 1, Math.ceil((to * peaks.sampleRate) / level.samplesPerPeak)));
  let min = 0;
  let max = 0;

  for (let i = a; i < b; i++) {
    min = Math.min(min, level.data[i * 2]!);
    max = Math.max(max, level.data[i * 2 + 1]!);
  }

  return [min / 32768, max / 32767];
};

const MAGIC = 0x50544653; // "STFP"

/** Peaks as bytes for a device cache: a small header and the finest level. */
export const encodePeaks = (peaks: Peaks): ArrayBuffer => {
  const base = peaks.levels[0]!;
  const buffer = new ArrayBuffer(16 + base.data.byteLength);
  const header = new Uint32Array(buffer, 0, 4);

  header.set([MAGIC, peaks.sampleRate, peaks.length, base.samplesPerPeak]);
  new Int16Array(buffer, 16).set(base.data);

  return buffer;
};

export const decodePeaks = (buffer: ArrayBuffer): Peaks | null => {
  if (buffer.byteLength < 16) return null;

  const [magic, sampleRate, length, samplesPerPeak] = new Uint32Array(buffer, 0, 4);
  if (magic !== MAGIC || !sampleRate || !samplesPerPeak) return null;

  return makePeaks(new Int16Array(buffer.slice(16)), samplesPerPeak, sampleRate, length!);
};
