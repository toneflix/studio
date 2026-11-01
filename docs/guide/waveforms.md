# Waveforms

The timeline draws waveforms from **peaks**: the lowest and highest sample in each small block of audio. Peaks are kept at several resolutions, so any zoom level draws from a level close to one block per pixel.

## Where peaks come from

`Waveforms` is the easy way in. It looks in its cache first and only asks for the decoded audio when the peaks aren't there:

```ts
import { Waveforms } from '@toneflix/studio';

const waveforms = new Waveforms();
const peaks = await waveforms.get(`${file.id}:${file.version}`, () => decode(file));

timeline.setSource({ id: file.id, duration: peaks.length / peaks.sampleRate }, peaks);
```

Two calls for the same key at once share one job.

- `PeaksWorker` does the work in a Web Worker made from the library's own code, so it runs without any bundler setup. Without workers (some test runners, old browsers), it works on the main thread instead.
- `PeaksCache` keeps peaks in memory and in the browser's Cache Storage. Where Cache Storage is missing or blocked, as in some private windows, it keeps them in memory only.

Both take options:

```ts
new Waveforms(
  new PeaksWorker(32), // samples per peak at the finest level, default 64
  new PeaksCache('my-app-peaks', 128), // cache name, peaks kept in memory
);
```

To keep peaks somewhere else, such as IndexedDB or your server, implement `PeaksStore` (`get`, `put`, `clear`) and pass it in place of `PeaksCache`.

## Drawing

Clips draw their waveforms in canvas tiles 1024 pixels wide, and only for what is on screen plus a little either side. A long session at high zoom costs no more than the visible part. Gain and fades shape the drawn waveform, so a fade looks like a fade.

Sources without peaks yet show a flat line, and redraw as soon as `setSource` brings them.

## Bytes on disk

`encodePeaks` and `decodePeaks` turn peaks into a compact `ArrayBuffer` (16-bit, finest level only) and back, if you want to store or send them yourself.
