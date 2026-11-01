import { makePlugin } from './base.js';

/** A three-band EQ: low shelf, a sweepable mid and a high shelf. */
export default makePlugin({
  identifier: 'net.toneflix.studio.eq',
  name: 'EQ',
  params: {
    low: { label: 'Low', defaultValue: 0, minValue: -18, maxValue: 18, step: 0.5, units: 'dB' },
    lowFreq: { label: 'Low freq', defaultValue: 120, minValue: 40, maxValue: 500, step: 5, units: 'Hz' },
    mid: { label: 'Mid', defaultValue: 0, minValue: -18, maxValue: 18, step: 0.5, units: 'dB' },
    midFreq: { label: 'Mid freq', defaultValue: 1000, minValue: 200, maxValue: 8000, step: 10, units: 'Hz' },
    midQ: { label: 'Mid width', defaultValue: 1, minValue: 0.3, maxValue: 8, step: 0.1, units: 'Q' },
    high: { label: 'High', defaultValue: 0, minValue: -18, maxValue: 18, step: 0.5, units: 'dB' },
    highFreq: { label: 'High freq', defaultValue: 8000, minValue: 2000, maxValue: 16000, step: 50, units: 'Hz' },
  },
  build(context, node) {
    const low = new BiquadFilterNode(context, { type: 'lowshelf' });
    const mid = new BiquadFilterNode(context, { type: 'peaking' });
    const high = new BiquadFilterNode(context, { type: 'highshelf' });

    node.connectInput(low).connect(mid).connect(high).connect(node.output);

    return { low, mid, high };
  },
  apply({ low, mid, high }, v, _transport, context) {
    const now = context.currentTime;

    low.gain.setTargetAtTime(v.low, now, 0.02);
    low.frequency.setTargetAtTime(v.lowFreq, now, 0.02);
    mid.gain.setTargetAtTime(v.mid, now, 0.02);
    mid.frequency.setTargetAtTime(v.midFreq, now, 0.02);
    mid.Q.setTargetAtTime(v.midQ, now, 0.02);
    high.gain.setTargetAtTime(v.high, now, 0.02);
    high.frequency.setTargetAtTime(v.highFreq, now, 0.02);
  },
});
