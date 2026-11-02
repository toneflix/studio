# Plugins

From `@toneflix/studio-plugins`, also in `@toneflix/studio`. See the [Plugins guide](/guide/plugins).

## PluginRack

| | |
| --- | --- |
| `new PluginRack(engine, options?)` | `load(url)` to load a module (default `import()`), `host(context)` to set a context up (default `initializeWamHost`), `mouseOnly(url)` for plugins whose editors only answer the mouse |
| `rack.add(track \| null, url, { index?, state?, bypass? })` | Load a plugin and insert it; resolves to its `PluginSlot` |
| `rack.remove(track, id)` / `move(track, id, index)` / `setBypass(track, id, bypass)` / `clear(track)` | |
| `rack.slots(track)` | The chain, first first: `{ id, url, name, vendor, bypass, plugin }` |
| `rack.chainIds` | Chains with plugins; null is the master |
| `rack.snapshot()` / `restore(snapshot)` | `{ master: SavedPlugin[], tracks: Record<string, SavedPlugin[]> }`, each `{ url, bypass, state }` |
| `rack.renderEffects` | Pass as `engine.render({ effects })`. Each plugin's settings are set again once the render runs, since many WAMs ignore the state they are made with in an offline context |
| `rack.openEditor(slot)` / `closeEditor(slot, element)` | The plugin's own editor, taking touch as mouse input when `mouseOnly` says so |
| `touchAsMouse(element)` | Pass one finger on an element on as mouse down, moves, up and click; returns a function that stops it |
| `rack.syncTransport()` | Send tempo, time signature, bar and play state to the plugins |
| `rack.destroy()` | |

Events: `change { track }`, `error { track, url, error }`.

## Helpers

| | |
| --- | --- |
| `initializeWamHost(context)` | Sets a context up to host WAM plugins once; resolves to `[groupId, groupKey]` |
| `openPluginEditor(document, rack, slot, options?)` | From `@toneflix/studio-controls`. The plugin window the mixer opens; returns `{ close }` |
| `createInserts(document, rack, track, options?)` | From `@toneflix/studio-controls`. A strip's insert slots: `catalog`, `pick`, `labels`, `icons`, `container` (editors and the add menu stay inside it); returns `{ element, stop }` |
| `WebAudioModule`, `WamNode`, `WamConstructor`, `WamParameterInfo`, `WamTransportData` | Types for the parts of the WAM 2 API the studio uses |
