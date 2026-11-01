import { makePlugin } from './base.js';

const gain = (db) => 10 ** (db / 20);

/** A compressor with threshold, ratio, timing and make-up gain. */
export default makePlugin({
  identifier: 'net.toneflix.studio.compressor',
  name: 'Compressor',
  params: {
    threshold: { label: 'Threshold', defaultValue: -18, minValue: -60, maxValue: 0, step: 0.5, units: 'dB' },
    ratio: { label: 'Ratio', defaultValue: 4, minValue: 1, maxValue: 20, step: 0.5, units: ':1' },
    attack: { label: 'Attack', defaultValue: 10, minValue: 0, maxValue: 200, step: 1, units: 'ms' },
    release: { label: 'Release', defaultValue: 150, minValue: 10, maxValue: 1000, step: 5, units: 'ms' },
    knee: { label: 'Knee', defaultValue: 6, minValue: 0, maxValue: 40, step: 1, units: 'dB' },
    makeup: { label: 'Make-up', defaultValue: 0, minValue: -12, maxValue: 24, step: 0.5, units: 'dB' },
  },
  build(context, node) {
    const compressor = new DynamicsCompressorNode(context);
    const makeup = new GainNode(context);

    node.connectInput(compressor).connect(makeup).connect(node.output);

    return { compressor, makeup };
  },
  apply({ compressor, makeup }, v, _transport, context) {
    const now = context.currentTime;

    compressor.threshold.setValueAtTime(v.threshold, now);
    compressor.ratio.setValueAtTime(v.ratio, now);
    compressor.attack.setValueAtTime(v.attack / 1000, now);
    compressor.release.setValueAtTime(v.release / 1000, now);
    compressor.knee.setValueAtTime(v.knee, now);
    makeup.gain.setTargetAtTime(gain(v.makeup), now, 0.02);
  },
});
