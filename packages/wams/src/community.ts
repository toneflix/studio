/**
 * Where the vetted plugins load from, by package, pinned to the versions they were
 * tested at. The Sequencer Party plugins come from their own package on jsDelivr. The
 * Wimmics ones are only in `wam-community`, which is over jsDelivr's 150 MB package
 * limit, so they come from unpkg.
 */
export const COMMUNITY_WAM_PACKAGES = {
  'burns-audio-wam': 'https://cdn.jsdelivr.net/npm/burns-audio-wam@0.2.54/dist/plugins/',
  'wam-community': 'https://unpkg.com/wam-community@0.4.9/dist/plugins/',
} as const;

export type CommunityWamPackage = keyof typeof COMMUNITY_WAM_PACKAGES;

/** A plugin from the Web Audio Modules community that passed the same tests as the curated ones. */
export interface CommunityWam {
  identifier: string;
  name: string;
  vendor: string;
  description: string;
  keywords: string[];
  /** The package it loads from */
  package: CommunityWamPackage;
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

const burns = (plugin: Omit<CommunityWam, 'vendor' | 'license' | 'homepage' | 'mouseOnly' | 'thumbnail' | 'package'>): CommunityWam => ({
  package: 'burns-audio-wam',
  vendor: 'Sequencer Party',
  license: 'MIT',
  homepage: 'https://github.com/boourns/burns-audio-wam',
  mouseOnly: true,
  thumbnail: plugin.path.replace(/index\.js$/, 'screenshot.png'),
  ...plugin,
});

const wimmics = (plugin: Omit<CommunityWam, 'vendor' | 'license' | 'homepage' | 'mouseOnly' | 'package' | 'isInstrument'>): CommunityWam => ({
  package: 'wam-community',
  vendor: 'Wimmics',
  license: 'Not stated',
  homepage: 'https://github.com/webaudiomodules/wam-community',
  mouseOnly: false,
  isInstrument: false,
  ...plugin,
});

/**
 * An import map for the page, needed by the Wimmics plugins: `wam-community` 0.4.9
 * imports two files from a folder they are not in, and the map points those imports
 * at where the files are. Put it in a `<script type="importmap">` before any module
 * script, since browsers only read an import map before modules load.
 */
export const communityWamsImportMap = (base: string = COMMUNITY_WAM_PACKAGES['wam-community']) => ({
  imports: { [`${base}wimmics/utils/sdk-parammgr/src/sdk/`]: `${base}wimmics/utils/sdk/` },
});

/**
 * Community plugins that loaded, sounded, kept their settings, exported as heard and
 * could be fully used with a mouse and by touch, at the versions in `COMMUNITY_WAM_PACKAGES`.
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
  wimmics({
    identifier: 'com.wimmics.bigmuff',
    name: 'Big Muff',
    description: 'Fuzz modelled on the Big Muff pedal',
    keywords: ['effect', 'distortion', 'fuzz'],
    path: 'wimmics/BigMuff/index.js',
    thumbnail: 'wimmics/BigMuff/screenshot.png',
  }),
  wimmics({
    identifier: 'com.wimmics.blipper',
    name: 'Blipper',
    description: 'Envelope follower that plays a pitched blip with the input',
    keywords: ['effect', 'modulation', 'synth'],
    path: 'wimmics/blipper/index.js',
    thumbnail: 'wimmics/blipper/default.png',
  }),
  wimmics({
    identifier: 'com.wimmics.dualpitchshifter',
    name: 'DualPitchShifter',
    description: 'Two-channel pitch shifter',
    keywords: ['effect', 'pitch'],
    path: 'wimmics/DualPitchShifter/index.js',
    thumbnail: 'wimmics/DualPitchShifter/default.png',
  }),
  wimmics({
    identifier: 'com.wimmics.owldirty',
    name: 'OwlDirty',
    description: 'Ambient stereo reverb with distortion on its tail',
    keywords: ['effect', 'reverb', 'distortion'],
    path: 'wimmics/OwlDirty/index.js',
    thumbnail: 'wimmics/OwlDirty/default.png',
  }),
  wimmics({
    identifier: 'com.wimmics.owlshimmer',
    name: 'OWLShimmer',
    description: 'Ambient stereo reverb with shimmer',
    keywords: ['effect', 'reverb', 'shimmer'],
    path: 'wimmics/OwlShimmer/index.js',
    thumbnail: 'wimmics/OwlShimmer/default.png',
  }),
  wimmics({
    identifier: 'com.wimmics.pingpongdelay',
    name: 'PingPongDelay',
    description: 'Stereo delay bouncing between left and right',
    keywords: ['effect', 'delay', 'stereo'],
    path: 'wimmics/pingpongdelay/dist/index.js',
    thumbnail: 'wimmics/pingpongdelay/dist/screenshot.png',
  }),
  wimmics({
    identifier: 'com.wimmics.quadrafuzz',
    name: 'QuadraFuzz',
    description: 'Four-band fuzz',
    keywords: ['effect', 'distortion', 'fuzz'],
    path: 'wimmics/quadrafuzz/dist/index.js',
    thumbnail: 'wimmics/quadrafuzz/dist/screenshot.png',
  }),
  wimmics({
    identifier: 'com.wimmics.smoothdelay',
    name: 'SmoothDelay',
    description: 'Delay that changes time without clicks or pitch jumps',
    keywords: ['effect', 'delay'],
    path: 'wimmics/SmoothDelay/index.js',
    thumbnail: 'wimmics/SmoothDelay/default.png',
  }),
  wimmics({
    identifier: 'com.wimmics.stereofreqshifter',
    name: 'StereoFreqShifter',
    description: 'Twin frequency shifter for left and right',
    keywords: ['effect', 'pitch', 'stereo'],
    path: 'wimmics/StereoFreqShifter/index.js',
    thumbnail: 'wimmics/StereoFreqShifter/default.png',
  }),
  wimmics({
    identifier: 'com.wimmics.sweetwah',
    name: 'SweetWah',
    description: 'Auto-wah with modulation',
    keywords: ['effect', 'filter', 'wah'],
    path: 'wimmics/sweetWah/index.js',
    thumbnail: 'wimmics/sweetWah/screenshot.png',
  }),
  wimmics({
    identifier: 'com.wimmics.thruzeroflanger',
    name: 'ThruZeroFlanger',
    description: 'Thru-zero flanger modelling a pair of tape delays',
    keywords: ['effect', 'flanger', 'modulation'],
    path: 'wimmics/ThruZeroFlanger/index.js',
    thumbnail: 'wimmics/ThruZeroFlanger/default.png',
  }),
  wimmics({
    identifier: 'com.wimmics.weirdphaser',
    name: 'WeirdPhaser',
    description: 'Stereo phaser built on single-sideband shifting',
    keywords: ['effect', 'phaser', 'modulation'],
    path: 'wimmics/WeirdPhaser/index.js',
    thumbnail: 'wimmics/WeirdPhaser/default.png',
  }),
];
