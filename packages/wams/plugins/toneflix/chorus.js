import { makePlugin } from './base.js';

/** A stereo chorus: two short delays swept in opposite directions by one LFO. */
export default makePlugin({
  identifier: 'net.toneflix.studio.chorus',
  name: 'Chorus',
  params: {
    rate: { label: 'Rate', defaultValue: 0.8, minValue: 0.05, maxValue: 5, step: 0.05, units: 'Hz' },
    depth: { label: 'Depth', defaultValue: 3, minValue: 0, maxValue: 10, step: 0.1, units: 'ms' },
    delay: { label: 'Delay', defaultValue: 15, minValue: 5, maxValue: 40, step: 1, units: 'ms' },
    mix: { label: 'Mix', defaultValue: 0.5, minValue: 0, maxValue: 1 },
  },
  build(context, node) {
    const lfo = new OscillatorNode(context, { type: 'sine' });
    const dry = new GainNode(context);
    const wet = new GainNode(context);
    const voices = [-1, 1].map((side) => {
      const delay = new DelayNode(context, { maxDelayTime: 0.06 });
      const depth = new GainNode(context);
      const pan = new StereoPannerNode(context, { pan: side * 0.8 });

      lfo.connect(depth).connect(delay.delayTime);
      node.connectInput(delay).connect(pan).connect(wet);

      return { delay, depth, side };
    });

    node.connectInput(dry).connect(node.output);
    wet.connect(node.output);
    lfo.start();

    return { lfo, dry, wet, voices, stop: () => lfo.stop() };
  },
  apply({ lfo, dry, wet, voices }, v, _transport, context) {
    const now = context.currentTime;

    lfo.frequency.setTargetAtTime(v.rate, now, 0.02);

    for (const voice of voices) {
      voice.delay.delayTime.setTargetAtTime(v.delay / 1000, now, 0.02);
      voice.depth.gain.setTargetAtTime((voice.side * v.depth) / 1000 / 2, now, 0.02);
    }

    // Two voices: each at half level
    wet.gain.setTargetAtTime(v.mix * 0.5, now, 0.02);
    dry.gain.setTargetAtTime(1 - v.mix * 0.5, now, 0.02);
  },
});
