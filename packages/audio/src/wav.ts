/** The channels and rate of rendered audio; an AudioBuffer fits. */
export interface PcmAudio {
  sampleRate: number;
  numberOfChannels: number;
  length: number;
  getChannelData(channel: number): Float32Array;
}

/** Encode audio as a 16-bit or 24-bit PCM WAV file. */
export const encodeWav = (audio: PcmAudio, bitDepth: 16 | 24 = 16): ArrayBuffer => {
  const bytes = bitDepth / 8;
  const channels = audio.numberOfChannels;
  const dataSize = audio.length * channels * bytes;
  const view = new DataView(new ArrayBuffer(44 + dataSize));
  const text = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i++) view.setUint8(offset + i, value.charCodeAt(i));
  };

  text(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  text(8, 'WAVE');
  text(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, audio.sampleRate, true);
  view.setUint32(28, audio.sampleRate * channels * bytes, true);
  view.setUint16(32, channels * bytes, true);
  view.setUint16(34, bitDepth, true);
  text(36, 'data');
  view.setUint32(40, dataSize, true);

  const data = Array.from({ length: channels }, (_, c) => audio.getChannelData(c));
  const max = 2 ** (bitDepth - 1) - 1;
  let offset = 44;

  for (let i = 0; i < audio.length; i++) {
    for (let c = 0; c < channels; c++) {
      const value = Math.round(Math.max(-1, Math.min(1, data[c]![i]!)) * max);

      if (bitDepth === 16) view.setInt16(offset, value, true);
      else {
        view.setUint8(offset, value & 0xff);
        view.setUint8(offset + 1, (value >> 8) & 0xff);
        view.setUint8(offset + 2, (value >> 16) & 0xff);
      }

      offset += bytes;
    }
  }

  return view.buffer;
};
