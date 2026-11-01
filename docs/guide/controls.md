# Toolbar and track controls

`@toneflix/studio-controls` has ready-made controls drawn with [Lucide](https://lucide.dev) icons: a toolbar for playback and editing with a transport display and output meter, and track headers with mute, solo, volume and a level meter. The icons are built in, so there's nothing extra to install, and you can replace any of them.

## Toolbar

```ts
import { AudioEngine, StudioTimeline, StudioToolbar, linkPlayback } from '@toneflix/studio';

const engine = new AudioEngine();
const timeline = new StudioTimeline('#editor');

new StudioToolbar('#toolbar', { timeline, engine });
linkPlayback(timeline, engine);
```

The default toolbar has play, stop, loop and metronome, the transport display, split, duplicate, delete, undo, redo, zoom, fit, snap, export, the output meter and info. Undo, redo, duplicate and delete are disabled when there's nothing to do. Play turns into pause while playing.

Pick the buttons and their order with `items`. `'|'` adds a divider:

```ts
new StudioToolbar('#toolbar', {
  timeline,
  engine,
  items: ['play', 'stop', '|', 'split', 'undo', 'redo'],
});
```

Without an `engine`, the playback buttons and the meter are left out.

### Transport display

The `display` item shows where the playhead is in bars, beats and sixteenths (`3.2.1`) and in minutes and seconds, with the tempo and time signature beside them. Type a new tempo or pick a time signature there to change the timeline's grid and the metronome together.

### Session info

The `info` item opens a dialog with the number of tracks, clips and selected clips, the playhead, the length, the tempo and the time signature. It stays up to date while open. Add your own rows, or replace them, with `info`:

```ts
new StudioToolbar('#toolbar', {
  timeline,
  engine,
  info: (rows) => [...rows, ['Project', song.title]],
});
```

Open it from your own UI with `toolbar.showInfo()`.

### Output meter

The `meter` item shows the master output level for the left and right sides, from -60 dB to 0 dB. It only does work while something plays.

Each button's name is its tooltip and is read by screen readers. Change them with `labels`, for example to translate them:

```ts
new StudioToolbar('#toolbar', { timeline, engine, labels: { play: 'Lecture', pause: 'Pause' } });
```

Loop repeats the selected range, or four bars from the playhead when nothing is selected. Export mixes the timeline and downloads it as `mix.wav`. Set `exportName` to change the file name.

## Your own buttons

Add buttons with `actions`. Each one names the item it goes `before` or `after`, or goes at the end. You can also put its `id` in `items`:

```ts
const toolbar = new StudioToolbar('#toolbar', {
  timeline,
  engine,
  actions: [
    {
      id: 'share',
      label: 'Share',
      icon: '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>',
      after: 'export',
      onClick: ({ timeline }) => share(timeline.state),
    },
  ],
});

const remove = toolbar.addAction({ id: 'publish', label: 'Publish', icon: publishSvg, before: 'info', onClick: publish });
```

`onClick` gets the timeline, the engine, the toolbar, `mix()` (the mix as a WAV `Blob`) and `download()`. While a returned promise runs, the button is disabled so it can't start twice. Give an action `pressed` or `disabled` functions to show its state; they're read whenever the toolbar refreshes.

## Saving

Pass `onSave` to turn the export button into Save. It's called instead of downloading, for example to upload the mix or store the project, and the button waits until it finishes:

```ts
new StudioToolbar('#toolbar', {
  timeline,
  engine,
  onSave: async ({ timeline, mix }) => {
    await api.saveProject(timeline.state);
    await api.uploadMix(await mix());
  },
});
```

The save button shows even without an engine; `mix()` needs one.

## Track strips

`trackStrip` fills each track header with a tab in the track's colour, its name, M (mute) and S (solo) buttons, a volume slider and a level meter. Double-click the slider to set it back to full volume. Set `meter: false` to leave the meter out.

Drag the bottom edge of a track to make it taller or shorter, and double-click the edge to give it the default height again. Short tracks hide the volume slider.

```ts
const timeline = new StudioTimeline('#editor', {
  headerWidth: 180,
  renderHeader: trackStrip(engine),
});
```

## Mixer

`StudioMixer` is a mixing desk view: a channel strip for each track with a pan knob, M and S, a fader with a dB scale and readout, a level meter and the track's name in its colour. A master strip sits at the end. Strips follow the timeline as tracks are added, renamed or moved, and stay in step with the track headers.

```ts
import { StudioMixer } from '@toneflix/studio';

const mixer = new StudioMixer('#mixer', { timeline, engine, hidden: true });

new StudioToolbar('#toolbar', { timeline, engine, mixer });
```

Given a `mixer`, the toolbar gets a mixer button that shows and hides it. You can also call `mixer.show()`, `hide()` and `toggle()`, and listen for `toggle`.

| Control | |
| --- | --- |
| Fader | Drag, click or use the arrow keys. Double-click for 0 dB. The top is +6 dB; set `maxVolume` to change it |
| Pan knob | Drag up or down, or use the arrow keys. Double-click to centre it |

Set `--tfs-mixer-height` (320px) to size it, and `--tfs-channel-width` (84px) for the strips.

## Custom icons

Pass `icons` to swap individual icons. An icon can be SVG markup, either a whole `<svg>` or only the shapes drawn in a 24×24 box, or a function that returns an element:

```ts
new StudioToolbar('#toolbar', {
  timeline,
  engine,
  icons: {
    play: '<svg viewBox="0 0 16 16"><path d="M4 2l10 6-10 6z" fill="currentColor"/></svg>',
    loop: () => {
      const icon = document.createElement('i');
      icon.className = 'fa-solid fa-repeat';
      return icon;
    },
  },
});

trackStrip(engine, { icons: { mute: myMuteIcon } });
```

To change icons everywhere at once, call `setDefaultIcons` before making any controls:

```ts
import { setDefaultIcons } from '@toneflix/studio';

setDefaultIcons({ play: playSvg, pause: pauseSvg, stop: stopSvg });
```

Mute and solo show the letters M and S unless you give them icons.

Icon names: `play`, `pause`, `stop`, `loop`, `metronome`, `split`, `duplicate`, `delete`, `undo`, `redo`, `zoomIn`, `zoomOut`, `fit`, `snap`, `export`, `mute`, `solo`, `info`, `save`, `close` and `mixer`. Icons use `currentColor`, so they take the button's text colour. Play, pause and stop are solid shapes; the rest are outlines.

## Styling

Set these CSS variables on the toolbar or any parent of it:

| Variable | Default | |
| --- | --- | --- |
| `--tfs-toolbar-bg` | `#18181b` | Toolbar background |
| `--tfs-toolbar-text` | `#e8e8ea` | Icon colour |
| `--tfs-toolbar-hover` | `rgba(255,255,255,.08)` | Button hover |
| `--tfs-toolbar-line` | `rgba(255,255,255,.1)` | Dividers |
| `--tfs-toolbar-active` | `#03bfff` | Play, and buttons that are on |
| `--tfs-toolbar-active-text` | `#03141c` | Icons on the active colour |
| `--tfs-toolbar-size` | `32px` | Button size |
| `--tfs-mute` / `--tfs-solo` | `#f5b53d` / `#03bfff` | Mute and solo when on |
| `--tfs-meter-off` | `rgba(255,255,255,.07)` | Unlit part of the meters |
| `--tfs-display-bg` | `#0b0d10` | Transport display background |
| `--tfs-display-text` / `--tfs-display-muted` | `#e8e8ea` / `#7d8590` | Display numbers and captions |

Buttons have the class `tfs-tool` and a `data-tool` attribute with their name, for more specific styling.
