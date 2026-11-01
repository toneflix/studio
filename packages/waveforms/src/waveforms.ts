import { PeaksCache, type PeaksStore } from './peaks-cache.ts';
import { PeaksWorker } from './peaks-worker.ts';
import type { Peaks } from '@toneflix/studio-core';

type AudioLike = Parameters<PeaksWorker['compute']>[0];

/**
 * Peaks for audio, read from the device cache when they were worked out
 * before, otherwise computed in the worker and cached.
 */
export class Waveforms {
  private pending = new Map<string, Promise<Peaks>>();
  readonly worker: PeaksWorker;
  readonly cache: PeaksStore;

  constructor(worker = new PeaksWorker(), cache: PeaksStore = new PeaksCache()) {
    this.worker = worker;
    this.cache = cache;
  }

  /** Peaks for a cache key; `audio` is only called when they aren't cached. */
  get(key: string, audio: () => AudioLike | Promise<AudioLike>): Promise<Peaks> {
    const running = this.pending.get(key);
    if (running) return running;

    const job = (async () => {
      const cached = await this.cache.get(key);
      if (cached) return cached;

      const peaks = await this.worker.compute(await audio());
      await this.cache.put(key, peaks);

      return peaks;
    })().finally(() => this.pending.delete(key));

    this.pending.set(key, job);

    return job;
  }

  /** Peaks already cached for a key, without computing any. */
  cached(key: string) {
    return this.cache.get(key);
  }

  destroy() {
    this.worker.terminate();
  }
}
