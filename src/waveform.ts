import { peakAt, type Peaks } from './peaks.ts';
import type { Clip } from './types.ts';

export interface WaveformDraw {
  clip: Clip;
  peaks?: Peaks;
  pxPerSecond: number;
  /** Where the canvas starts inside the clip, in CSS pixels */
  from: number;
  color: string;
  pixelRatio: number;
}

/** Clip loudness at a time into the clip: its gain shaped by the fades. */
export const envelopeAt = (clip: Clip, time: number) => {
  let gain = clip.gain;

  if (clip.fadeIn > 0 && time < clip.fadeIn) gain *= Math.max(0, time / clip.fadeIn);
  if (clip.fadeOut > 0 && time > clip.duration - clip.fadeOut) gain *= Math.max(0, (clip.duration - time) / clip.fadeOut);

  return gain;
};

/** Draw a slice of a clip's waveform, one bar per device pixel, with fade lines on top. */
export const drawWaveform = (canvas: HTMLCanvasElement, draw: WaveformDraw) => {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const { clip, peaks, pxPerSecond, from, color, pixelRatio } = draw;
  const width = canvas.width;
  const rows = canvas.height;
  const middle = rows / 2;
  const perPixel = 1 / (pxPerSecond * pixelRatio);

  ctx.clearRect(0, 0, width, rows);
  ctx.fillStyle = color;

  if (!peaks) {
    ctx.globalAlpha = 0.5;
    ctx.fillRect(0, Math.floor(middle), width, Math.max(1, pixelRatio));
    ctx.globalAlpha = 1;

    return;
  }

  for (let x = 0; x < width; x++) {
    const time = from / pxPerSecond + x * perPixel;
    if (time > clip.duration) break;

    const source = clip.offset + time;
    const [min, max] = peakAt(peaks, source, source + perPixel);
    const gain = Math.min(2, envelopeAt(clip, time));
    const top = middle - Math.min(1, max * gain) * middle;
    const bottom = middle - Math.max(-1, min * gain) * middle;

    ctx.fillRect(x, top, 1, Math.max(1, bottom - top));
  }

  drawFadeLines(ctx, draw, rows);
};

const drawFadeLines = (ctx: CanvasRenderingContext2D, draw: WaveformDraw, rows: number) => {
  const { clip, pxPerSecond, from, pixelRatio } = draw;
  const px = (time: number) => (time * pxPerSecond - from) * pixelRatio;

  ctx.strokeStyle = draw.color;
  ctx.lineWidth = pixelRatio;
  ctx.globalAlpha = 0.9;

  if (clip.fadeIn > 0) {
    ctx.beginPath();
    ctx.moveTo(px(0), rows);
    ctx.lineTo(px(clip.fadeIn), 0);
    ctx.stroke();
  }

  if (clip.fadeOut > 0) {
    ctx.beginPath();
    ctx.moveTo(px(clip.duration - clip.fadeOut), 0);
    ctx.lineTo(px(clip.duration), rows);
    ctx.stroke();
  }

  ctx.globalAlpha = 1;
};
