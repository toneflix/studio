import type { Clip } from './types.ts';

/** Clip loudness at a time into the clip: its gain shaped by the fades. */
export const envelopeAt = (clip: Clip, time: number) => {
  let gain = clip.gain;

  if (clip.fadeIn > 0 && time < clip.fadeIn) gain *= Math.max(0, time / clip.fadeIn);
  if (clip.fadeOut > 0 && time > clip.duration - clip.fadeOut) gain *= Math.max(0, (clip.duration - time) / clip.fadeOut);

  return gain;
};
