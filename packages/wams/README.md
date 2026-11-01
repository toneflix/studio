# @toneflix/studio-wams

Reviewed Web Audio Module (WAM 2) effects for [Toneflix Studio](https://toneflix.github.io/studio/), served from jsDelivr.

A plugin runs as code in your page, so this package only holds plugins that were read through, whose licences allow passing them on, and that are pinned: the module URLs point at this package's exact version on jsDelivr, so the code can't change under you.

| Plugin | Vendor | Licence |
| --- | --- | --- |
| Echo | Toneflix | MIT |
| Drive | Toneflix | MIT |
| Reverb | Toneflix | MIT |
| Compressor | Toneflix | MIT |
| Limiter | Toneflix | MIT |
| Gate | Toneflix | MIT |
| EQ | Toneflix | MIT |
| Chorus | Toneflix | MIT |
| Phaser | Toneflix | MIT |
| KB Verb | Toneflix, a port of KBVerb by Corey Kereliuk | MIT |
| Stone Phaser | Toneflix, a port of Stone Phaser by Jean Pierre Cimalando | MIT (original CC0-1.0) |
| Simple Delay | Sequencer Party (Tom Burns) | MIT |
| Simple Distortion | Sequencer Party (Tom Burns) | MIT |
| Simple EQ | Sequencer Party (Tom Burns) | MIT |

```sh
pnpm add @toneflix/studio-wams
```

```ts
import { curatedWams, curatedWamSource } from '@toneflix/studio-wams';

// A Plugins tab in the browser, and the mixer's add menu
new StudioBrowser('#editor', { timeline, engine, plugins, sources: [curatedWamSource()] });
new StudioMixer('#editor', { timeline, engine, plugins, catalog: curatedWams() });
```

Pass `base` to serve the `plugins` folder yourself, for example from your own storage under a strict Content Security Policy, and `allow` to offer only some of them. `plugins/plugins.json` lists them in the WAM community list's shape, for `wamCommunitySource({ url, base })` (with `base` set to the `plugins` folder) or other hosts.

See `THIRD_PARTY_NOTICES.md` for where each plugin came from. It is one part of Toneflix Studio. Install [`@toneflix/studio`](https://www.npmjs.com/package/@toneflix/studio) to get every part from one import.

MIT License.
