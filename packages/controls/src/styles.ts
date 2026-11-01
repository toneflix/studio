/**
 * Default look of the toolbar and track strips. Set the `--tfs-toolbar-*`, `--tfs-display-*`,
 * `--tfs-mute` and `--tfs-solo` variables on any parent to restyle them.
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

.tfs-strip { display: flex; height: 100%; box-sizing: border-box; container-type: size; }
.tfs-strip-tab { flex: none; width: 6px; background: var(--clip, var(--tfs-clip)); }
.tfs-strip-body { display: flex; flex: 1; flex-direction: column; justify-content: center; gap: 5px; min-width: 0; padding: 0 8px; }
.tfs-strip-top { display: flex; align-items: center; gap: 3px; min-width: 0; }
.tfs-strip-name { flex: 1; min-width: 0; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; font-weight: 600; }
.tfs-strip .tfs-tool { width: 20px; height: 18px; flex: none; border: 1px solid var(--tfs-line); border-radius: 3px; color: var(--tfs-muted); font: 700 10px/1 system-ui, sans-serif; }
.tfs-strip .tfs-tool:hover { background: rgba(255, 255, 255, 0.08); color: var(--tfs-text); }
.tfs-strip .tfs-tool .tfs-icon { width: 12px; height: 12px; }
.tfs-strip .tfs-tool[aria-pressed='true'][data-tool='mute'] { border-color: transparent; background: var(--tfs-mute, #f5b53d); color: #1a1406; }
.tfs-strip .tfs-tool[aria-pressed='true'][data-tool='solo'] { border-color: transparent; background: var(--tfs-solo, #4da3ff); color: #08131f; }
.tfs-strip input[type='range'] { width: 100%; height: 14px; margin: 0; accent-color: var(--clip, var(--tfs-clip)); }

@container (max-height: 60px) { .tfs-strip input[type='range'] { display: none; } }
.tfs-meter { display: flex; flex-direction: column; gap: 1px; width: 100%; background: linear-gradient(var(--tfs-meter-off, rgba(255, 255, 255, 0.07)) 3px, transparent 3px) 0 0 / 100% 4px; }
.tfs-meter i { height: 3px; border-radius: 1px; background: linear-gradient(to right, #2fd07f 0%, #2fd07f 70%, #f5b53d 85%, #ff5a5f 100%); }
.tfs-meter--output { width: 96px; padding: 0 6px; }
.tfs-meter--output { background-size: 100% 6px; background-image: linear-gradient(var(--tfs-meter-off, rgba(255, 255, 255, 0.07)) 5px, transparent 5px); background-origin: content-box; background-clip: content-box; }
.tfs-meter--output i { height: 5px; }

.tfs-display { display: inline-flex; align-items: stretch; gap: 1px; height: 36px; padding: 2px; border-radius: 8px; background: var(--tfs-display-bg, #0b0d10); color: var(--tfs-display-text, #e8e8ea); font-variant-numeric: tabular-nums; }
.tfs-display-cell { display: flex; flex-direction: column; align-items: center; justify-content: center; min-width: 52px; padding: 0 8px; }
.tfs-display-cell + .tfs-display-cell { border-left: 1px solid rgba(255, 255, 255, 0.08); }
.tfs-display-cell small { font-size: 9px; letter-spacing: 0.06em; text-transform: uppercase; color: var(--tfs-display-muted, #7d8590); }
.tfs-display-position { min-width: 64px; text-align: center; font: 600 17px/1.1 ui-monospace, SFMono-Regular, Menlo, monospace; }
.tfs-display-clock { font: 13px/1.3 ui-monospace, SFMono-Regular, Menlo, monospace; }
.tfs-display-tempo, .tfs-display-meter { width: 52px; padding: 0; border: 0; background: transparent; color: inherit; font: 600 14px/1.2 ui-monospace, SFMono-Regular, Menlo, monospace; text-align: center; appearance: textfield; -moz-appearance: textfield; }
.tfs-display-tempo::-webkit-inner-spin-button, .tfs-display-tempo::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
.tfs-display-meter { width: 46px; cursor: pointer; text-align-last: center; }
.tfs-display-meter option { color: initial; }
.tfs-tool[aria-busy='true'] { cursor: progress; }

.tfs-dialog {
  min-width: min(320px, calc(100vw - 32px));
  max-width: calc(100vw - 32px);
  padding: 0;
  border: 1px solid var(--tfs-toolbar-line, rgba(255, 255, 255, 0.1));
  border-radius: 12px;
  background: var(--tfs-toolbar-bg, #18181b);
  color: var(--tfs-toolbar-text, #e8e8ea);
  font: 13px/1.4 system-ui, sans-serif;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5);
}
.tfs-dialog::backdrop { background: rgba(0, 0, 0, 0.5); }
.tfs-dialog-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 8px 8px 8px 16px; border-bottom: 1px solid var(--tfs-toolbar-line, rgba(255, 255, 255, 0.1)); }
.tfs-dialog-head h2 { margin: 0; font-size: 14px; font-weight: 600; }
.tfs-dialog dl { display: grid; grid-template-columns: auto 1fr; gap: 8px 24px; margin: 0; padding: 16px; }
.tfs-dialog dt { color: var(--tfs-display-muted, #7d8590); }
.tfs-dialog dd { margin: 0; text-align: right; font-variant-numeric: tabular-nums; }
`;

/** Add the control styles to a document once. */
export const injectControlStyles = (doc: Document) => {
  if (doc.getElementById('tfs-control-styles')) return;

  const style = doc.createElement('style');

  style.id = 'tfs-control-styles';
  style.textContent = CONTROL_STYLES;
  doc.head.prepend(style);
};
