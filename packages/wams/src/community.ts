/** The version of the `wam-community` npm package the vetted plugins were tested at. */
export const COMMUNITY_WAMS_VERSION = '0.4.9';

/** The `plugins` folder of a version of the `wam-community` package on jsDelivr. */
export const communityWamsBase = (version = COMMUNITY_WAMS_VERSION) => `https://cdn.jsdelivr.net/npm/wam-community@${version}/dist/plugins/`;

/** A plugin from the Web Audio Modules community that passed the same tests as the curated ones. */
export interface CommunityWam {
  identifier: string;
  name: string;
  vendor: string;
  description: string;
  keywords: string[];
  /** Its module, relative to the community `plugins` folder */
  path: string;
  /** A picture of its editor, relative to the `plugins` folder */
  thumbnail: string;
  isInstrument: boolean;
  /** Its editor only answers the mouse; hosts pass touches on as mouse input */
  mouseOnly: boolean;
  license: string;
  homepage: string;
}

const burns = (plugin: Omit<CommunityWam, 'vendor' | 'license' | 'homepage' | 'mouseOnly' | 'thumbnail'>): CommunityWam => ({
  vendor: 'Sequencer Party',
  license: 'MIT',
  homepage: 'https://github.com/boourns/burns-audio-wam',
  mouseOnly: true,
  thumbnail: plugin.path.replace(/index\.js$/, 'screenshot.png'),
  ...plugin,
});

const wimmics = (plugin: Omit<CommunityWam, 'vendor' | 'license' | 'homepage' | 'mouseOnly' | 'thumbnail' | 'isInstrument'>): CommunityWam => ({
  vendor: 'Wimmics',
  license: 'Not stated',
  homepage: 'https://github.com/webaudiomodules/wam-community',
  mouseOnly: false,
  isInstrument: false,
  thumbnail: plugin.path.replace(/index\.js$/, 'screenshot.png'),
  ...plugin,
});

/**
 * Community plugins that loaded, sounded, kept their settings, exported as heard and
 * could be fully used with a mouse and by touch, at `COMMUNITY_WAMS_VERSION`.
 * They are loaded from the community's own files, not copied into this package.
 */
export const COMMUNITY_WAMS: readonly CommunityWam[] = [
  burns({
    identifier: 'com.sequencerParty.synth101',
    name: 'Synth-101',
    description: 'Monophonic analog-style synth with sub oscillator, filter and LFO',
    keywords: ['instrument', 'synth', 'mono', 'bass'],
    path: 'burns-audio/synth101/index.js',
    isInstrument: true,
  }),
  burns({
    identifier: 'com.sequencerParty.simpleDistortion',
    name: 'Simple Distortion',
    description: 'Overdrive with flavours and offset',
    keywords: ['effect', 'distortion', 'overdrive'],
    path: 'burns-audio/distortion/index.js',
    isInstrument: false,
  }),
  burns({
    identifier: 'com.sequencerParty.microverb',
    name: 'Microverb',
    description: 'Small reverb with a wet control',
    keywords: ['effect', 'reverb'],
    path: 'burns-audio/reverb/index.js',
    isInstrument: false,
  }),
  burns({
    identifier: 'com.sequencerParty.simpleDelay',
    name: 'Simple Delay',
    description: 'Delay with feedback, filters, stereo and ping-pong',
    keywords: ['effect', 'delay', 'echo'],
    path: 'burns-audio/delay/index.js',
    isInstrument: false,
  }),
  burns({
    identifier: 'com.sequencerParty.simpleEQ',
    name: 'Simple EQ',
    description: 'Three-band equalizer',
    keywords: ['effect', 'eq', 'filter'],
    path: 'burns-audio/simpleEQ/index.js',
    isInstrument: false,
  }),
  wimmics({
    identifier: 'com.wimmics.pingpongdelay',
    name: 'PingPongDelay',
    description: 'Stereo delay bouncing between left and right',
    keywords: ['effect', 'delay', 'stereo'],
    path: 'wimmics/pingpongdelay/dist/index.js',
  }),
  wimmics({
    identifier: 'com.wimmics.quadrafuzz',
    name: 'QuadraFuzz',
    description: 'Four-band fuzz',
    keywords: ['effect', 'distortion', 'fuzz'],
    path: 'wimmics/quadrafuzz/dist/index.js',
  }),
];
