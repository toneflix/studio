# Plugins

`PluginRack` hosts [Web Audio Modules](https://www.webaudiomodules.com) (WAM 2) plugins: effects made for the web, the browser's answer to VST and Audio Units. Put them on any track or on the master. They play live through the mixer, open their own editors, follow the tempo, are saved with the project and are part of an exported mix. It comes in `@toneflix/studio-plugins` and in `@toneflix/studio`.

## Add plugins to the mixer

```ts
import { AudioEngine, PluginRack, StudioMixer, StudioToolbar } from '@toneflix/studio';

const engine = new AudioEngine();
const plugins = new PluginRack(engine);

const mixer = new StudioMixer('#editor', {
  timeline,
  engine,
  plugins,
  catalog: [
    { name: 'Echo', url: 'https://example.com/plugins/echo/index.js' },
    { name: 'Reverb', url: 'https://example.com/plugins/reverb/index.js' },
  ],
});

new StudioToolbar('#toolbar', { timeline, engine, mixer, plugins });
```

Each mixer strip then has insert slots above the pan knob:

- **+** opens a menu with the `catalog`. Picking one loads the plugin, puts it at the end of the chain and opens its editor. Pass `pickPlugin(track)` instead to show your own browser of plugins.
- The dot turns a plugin on or off (bypass). A bypassed plugin lets the sound pass untouched.
- The name opens the plugin's editor in a window you can drag. Clicking it again brings the window forward.
- **×** removes the plugin.

Sound goes through the plugins from top to bottom, before the fader and pan. With `plugins`, the toolbar's export includes every plugin that is on.

Try it in the [playground](/playground): open the mixer and add the demo Echo or Drive.

## Without the mixer view

```ts
const echo = await plugins.add('vocals', url); // at the end of the vocals chain
await plugins.add(null, url, { index: 0 }); // first on the master
plugins.setBypass('vocals', echo.id, true);
plugins.move('vocals', echo.id, 0);
plugins.remove('vocals', echo.id);
plugins.slots('vocals'); // [{ id, url, name, vendor, bypass, plugin }]

const editor = await plugins.openEditor(echo); // an element to put on the page
plugins.closeEditor(echo, editor);
```

`echo.plugin` is the WAM itself, for parameters: `echo.plugin.audioNode.getParameterInfo()` and `setParameterValues()`. `openPluginEditor(document, plugins, slot)` opens the same window the mixer uses. `change` fires when a chain changes, and `error` when a plugin fails to load.

Browsers start audio only after the user interacts with the page, so add the first plugin from a click.

## Save and load

```ts
project.plugins = await plugins.snapshot(); // { master: [...], tracks: { vocals: [...] } }
await plugins.restore(project.plugins);
```

Each saved plugin keeps its URL, whether it is bypassed, and its own settings. Store `engine.mixer.snapshot()` beside it for the faders. A plugin that fails to load on restore is left out and reported as `error`.

## Mixdown

Plugins can't move between audio contexts, so a render makes each chain again in the render's context with the same settings:

```ts
const mix = await engine.render({ effects: plugins.renderEffects });
```

## Tempo

Plugins get WAM transport events with the tempo, time signature, bar and whether playback runs, on play, pause and seek. Tempo-synced effects like delays follow the session. After changing the tempo, call `plugins.syncTransport()`.

## Finding plugins

Any WAM 2 plugin works: a JavaScript module whose default export has `createInstance()`. The [WAM community](https://www.webaudiomodules.com/community) lists open source ones, and [Faust](https://faust.grame.fr) can compile its effects to WAM. Plugins are loaded with `import()`, so their server must allow your site with CORS. Pass `load` to `PluginRack` to load them another way, for example from your own bundle.

## Curated plugins

`@toneflix/studio-wams` holds reviewed effects whose licences allow passing them on: Toneflix's Echo, Drive, Reverb, Compressor, Limiter, Gate, EQ, Chorus and Phaser, and ports of KBVerb and Stone Phaser. Each one is tested to work fully: its editor with a mouse and touch, every parameter, saved settings, live playback and export. They load from jsDelivr, pinned to the package's version, so the code you reviewed is the code that runs.

```ts
import { curatedWams, curatedWamSource } from '@toneflix/studio';

new StudioMixer('#editor', { timeline, engine, plugins, catalog: curatedWams() });
new StudioBrowser('#editor', { timeline, engine, plugins, sources: [curatedWamSource()] });
```

Pass `base` to serve the package's `plugins` folder from your own storage instead, and `allow` to offer only some. `plugins/plugins.json` lists them in the WAM community list's shape.

The Toneflix plugins are in the package's `plugins/toneflix` folder, built on one small `base.js`. They are short, so they're a good starting point for writing your own; Gate shows how to add an AudioWorklet processor. It loads that processor from a `blob:` URL, so a Content Security Policy that offers Gate needs `blob:` in `script-src`.

## Vetted community plugins

`COMMUNITY_WAMS` lists plugins from the [WAM community](https://www.webaudiomodules.com/community) that passed the same tests as the curated ones: the Sequencer Party Synth-101 instrument, and Simple Distortion, Microverb, Simple Delay and Simple EQ. They load from their own package, `burns-audio-wam` 0.2.54, on jsDelivr, pinned to the tested version, and are not copied into ours. (The `wam-community` package holds the same files but is too large for jsDelivr to serve.)

```ts
import { communityWamInstruments, communityWams, communityWamSource, curatedWams, DEFAULT_INSTRUMENT_OPTIONS, isMouseOnlyWam } from '@toneflix/studio';

const plugins = new PluginRack(engine, { mouseOnly: (url) => isMouseOnlyWam(url) });
const catalog = [...curatedWams(), ...communityWams({ allow: (plugin) => !plugin.isInstrument })];

new StudioMixer('#editor', { timeline, engine, plugins, catalog });
new StudioBrowser('#editor', { timeline, engine, plugins, sources: [curatedWamSource(), communityWamSource()] });
new StudioInstrumentPanel({ timeline, engine, instruments: [...DEFAULT_INSTRUMENT_OPTIONS, ...communityWamInstruments()] });
```

Their editors only answer the mouse. `mouseOnly` tells the rack which ones, and their editors then take one finger as mouse input, so they work on phones too. Editors wider than the screen are shrunk to fit.

Of the 28 plugins tested, the others were left out: the Wimmics plugins are only published in `wam-community`, which jsDelivr does not serve, and most of them also import two files from the wrong folder; several are GPL. Envelope Follower, DRM-16, Soundfont Player and Big Muff stay silent or fail.
