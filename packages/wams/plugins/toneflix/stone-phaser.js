import { makePlugin } from './base.js';

/**
 * A port of Stone Phaser by Jean Pierre Cimalando (CC0-1.0), a model of a four-stage
 * analog phaser pedal after Kiiski, Esqueda and Välimäki, "Time-variant gray-box
 * modeling of a phaser pedal" (DAFx-16).
 */
const processor = `
const smoothing = Math.exp(-1 / (0.1 * sampleRate));
const key = (hz) => 69 + 12 * Math.log2(hz / 440);
const hz = (k) => 440 * 2 ** ((k - 69) / 12);

/** The rounded triangle the pedal's LFO makes, from 0 to 1 over a cycle. */
const roundness = 0.975;
const shape = (pos) => 1 - Math.sin(2 * (pos < 0.5 ? pos : 1 - pos) * Math.asin(roundness)) / roundness;

class Smooth {
  constructor(value) {
    this.value = value;
  }

  step(target) {
    return (this.value = (1 - smoothing) * target + smoothing * this.value);
  }
}

/** One-pole highpass. */
class Highpass {
  x1 = 0;
  y1 = 0;

  step(x, f) {
    const p = Math.exp((-2 * Math.PI * f) / sampleRate);
    const y = 0.5 * (1 + p) * (x - this.x1) + p * this.y1;

    this.x1 = x;
    this.y1 = y;

    return y;
  }
}

/** One-pole allpass. */
class Allpass {
  x1 = 0;
  y1 = 0;

  step(x, a) {
    const y = a * x + this.x1 - a * this.y1;

    this.x1 = x;
    this.y1 = y;

    return y;
  }
}

class Channel {
  input = new Highpass();
  loop = new Highpass();
  stages = [new Allpass(), new Allpass(), new Allpass(), new Allpass()];
  last = 0;

  step(x, a, feedback, cut) {
    let y = this.input.step(x, 33) + this.loop.step(this.last, cut) * feedback;

    for (const stage of this.stages) y = stage.step(y, a);

    return (this.last = y);
  }
}

class ToneflixStonePhaser extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return ['color', 'rate', 'feedback', 'cut', 'mix', 'phase'].map((name) => ({ name, defaultValue: 0, automationRate: 'k-rate' }));
  }

  constructor() {
    super();
    this.channels = [new Channel(), new Channel()];
    this.pos = 0;
    this.s = { rate: new Smooth(0.2), feedback: new Smooth(0.75), cut: new Smooth(500), wet: new Smooth(0.7), dry: new Smooth(0.7), phase: new Smooth(1), low: new Smooth(key(80)), high: new Smooth(key(2200)), colorFeedback: new Smooth(0.75) };
  }

  process([input], [output], p) {
    const color = p.color[0] >= 0.5;
    const mix = p.mix[0] / 100;
    const s = this.s;

    for (let i = 0; i < output[0].length; i++) {
      const rate = s.rate.step(p.rate[0]);
      const feedback = s.feedback.step(p.feedback[0] / 100);
      const cut = s.cut.step(p.cut[0]);
      const wet = s.wet.step(Math.sin((mix * Math.PI) / 2));
      const dry = s.dry.step(Math.cos((mix * Math.PI) / 2));
      const phase = s.phase.step(p.phase[0] / 360 + 1);
      const low = s.low.step(key(color ? 80 : 300));
      const high = s.high.step(key(color ? 2200 : 6000));
      const loop = s.colorFeedback.step(color ? feedback : 0.1 * feedback);

      this.pos = (this.pos + rate / sampleRate) % 1;

      for (let c = 0; c < output.length; c++) {
        const pos = c ? (this.pos + phase) % 1 : this.pos;
        const f = hz(low + shape(pos) * (high - low));
        const a = -1 + (2 * Math.PI * f) / sampleRate;
        const x = (input[c] ?? input[0])?.[i] ?? 0;

        output[c][i] = x * dry + this.channels[c].step(x, a, loop, cut) * wet;
      }
    }

    return true;
  }
}

registerProcessor('toneflix-stone-phaser', ToneflixStonePhaser);
`;

export default makePlugin({
  identifier: 'net.toneflix.studio.stone-phaser',
  name: 'Stone Phaser',
  worklet: processor,
  params: {
    rate: { label: 'Rate', defaultValue: 0.2, minValue: 0.01, maxValue: 5, step: 0.01, units: 'Hz' },
    feedback: { label: 'Feedback', defaultValue: 75, minValue: 0, maxValue: 99, step: 1, units: '%' },
    cut: { label: 'Feedback bass cut', defaultValue: 500, minValue: 10, maxValue: 5000, step: 10, units: 'Hz' },
    color: { label: 'Color', defaultValue: 1, minValue: 0, maxValue: 1, step: 1 },
    phase: { label: 'Stereo phase', defaultValue: 0, minValue: -180, maxValue: 180, step: 1, units: '°' },
    mix: { label: 'Mix', defaultValue: 50, minValue: 0, maxValue: 100, step: 1, units: '%' },
  },
  build(context, node) {
    const phaser = new AudioWorkletNode(context, 'toneflix-stone-phaser', { outputChannelCount: [2] });

    node.connectInput(phaser).connect(node.output);

    return { phaser };
  },
  apply({ phaser }, v, _transport, context) {
    for (const id of ['color', 'rate', 'feedback', 'cut', 'mix', 'phase']) phaser.parameters.get(id).setValueAtTime(v[id], context.currentTime);
  },
});
