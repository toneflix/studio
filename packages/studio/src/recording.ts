import { addClips, makeClip, type Peaks } from '@toneflix/studio-core';
import type { Recorder, Take } from '@toneflix/studio-recorder';
import type { StudioTimeline } from '@toneflix/studio-timeline';
import { computePeakData, makePeaks, type Waveforms } from '@toneflix/studio-waveforms';

export interface LinkRecorderOptions {
  /** Works out the finished take's waveform; it keeps the one drawn while recording without it */
  waveforms?: Waveforms;
  /** Name of the clip a take makes, from its number in this session */
  name?: (take: number) => string;
  /** Called with each finished take, for example to upload it */
  onTake?: (take: Take) => void;
}

/** Samples per peak of the waveform drawn while recording */
const LIVE_PEAK = 256;

/**
 * Shows recording on a timeline: the take grows as a clip with its waveform while
 * recording, and lands as one undo step. Editing is paused while recording.
 * Returns a function that unlinks them.
 */
export const linkRecorder = (timeline: StudioTimeline, recorder: Recorder, options: LinkRecorderOptions = {}) => {
  const name = options.name ?? ((n: number) => `Take ${n}`);
  let count = 0;
  let live: { id: string; clip: string; track: string; start: number; duration: number; sampleRate: number; data: Int16Array; peaks: number; readonly: boolean } | null = null;
  let frame = 0;

  const peaks = (): Peaks | undefined => {
    if (!live || !live.peaks) return undefined;

    return makePeaks(live.data.subarray(0, live.peaks * 2), LIVE_PEAK, live.sampleRate, Math.round(live.duration * live.sampleRate));
  };

  const draw = () => {
    frame = 0;
    if (!live) return;

    const { id, clip, track, start, duration } = live;

    timeline.setSource({ id, duration }, peaks());
    timeline.model.draft('Record', (state) =>
      addClips(state, [makeClip({ id: clip, track, source: id, name: name(count), start, offset: 0, duration })]),
    );
  };

  const unlisten = [
    recorder.on('start', ({ id, track }) => {
      count++;
      live = { id, clip: `${id}-clip`, track, start: 0, duration: 0, sampleRate: 0, data: new Int16Array(4096), peaks: 0, readonly: timeline.readonly };
      timeline.setOptions({ readonly: true });
    }),
    recorder.on('data', ({ id, start, duration, channels, sampleRate }) => {
      if (!live || live.id !== id) return;

      const add = computePeakData(channels, LIVE_PEAK);

      if (live.peaks * 2 + add.length > live.data.length) {
        const grown = new Int16Array(Math.max(live.data.length * 2, live.peaks * 2 + add.length));

        grown.set(live.data);
        live.data = grown;
      }

      live.data.set(add, live.peaks * 2);
      live.peaks += add.length / 2;
      Object.assign(live, { start, duration, sampleRate });
      frame ||= requestAnimationFrame(draw);
    }),
    recorder.on('stop', ({ take }) => {
      cancelAnimationFrame(frame);
      frame = 0;

      const was = live;

      live = null;
      if (!was) return;

      timeline.setOptions({ readonly: was.readonly });

      if (!take) {
        timeline.model.cancel();

        return;
      }

      Object.assign(was, { start: take.start, duration: take.duration });
      live = was;
      draw();
      live = null;
      timeline.model.commit('Record');

      options.waveforms?.get(`take:${take.id}`, () => take.buffer).then((final) => timeline.setSource({ id: take.id }, final));
      options.onTake?.(take);
    }),
  ];

  return () => {
    cancelAnimationFrame(frame);
    for (const off of unlisten) off();
  };
};
