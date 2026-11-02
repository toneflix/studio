/**
 * The npm package the vetted plugins load from, at the version they were tested at.
 * It is the Sequencer Party plugins' own package: the `wam-community` package holds the
 * same files but is over jsDelivr's 150 MB package limit, so jsDelivr does not serve it.
 */
export const COMMUNITY_WAMS_PACKAGE = 'burns-audio-wam@0.2.54';

/** The `plugins` folder of that package on jsDelivr. */
export const communityWamsBase = (pkg = COMMUNITY_WAMS_PACKAGE) => `https://cdn.jsdelivr.net/npm/${pkg}/dist/plugins/`;

/** A plugin from the Web Audio Modules community that passed the same tests as the curated ones. */
export interface CommunityWam {
  identifier: string;
  name: string;
  vendor: string;
  description: string;
  keywords: string[];
  /** Its module, relative to the package's `plugins` folder */
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

/**
 * Community plugins that loaded, sounded, kept their settings, exported as heard and
 * could be fully used with a mouse and by touch, at `COMMUNITY_WAMS_PACKAGE`.
 * They are loaded from the community's own files, not copied into this package.
 */
export const COMMUNITY_WAMS: readonly CommunityWam[] = [
  burns({
    identifier: 'com.sequencerParty.synth101',
    name: 'Synth-101',
    description: 'Monophonic analog-style synth with sub oscillator, filter and LFO',
    keywords: ['instrument', 'synth', 'mono', 'bass'],
    path: 'synth101/index.js',
    isInstrument: true,
  }),
  burns({
    identifier: 'com.sequencerParty.simpleDistortion',
    name: 'Simple Distortion',
    description: 'Overdrive with flavours and offset',
    keywords: ['effect', 'distortion', 'overdrive'],
    path: 'distortion/index.js',
    isInstrument: false,
  }),
  burns({
    identifier: 'com.sequencerParty.microverb',
    name: 'Microverb',
    description: 'Small reverb with a wet control',
    keywords: ['effect', 'reverb'],
    path: 'reverb/index.js',
    isInstrument: false,
  }),
  burns({
    identifier: 'com.sequencerParty.simpleDelay',
    name: 'Simple Delay',
    description: 'Delay with feedback, filters, stereo and ping-pong',
    keywords: ['effect', 'delay', 'echo'],
    path: 'delay/index.js',
    isInstrument: false,
  }),
  burns({
    identifier: 'com.sequencerParty.simpleEQ',
    name: 'Simple EQ',
    description: 'Three-band equalizer',
    keywords: ['effect', 'eq', 'filter'],
    path: 'simpleEQ/index.js',
    isInstrument: false,
  }),
];
