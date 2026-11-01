# @toneflix/studio-plugins

Plugins for [Toneflix Studio](https://toneflix.github.io/studio/). Host [Web Audio Modules](https://www.webaudiomodules.com) (WAM 2) effects on any track or the master: heard live through the mixer, with their own editors, saved with the project and included in the mixdown.

```sh
pnpm add @toneflix/studio-plugins
```

```ts
import { AudioEngine } from '@toneflix/studio-audio';
import { PluginRack } from '@toneflix/studio-plugins';

const engine = new AudioEngine();
const plugins = new PluginRack(engine);

const echo = await plugins.add('vocals', 'https://example.com/plugins/echo/index.js');
document.body.append(await plugins.openEditor(echo));

const saved = await plugins.snapshot();
const mix = await engine.render({ effects: plugins.renderEffects });
```

It is one part of Toneflix Studio. Install [`@toneflix/studio`](https://www.npmjs.com/package/@toneflix/studio) to get every part from one import, with insert slots in the mixer view. See [Plugins](https://toneflix.github.io/studio/guide/plugins) for the full guide.

MIT License.
