import { makePlugin } from './base.js';

const curve = (amount) => {
  const k = amount * 50;
  const data = new Float32Array(1024);

  for (let i = 0; i < data.length; i++) {
    const x = (i / (data.length - 1)) * 2 - 1;
    data[i] = ((1 + k) * x) / (1 + k * Math.abs(x));
  }

  return data;
};

/** Warm saturation with a tone control. */
export default makePlugin({
  identifier: 'net.toneflix.studio.drive',
  name: 'Drive',
  params: {
    drive: { label: 'Drive', defaultValue: 0.3, minValue: 0, maxValue: 1 },
    tone: { label: 'Tone', defaultValue: 6000, minValue: 800, maxValue: 16000, step: 50, units: 'Hz' },
    level: { label: 'Level', defaultValue: 0.8, minValue: 0, maxValue: 1.5 },
  },
  build(context, node) {
    const shaper = new WaveShaperNode(context, { oversample: '4x' });
    const tone = new BiquadFilterNode(context, { type: 'lowpass' });
    const level = new GainNode(context);

    node.connectInput(shaper).connect(tone).connect(level).connect(node.output);

    return { shaper, tone, level, amount: -1 };
  },
  apply(parts, v, _transport, context) {
    const now = context.currentTime;

    if (parts.amount !== v.drive) {
      parts.shaper.curve = curve(v.drive);
      parts.amount = v.drive;
    }

    parts.tone.frequency.setTargetAtTime(v.tone, now, 0.02);
    parts.level.gain.setTargetAtTime(v.level, now, 0.02);
  },
});
