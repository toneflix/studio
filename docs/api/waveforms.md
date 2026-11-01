# Waveforms

| | |
| --- | --- |
| `new Waveforms(worker?, cache?)` | Peaks from the cache, or worked out and cached |
| `waveforms.get(key, audio)` | `audio` is called only when `key` isn't cached; may return a promise |
| `waveforms.cached(key)` | Cached peaks or `null`, without computing any |
| `waveforms.destroy()` | Stop the worker |
| `new PeaksWorker(samplesPerPeak = 64)` | `compute(audio)` returns `Peaks` |
| `new PeaksCache(name?, maxInMemory = 64)` | A `PeaksStore` in memory and Cache Storage |
| `peaksOf(channels, sampleRate, samplesPerPeak?)` | Peaks on the current thread |
| `peakAt(peaks, from, to)` | `[min, max]` between two times, from -1 to 1 |
| `encodePeaks(peaks)` / `decodePeaks(buffer)` | Peaks to bytes and back |
| `drawWaveform(canvas, options)` | Draw part of a clip's waveform yourself |

`audio` is anything shaped like an `AudioBuffer`: `sampleRate`, `numberOfChannels` and `getChannelData(channel)`.

```ts
interface Peaks {
  sampleRate: number;
  length: number; // samples
  levels: { samplesPerPeak: number; data: Int16Array }[]; // finest first
}

interface PeaksStore {
  get(key: string): Promise<Peaks | null>;
  put(key: string, peaks: Peaks): Promise<void>;
  clear(): Promise<void>;
}
```
