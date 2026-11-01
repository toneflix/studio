import { makePlugin } from './base.js';

/**
 * A port of KBVerb by Corey Kereliuk (MIT), a reverb in the style of Keith Barr's
 * allpass loop: chains of allpass pairs with prime lengths, fed back on themselves.
 */
const processor = `
const primes = [];

for (let n = 2; primes.length < 300; n++) if (primes.every((p) => p * p > n || n % p)) primes.push(n);

class Line {
  constructor(size) {
    this.data = new Float32Array(size);
    this.at = 0;
  }

  /** The sample written \`delay\` steps ago, then write \`value\`. */
  step(value, delay) {
    const size = this.data.length;
    const out = this.data[(this.at - delay + size) % size];

    this.data[this.at] = value;
    this.at = (this.at + 1) % size;

    return out;
  }
}

/** A Schroeder allpass of length n + 1 and gain g. */
class Allpass {
  constructor(n, g) {
    this.n = n + 1;
    this.g = g;
    this.line = new Line(this.n + 1);
    this.last = 0;
  }

  step(x) {
    const s = x - this.g * this.last;
    const out = this.last + this.g * s;

    this.last = this.line.step(s, this.n - 1);

    return out;
  }
}

/** Two allpasses, then a plain delay of three quarters of their lengths. */
class Section {
  constructor([n1, n2]) {
    this.a = new Allpass(n1, 0.7);
    this.b = new Allpass(n2, 0.7);
    this.length = Math.floor(0.75 * (n1 + n2));
    this.line = new Line(this.length + 1);
  }

  step(x) {
    return this.line.step(this.b.step(this.a.step(x)), this.length);
  }
}

/** One channel: the input feeds every section; the last one feeds back through its own section. */
class Tank {
  constructor(forward, back) {
    this.sections = forward.map((pair) => new Section(pair));
    this.back = new Section(back);
    this.fed = 0;
  }

  step(x, feedback) {
    let input = x + this.fed;
    let sum = 0;

    for (const section of this.sections) {
      const out = section.step(input);

      sum += out;
      input = out + x;
    }

    this.fed = this.back.step(input) * feedback;

    return sum;
  }
}

const pairs = (indices) => indices.map((i) => [primes[i], primes[i + 1]]);

class ToneflixKBVerb extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [{ name: 'feedback', defaultValue: 0.5, minValue: 0, maxValue: 1, automationRate: 'k-rate' }];
  }

  constructor() {
    super();
    this.left = new Tank(pairs([110, 120, 140, 180, 260]), [primes[100], primes[101]]);
    this.right = new Tank(pairs([111, 122, 144, 188]), [primes[97], primes[99]]);
    this.feedback = 0.5;
  }

  process([input], [output], parameters) {
    const target = parameters.feedback[0];
    const l = input[0];
    const r = input[1] ?? input[0];

    for (let i = 0; i < output[0].length; i++) {
      const inL = l ? l[i] : 0;
      const inR = r ? r[i] : 0;

      this.feedback = target + (this.feedback - target) * 0.99;
      // The original rotates the inputs a quarter turn before the tanks
      output[0][i] = this.left.step(-0.5 * inR, this.feedback);
      if (output[1]) output[1][i] = this.right.step(0.5 * inL, this.feedback);
    }

    return true;
  }
}

registerProcessor('toneflix-kbverb', ToneflixKBVerb);
`;

export default makePlugin({
  identifier: 'net.toneflix.studio.kbverb',
  name: 'KB Verb',
  worklet: processor,
  params: {
    feedback: { label: 'Feedback', defaultValue: 0.5, minValue: 0, maxValue: 0.98 },
    tone: { label: 'Tone', defaultValue: 9000, minValue: 1000, maxValue: 16000, step: 50, units: 'Hz' },
    mix: { label: 'Mix', defaultValue: 0.3, minValue: 0, maxValue: 1 },
  },
  build(context, node) {
    const verb = new AudioWorkletNode(context, 'toneflix-kbverb', { outputChannelCount: [2] });
    const tone = new BiquadFilterNode(context, { type: 'lowpass' });
    const wet = new GainNode(context);
    const dry = new GainNode(context);

    node.connectInput(dry).connect(node.output);
    node.connectInput(verb).connect(tone).connect(wet).connect(node.output);

    return { verb, tone, wet, dry };
  },
  apply({ verb, tone, wet, dry }, v, _transport, context) {
    const now = context.currentTime;

    verb.parameters.get('feedback').setValueAtTime(v.feedback, now);
    tone.frequency.setTargetAtTime(v.tone, now, 0.02);
    // The tanks sum several sections, so the wet path is scaled down
    wet.gain.setTargetAtTime(v.mix * 0.25, now, 0.02);
    dry.gain.setTargetAtTime(1 - v.mix * 0.5, now, 0.02);
  },
});
