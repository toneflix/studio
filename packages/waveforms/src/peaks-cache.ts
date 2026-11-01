import type { Peaks } from '@toneflix/studio-core';
import { decodePeaks, encodePeaks } from './peaks.ts';

/** Where peaks are kept between visits. Keys should change when the audio changes. */
export interface PeaksStore {
  get(key: string): Promise<Peaks | null>;
  put(key: string, peaks: Peaks): Promise<void>;
  clear(): Promise<void>;
}

/**
 * Peaks kept in memory and in Cache Storage on the device. Without Cache
 * Storage (private windows, tests) it keeps them in memory only.
 */
export class PeaksCache implements PeaksStore {
  private memory = new Map<string, Peaks>();
  readonly name: string;
  readonly maxInMemory: number;

  constructor(name = 'toneflix-studio-peaks', maxInMemory = 64) {
    this.name = name;
    this.maxInMemory = maxInMemory;
  }

  async get(key: string) {
    const kept = this.memory.get(key);

    if (kept) {
      this.remember(key, kept);

      return kept;
    }

    const cache = await this.open();
    const response = await cache?.match(this.url(key)).catch(() => undefined);
    const peaks = response ? decodePeaks(await response.arrayBuffer()) : null;

    if (peaks) this.remember(key, peaks);

    return peaks;
  }

  async put(key: string, peaks: Peaks) {
    this.remember(key, peaks);

    const cache = await this.open();
    await cache?.put(this.url(key), new Response(encodePeaks(peaks))).catch(() => undefined);
  }

  async clear() {
    this.memory.clear();

    if (typeof caches !== 'undefined') await caches.delete(this.name).catch(() => false);
  }

  private remember(key: string, peaks: Peaks) {
    this.memory.delete(key);
    this.memory.set(key, peaks);

    while (this.memory.size > this.maxInMemory) this.memory.delete(this.memory.keys().next().value!);
  }

  private async open() {
    if (typeof caches === 'undefined') return null;

    return caches.open(this.name).catch(() => null);
  }

  private url(key: string) {
    return `https://peaks.studio.local/${encodeURIComponent(key)}`;
  }
}
