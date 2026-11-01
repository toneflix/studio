# Styling and headers

## Colours

The timeline injects its default styles once per page. Override the variables on `.tfs` or any parent:

```css
.tfs {
  --tfs-bg: #0b0b0d;
  --tfs-lane: #141417;
  --tfs-lane-alt: #18181c;
  --tfs-header: #1b1b1f;
  --tfs-text: #f2f2f3;
  --tfs-muted: #8d8d96;
  --tfs-line: rgba(255, 255, 255, 0.07);
  --tfs-beat: rgba(255, 255, 255, 0.05);
  --tfs-bar: rgba(255, 255, 255, 0.13);
  --tfs-clip: #4f9cf9;
  --tfs-select: #ffd34d;
  --tfs-playhead: #ff5a5f;
  --tfs-range: rgba(255, 211, 77, 0.16);
  --tfs-ruler-height: 28px;
}
```

Clips take their track's `color`, or the next colour of the `palette` option. A clip's own `color` wins over both.

The track menu is placed on the page body, outside `.tfs`, so it has its own variables on `:root` or `body`: `--tfs-menu-bg` (`#1f1f24`), `--tfs-menu-text` (`#e8e8ea`), `--tfs-menu-line` and `--tfs-menu-danger` (`#ff6b7a`).

## Sizes

```ts
new StudioTimeline(element, {
  trackHeight: 120,
  headerWidth: 220, // 0 hides the header column
  pxPerSecond: 60,
  minPxPerSecond: 2,
  maxPxPerSecond: 2000,
});
```

## Your own track headers

The default header shows the track's colour and name. Pass `renderHeader` to fill the cell with your own controls. It is called again when the track's name or colour changes, after the function you returned has cleaned up.

```ts
new StudioTimeline(element, {
  renderHeader(track, cell) {
    const app = createApp(TrackHeader, { track });
    app.mount(cell);

    return () => app.unmount();
  },
});
```

Pointer events inside headers are left alone, so buttons and sliders work as usual. Typing into inputs there doesn't trigger the timeline's shortcuts.

## Read-only

`readonly: true` hides trim and fade handles and turns off dragging and editing shortcuts. Clicking still selects clips and moves the playhead.

```ts
timeline.setOptions({ readonly: true });
```
