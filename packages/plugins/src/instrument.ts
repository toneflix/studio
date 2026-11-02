import type { Instrument } from '@toneflix/studio-audio';
import type { WebAudioModule } from './types.ts';

const midi = (time: number, bytes: [number, number, number]) => ({ type: 'wam-midi', time, data: { bytes } });

/** A WAM instrument played by note events, so it can stand in for the built-in synth or drums. */
export class WamInstrument implements Instrument {
  readonly output: AudioNode;
  readonly plugin: WebAudioModule;
  /** Some WAM instruments make their sound on the main thread, so offline renders wait for them */
  readonly mainThread = true;

  constructor(plugin: WebAudioModule) {
    this.plugin = plugin;
    this.output = plugin.audioNode;
  }

  play(pitch: number, velocity: number, when: number, duration: number) {
    const level = Math.max(1, Math.round(velocity * 127));

    this.plugin.audioNode.scheduleEvents(midi(when, [0x90, pitch, level]), midi(when + Math.max(0.005, duration), [0x80, pitch, 0]));
  }

  noteOn(pitch: number, velocity: number) {
    this.plugin.audioNode.scheduleEvents(midi(this.plugin.audioContext.currentTime, [0x90, pitch, Math.max(1, Math.round(velocity * 127))]));
  }

  noteOff(pitch: number) {
    this.plugin.audioNode.scheduleEvents(midi(this.plugin.audioContext.currentTime, [0x80, pitch, 0]));
  }

  stopAll(when: number) {
    const node = this.plugin.audioNode;

    node.clearEvents();
    // All notes off, then all sound off
    node.scheduleEvents(midi(when, [0xb0, 123, 0]), midi(when, [0xb0, 120, 0]));
  }

  setState(state: unknown) {
    void this.plugin.audioNode.setState(state);
  }

  destroy() {
    this.plugin.audioNode.clearEvents();
    this.plugin.audioNode.disconnect();
    this.plugin.audioNode.destroy();
  }
}
