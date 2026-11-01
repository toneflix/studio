/**
 * Fader travel follows a cubic curve, so most of it covers the useful range
 * around 0 dB, as on a mixing desk. Positions run from 0 (bottom) to 1 (top).
 */
export const faderToGain = (position: number, maxGain = 2) => maxGain * Math.min(1, Math.max(0, position)) ** 3;

export const gainToFader = (gain: number, maxGain = 2) => Math.cbrt(Math.min(1, Math.max(0, gain / maxGain)));

/** A gain as dB for a readout, like `-3.5`, `0.0` or `-∞`. */
export const formatDb = (gain: number) => {
  if (gain <= 0.00001) return '-∞';

  const db = 20 * Math.log10(gain);

  return `${db > 0.05 ? '+' : ''}${db.toFixed(1)}`;
};

/** A pan value as L, C or R with a percentage, like `L 40` or `C`. */
export const formatPan = (pan: number) => {
  const amount = Math.round(Math.abs(pan) * 100);

  return amount === 0 ? 'C' : `${pan < 0 ? 'L' : 'R'} ${amount}`;
};
