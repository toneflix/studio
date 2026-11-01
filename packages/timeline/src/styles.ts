/** Default look of the timeline. Hosts restyle it through the `--tfs-*` variables. */
export const STYLES = `
.tfs {
  --tfs-bg: #121214;
  --tfs-lane: #18181b;
  --tfs-lane-alt: #1c1c20;
  --tfs-line: rgba(255, 255, 255, 0.07);
  --tfs-beat: rgba(255, 255, 255, 0.05);
  --tfs-bar: rgba(255, 255, 255, 0.13);
  --tfs-header: #1f1f23;
  --tfs-text: #e8e8ea;
  --tfs-muted: #9a9aa2;
  --tfs-clip: #4f9cf9;
  --tfs-select: #ffd34d;
  --tfs-playhead: #ff5a5f;
  --tfs-range: rgba(255, 211, 77, 0.16);
  --tfs-loop: #03bfff;
  --tfs-ruler-height: 28px;
  --tfs-auto-bg: #141417;
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: var(--tfs-bg);
  color: var(--tfs-text);
  font: 12px/1.3 system-ui, sans-serif;
  user-select: none;
  -webkit-user-select: none;
  outline: none;
}
.tfs-scroll { position: absolute; inset: 0; overflow: auto; overscroll-behavior: contain; }
.tfs-content { position: relative; min-height: 100%; }
.tfs-ruler-row { position: sticky; top: 0; z-index: 6; display: flex; height: var(--tfs-ruler-height); }
.tfs-corner { position: sticky; left: 0; z-index: 7; display: flex; align-items: center; justify-content: flex-end; padding: 0 6px; box-sizing: border-box; flex: none; background: var(--tfs-header); border-bottom: 1px solid var(--tfs-line); border-right: 1px solid var(--tfs-line); }
.tfs-add-track { display: grid; place-items: center; width: 22px; height: 20px; padding: 0; border: 1px solid var(--tfs-line); border-radius: 4px; background: transparent; color: var(--tfs-muted); font: 600 15px/1 system-ui, sans-serif; cursor: pointer; }
.tfs-add-track:hover { background: rgba(255, 255, 255, 0.08); color: var(--tfs-text); }
.tfs-add-track[hidden] { display: none; }
.tfs-track-name { cursor: pointer; }
.tfs-track-name:hover { text-decoration: underline; text-underline-offset: 2px; }
.tfs--readonly .tfs-track-name { cursor: default; text-decoration: none; }
.tfs-rename { position: absolute; z-index: 2; top: 6px; left: 10px; right: 10px; height: 24px; box-sizing: border-box; padding: 0 6px; border: 1px solid var(--tfs-select); border-radius: 4px; background: var(--tfs-bg); color: var(--tfs-text); font: 600 13px/1 system-ui, sans-serif; outline: none; }
.tfs-menu { position: fixed; z-index: 1000; display: flex; flex-direction: column; min-width: 160px; padding: 4px; border: 1px solid var(--tfs-menu-line, rgba(255, 255, 255, 0.12)); border-radius: 6px; background: var(--tfs-menu-bg, #1f1f24); box-shadow: 0 8px 24px rgba(0, 0, 0, 0.45); font: 13px/1.3 system-ui, sans-serif; }
.tfs-menu button { padding: 6px 10px; border: 0; border-radius: 4px; background: none; color: var(--tfs-menu-text, #e8e8ea); font: inherit; text-align: left; cursor: pointer; }
.tfs-menu button:hover:not(:disabled), .tfs-menu button:focus-visible { background: rgba(255, 255, 255, 0.08); outline: none; }
.tfs-menu button:disabled { opacity: 0.4; cursor: default; }
.tfs-menu .tfs-menu-danger { color: var(--tfs-menu-danger, #ff6b7a); }
.tfs-ruler { position: relative; flex: none; background: var(--tfs-header); border-bottom: 1px solid var(--tfs-line); cursor: text; overflow: hidden; }
.tfs-ruler-label { position: absolute; top: 4px; padding-left: 4px; color: var(--tfs-muted); font-size: 11px; white-space: nowrap; border-left: 1px solid var(--tfs-bar); height: calc(var(--tfs-ruler-height) - 4px); pointer-events: none; }
.tfs-row { position: relative; display: grid; grid-template-columns: auto auto; justify-content: start; border-bottom: 1px solid var(--tfs-line); }
.tfs-row > .tfs-header { grid-row: 1; grid-column: 1; }
.tfs-row > .tfs-lane { grid-row: 1; grid-column: 2; }
.tfs-auto-head { position: sticky; left: 0; z-index: 5; grid-row: 2; grid-column: 1; display: flex; align-items: center; justify-content: space-between; gap: 6px; box-sizing: border-box; padding: 0 10px; background: var(--tfs-header); border-top: 1px solid var(--tfs-line); border-right: 1px solid var(--tfs-line); }
.tfs-auto-name { padding: 2px 6px; border: 1px solid var(--tfs-line); border-radius: 4px; background: none; color: var(--clip, var(--tfs-clip)); font: 600 11px/1.2 system-ui, sans-serif; cursor: pointer; }
.tfs-auto-name::after { content: ' ▾'; color: var(--tfs-muted); }
.tfs-auto-name:hover { background: rgba(255, 255, 255, 0.08); }
.tfs-auto-value { color: var(--tfs-muted); font-size: 11px; font-variant-numeric: tabular-nums; white-space: nowrap; }
.tfs-auto-lane { position: relative; grid-row: 2; grid-column: 2; overflow: hidden; background: var(--tfs-auto-bg); border-top: 1px solid var(--tfs-line); cursor: crosshair; touch-action: none; }
.tfs-auto-lane svg { position: absolute; top: 0; left: 0; }
.tfs-auto-line { fill: none; stroke: var(--clip, var(--tfs-clip)); stroke-width: 1.5; }
.tfs-auto-line--flat { stroke-dasharray: 4 4; opacity: 0.45; }
.tfs-auto-point { fill: var(--tfs-auto-bg); stroke: var(--clip, var(--tfs-clip)); stroke-width: 1.5; cursor: grab; }
.tfs-auto-point:hover { fill: var(--clip, var(--tfs-clip)); }
.tfs--readonly .tfs-auto-lane, .tfs--readonly .tfs-auto-point { cursor: default; }
.tfs-row:nth-child(odd of .tfs-row) .tfs-lane { background-color: var(--tfs-lane-alt); }
.tfs-header { position: sticky; left: 0; z-index: 5; flex: none; box-sizing: border-box; background: var(--tfs-header); border-right: 1px solid var(--tfs-line); overflow: hidden; }
.tfs-header-default { display: flex; align-items: center; gap: 8px; height: 100%; padding: 0 12px; }
.tfs-header-default i { width: 4px; align-self: stretch; margin: 10px 0; border-radius: 2px; background: var(--clip, var(--tfs-clip)); }
.tfs-header-default span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.tfs-lane { position: relative; flex: none; background-color: var(--tfs-lane); touch-action: pan-x pan-y; }
.tfs-lane-grid { position: absolute; inset: 0; pointer-events: none; }
.tfs-grid-section {
  position: absolute; top: 0; bottom: 0;
  background-image: linear-gradient(to right, var(--tfs-bar) 1px, transparent 1px), linear-gradient(to right, var(--tfs-beat) 1px, transparent 1px);
  background-size: var(--tfs-bar-px) 100%, var(--tfs-beat-px) 100%;
}
.tfs-globals { position: sticky; top: var(--tfs-ruler-height); z-index: 6; }
.tfs-global { position: relative; display: flex; height: var(--tfs-global-height, 22px); }
.tfs-global-head { position: sticky; left: 0; z-index: 7; display: flex; align-items: center; justify-content: space-between; flex: none; box-sizing: border-box; padding: 0 6px 0 12px; background: var(--tfs-header); border-bottom: 1px solid var(--tfs-line); border-right: 1px solid var(--tfs-line); color: var(--tfs-muted); font-size: 11px; }
.tfs-global-add { display: grid; place-items: center; width: 18px; height: 16px; padding: 0; border: 0; border-radius: 3px; background: none; color: var(--tfs-muted); font: 600 13px/1 system-ui, sans-serif; cursor: pointer; }
.tfs-global-add:hover { background: rgba(255, 255, 255, 0.08); color: var(--tfs-text); }
.tfs-global-add[hidden] { display: none; }
.tfs-global-lane { position: relative; flex: none; overflow: hidden; background: var(--tfs-header); border-bottom: 1px solid var(--tfs-line); }
.tfs-marker, .tfs-tempo { position: absolute; top: 3px; bottom: 3px; display: flex; align-items: center; max-width: 160px; padding: 0 6px; box-sizing: border-box; border-radius: 0 3px 3px 0; font-size: 11px; font-weight: 600; white-space: nowrap; cursor: grab; touch-action: none; }
.tfs-marker span, .tfs-tempo span { overflow: hidden; text-overflow: ellipsis; }
.tfs-marker { background: color-mix(in srgb, var(--tfs-marker, #f5b53d) 30%, transparent); border-left: 2px solid var(--tfs-marker, #f5b53d); color: var(--tfs-text); }
.tfs-tempo { background: color-mix(in srgb, var(--tfs-loop) 18%, transparent); border-left: 2px solid var(--tfs-loop); color: var(--tfs-text); font-variant-numeric: tabular-nums; }
.tfs-tempo--start { cursor: default; background: none; color: var(--tfs-muted); }
.tfs--readonly .tfs-marker, .tfs--readonly .tfs-tempo { cursor: pointer; }
.tfs-inline-edit { position: absolute; z-index: 8; top: 2px; width: 120px; height: calc(100% - 4px); box-sizing: border-box; padding: 0 4px; border: 1px solid var(--tfs-select); border-radius: 3px; background: var(--tfs-bg); color: var(--tfs-text); font: 600 11px/1 system-ui, sans-serif; outline: none; }
.tfs-range.tfs-range--box { background: color-mix(in srgb, var(--tfs-select) 10%, transparent); border: 1px dashed var(--tfs-select); }
.tfs-range--box .tfs-range-edge { display: none; }
.tfs-row-resize { position: absolute; left: 0; right: 0; bottom: -4px; height: 7px; z-index: 6; cursor: row-resize; touch-action: none; }
.tfs-row-resize:hover, .tfs-row-resize:active { background: linear-gradient(transparent 3px, var(--tfs-select) 3px 4px, transparent 4px); }
.tfs-row--new .tfs-lane { background: repeating-linear-gradient(45deg, transparent 0 8px, var(--tfs-line) 8px 16px); }
.tfs-clip {
  position: absolute; top: 2px; bottom: 2px; box-sizing: border-box; overflow: hidden;
  border-radius: 4px; border: 1px solid color-mix(in srgb, var(--clip, var(--tfs-clip)) 85%, #fff);
  background: color-mix(in srgb, var(--clip, var(--tfs-clip)) 62%, #000);
  cursor: grab; touch-action: none;
}
.tfs-clip + .tfs-clip { box-shadow: -3px 0 6px -2px rgba(0, 0, 0, 0.55); }
.tfs-clip:focus-visible { outline: 2px solid var(--tfs-select); outline-offset: -2px; }
.tfs-clip.tfs-clip--selected { border-color: var(--tfs-select); box-shadow: inset 0 0 0 1px var(--tfs-select), -3px 0 6px -2px rgba(0, 0, 0, 0.55); filter: brightness(1.12); }
.tfs-clip--dragging { cursor: grabbing; opacity: 0.92; }
.tfs-clip-head { position: absolute; left: 0; right: 0; top: 0; height: 16px; padding: 1px 8px; box-sizing: border-box; font-size: 11px; color: #fff; font-weight: 600; text-shadow: 0 1px 1px rgba(0, 0, 0, 0.35); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; background: var(--clip, var(--tfs-clip)); pointer-events: none; }
.tfs-wave { position: absolute; left: 0; right: 0; top: 16px; bottom: 0; pointer-events: none; }
.tfs-wave canvas { position: absolute; top: 0; height: 100%; }
.tfs-trim { position: absolute; top: 0; bottom: 0; width: 8px; z-index: 2; cursor: ew-resize; }
.tfs-trim--start { left: 0; }
.tfs-trim--end { right: 0; }
.tfs-fade { position: absolute; top: 1px; width: 10px; height: 10px; margin-left: -5px; z-index: 3; box-sizing: border-box; border-radius: 2px; background: var(--tfs-text); opacity: 0; cursor: col-resize; }
.tfs-clip:hover .tfs-fade, .tfs-clip--selected .tfs-fade { opacity: 0.85; }
.tfs--readonly .tfs-trim, .tfs--readonly .tfs-fade { display: none; }
.tfs--readonly .tfs-clip { cursor: default; }
.tfs-overlay { position: absolute; top: 0; bottom: 0; z-index: 4; pointer-events: none; }
.tfs-playhead { position: absolute; top: 0; bottom: 0; width: 1px; background: var(--tfs-playhead); }
.tfs-playhead::before { content: ''; position: absolute; top: 0; left: -5px; border: 5px solid transparent; border-top: 7px solid var(--tfs-playhead); }
.tfs-range { position: absolute; background: var(--tfs-range); border-left: 1px solid var(--tfs-select); border-right: 1px solid var(--tfs-select); }
.tfs-range-edge { position: absolute; top: 0; bottom: 0; width: 9px; pointer-events: auto; cursor: ew-resize; touch-action: none; }
.tfs-range-edge[data-range-edge='start'] { left: -5px; }
.tfs-range-edge[data-range-edge='end'] { right: -5px; }
.tfs-range-mark { position: absolute; top: 0; bottom: 0; z-index: 1; display: none; background: color-mix(in srgb, var(--tfs-select) 22%, transparent); pointer-events: none; }
.tfs-range-grip { position: absolute; top: 3px; bottom: 3px; width: 7px; border-radius: 2px; background: var(--tfs-select); pointer-events: auto; cursor: ew-resize; touch-action: none; box-shadow: 0 1px 2px rgba(0, 0, 0, 0.4); }
.tfs-range-grip::after { content: ''; position: absolute; left: 3px; top: 30%; bottom: 30%; width: 1px; background: rgba(0, 0, 0, 0.45); }
.tfs-range-grip[data-range-edge='start'] { left: -4px; }
.tfs-range-grip[data-range-edge='end'] { right: -4px; }
.tfs-loop { position: absolute; top: 0; bottom: 0; box-sizing: border-box; background: color-mix(in srgb, var(--tfs-loop) 28%, transparent); border-left: 2px solid var(--tfs-loop); border-right: 2px solid var(--tfs-loop); pointer-events: none; }
.tfs-snap { position: absolute; top: 0; bottom: 0; width: 1px; background: var(--tfs-select); opacity: 0.7; }
`;

/** Add the default styles to a document once. */
export const injectStyles = (doc: Document) => {
  if (doc.getElementById('tfs-styles')) return;

  const style = doc.createElement('style');
  style.id = 'tfs-styles';
  style.textContent = STYLES;
  doc.head.prepend(style);
};
