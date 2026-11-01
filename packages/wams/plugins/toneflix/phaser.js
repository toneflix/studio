import { makePlugin } from './base.js';

const STAGES = 6;

/** A six-stage phaser with an LFO-swept centre and feedback. */
export default makePlugin({
  identifier: 'net.toneflix.studio.phaser',
  name: 'Phaser',
  params: {
    rate: { label: 'Rate', defaultValue: 0.4, minValue: 0.05, maxValue: 5, step: 0.05, units: 'Hz' },
    centre: { label: 'Centre', defaultValue: 900, minValue: 200, maxValue: 4000, step: 10, units: 'Hz' },
    depth: { label: 'Depth', defaultValue: 0.7, minValue: 0, maxValue: 1 },
    feedback: { label: 'Feedback', defaultValue: 0.4, minValue: 0, maxValue: 0.9 },
    mix: { label: 'Mix', defaultValue: 0.5, minValue: 0, maxValue: 1 },
  },
  build(context, node) {
    const lfo = new OscillatorNode(context, { type: 'sine' });
    const sweep = new GainNode(context);
    const stages = Array.from({ length: STAGES }, () => new BiquadFilterNode(context, { type: 'allpass', Q: 0.5 }));
    const feedback = new GainNode(context);
    // A loop needs a delay; this one is a single render block
    const loop = new DelayNode(context, { delayTime: 128 / context.sampleRate, maxDelayTime: 0.01 });
    const wet = new GainNode(context);
    const dry = new GainNode(context);

    lfo.connect(sweep);
    node.connectInput(stages[0]);
    for (let i = 1; i < STAGES; i++) stages[i - 1].connect(stages[i]);
    for (const stage of stages) sweep.connect(stage.frequency);
    stages[STAGES - 1].connect(feedback).connect(loop).connect(stages[0]);
    stages[STAGES - 1].connect(wet).connect(node.output);
    node.connectInput(dry).connect(node.output);
    lfo.start();

    return { lfo, sweep, stages, feedback, wet, dry, stop: () => lfo.stop() };
  },
  apply({ lfo, sweep, stages, feedback, wet, dry }, v, _transport, context) {
    const now = context.currentTime;

    lfo.frequency.setTargetAtTime(v.rate, now, 0.02);
    sweep.gain.setTargetAtTime(v.centre * v.depth * 0.9, now, 0.02);
    for (const stage of stages) stage.frequency.setTargetAtTime(v.centre, now, 0.02);
    feedback.gain.setTargetAtTime(v.feedback, now, 0.02);
    wet.gain.setTargetAtTime(v.mix, now, 0.02);
    dry.gain.setTargetAtTime(1 - v.mix * 0.5, now, 0.02);
  },
});
