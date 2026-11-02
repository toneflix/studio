import { addClips, makeClip, makeNoteClip, uid, type Grid, type Note, type Peaks } from '@toneflix/studio-core';
import type { NoteRecorder, NoteTakeResult, Recorder, Take } from '@toneflix/studio-recorder';
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
 * recording, and lands as one undo step. Editing is paused while recording, and
 * a deleted track is disarmed.
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
    timeline.on('change', ({ state, final }) => {
      // A deleted track can't stay armed
      if (final && recorder.armed && !state.tracks.some((track) => track.id === recorder.armed)) recorder.arm(null);
    }),
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

export interface LinkNoteRecorderOptions {
  /** Name of the clip a take makes, from its number in this session */
  name?: (take: number) => string;
  /** Called with each finished take */
  onTake?: (take: NoteTakeResult) => void;
}

/** Whole bars around a stretch of time: from the bar `from` falls in to the end of the bar `to` falls in. */
const barsAround = (grid: Grid, from: number, to: number) => {
  const first = grid.barTime(grid.position(from).bar);
  const last = grid.position(Math.max(from, to - 1e-6)).bar;

  return { start: first, end: grid.barTime(last + 1) };
};

/**
 * Shows note recording on a timeline: the take grows as a note clip in whole bars
 * while recording, and lands as one undo step. Editing is paused while recording.
 * Returns a function that unlinks them.
 */
export const linkNoteRecorder = (timeline: StudioTimeline, recorder: NoteRecorder, options: LinkNoteRecorderOptions = {}) => {
  const name = options.name ?? ((n: number) => `Take ${n}`);
  let count = 0;
  let live: { id: string; track: string; from: number; readonly: boolean } | null = null;
  let frame = 0;

  const draw = (notes: Note[], to: number) => {
    if (!live) return;

    const { id, track, from } = live;
    const end = Math.max(to, ...notes.map((n) => n.start + n.duration));
    const bars = barsAround(timeline.grid, from, end);
    const clip = makeNoteClip({
      id,
      track,
      name: name(count),
      start: bars.start,
      duration: bars.end - bars.start,
      notes: notes.map((n) => ({ ...n, start: n.start - bars.start })),
    });

    timeline.model.draft('Record notes', (state) => addClips(state, [clip]));
  };

  const tick = () => {
    frame = requestAnimationFrame(tick);
    if (live) draw(recorder.notes(), recorder.engine.time);
  };

  const unlisten = [
    recorder.on('start', ({ track, from }) => {
      count++;
      live = { id: uid('c'), track, from, readonly: timeline.readonly };
      timeline.setOptions({ readonly: true });
      frame = requestAnimationFrame(tick);
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

      live = was;
      draw(take.notes, take.to);
      live = null;
      timeline.model.commit('Record notes');
      options.onTake?.(take);
    }),
  ];

  return () => {
    cancelAnimationFrame(frame);
    for (const off of unlisten) off();
  };
};
