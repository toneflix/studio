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
  --tfs-ruler-height: 28px;
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
.tfs-corner { position: sticky; left: 0; z-index: 7; flex: none; background: var(--tfs-header); border-bottom: 1px solid var(--tfs-line); border-right: 1px solid var(--tfs-line); }
.tfs-ruler { position: relative; flex: none; background: var(--tfs-header); border-bottom: 1px solid var(--tfs-line); cursor: text; overflow: hidden; }
.tfs-ruler-label { position: absolute; top: 4px; padding-left: 4px; color: var(--tfs-muted); font-size: 11px; white-space: nowrap; border-left: 1px solid var(--tfs-bar); height: calc(var(--tfs-ruler-height) - 4px); pointer-events: none; }
.tfs-row { position: relative; display: flex; border-bottom: 1px solid var(--tfs-line); }
.tfs-row:nth-child(odd of .tfs-row) .tfs-lane { background-color: var(--tfs-lane-alt); }
.tfs-header { position: sticky; left: 0; z-index: 5; flex: none; box-sizing: border-box; background: var(--tfs-header); border-right: 1px solid var(--tfs-line); overflow: hidden; }
.tfs-header-default { display: flex; align-items: center; gap: 8px; height: 100%; padding: 0 12px; }
.tfs-header-default i { width: 4px; align-self: stretch; margin: 10px 0; border-radius: 2px; background: var(--clip, var(--tfs-clip)); }
.tfs-header-default span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.tfs-lane { position: relative; flex: none; background-color: var(--tfs-lane); touch-action: pan-x pan-y; }
.tfs--grid .tfs-lane {
  background-image: linear-gradient(to right, var(--tfs-bar) 1px, transparent 1px), linear-gradient(to right, var(--tfs-beat) 1px, transparent 1px);
  background-size: var(--tfs-bar-px) 100%, var(--tfs-beat-px) 100%;
}
.tfs-row--new .tfs-lane { background: repeating-linear-gradient(45deg, transparent 0 8px, var(--tfs-line) 8px 16px); }
.tfs-clip {
  position: absolute; top: 2px; bottom: 2px; box-sizing: border-box; overflow: hidden;
  border-radius: 6px; border: 1px solid color-mix(in srgb, var(--clip, var(--tfs-clip)) 65%, transparent);
  background: color-mix(in srgb, var(--clip, var(--tfs-clip)) 22%, var(--tfs-lane));
  cursor: grab; touch-action: none;
}
.tfs-clip + .tfs-clip { box-shadow: -3px 0 6px -2px rgba(0, 0, 0, 0.55); }
.tfs-clip:focus-visible { outline: 2px solid var(--tfs-select); outline-offset: -2px; }
.tfs-clip.tfs-clip--selected { border-color: var(--tfs-select); box-shadow: inset 0 0 0 1px var(--tfs-select), -3px 0 6px -2px rgba(0, 0, 0, 0.55); }
.tfs-clip--dragging { cursor: grabbing; opacity: 0.92; }
.tfs-clip-head { position: absolute; left: 0; right: 0; top: 0; height: 16px; padding: 1px 8px; box-sizing: border-box; font-size: 11px; color: var(--tfs-text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; background: color-mix(in srgb, var(--clip, var(--tfs-clip)) 35%, transparent); pointer-events: none; }
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
