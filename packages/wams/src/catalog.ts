/** A reviewed plugin in this package, described like the WAM community list describes plugins. */
export interface CuratedWam {
  identifier: string;
  name: string;
  vendor: string;
  description: string;
  keywords: string[];
  /** Its module, relative to the package's `plugins` folder */
  path: string;
  /** A picture of its editor, relative to the `plugins` folder */
  thumbnail?: string;
  /** The plugin's own version */
  version: string;
  isInstrument: false;
  license: string;
  homepage: string;
}

/**
 * The reviewed plugins, all effects. Each one is a pinned copy whose licence lets
 * it be passed on; `THIRD_PARTY_NOTICES.md` lists where each came from.
 */
export const CURATED_WAMS: readonly CuratedWam[] = [
  {
    identifier: 'net.toneflix.studio.echo',
    name: 'Echo',
    vendor: 'Toneflix',
    description: 'Tempo-synced echo with feedback and tone',
    keywords: ['effect', 'delay', 'echo'],
    path: 'toneflix/echo.js',
    version: '1.0.0',
    isInstrument: false,
    license: 'MIT',
    homepage: 'https://github.com/toneflix/studio',
  },
  {
    identifier: 'net.toneflix.studio.drive',
    name: 'Drive',
    vendor: 'Toneflix',
    description: 'Warm saturation with tone and level',
    keywords: ['effect', 'distortion', 'saturation'],
    path: 'toneflix/drive.js',
    version: '1.0.0',
    isInstrument: false,
    license: 'MIT',
    homepage: 'https://github.com/toneflix/studio',
  },
  {
    identifier: 'com.sequencerParty.simpleDelay',
    name: 'Simple Delay',
    vendor: 'Sequencer Party',
    description: 'Simple stereo filtered delay',
    keywords: ['effect', 'delay'],
    path: 'sequencer-party/delay/index.js',
    thumbnail: 'sequencer-party/delay/screenshot.png',
    version: '1.0.0',
    isInstrument: false,
    license: 'MIT',
    homepage: 'https://github.com/boourns/burns-audio-wam',
  },
  {
    identifier: 'com.sequencerParty.simpleDistortion',
    name: 'Simple Distortion',
    vendor: 'Sequencer Party',
    description: 'Simple waveshaper-based distortion with variable curve and gain',
    keywords: ['effect', 'distortion'],
    path: 'sequencer-party/distortion/index.js',
    thumbnail: 'sequencer-party/distortion/screenshot.png',
    version: '1.0.0',
    isInstrument: false,
    license: 'MIT',
    homepage: 'https://github.com/boourns/burns-audio-wam',
  },
  {
    identifier: 'com.sequencerParty.simpleEQ',
    name: 'Simple EQ',
    vendor: 'Sequencer Party',
    description: 'Simple three-band equalizer',
    keywords: ['effect', 'eq'],
    path: 'sequencer-party/simple-eq/index.js',
    thumbnail: 'sequencer-party/simple-eq/screenshot.png',
    version: '1.0.0',
    isInstrument: false,
    license: 'MIT',
    homepage: 'https://github.com/boourns/burns-audio-wam',
  },
];
