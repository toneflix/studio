/**
 * Default look of the toolbar and track strips. Set the `--tfs-toolbar-*`, `--tfs-mute`
 * and `--tfs-solo` variables on any parent to restyle them.
 */
export const CONTROL_STYLES = `
.tfs-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
  padding: 6px;
  background: var(--tfs-toolbar-bg, #18181b);
  color: var(--tfs-toolbar-text, #e8e8ea);
  font: 12px/1.3 system-ui, sans-serif;
}
.tfs-tool {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: var(--tfs-toolbar-size, 32px);
  height: var(--tfs-toolbar-size, 32px);
  padding: 0;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: inherit;
  cursor: pointer;
}
.tfs-tool:hover:not(:disabled) { background: var(--tfs-toolbar-hover, rgba(255, 255, 255, 0.08)); }
.tfs-tool:focus-visible { outline: 2px solid var(--tfs-toolbar-active, #4da3ff); outline-offset: 1px; }
.tfs-tool:disabled { opacity: 0.35; cursor: default; }
.tfs-tool[aria-pressed='true'], .tfs-tool--primary { background: var(--tfs-toolbar-active, #4da3ff); color: var(--tfs-toolbar-active-text, #08131f); }
.tfs-tool[aria-pressed='true']:hover, .tfs-tool--primary:hover { background: var(--tfs-toolbar-active, #4da3ff); filter: brightness(1.1); }
.tfs-tool .tfs-icon { width: 18px; height: 18px; }
.tfs-toolbar-gap { width: 1px; height: 20px; margin: 0 4px; background: var(--tfs-toolbar-line, rgba(255, 255, 255, 0.1)); }
.tfs-snap-pick { display: inline-flex; align-items: center; gap: 4px; height: var(--tfs-toolbar-size, 32px); padding: 0 6px; border-radius: 8px; }
.tfs-snap-pick .tfs-icon { width: 16px; height: 16px; }
.tfs-snap-pick select { height: 26px; border: 1px solid var(--tfs-toolbar-line, rgba(255, 255, 255, 0.1)); border-radius: 6px; background: transparent; color: inherit; font: inherit; }
.tfs-snap-pick option { color: initial; }

.tfs-strip { display: flex; flex-direction: column; justify-content: center; gap: 6px; height: 100%; padding: 0 8px 0 12px; box-sizing: border-box; }
.tfs-strip-top { display: flex; align-items: center; gap: 4px; min-width: 0; }
.tfs-strip-top > i { flex: none; width: 4px; height: 16px; border-radius: 2px; background: var(--clip, var(--tfs-clip)); }
.tfs-strip-name { flex: 1; min-width: 0; margin-left: 4px; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; font-weight: 600; }
.tfs-strip .tfs-tool { width: 24px; height: 24px; flex: none; border-radius: 6px; color: var(--tfs-muted); }
.tfs-strip .tfs-tool:hover { background: rgba(255, 255, 255, 0.08); color: var(--tfs-text); }
.tfs-strip .tfs-tool .tfs-icon { width: 14px; height: 14px; }
.tfs-strip .tfs-tool[aria-pressed='true'][data-tool='mute'] { background: var(--tfs-mute, #f5b53d); color: #1a1406; }
.tfs-strip .tfs-tool[aria-pressed='true'][data-tool='solo'] { background: var(--tfs-solo, #4da3ff); color: #08131f; }
.tfs-strip input[type='range'] { width: 100%; margin: 0; accent-color: var(--clip, var(--tfs-clip)); }
`;

/** Add the control styles to a document once. */
export const injectControlStyles = (doc: Document) => {
  if (doc.getElementById('tfs-control-styles')) return;

  const style = doc.createElement('style');

  style.id = 'tfs-control-styles';
  style.textContent = CONTROL_STYLES;
  doc.head.prepend(style);
};
