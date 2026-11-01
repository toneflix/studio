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

The default toolbar has play, stop, loop and metronome, the transport display, split, duplicate, delete, undo, redo, zoom, fit, snap, export and the output meter. Undo, redo, duplicate and delete are disabled when there's nothing to do. Play turns into pause while playing.

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

### Output meter

The `meter` item shows the master output level for the left and right sides, from -60 dB to 0 dB. It only does work while something plays.

Each button's name is its tooltip and is read by screen readers. Change them with `labels`, for example to translate them:

```ts
new StudioToolbar('#toolbar', { timeline, engine, labels: { play: 'Lecture', pause: 'Pause' } });
```

Loop repeats the selected range, or four bars from the playhead when nothing is selected. Export mixes the timeline and downloads it as `mix.wav`. Set `exportName` to change the file name.

## Track strips

`trackStrip` fills each track header with a tab in the track's colour, its name, M (mute) and S (solo) buttons, a volume slider and a level meter. Double-click the slider to set it back to full volume. Set `meter: false` to leave the meter out.

Drag the bottom edge of a track to make it taller or shorter, and double-click the edge to give it the default height again. Short tracks hide the volume slider.

```ts
const timeline = new StudioTimeline('#editor', {
  headerWidth: 180,
  renderHeader: trackStrip(engine),
});
```

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

Icon names: `play`, `pause`, `stop`, `loop`, `metronome`, `split`, `duplicate`, `delete`, `undo`, `redo`, `zoomIn`, `zoomOut`, `fit`, `snap`, `export`, `mute` and `solo`. Icons use `currentColor`, so they take the button's text colour.

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
