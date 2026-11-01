import type { AudioEngine, Channel } from '@toneflix/studio-audio';

/** Quietest level a meter shows, in dB. */
export const METER_FLOOR = -60;

/** Where a level sits on a meter, from 0 (silent) to 1 (0 dB or louder). */
export const meterPosition = (gain: number) => {
  if (gain <= 0) return 0;

  return Math.min(1, Math.max(0, (20 * Math.log10(gain) - METER_FLOOR) / -METER_FLOOR));
};

/** How much of the shown level is kept each frame, so meters fall smoothly. */
const FALL = 0.88;

interface Entry {
  channel: () => Channel;
  bars: HTMLElement[];
  shown: [number, number];
}

/** Drives every meter of one engine from a single animation frame loop, only while there is something to show. */
class MeterBoard {
  private readonly engine: AudioEngine;
  private readonly entries = new Set<Entry>();
  private frame = 0;

  constructor(engine: AudioEngine) {
    this.engine = engine;
    engine.on('play', () => this.wake());
  }

  add(entry: Entry) {
    this.entries.add(entry);
    this.wake();

    return () => {
      this.entries.delete(entry);
    };
  }

  private wake() {
    if (!this.frame && typeof requestAnimationFrame === 'function') this.frame = requestAnimationFrame(() => this.tick());
  }

  private tick() {
    this.frame = 0;

    const playing = this.engine.isPlaying;
    let moving = false;

    for (const entry of this.entries) {
      const levels = playing ? entry.channel().levels() : [0, 0];

      for (const side of [0, 1] as const) {
        const level = meterPosition(levels[side]);
        const shown = Math.max(level, entry.shown[side] * FALL);

        entry.shown[side] = shown < 0.002 ? 0 : shown;
        entry.bars[side]!.style.clipPath = `inset(0 ${((1 - entry.shown[side]) * 100).toFixed(1)}% 0 0)`;
        moving ||= entry.shown[side] > 0;
      }
    }

    if (this.entries.size && (playing || moving)) this.wake();
  }
}

const boards = new WeakMap<AudioEngine, MeterBoard>();

/**
 * A left and right level meter for a channel. Returns the element and a
 * function that stops it.
 */
export const createMeter = (doc: Document, engine: AudioEngine, channel: () => Channel) => {
  let board = boards.get(engine);

  if (!board) {
    board = new MeterBoard(engine);
    boards.set(engine, board);
  }

  const element = doc.createElement('div');
  const bars = [doc.createElement('i'), doc.createElement('i')];

  element.className = 'tfs-meter';
  element.setAttribute('aria-hidden', 'true');
  for (const bar of bars) bar.style.clipPath = 'inset(0 100% 0 0)';
  element.append(...bars);

  return { element, stop: board.add({ channel, bars, shown: [0, 0] }) };
};
