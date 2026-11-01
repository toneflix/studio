/** Name the capture processor is registered under. */
export const CAPTURE_PROCESSOR = 'tfs-capture';

/**
 * Audio worklet that copies its input to the main thread in chunks of `size`
 * frames, each tagged with the context frame of its first sample. A `flush`
 * message sends what is left, then `{ done: true }`.
 */
const source = (name: string) => `
class Capture extends AudioWorkletProcessor {
  constructor(options) {
    super();
    this.size = options.processorOptions?.size ?? 4096;
    this.buffer = null;
    this.filled = 0;
    this.frame = 0;
    this.port.onmessage = (e) => {
      if (e.data !== 'flush') return;
      this.send();
      this.port.postMessage({ done: true });
    };
  }

  send() {
    if (!this.buffer || !this.filled) return;
    const channels = this.buffer.map((c) => c.slice(0, this.filled));
    this.port.postMessage({ frame: this.frame, channels }, channels.map((c) => c.buffer));
    this.buffer = null;
    this.filled = 0;
  }

  process(inputs) {
    const input = inputs[0];
    if (!input || !input.length) return true;
    if (!this.buffer) {
      this.buffer = input.map(() => new Float32Array(this.size));
      this.frame = currentFrame;
    }
    for (let c = 0; c < this.buffer.length; c++) this.buffer[c].set(input[c] ?? input[0], this.filled);
    this.filled += input[0].length;
    if (this.filled + input[0].length > this.size) this.send();
    return true;
  }
}
registerProcessor('${name}', Capture);
`;

const loaded = new WeakMap<BaseAudioContext, Promise<void>>();

/** Load the capture processor into a context once. */
export const loadCapture = (context: BaseAudioContext) => {
  let ready = loaded.get(context);

  if (!ready) {
    const url = URL.createObjectURL(new Blob([source(CAPTURE_PROCESSOR)], { type: 'text/javascript' }));

    ready = context.audioWorklet.addModule(url).finally(() => URL.revokeObjectURL(url));
    loaded.set(context, ready);
  }

  return ready;
};
