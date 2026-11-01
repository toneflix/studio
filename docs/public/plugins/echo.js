import { makePlugin } from './base.js';

/** A tempo-synced echo: repeats every `beats` beats of the host's tempo. */
export default makePlugin({
  identifier: 'net.toneflix.studio.echo',
  name: 'Echo',
  params: {
    beats: { label: 'Beats', defaultValue: 0.75, minValue: 0.25, maxValue: 2, step: 0.25 },
    feedback: { label: 'Feedback', defaultValue: 0.35, minValue: 0, maxValue: 0.9 },
    tone: { label: 'Tone', defaultValue: 3500, minValue: 500, maxValue: 12000, step: 50, units: 'Hz' },
    mix: { label: 'Mix', defaultValue: 0.3, minValue: 0, maxValue: 1 },
  },
  build(context, node) {
    const delay = new DelayNode(context, { maxDelayTime: 4 });
    const feedback = new GainNode(context);
    const tone = new BiquadFilterNode(context, { type: 'lowpass' });
    const wet = new GainNode(context);
    const dry = new GainNode(context);

    node.connectInput(dry).connect(node.output);
    node.connectInput(delay).connect(tone).connect(feedback).connect(delay);
    tone.connect(wet).connect(node.output);

    return { delay, feedback, tone, wet, dry };
  },
  apply({ delay, feedback, tone, wet, dry }, v, transport, context) {
    const now = context.currentTime;

    delay.delayTime.setTargetAtTime(Math.min(4, v.beats * (60 / (transport.tempo || 120))), now, 0.02);
    feedback.gain.setTargetAtTime(v.feedback, now, 0.02);
    tone.frequency.setTargetAtTime(v.tone, now, 0.02);
    wet.gain.setTargetAtTime(v.mix, now, 0.02);
    dry.gain.setTargetAtTime(1 - v.mix * 0.5, now, 0.02);
  },
});
