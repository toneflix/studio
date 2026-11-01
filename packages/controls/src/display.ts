import type { AudioEngine } from '@toneflix/studio-audio';
import type { StudioTimeline } from '@toneflix/studio-timeline';

const METERS: [number, number][] = [
  [2, 4],
  [3, 4],
  [4, 4],
  [5, 4],
  [6, 8],
  [7, 8],
  [12, 8],
];

/** Bar, beat and sixteenth (all from 1) at a time, for a tempo and meter. */
export const barsAndBeats = (time: number, bpm: number, meter: [number, number]) => {
  const beat = (60 / bpm) * (4 / meter[1]);
  const beats = time / beat + 1e-9;
  const whole = Math.floor(beats);

  return {
    bar: Math.floor(whole / meter[0]) + 1,
    beat: (whole % meter[0]) + 1,
    sixteenth: Math.floor((beats - whole) * (16 / meter[1])) + 1,
  };
};

/** Minutes, seconds and milliseconds, like 1:05.250. */
export const clockTime = (time: number) => {
  const ms = Math.floor(time * 1000);
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);

  return `${minutes}:${String(seconds).padStart(2, '0')}.${String(ms % 1000).padStart(3, '0')}`;
};

export interface DisplayLabels {
  position: string;
  tempo: string;
  meter: string;
}

/**
 * The transport display: bar, beat and time of the playhead, and the tempo and
 * meter, which can be changed there.
 */
export const createDisplay = (doc: Document, timeline: StudioTimeline, engine: AudioEngine | undefined, labels: DisplayLabels) => {
  const element = doc.createElement('div');
  const position = doc.createElement('div');
  const clock = doc.createElement('div');
  const tempo = doc.createElement('input');
  const meter = doc.createElement('select');
  const cell = (main: HTMLElement, caption: string) => {
    const wrap = doc.createElement('label');
    const small = doc.createElement('small');

    wrap.className = 'tfs-display-cell';
    small.textContent = caption;
    wrap.append(main, small);

    return wrap;
  };

  element.className = 'tfs-display';
  element.setAttribute('aria-label', labels.position);
  position.className = 'tfs-display-position';
  clock.className = 'tfs-display-clock';
  tempo.type = 'number';
  tempo.min = '20';
  tempo.max = '999';
  tempo.step = '1';
  tempo.className = 'tfs-display-tempo';
  tempo.setAttribute('aria-label', labels.tempo);
  meter.className = 'tfs-display-meter';
  meter.setAttribute('aria-label', labels.meter);

  for (const [beats, unit] of METERS) meter.add(new Option(`${beats}/${unit}`, `${beats}/${unit}`));

  element.append(cell(position, 'Bar'), cell(clock, 'Time'), cell(tempo, 'BPM'), cell(meter, 'Meter'));

  const playhead = () => (engine?.isPlaying ? engine.time : timeline.time);

  // Changes the tempo section under the playhead: the grid's own tempo, or a tempo change
  const setGrid = (options: { bpm?: number; meter?: [number, number] }) => {
    const section = timeline.grid.sectionAt(playhead());
    const change = timeline.grid.tempo.find((c) => Math.abs(c.time - section.start) < 1e-6);

    if (change) timeline.updateTempoChange(change.id, options);
    else {
      timeline.setGrid(options);
      engine?.metronome.grid.set(options);
    }

    update();
  };

  tempo.addEventListener('change', () => {
    const bpm = Math.round(Number(tempo.value));

    if (bpm >= 20 && bpm <= 999) setGrid({ bpm });
    else tempo.value = String(timeline.grid.sectionAt(playhead()).bpm);
  });
  meter.addEventListener('change', () => setGrid({ meter: meter.value.split('/').map(Number) as [number, number] }));

  let frame = 0;

  const update = () => {
    const time = playhead();
    const { bar, beat, sixteenth } = timeline.grid.position(time);
    const section = timeline.grid.sectionAt(time);

    position.textContent = `${bar}.${beat}.${sixteenth}`;
    clock.textContent = clockTime(time);
    if (doc.activeElement !== tempo) tempo.value = String(section.bpm);

    const value = section.meter.join('/');

    if (![...meter.options].some((option) => option.value === value)) meter.add(new Option(value, value));
    meter.value = value;
  };

  const follow = () => {
    update();
    frame = engine?.isPlaying ? requestAnimationFrame(follow) : 0;
  };

  const unsubscribe = [timeline.on('seek', update), timeline.on('change', update)];

  if (engine) {
    unsubscribe.push(
      engine.on('play', () => {
        cancelAnimationFrame(frame);
        follow();
      }),
      engine.on('pause', update),
      engine.on('seek', update),
      engine.on('end', update),
    );
  }

  update();

  return {
    element,
    update,
    destroy() {
      cancelAnimationFrame(frame);
      for (const off of unsubscribe) off();
    },
  };
};
