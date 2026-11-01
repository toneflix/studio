import { Grid, type GridOptions } from '@toneflix/studio-core';
import type { Click } from './schedule.ts';

/** Clicks on every beat of the grid while playing; the first beat of a bar is higher. */
export class Metronome {
  readonly grid: Grid;
  enabled = false;
  /** Linear gain of the clicks */
  volume = 0.5;
  private readonly context: BaseAudioContext;
  private readonly output: AudioNode;

  constructor(context: BaseAudioContext, output: AudioNode = context.destination, grid: Partial<GridOptions> = {}) {
    this.context = context;
    this.output = output;
    this.grid = new Grid(grid);
  }

  /** Play clicks at context times. */
  play(clicks: readonly (Click & { when: number })[]) {
    if (!this.enabled) return;

    for (const click of clicks) {
      const osc = this.context.createOscillator();
      const gain = this.context.createGain();
      const peak = this.volume * (click.accent ? 1 : 0.6);

      osc.frequency.value = click.accent ? 1760 : 1320;
      gain.gain.setValueAtTime(0, click.when);
      gain.gain.linearRampToValueAtTime(peak, click.when + 0.002);
      gain.gain.exponentialRampToValueAtTime(0.0001, click.when + 0.06);
      osc.connect(gain).connect(this.output);
      osc.start(click.when);
      osc.stop(click.when + 0.07);
      osc.onended = () => gain.disconnect();
    }
  }
}
