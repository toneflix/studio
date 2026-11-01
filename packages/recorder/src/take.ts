/**
 * Collects recorded audio as it arrives. The first chunk fixes where the take
 * starts on the timeline; the rest follow on without gaps, as an audio worklet
 * delivers them. Audio from before `from` is dropped.
 */
export class TakeBuilder {
  readonly sampleRate: number;
  readonly channelCount: number;
  private readonly from: number;
  private chunks: Float32Array[][] = [];
  private frames = 0;
  private startTime: number | null = null;

  constructor(sampleRate: number, channelCount: number, from = 0) {
    this.sampleRate = sampleRate;
    this.channelCount = channelCount;
    this.from = Math.max(0, from);
  }

  /** Where the take starts on the timeline, once audio has arrived. */
  get start() {
    return this.startTime;
  }

  /** Recorded length in seconds. */
  get duration() {
    return this.frames / this.sampleRate;
  }

  get length() {
    return this.frames;
  }

  /**
   * Add a chunk. `at` is the timeline time of its first sample; only the first
   * chunk's is used. Returns the samples kept, or null when all were dropped.
   */
  push(at: number, channels: Float32Array[]): Float32Array[] | null {
    let kept = this.fit(channels);

    if (this.startTime === null) {
      const skip = Math.max(0, Math.ceil((this.from - at) * this.sampleRate - 1e-6));

      if (skip >= kept[0]!.length) return null;

      kept = kept.map((channel) => channel.subarray(skip));
      this.startTime = at + skip / this.sampleRate;
    }

    this.chunks.push(kept);
    this.frames += kept[0]!.length;

    return kept;
  }

  /** The whole take, one array per channel. */
  build(): Float32Array[] {
    return Array.from({ length: this.channelCount }, (_, c) => {
      const out = new Float32Array(this.frames);
      let at = 0;

      for (const chunk of this.chunks) {
        out.set(chunk[c]!, at);
        at += chunk[c]!.length;
      }

      return out;
    });
  }

  /** Always `channelCount` channels: missing ones copy the first, extra ones are left out. */
  private fit(channels: Float32Array[]) {
    const first = channels[0] ?? new Float32Array(0);

    return Array.from({ length: this.channelCount }, (_, c) => channels[c] ?? first);
  }
}
