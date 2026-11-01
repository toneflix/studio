# Browser and library

`StudioBrowser` is a drawer of sounds and plugins. Each tab is a source: sounds in the session, files from the device, a plugin list, or your app's own library and search. People listen to a sound, then drag it onto a track or add it from its menu. Plugins go on a track or the master.

<StudioPlayground />

```ts
import { filesSource, listSource, pluginSource, sessionSource, StudioBrowser, StudioToolbar } from '@toneflix/studio';

const browser = new StudioBrowser('#editor', {
  timeline,
  engine,
  plugins,
  hidden: true,
  // Draw the waveform of each sound as it is added
  onSource: (id, buffer) => void waveforms.get(id, () => buffer).then((peaks) => timeline.setSource({ id }, peaks)),
  sources: [sessionSource(timeline, engine), filesSource(document), pluginSource(catalog)],
});

new StudioToolbar('#toolbar', { timeline, engine, browser });
```

It slides in over the left of the element you give it. With `docked: true` it sits first in that element instead, in the page flow, so a row like `<main style="display: flex">` puts it beside the timeline. Given a `browser`, the toolbar gets a library button that shows and hides it.

| Gesture | What it does |
| --- | --- |
| Play button on a sound | Listen to it; click again to stop |
| Drag a sound onto a lane | Puts it there at the drop point, on the grid. Below the last track it gets a new track |
| **+** on a sound | Adds it at the playhead on a new track or a track you pick |
| Drag a plugin onto a lane, or **+** on it | Adds it to that track's chain, or the master's from the menu |

Each addition is one undo step. Plugin items need `plugins`, a `PluginRack`.

## Built-in sources

| Source | What it lists |
| --- | --- |
| `sessionSource(timeline, engine)` | Loaded: the sounds the session's clips use, to place them again |
| `filesSource(document)` | Audio files people import from their device; they stay in the page and nothing is uploaded |
| `pluginSource(catalog)` | Plugins from a list of `{ name, url }`, like the mixer's `catalog` |
| `listSource(id, label, items)` | Any fixed list, or a function that gives one; search and paging happen in the browser |
| `wamCommunitySource({ allow })` | The Web Audio Modules community list, filtered by `allow` (see below) |

## Your own sources

A source is an id, a label and a `list` function. The browser calls it with the search text, a page number from 1 and an `AbortSignal` that fires when the search changes, and shows the items it returns. Return `more: true` to show a Load more button.

```ts
const freesound: LibrarySource = {
  id: 'freesound',
  label: 'Freesound',
  list: async ({ search, page, signal }) => {
    const response = await fetch(`/api/sounds?search=${encodeURIComponent(search)}&page=${page}`, { signal });
    const body = await response.json();

    return {
      items: body.data.map((sound) => ({
        id: String(sound.id),
        name: sound.name,
        kind: 'audio',
        detail: sound.author,
        duration: sound.duration,
        preview: sound.previewUrl,
        url: sound.fileUrl,
      })),
      more: body.meta.currentPage < body.meta.lastPage,
    };
  },
};

browser.setSources([freesound, sessionSource(timeline, engine), filesSource(document)]);
```

An audio item gives its file as `url`, or a `load(signal)` that resolves to a `Blob`, an `ArrayBuffer` or a decoded `AudioBuffer`, for files behind your own auth. `preview` is a lighter file to listen to. A plugin item's `url` is its Web Audio Module. `data` carries anything you want back in the `add` event:

```ts
browser.on('add', ({ item, source, track, clip }) => analytics.track('sound-added', { id: item.id, source: source.id }));
browser.on('error', ({ item, error }) => toast(`Could not add ${item?.name}: ${error}`));
```

A source with an `action`, like the files source's Import files button, gets a button above its list; the list reloads after it runs.

## Community plugins and security

`wamCommunitySource` lists plugins from the [Web Audio Modules community](https://www.webaudiomodules.com/community/plugins.json), or from a list in the same shape at `url`. The browser never fetches it unless you add the source, and it shows only the plugins `allow` accepts.

A Web Audio Module is JavaScript that runs in your page, with your page's rights. A plugin you load can read cookies and storage that scripts can reach, call your API as the signed-in user and change the page. A plugin list that changes, or a plugin file that is replaced, changes what runs. So:

- **Offer only plugins you trust.** For a signed-in app, review plugins, host pinned copies on your own storage, and point `url` at your own list of them.
- **Limit where scripts can come from** with a Content Security Policy `script-src`, so only your plugin host can serve plugin code.
- **Keep sign-in tokens out of reach of scripts**, in HttpOnly cookies.

A plugin can't run in a sandboxed frame on another origin and still process the session's audio, since Web Audio nodes can't cross frames. A page with nothing to protect, like this documentation, can allow every plugin.

## Labels and styling

Pass `labels` to translate the text, and set `--tfs-browser-width` (300px) to size it. The browser uses the toolbar's and mixer's colour variables.
