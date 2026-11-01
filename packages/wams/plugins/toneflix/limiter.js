import { makePlugin } from './base.js';

const gain = (db) => 10 ** (db / 20);

/** Clips anything past the ceiling, so peaks the compressor lets through never pass it. */
const clip = (ceiling) => {
  const data = new Float32Array(2049);

  for (let i = 0; i < data.length; i++) {
    const x = (i / (data.length - 1)) * 2 - 1;
    data[i] = Math.max(-ceiling, Math.min(ceiling, x));
  }

  return data;
};

/** A peak limiter: gain in, a fast compressor, then a hard ceiling. */
export default makePlugin({
  identifier: 'net.toneflix.studio.limiter',
  name: 'Limiter',
  params: {
    input: { label: 'Gain', defaultValue: 0, minValue: 0, maxValue: 24, step: 0.5, units: 'dB' },
    ceiling: { label: 'Ceiling', defaultValue: -1, minValue: -12, maxValue: 0, step: 0.1, units: 'dB' },
    release: { label: 'Release', defaultValue: 60, minValue: 5, maxValue: 500, step: 5, units: 'ms' },
  },
  build(context, node) {
    const input = new GainNode(context);
    const compressor = new DynamicsCompressorNode(context, { ratio: 20, knee: 0, attack: 0 });
    const ceiling = new WaveShaperNode(context, { oversample: '4x' });

    node.connectInput(input).connect(compressor).connect(ceiling).connect(node.output);

    return { input, compressor, ceiling, level: NaN };
  },
  apply(parts, v, _transport, context) {
    const now = context.currentTime;

    if (parts.level !== v.ceiling) {
      parts.ceiling.curve = clip(gain(v.ceiling));
      parts.level = v.ceiling;
    }

    parts.input.gain.setTargetAtTime(gain(v.input), now, 0.02);
    parts.compressor.threshold.setValueAtTime(v.ceiling - 2, now);
    parts.compressor.release.setValueAtTime(v.release / 1000, now);
  },
});
