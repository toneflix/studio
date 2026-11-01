import type { Peaks } from '../peaks.ts';
import type { Clip } from '../types.ts';
import { drawWaveform } from '../waveform.ts';

/** Width of one waveform canvas in CSS pixels. Long clips use several. */
export const TILE = 1024;

const HEAD = 16;

/**
 * One clip on a lane: its box, trim and fade handles, and waveform canvases
 * drawn only for the part that is on screen.
 */
export class ClipView {
  readonly el: HTMLDivElement;
  private head: HTMLDivElement;
  private wave: HTMLDivElement;
  private fadeIn: HTMLDivElement;
  private fadeOut: HTMLDivElement;
  private tiles = new Map<number, HTMLCanvasElement>();
  private drawn = '';
  private colour = '';
  clip: Clip;

  constructor(clip: Clip, doc: Document) {
    this.clip = clip;
    this.el = doc.createElement('div');
    this.el.className = 'tfs-clip';
    this.el.tabIndex = -1;
    this.el.dataset.clip = clip.id;
    this.el.setAttribute('role', 'button');

    this.head = doc.createElement('div');
    this.head.className = 'tfs-clip-head';
    this.wave = doc.createElement('div');
    this.wave.className = 'tfs-wave';

    const handle = (className: string, part: string) => {
      const el = doc.createElement('div');
      el.className = className;
      el.dataset.part = part;

      return el;
    };

    this.fadeIn = handle('tfs-fade', 'fade-in');
    this.fadeOut = handle('tfs-fade', 'fade-out');

    this.el.append(
      this.head,
      this.wave,
      handle('tfs-trim tfs-trim--start', 'trim-start'),
      handle('tfs-trim tfs-trim--end', 'trim-end'),
      this.fadeIn,
      this.fadeOut,
    );
  }

  /** Place the box and its handles. */
  layout(clip: Clip, pxPerSecond: number, z: number, selected: boolean, color: string) {
    this.clip = clip;
    this.colour = color;

    const width = Math.max(2, clip.duration * pxPerSecond);
    const style = this.el.style;

    style.left = `${clip.start * pxPerSecond}px`;
    style.width = `${width}px`;
    style.zIndex = String(z);
    style.setProperty('--clip', color);

    this.el.classList.toggle('tfs-clip--selected', selected);
    this.el.setAttribute('aria-pressed', String(selected));
    this.el.setAttribute('aria-label', `${clip.name ?? 'Clip'}, ${clip.start.toFixed(2)} seconds, ${clip.duration.toFixed(2)} seconds long`);
    this.head.textContent = clip.name ?? '';
    this.fadeIn.style.left = `${Math.min(width - 5, Math.max(5, clip.fadeIn * pxPerSecond))}px`;
    this.fadeOut.style.left = `${Math.max(5, Math.min(width - 5, width - clip.fadeOut * pxPerSecond))}px`;
  }

  /** Draw the waveform canvases that cover `[from, to)` CSS pixels of the clip. */
  paint(from: number, to: number, pxPerSecond: number, peaks: Peaks | undefined, pixelRatio: number) {
    const clip = this.clip;
    const width = clip.duration * pxPerSecond;
    const signature = [clip.offset, clip.duration, clip.gain, clip.fadeIn, clip.fadeOut, pxPerSecond, pixelRatio, peaks ? peaks.length : 0, this.colour].join();

    if (signature !== this.drawn) {
      for (const canvas of this.tiles.values()) canvas.remove();
      this.tiles.clear();
      this.drawn = signature;
    }

    this.head.style.paddingLeft = `${Math.max(8, Math.min(from + 8, width - 80))}px`;

    const first = Math.max(0, Math.floor(from / TILE) - 1);
    const last = Math.min(Math.ceil(width / TILE) - 1, Math.floor(to / TILE) + 1);

    for (const [index, canvas] of this.tiles) {
      if (index < first || index > last) {
        canvas.remove();
        this.tiles.delete(index);
      }
    }

    const height = Math.max(1, this.el.clientHeight - HEAD - 2);

    for (let index = first; index <= last; index++) {
      if (this.tiles.has(index)) continue;

      const left = index * TILE;
      const tileWidth = Math.min(TILE, width - left);
      if (tileWidth <= 0) continue;

      const canvas = this.el.ownerDocument.createElement('canvas');
      canvas.width = Math.ceil(tileWidth * pixelRatio);
      canvas.height = Math.ceil(height * pixelRatio);
      canvas.style.left = `${left}px`;
      canvas.style.width = `${tileWidth}px`;

      drawWaveform(canvas, { clip, peaks, pxPerSecond, from: left, color: this.colour, pixelRatio });
      this.wave.append(canvas);
      this.tiles.set(index, canvas);
    }
  }

  /** Redraw everything on the next paint. */
  invalidate() {
    this.drawn = '';
  }
}
