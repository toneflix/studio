import type { Peaks } from '@toneflix/studio-core';
import { computePeakData, makePeaks, peaksOf } from './peaks.ts';

interface AudioLike {
  sampleRate: number;
  numberOfChannels: number;
  getChannelData(channel: number): Float32Array;
}

type Job = { resolve: (data: Int16Array) => void; reject: (error: unknown) => void };

/**
 * Works out waveform peaks off the main thread. The worker is built from
 * `computePeakData`'s own source, so no bundler setup is needed.
 */
export class PeaksWorker {
  private worker?: Worker;
  private jobs = new Map<number, Job>();
  private next = 0;
  readonly samplesPerPeak: number;

  constructor(samplesPerPeak = 64) {
    this.samplesPerPeak = samplesPerPeak;
  }

  /** Peaks of decoded audio. The channel data is copied, so the buffer stays usable. */
  async compute(audio: AudioLike): Promise<Peaks> {
    const channels = Array.from({ length: audio.numberOfChannels }, (_, c) => audio.getChannelData(c).slice());
    const length = channels.reduce((n, channel) => Math.max(n, channel.length), 0);
    const worker = this.start();

    if (!worker) return peaksOf(channels, audio.sampleRate, this.samplesPerPeak);

    const id = this.next++;
    const data = await new Promise<Int16Array>((resolve, reject) => {
      this.jobs.set(id, { resolve, reject });
      worker.postMessage(
        { id, channels, samplesPerPeak: this.samplesPerPeak },
        channels.map((channel) => channel.buffer),
      );
    });

    return makePeaks(data, this.samplesPerPeak, audio.sampleRate, length);
  }

  terminate() {
    this.worker?.terminate();
    this.worker = undefined;

    for (const job of this.jobs.values()) job.reject(new Error('Peaks worker stopped'));
    this.jobs.clear();
  }

  private start() {
    if (this.worker) return this.worker;
    if (typeof Worker === 'undefined' || typeof Blob === 'undefined' || typeof URL.createObjectURL !== 'function') return null;

    const source = `const computePeakData = ${computePeakData.toString()};
self.onmessage = (event) => {
  const { id, channels, samplesPerPeak } = event.data;
  try {
    const data = computePeakData(channels, samplesPerPeak);
    self.postMessage({ id, data }, [data.buffer]);
  } catch (error) {
    self.postMessage({ id, error: String(error) });
  }
};`;

    try {
      const url = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));
      this.worker = new Worker(url);
      URL.revokeObjectURL(url);
    } catch {
      return null;
    }

    this.worker.onmessage = (event: MessageEvent<{ id: number; data?: Int16Array; error?: string }>) => {
      const job = this.jobs.get(event.data.id);
      this.jobs.delete(event.data.id);

      if (event.data.data) job?.resolve(event.data.data);
      else job?.reject(new Error(event.data.error));
    };

    return this.worker;
  }
}
