import { makePlugin } from './base.js';

/** A stereo impulse response of decaying noise, the same every time for a given length. */
const impulse = (context, seconds) => {
  const length = Math.max(1, Math.floor(context.sampleRate * seconds));
  const buffer = context.createBuffer(2, length, context.sampleRate);
  let seed = 1;
  const random = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 2 ** 31 - 1;
  };

  for (let channel = 0; channel < 2; channel++) {
    const data = buffer.getChannelData(channel);

    // Falls 60 dB over the length
    for (let i = 0; i < length; i++) data[i] = random() * Math.exp((-6.9 * i) / length);
  }

  return buffer;
};

/** A room-to-hall reverb with decay, pre-delay and tone. */
export default makePlugin({
  identifier: 'net.toneflix.studio.reverb',
  name: 'Reverb',
  params: {
    decay: { label: 'Decay', defaultValue: 2, minValue: 0.2, maxValue: 8, step: 0.1, units: 's' },
    predelay: { label: 'Pre-delay', defaultValue: 20, minValue: 0, maxValue: 200, step: 1, units: 'ms' },
    tone: { label: 'Tone', defaultValue: 7000, minValue: 1000, maxValue: 16000, step: 50, units: 'Hz' },
    mix: { label: 'Mix', defaultValue: 0.25, minValue: 0, maxValue: 1 },
  },
  build(context, node) {
    const predelay = new DelayNode(context, { maxDelayTime: 0.2 });
    const convolver = new ConvolverNode(context);
    const tone = new BiquadFilterNode(context, { type: 'lowpass' });
    const wet = new GainNode(context);
    const dry = new GainNode(context);

    node.connectInput(dry).connect(node.output);
    node.connectInput(predelay).connect(convolver).connect(tone).connect(wet).connect(node.output);

    return { predelay, convolver, tone, wet, dry, decay: -1 };
  },
  apply(parts, v, _transport, context) {
    const now = context.currentTime;

    if (parts.decay !== v.decay) {
      parts.convolver.buffer = impulse(context, v.decay);
      parts.decay = v.decay;
    }

    parts.predelay.delayTime.setTargetAtTime(v.predelay / 1000, now, 0.02);
    parts.tone.frequency.setTargetAtTime(v.tone, now, 0.02);
    parts.wet.gain.setTargetAtTime(v.mix, now, 0.02);
    parts.dry.gain.setTargetAtTime(1 - v.mix * 0.5, now, 0.02);
  },
});
