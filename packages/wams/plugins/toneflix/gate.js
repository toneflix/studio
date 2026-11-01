import { makePlugin } from './base.js';

/** The gate's processor: a peak detector opens it, it holds, then closes to `range`. */
const processor = `
class ToneflixGate extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: 'threshold', defaultValue: -40, automationRate: 'k-rate' },
      { name: 'attack', defaultValue: 1, automationRate: 'k-rate' },
      { name: 'hold', defaultValue: 50, automationRate: 'k-rate' },
      { name: 'release', defaultValue: 120, automationRate: 'k-rate' },
      { name: 'range', defaultValue: -80, automationRate: 'k-rate' },
    ];
  }

  constructor() {
    super();
    this.level = 0;
    this.gain = 0;
    this.held = 0;
  }

  process([input], [output], p) {
    if (!input.length) return true;

    const threshold = 10 ** (p.threshold[0] / 20);
    const floor = 10 ** (p.range[0] / 20);
    const attack = Math.exp(-1 / (sampleRate * Math.max(0.0001, p.attack[0] / 1000)));
    const release = Math.exp(-1 / (sampleRate * Math.max(0.001, p.release[0] / 1000)));
    const fall = Math.exp(-1 / (sampleRate * 0.01));
    const hold = (p.hold[0] / 1000) * sampleRate;

    for (let i = 0; i < input[0].length; i++) {
      let peak = 0;

      for (const channel of input) peak = Math.max(peak, Math.abs(channel[i]));

      this.level = peak > this.level ? peak : this.level * fall;

      if (this.level >= threshold) this.held = hold;
      else if (this.held > 0) this.held--;

      const target = this.held > 0 ? 1 : floor;

      this.gain = target + (this.gain - target) * (target > this.gain ? attack : release);

      for (let c = 0; c < output.length; c++) output[c][i] = (input[c] ?? input[0])[i] * this.gain;
    }

    return true;
  }
}

registerProcessor('toneflix-gate', ToneflixGate);
`;

/** A noise gate with threshold, hold and range. */
export default makePlugin({
  identifier: 'net.toneflix.studio.gate',
  name: 'Gate',
  worklet: processor,
  params: {
    threshold: { label: 'Threshold', defaultValue: -40, minValue: -80, maxValue: 0, step: 0.5, units: 'dB' },
    attack: { label: 'Attack', defaultValue: 1, minValue: 0.1, maxValue: 50, step: 0.1, units: 'ms' },
    hold: { label: 'Hold', defaultValue: 50, minValue: 0, maxValue: 500, step: 5, units: 'ms' },
    release: { label: 'Release', defaultValue: 120, minValue: 5, maxValue: 1000, step: 5, units: 'ms' },
    range: { label: 'Range', defaultValue: -80, minValue: -80, maxValue: 0, step: 1, units: 'dB' },
  },
  build(context, node) {
    const gate = new AudioWorkletNode(context, 'toneflix-gate', { outputChannelCount: [2] });

    node.connectInput(gate).connect(node.output);

    return { gate };
  },
  apply({ gate }, v, _transport, context) {
    for (const id of ['threshold', 'attack', 'hold', 'release', 'range']) gate.parameters.get(id).setValueAtTime(v[id], context.currentTime);
  },
});
