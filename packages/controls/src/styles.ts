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
.tfs-tool:focus-visible { outline: 2px solid var(--tfs-toolbar-active, #03bfff); outline-offset: 1px; }
.tfs-tool:disabled { opacity: 0.35; cursor: default; }
.tfs-tool[aria-pressed='true'], .tfs-tool--primary { background: var(--tfs-toolbar-active, #03bfff); color: var(--tfs-toolbar-active-text, #03141c); }
.tfs-tool[aria-pressed='true']:hover:not(:disabled), .tfs-tool--primary:hover:not(:disabled) { background: var(--tfs-toolbar-active, #03bfff); filter: brightness(1.1); }
.tfs-tool .tfs-icon { width: 18px; height: 18px; }
.tfs-tool.tfs-tool--menu { width: auto; gap: 2px; padding: 0 6px 0 10px; font: 600 13px/1 system-ui, sans-serif; }
.tfs-tool.tfs-tool--menu .tfs-icon { width: 14px; height: 14px; opacity: 0.7; }
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
.tfs-strip .tfs-tool, .tfs-channel .tfs-tool { width: 20px; height: 18px; flex: none; border: 1px solid var(--tfs-line); border-radius: 3px; color: var(--tfs-muted); font: 700 10px/1 system-ui, sans-serif; }
.tfs-strip .tfs-tool:hover, .tfs-channel .tfs-tool:hover { background: rgba(255, 255, 255, 0.08); color: var(--tfs-text); }
.tfs-strip .tfs-tool .tfs-icon, .tfs-channel .tfs-tool .tfs-icon { width: 12px; height: 12px; }
.tfs-strip .tfs-tool[aria-pressed='true'][data-tool='mute'], .tfs-channel .tfs-tool[aria-pressed='true'][data-tool='mute'] { border-color: transparent; background: var(--tfs-mute, #f5b53d); color: #1a1406; }
.tfs-strip .tfs-tool[aria-pressed='true'][data-tool='solo'], .tfs-channel .tfs-tool[aria-pressed='true'][data-tool='solo'] { border-color: transparent; background: var(--tfs-solo, #03bfff); color: #03141c; }
.tfs-strip .tfs-tool[aria-pressed='true'][data-tool='arm'] { border-color: transparent; background: var(--tfs-record, #ff4d5e); color: #fff; }
.tfs-tool[data-tool='record'] { color: var(--tfs-record, #ff4d5e); }
.tfs-tool[data-tool='record'][aria-pressed='true'], .tfs-tool[data-tool='record'][aria-pressed='true']:hover:not(:disabled) { background: var(--tfs-record, #ff4d5e); color: #fff; animation: tfs-recording 1.2s ease-in-out infinite; }
@keyframes tfs-recording { 50% { filter: brightness(0.8); } }
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
.tfs-meter--vertical { flex-direction: row; width: 9px; background: linear-gradient(to right, var(--tfs-meter-off, rgba(255, 255, 255, 0.07)) 4px, transparent 4px) 0 0 / 5px 100%; }
.tfs-meter--vertical i { width: 4px; height: auto; background: linear-gradient(to top, #2fd07f 0%, #2fd07f 70%, #f5b53d 85%, #ff5a5f 100%); }

.tfs-browser { display: flex; flex-direction: column; width: min(var(--tfs-browser-width, 300px), 100%); box-sizing: border-box; border-right: 1px solid var(--tfs-mixer-line, rgba(255, 255, 255, 0.1)); background: var(--tfs-mixer-bg, #111114); color: var(--tfs-toolbar-text, #e8e8ea); font: 12px/1.3 system-ui, sans-serif; }
.tfs-browser[hidden] { display: none; }
.tfs-browser--overlay { position: absolute; top: 0; bottom: 0; left: 0; z-index: 31; box-shadow: 12px 0 32px rgba(0, 0, 0, 0.45); animation: tfs-browser-in 0.18s ease-out; }
@keyframes tfs-browser-in { from { transform: translateX(-24px); opacity: 0; } }
@media (prefers-reduced-motion: reduce) { .tfs-browser--overlay { animation: none; } }
.tfs-browser-head { display: flex; align-items: center; justify-content: space-between; padding: 6px 6px 6px 14px; }
.tfs-browser-head h2 { margin: 0; font-size: 13px; font-weight: 600; }
.tfs-browser-tabs { display: flex; gap: 4px; padding: 0 10px 8px; overflow-x: auto; scrollbar-width: none; }
.tfs-browser-tabs[hidden] { display: none; }
.tfs-browser-tab { flex: none; padding: 5px 10px; border: 1px solid var(--tfs-toolbar-line, rgba(255, 255, 255, 0.1)); border-radius: 999px; background: none; color: var(--tfs-display-muted, #9a9aa2); font: 600 11px/1 system-ui, sans-serif; cursor: pointer; }
.tfs-browser-tab:hover { color: inherit; }
.tfs-browser-tab[aria-selected='true'] { border-color: transparent; background: var(--tfs-toolbar-active, #03bfff); color: var(--tfs-toolbar-active-text, #03141c); }
.tfs-browser-search { display: block; padding: 0 10px 8px; }
.tfs-browser-search input { width: 100%; height: 30px; box-sizing: border-box; padding: 0 10px; border: 1px solid var(--tfs-toolbar-line, rgba(255, 255, 255, 0.1)); border-radius: 6px; background: rgba(255, 255, 255, 0.04); color: inherit; font: inherit; outline: none; }
.tfs-browser-search input:focus { border-color: var(--tfs-toolbar-active, #03bfff); }
.tfs-browser-action, .tfs-browser-more { margin: 0 10px 8px; padding: 7px 10px; border: 1px dashed var(--tfs-toolbar-line, rgba(255, 255, 255, 0.18)); border-radius: 6px; background: none; color: inherit; font: 600 12px/1 system-ui, sans-serif; cursor: pointer; }
.tfs-browser-action:hover, .tfs-browser-more:hover { background: rgba(255, 255, 255, 0.05); }
.tfs-browser-action[hidden], .tfs-browser-more[hidden], .tfs-browser-status[hidden] { display: none; }
.tfs-browser-list { flex: 1 1 auto; min-height: 0; margin: 0; padding: 0 4px; overflow-y: auto; list-style: none; }
.tfs-browser-item { display: flex; align-items: center; gap: 8px; padding: 4px 6px; border-radius: 6px; cursor: grab; }
.tfs-browser-item:hover { background: rgba(255, 255, 255, 0.05); }
.tfs-browser-item[aria-busy='true'] { opacity: 0.55; cursor: progress; }
.tfs-browser-item .tfs-tool { width: 26px; height: 26px; flex: none; border-radius: 6px; }
.tfs-browser-item .tfs-tool .tfs-icon { width: 14px; height: 14px; }
.tfs-browser-item .tfs-browser-preview { border: 1px solid var(--tfs-toolbar-line, rgba(255, 255, 255, 0.1)); }
.tfs-browser-preview[aria-busy='true'] { opacity: 0.5; }
.tfs-browser-kind { display: grid; place-items: center; width: 26px; height: 26px; flex: none; color: var(--tfs-display-muted, #9a9aa2); }
.tfs-browser-kind .tfs-icon { width: 15px; height: 15px; }
.tfs-browser-image { flex: none; width: 44px; height: 33px; border-radius: 4px; object-fit: cover; background: rgba(255, 255, 255, 0.06); }
.tfs-browser-text { display: flex; flex-direction: column; flex: 1 1 auto; min-width: 0; }
.tfs-browser-name, .tfs-browser-detail { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.tfs-browser-name { font-weight: 600; }
.tfs-browser-detail, .tfs-browser-length { color: var(--tfs-display-muted, #9a9aa2); font-size: 11px; }
.tfs-browser-length { flex: none; font-variant-numeric: tabular-nums; }
.tfs-browser-add { opacity: 0.6; }
.tfs-browser-item:hover .tfs-browser-add, .tfs-browser-add:focus-visible { opacity: 1; }
.tfs-browser-add[hidden] { display: none; }
.tfs-browser-status { padding: 12px 14px; color: var(--tfs-display-muted, #9a9aa2); }
.tfs-browser-status--failed { color: var(--tfs-menu-danger, #ff6b7a); }
@media (max-width: 480px) { .tfs-browser--overlay { width: 100%; } }
@media (pointer: coarse) {
  .tfs-browser-item { padding: 6px; }
  .tfs-browser-item .tfs-tool { width: 36px; height: 36px; }
  .tfs-browser-add { opacity: 1; }
  .tfs-browser-search input { height: 38px; font-size: 16px; }
}

.tfs-mixer { display: flex; height: var(--tfs-mixer-height, 320px); box-sizing: border-box; border-top: 1px solid var(--tfs-mixer-line, rgba(255, 255, 255, 0.1)); background: var(--tfs-mixer-bg, #111114); color: var(--tfs-toolbar-text, #e8e8ea); font: 12px/1.3 system-ui, sans-serif; }
.tfs-mixer[hidden] { display: none; }
.tfs-mixer--overlay { position: absolute; left: 0; right: 0; bottom: 0; z-index: 30; max-height: 100%; box-shadow: 0 -12px 32px rgba(0, 0, 0, 0.45); animation: tfs-mixer-in 0.18s ease-out; }
@keyframes tfs-mixer-in { from { transform: translateY(24px); opacity: 0; } }
@media (prefers-reduced-motion: reduce) { .tfs-mixer--overlay { animation: none; } }
.tfs-mixer-strips { display: flex; flex: 1; min-width: 0; overflow-x: auto; }
.tfs-channel { display: flex; flex: none; flex-direction: column; align-items: center; gap: 8px; width: var(--tfs-channel-width, 84px); padding-top: 10px; box-sizing: border-box; border-right: 1px solid var(--tfs-mixer-line, rgba(255, 255, 255, 0.1)); background: var(--tfs-channel-bg, #1a1a1e); }
.tfs-channel--master { border-right: 0; border-left: 2px solid var(--tfs-mixer-line, rgba(255, 255, 255, 0.1)); background: var(--tfs-channel-master-bg, #202026); }
.tfs-channel-buttons { display: flex; gap: 4px; }
.tfs-channel-body { display: flex; flex: 1; min-height: 0; gap: 3px; justify-content: center; }
.tfs-channel-scale { position: relative; width: 20px; margin: 9px 0; font: 9px/1 ui-monospace, SFMono-Regular, Menlo, monospace; color: var(--tfs-display-muted, #7d8590); }
.tfs-channel-scale span { position: absolute; right: 0; transform: translateY(50%); }
.tfs-channel-body .tfs-meter--vertical { margin: 9px 0; }
.tfs-fader { width: 22px; height: 100%; margin: 0; padding: 0; writing-mode: vertical-lr; direction: rtl; appearance: none; -webkit-appearance: none; background: linear-gradient(to right, transparent 9px, #050506 9px 13px, transparent 13px); cursor: ns-resize; }
.tfs-fader::-webkit-slider-thumb { -webkit-appearance: none; width: 22px; height: 18px; border: 1px solid rgba(255, 255, 255, 0.25); border-radius: 3px; background: linear-gradient(#5a5a62, #3a3a40 45%, #d8d8de 47% 53%, #3a3a40 55%, #2c2c31); box-shadow: 0 2px 4px rgba(0, 0, 0, 0.5); }
.tfs-fader::-moz-range-thumb { width: 20px; height: 16px; border: 1px solid rgba(255, 255, 255, 0.25); border-radius: 3px; background: linear-gradient(#5a5a62, #3a3a40 45%, #d8d8de 47% 53%, #3a3a40 55%, #2c2c31); }
.tfs-fader:focus-visible { outline: 2px solid var(--tfs-toolbar-active, #03bfff); outline-offset: 2px; }
.tfs-channel-db { min-width: 44px; padding: 2px 4px; box-sizing: border-box; border-radius: 4px; background: var(--tfs-display-bg, #0b0d10); font: 11px/1.3 ui-monospace, SFMono-Regular, Menlo, monospace; text-align: center; font-variant-numeric: tabular-nums; }
.tfs-channel-name { width: 100%; padding: 5px 4px; box-sizing: border-box; overflow: hidden; background: var(--clip, #8d8d96); color: #fff; font-weight: 600; text-align: center; text-overflow: ellipsis; white-space: nowrap; text-shadow: 0 1px 1px rgba(0, 0, 0, 0.35); }
.tfs-inserts { display: flex; flex: none; flex-direction: column; gap: 2px; width: 100%; height: var(--tfs-inserts-height, 78px); padding: 0 5px; box-sizing: border-box; overflow-y: auto; scrollbar-width: thin; }
.tfs-inserts-list { display: flex; flex-direction: column; gap: 2px; }
.tfs-insert { display: flex; align-items: center; height: 18px; flex: none; box-sizing: border-box; border: 1px solid var(--tfs-mixer-line, rgba(255, 255, 255, 0.1)); border-radius: 3px; background: var(--tfs-insert-bg, #26262c); color: var(--tfs-toolbar-text, #e8e8ea); font: 600 10px/1 system-ui, sans-serif; overflow: hidden; }
.tfs-insert button { height: 100%; padding: 0; border: 0; background: none; color: inherit; font: inherit; cursor: pointer; }
.tfs-insert-power { width: 14px; flex: none; }
.tfs-insert-power::before { content: ''; display: block; width: 6px; height: 6px; margin: auto; border-radius: 50%; background: var(--tfs-toolbar-active, #03bfff); box-shadow: 0 0 4px var(--tfs-toolbar-active, #03bfff); }
.tfs-insert[data-bypass='true'] { color: var(--tfs-muted, #8d8d96); }
.tfs-insert[data-bypass='true'] .tfs-insert-power::before { background: #55555c; box-shadow: none; }
.tfs-insert-name { flex: 1; min-width: 0; overflow: hidden; text-align: left; text-overflow: ellipsis; white-space: nowrap; }
.tfs-insert-name:hover { text-decoration: underline; }
.tfs-insert-remove { width: 14px; flex: none; opacity: 0; font-size: 12px !important; }
.tfs-insert:hover .tfs-insert-remove, .tfs-insert-remove:focus-visible { opacity: 0.7; }
.tfs-insert--add { justify-content: center; border-style: dashed; background: transparent; color: var(--tfs-muted, #8d8d96); font-size: 12px; cursor: pointer; }
.tfs-insert--add:hover:not(:disabled) { color: var(--tfs-toolbar-text, #e8e8ea); border-color: var(--tfs-muted, #8d8d96); }
.tfs-insert-menu { position: fixed; z-index: 1000; display: flex; flex-direction: column; min-width: 140px; padding: 4px; border: 1px solid var(--tfs-mixer-line, rgba(255, 255, 255, 0.12)); border-radius: 6px; background: var(--tfs-menu-bg, #1f1f24); box-shadow: 0 8px 24px rgba(0, 0, 0, 0.45); font: 12px/1.3 system-ui, sans-serif; }
.tfs-insert-menu button { padding: 6px 10px; border: 0; border-radius: 4px; background: none; color: var(--tfs-toolbar-text, #e8e8ea); font: inherit; text-align: left; cursor: pointer; }
.tfs-insert-menu button:hover, .tfs-insert-menu button:focus-visible { background: rgba(255, 255, 255, 0.08); }
.tfs-plugin-window { position: fixed; z-index: 1000; display: flex; flex-direction: column; min-width: 220px; max-width: calc(100vw - 16px); max-height: calc(100vh - 16px); border: 1px solid var(--tfs-mixer-line, rgba(255, 255, 255, 0.12)); border-radius: 8px; background: var(--tfs-mixer-bg, #111114); color: var(--tfs-toolbar-text, #e8e8ea); box-shadow: 0 16px 48px rgba(0, 0, 0, 0.55); font: 12px/1.3 system-ui, sans-serif; overflow: hidden; }
.tfs-plugin-window-bar { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 4px 4px 4px 12px; background: var(--tfs-toolbar-bg, #18181b); font-weight: 600; cursor: move; user-select: none; touch-action: none; }
.tfs-plugin-window-bar .tfs-tool { width: 24px; height: 24px; }
.tfs-plugin-window-body { overflow: auto; padding: 0; min-height: 40px; }
.tfs-plugin-window-body:not(:has(*)) { padding: 12px; color: var(--tfs-muted, #8d8d96); }
.tfs-instrument-head { display: flex; align-items: center; gap: 8px; padding: 10px 12px 4px; }
.tfs-instrument-pick { flex: 1; min-width: 0; height: 30px; padding: 0 8px; border: 1px solid var(--tfs-mixer-line, rgba(255, 255, 255, 0.12)); border-radius: 6px; background: var(--tfs-toolbar-bg, #18181b); color: inherit; font: inherit; }
.tfs-instrument-params { display: grid; grid-template-columns: repeat(auto-fill, 76px); justify-content: center; gap: 12px 8px; padding: 12px; max-width: min(420px, calc(100vw - 40px)); }
.tfs-instrument-param { display: flex; flex-direction: column; align-items: center; gap: 6px; text-align: center; }
.tfs-instrument-param .tfs-knob { width: 40px; height: 40px; }
.tfs-instrument-param--choice { grid-column: 1 / -1; align-items: flex-start; }
.tfs-instrument-param--choice .tfs-roll-views { margin: 0; }
.tfs-instrument-name { color: var(--tfs-muted, #8d8d96); font-size: 11px; }
.tfs-instrument-value { font-variant-numeric: tabular-nums; font-size: 11px; }
.tfs-instrument-editor { min-height: 40px; }
.tfs-instrument-samples { display: flex; flex-direction: column; gap: 8px; padding: 0 12px 12px; max-width: min(420px, calc(100vw - 40px)); }
.tfs-instrument-sample { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; padding: 8px; border-radius: 8px; background: rgba(255, 255, 255, 0.04); }
.tfs-instrument-sample-name { flex: 1 1 100%; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 600; }
.tfs-instrument-sample .tfs-instrument-pick { flex: none; width: 76px; }
.tfs-instrument-sample .tfs-roll-views { margin: 0; }
.tfs-instrument-loop { display: flex; gap: 16px; flex: 1 1 100%; justify-content: center; }
.tfs-instrument-empty { margin: 0; color: var(--tfs-muted, #8d8d96); font-size: 12px; }
.tfs-instrument-editor:not(:has(*)) { padding: 12px; color: var(--tfs-muted, #8d8d96); }
.tfs-knob { position: relative; flex: none; width: 30px; height: 30px; border-radius: 50%; background: radial-gradient(circle at 50% 35%, #4a4a52, #26262b 70%); box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.6), 0 2px 4px rgba(0, 0, 0, 0.4); cursor: ns-resize; touch-action: none; }
.tfs-knob:focus-visible { outline: 2px solid var(--tfs-toolbar-active, #03bfff); outline-offset: 2px; }
.tfs-knob-dial { position: absolute; inset: 0; border-radius: 50%; }
.tfs-knob-dial::after { content: ''; position: absolute; left: 50%; top: 3px; width: 2px; height: 9px; margin-left: -1px; border-radius: 1px; background: var(--clip, #e8e8ea); }
.tfs-roll { --tfs-roll-row: 14px; --tfs-roll-keys: 56px; display: flex; flex-direction: column; height: var(--tfs-roll-height, 340px); box-sizing: border-box; border-top: 1px solid var(--tfs-mixer-line, rgba(255, 255, 255, 0.1)); background: var(--tfs-roll-bg, #141418); color: var(--tfs-toolbar-text, #e8e8ea); font: 12px/1.3 system-ui, sans-serif; }
.tfs-roll[hidden] { display: none; }
.tfs-roll--overlay { position: absolute; left: 0; right: 0; bottom: var(--tfs-keys-offset, 0px); z-index: 30; max-height: 100%; box-shadow: 0 -12px 32px rgba(0, 0, 0, 0.45); animation: tfs-mixer-in 0.18s ease-out; }
@media (prefers-reduced-motion: reduce) { .tfs-roll--overlay { animation: none; } }
.tfs-roll--drums { --tfs-roll-keys: 96px; }
.tfs-roll-bar { display: flex; flex: none; align-items: center; gap: 4px; padding: 4px 6px 4px 12px; overflow-x: auto; scrollbar-width: none; border-bottom: 1px solid var(--tfs-mixer-line, rgba(255, 255, 255, 0.1)); background: var(--tfs-mixer-bg, #111114); }
.tfs-roll-pattern { display: inline-flex; flex: 0 1 auto; align-items: center; gap: 2px; min-width: 0; height: 30px; margin-right: 8px; padding: 0 6px; border: 0; border-radius: 6px; background: transparent; color: inherit; font: inherit; cursor: pointer; }
.tfs-roll-pattern:hover:not(:disabled) { background: rgba(255, 255, 255, 0.08); }
.tfs-roll-pattern:disabled { cursor: default; }
.tfs-roll-pattern:disabled .tfs-icon { display: none; }
.tfs-roll-pattern .tfs-icon { flex: none; width: 14px; height: 14px; }
.tfs-roll-pattern .tfs-roll-title { margin-right: 0; }
.tfs-roll-title { flex: 0 1 auto; min-width: 0; margin-right: 8px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 13px; }
.tfs-roll-gap { flex: 1 1 0; }
.tfs-roll-bar .tfs-tool { flex: none; width: 30px; height: 30px; }
.tfs-roll-bar .tfs-tool .tfs-icon { width: 16px; height: 16px; }
.tfs-roll-bar .tfs-tool:disabled, .tfs-roll-text:disabled { opacity: 0.4; cursor: default; }
.tfs-roll-snap { display: inline-flex; flex: none; align-items: center; gap: 6px; color: var(--tfs-display-muted, #9a9aa2); }
.tfs-roll-snap select, .tfs-roll-text { height: 28px; padding: 0 8px; border: 1px solid var(--tfs-toolbar-line, rgba(255, 255, 255, 0.12)); border-radius: 6px; background: rgba(255, 255, 255, 0.04); color: var(--tfs-toolbar-text, #e8e8ea); font: 600 12px/1 system-ui, sans-serif; }
.tfs-roll-snap select option { background: var(--tfs-menu-bg, #1f1f24); }
.tfs-roll-text { flex: none; cursor: pointer; }
.tfs-roll-text:hover:not(:disabled) { background: rgba(255, 255, 255, 0.08); }
.tfs-roll-scroller { position: relative; flex: 1 1 auto; min-height: 0; overflow: auto; overscroll-behavior: contain; }
.tfs-roll--empty .tfs-roll-scroller { display: none; }
.tfs-roll-empty { display: grid; flex: 1; place-items: center; padding: 16px; color: var(--tfs-display-muted, #9a9aa2); text-align: center; }
.tfs-roll-empty[hidden] { display: none; }
.tfs-roll-content { position: relative; width: calc(var(--tfs-roll-keys) + var(--tfs-roll-width, 0px)); }
.tfs-roll-row { display: flex; }
.tfs-roll-top { position: sticky; top: 0; z-index: 3; height: 22px; }
.tfs-roll-bottom { position: sticky; bottom: 0; z-index: 3; height: 56px; }
.tfs-roll-corner { position: sticky; left: 0; z-index: 2; flex: none; width: var(--tfs-roll-keys); box-sizing: border-box; padding: 4px 6px; border-right: 1px solid var(--tfs-mixer-line, rgba(255, 255, 255, 0.1)); background: var(--tfs-mixer-bg, #111114); color: var(--tfs-display-muted, #9a9aa2); font-size: 10px; }
.tfs-roll-ruler, .tfs-roll-velocity { position: relative; flex: none; width: var(--tfs-roll-width, 0px); background: var(--tfs-mixer-bg, #111114); }
.tfs-roll-ruler { border-bottom: 1px solid var(--tfs-mixer-line, rgba(255, 255, 255, 0.1)); }
.tfs-roll-ruler span { position: absolute; top: 0; bottom: 0; padding: 5px 4px 0; border-left: 1px solid var(--tfs-mixer-line, rgba(255, 255, 255, 0.2)); color: var(--tfs-display-muted, #9a9aa2); font-size: 10px; font-variant-numeric: tabular-nums; }
.tfs-roll-velocity { border-top: 1px solid var(--tfs-mixer-line, rgba(255, 255, 255, 0.1)); touch-action: none; cursor: ns-resize; }
.tfs-roll-keys { position: sticky; left: 0; z-index: 2; flex: none; width: var(--tfs-roll-keys); touch-action: none; }
.tfs-roll-key { display: flex; align-items: center; justify-content: flex-end; height: var(--tfs-roll-row); box-sizing: border-box; padding-right: 4px; border-bottom: 1px solid rgba(0, 0, 0, 0.25); border-right: 1px solid var(--tfs-mixer-line, rgba(255, 255, 255, 0.1)); background: #d9d9de; color: #3a3a42; font-size: 9px; line-height: 1; white-space: nowrap; overflow: hidden; cursor: pointer; user-select: none; }
.tfs-roll-key--black { background: #2a2a30; color: #c8c8d0; }
.tfs-roll-key--down { background: var(--clip, #4f9cf9); color: #fff; }
.tfs-roll--drums .tfs-roll-key { justify-content: flex-start; padding-left: 6px; background: #1f1f24; color: var(--tfs-display-muted, #9a9aa2); }
.tfs-roll--drums .tfs-roll-key--named { background: #2b2b33; color: var(--tfs-toolbar-text, #e8e8ea); font-size: 10px; }
.tfs-roll--sampled { --tfs-roll-keys: 96px; }
.tfs-roll .tfs-roll-key--sample { justify-content: flex-start; padding-left: 6px; background: color-mix(in srgb, var(--clip, #4f9cf9) 70%, #1f1f24); color: #fff; font-size: 10px; text-overflow: ellipsis; }
.tfs-roll-area { position: relative; flex: none; width: var(--tfs-roll-width, 0px); height: var(--tfs-roll-height-px, 0px); outline: none; overflow: hidden; touch-action: pan-x pan-y; background: repeating-linear-gradient(to bottom, var(--tfs-roll-lane, #1d1d22) 0 calc(var(--tfs-roll-row) - 1px), rgba(0, 0, 0, 0.35) calc(var(--tfs-roll-row) - 1px) var(--tfs-roll-row)); cursor: crosshair; }
.tfs-roll-area:focus-visible { box-shadow: inset 0 0 0 2px var(--tfs-toolbar-active, #03bfff); }
.tfs-roll-lines { position: absolute; inset: 0; pointer-events: none; }
.tfs-roll-lines i { position: absolute; top: 0; bottom: 0; width: 1px; background: rgba(255, 255, 255, 0.05); }
.tfs-roll-lines .tfs-roll-beat-line { background: rgba(255, 255, 255, 0.1); }
.tfs-roll-lines .tfs-roll-bar-line { background: rgba(255, 255, 255, 0.24); }
.tfs-roll-outside { position: absolute; top: 0; bottom: 0; left: 0; background: rgba(0, 0, 0, 0.4); pointer-events: none; }
.tfs-roll-note { position: absolute; top: 0; left: 0; height: calc(var(--tfs-roll-row) - 1px); box-sizing: border-box; border: 1px solid rgba(0, 0, 0, 0.45); border-radius: 3px; background: color-mix(in srgb, var(--clip, #4f9cf9) calc(45% + var(--v, 0.8) * 55%), #1d1d22); cursor: grab; touch-action: none; }
.tfs-roll-note::after { content: ''; position: absolute; top: 2px; right: 2px; bottom: 2px; width: 3px; border-radius: 2px; background: rgba(255, 255, 255, 0.35); cursor: ew-resize; }
.tfs-roll-note--picked { border-color: #fff; box-shadow: 0 0 0 1px #fff; }
.tfs-roll-box { position: absolute; border: 1px solid var(--tfs-toolbar-active, #03bfff); background: color-mix(in srgb, var(--tfs-toolbar-active, #03bfff) 15%, transparent); pointer-events: none; }
.tfs-roll-box[hidden], .tfs-roll-playhead[hidden] { display: none; }
.tfs-roll-playhead { position: absolute; top: 0; bottom: 0; left: 0; width: 2px; margin-left: -1px; background: var(--tfs-playhead, #ff5a5f); pointer-events: none; }
.tfs-roll-stalk { position: absolute; bottom: 0; width: 3px; margin-left: -1px; background: color-mix(in srgb, var(--clip, #4f9cf9) 70%, #fff); pointer-events: none; }
.tfs-roll-stalk::before { content: ''; position: absolute; top: -3px; left: -2px; width: 7px; height: 7px; border-radius: 50%; background: inherit; }
.tfs-roll-stalk--picked { background: #fff; }
@media (pointer: coarse) {
  .tfs-roll { --tfs-roll-row: 20px; }
  .tfs-roll-bar .tfs-tool { width: 38px; height: 38px; }
  .tfs-roll-snap select, .tfs-roll-text { height: 36px; }
  .tfs-roll-note::after { width: 5px; }
}
@media (max-width: 600px) { .tfs-roll { --tfs-roll-keys: 44px; height: var(--tfs-roll-height, 60vh); } .tfs-roll--drums, .tfs-roll--sampled { --tfs-roll-keys: 80px; } }
.tfs-roll-views { display: inline-flex; flex: none; padding: 2px; margin-right: 6px; border-radius: 8px; background: rgba(255, 255, 255, 0.06); }
.tfs-roll-view { height: 26px; padding: 0 10px; border: 0; border-radius: 6px; background: none; color: var(--tfs-display-muted, #9a9aa2); font: 600 12px/1 system-ui, sans-serif; cursor: pointer; }
.tfs-roll-view[aria-pressed='true'] { background: var(--tfs-toolbar-active, #03bfff); color: var(--tfs-toolbar-active-text, #03141c); }
.tfs-roll-text[aria-pressed='true'] { border-color: transparent; background: var(--tfs-toolbar-active, #03bfff); color: var(--tfs-toolbar-active-text, #03141c); }
.tfs-steps { display: none; flex: 1 1 auto; flex-direction: column; min-height: 0; }
.tfs-roll--steps .tfs-steps { display: flex; }
.tfs-roll--steps .tfs-roll-scroller, .tfs-roll--steps .tfs-roll-bar .tfs-tool:not(:last-child):not(.tfs-roll-play), .tfs-roll--empty .tfs-steps { display: none; }
.tfs-steps-bar { display: flex; flex: none; align-items: center; gap: 12px; padding: 6px 12px; overflow-x: auto; scrollbar-width: none; }
.tfs-steps-swing input { width: 110px; accent-color: var(--tfs-toolbar-active, #03bfff); }
.tfs-steps-value { min-width: 32px; color: var(--tfs-toolbar-text, #e8e8ea); font-variant-numeric: tabular-nums; }
.tfs-steps-scroller { flex: 1 1 auto; min-height: 0; overflow: auto; overscroll-behavior: contain; padding: 0 12px 12px 0; }
.tfs-steps-table { display: flex; flex-direction: column; gap: 3px; width: max-content; user-select: none; }
.tfs-steps-row { display: flex; gap: 3px; }
button.tfs-steps-name { cursor: pointer; }
button.tfs-steps-name:hover, button.tfs-steps-name:focus-visible { color: var(--clip, #4f9cf9); }
.tfs-steps-row--sample .tfs-steps-name { color: var(--clip, #4f9cf9); font-weight: 600; }
.tfs-steps-add { position: sticky; left: 0; margin: 6px 0 0 12px; padding: 4px 10px; border: 1px dashed var(--tfs-mixer-line, rgba(255, 255, 255, 0.25)); border-radius: 6px; background: transparent; color: var(--tfs-display-muted, #9a9aa2); font: inherit; font-size: 11px; cursor: pointer; }
.tfs-steps-add:hover, .tfs-steps-add:focus-visible { color: var(--tfs-toolbar-text, #e8e8ea); border-color: var(--clip, #4f9cf9); }
.tfs-steps-name { box-sizing: border-box; border: 0; border-radius: 0; margin: 0; font-family: inherit; text-align: left; position: sticky; left: 0; z-index: 1; flex: none; width: var(--tfs-steps-name, 84px); padding: 0 8px 0 12px; overflow: hidden; background: var(--tfs-roll-bg, #141418); color: var(--tfs-toolbar-text, #e8e8ea); font-size: 11px; line-height: var(--tfs-step, 24px); white-space: nowrap; text-overflow: ellipsis; }
.tfs-step { flex: none; width: var(--tfs-step, 24px); height: var(--tfs-step, 24px); box-sizing: border-box; border-radius: 4px; background: #26262c; cursor: pointer; touch-action: pan-x pan-y; }
.tfs-step--odd { background: #1e1e23; }
.tfs-step:hover { box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.25); }
.tfs-step--on { background: color-mix(in srgb, var(--clip, #4f9cf9) 75%, #1d1d22); }
.tfs-step--accent { background: var(--clip, #4f9cf9); box-shadow: inset 0 0 0 2px rgba(255, 255, 255, 0.7); }
.tfs-step--playing { outline: 2px solid rgba(255, 255, 255, 0.55); outline-offset: -1px; }
@media (pointer: coarse) { .tfs-steps-table { --tfs-step: 32px; } .tfs-roll-view { height: 34px; } }
@media (max-width: 600px) { .tfs-steps-table { --tfs-steps-name: 64px; } }
.tfs-keys { display: flex; flex-direction: column; box-sizing: border-box; border-top: 1px solid var(--tfs-mixer-line, rgba(255, 255, 255, 0.1)); background: var(--tfs-roll-bg, #141418); color: var(--tfs-toolbar-text, #e8e8ea); font: 12px/1.3 system-ui, sans-serif; }
.tfs-keys[hidden] { display: none; }
.tfs-keys--overlay { position: absolute; left: 0; right: 0; bottom: 0; z-index: 31; box-shadow: 0 -12px 32px rgba(0, 0, 0, 0.45); animation: tfs-mixer-in 0.18s ease-out; }
@media (prefers-reduced-motion: reduce) { .tfs-keys--overlay { animation: none; } }
.tfs-keys--recording .tfs-roll-title { color: #ff4d5e; }
.tfs-keys-octave { display: inline-flex; flex: none; align-items: center; gap: 4px; }
.tfs-keys-value { min-width: 28px; text-align: center; color: var(--tfs-display-muted, #9a9aa2); font-variant-numeric: tabular-nums; }
.tfs-keys-velocity input { width: 80px; accent-color: var(--clip, #4f9cf9); }
.tfs-roll-text[aria-pressed="true"] { border-color: var(--clip, #4f9cf9); color: var(--clip, #4f9cf9); }
.tfs-keys-midi--none { opacity: 0.6; }
.tfs-keys-scroller { overflow-x: auto; overscroll-behavior: contain; padding: 8px 12px 12px; }
.tfs-keys-scroller[hidden] { display: none; }
.tfs-keys-board { position: relative; height: var(--tfs-keys-height, 120px); min-width: calc(var(--whites) * 34px); touch-action: none; user-select: none; -webkit-user-select: none; }
.tfs-keys-key { position: absolute; top: 0; box-sizing: border-box; cursor: pointer; }
.tfs-keys-key--white { left: calc(var(--i) * 100% / var(--whites)); width: calc(100% / var(--whites)); height: 100%; border: 1px solid #2a2a30; border-radius: 0 0 6px 6px; background: #ececf0; }
.tfs-keys-key--black { z-index: 1; left: calc(var(--i) * 100% / var(--whites) - 100% / var(--whites) * 0.31); width: calc(100% / var(--whites) * 0.62); height: 62%; border-radius: 0 0 4px 4px; background: #1d1d22; box-shadow: inset 0 -3px 0 rgba(255, 255, 255, 0.08); }
.tfs-keys-key--down.tfs-keys-key--white { background: color-mix(in srgb, var(--clip, #4f9cf9) 55%, #ececf0); }
.tfs-keys-key--down.tfs-keys-key--black { background: var(--clip, #4f9cf9); }
.tfs-keys-key::after { position: absolute; left: 0; right: 0; bottom: 6px; text-align: center; font-size: 10px; line-height: 1; pointer-events: none; content: attr(data-letter); color: #8a8a94; }
.tfs-keys-key--black::after { color: #8a8a94; bottom: 5px; }
.tfs-keys-key[data-name]::before { position: absolute; left: 0; right: 0; bottom: 20px; text-align: center; font-size: 10px; font-weight: 600; line-height: 1; pointer-events: none; content: attr(data-name); color: #55555e; }
.tfs-keys-empty { padding: 20px 12px; color: var(--tfs-display-muted, #9a9aa2); }
@media (max-width: 600px) { .tfs-keys-velocity { display: none; } }
@media (pointer: coarse) { .tfs-keys-key::after { content: none; } .tfs-keys-board { --tfs-keys-height: 140px; min-width: calc(var(--whites) * 40px); } }
`;

/** Add the control styles to a document once. */
export const injectControlStyles = (doc: Document) => {
  if (doc.getElementById('tfs-control-styles')) return;

  const style = doc.createElement('style');

  style.id = 'tfs-control-styles';
  style.textContent = CONTROL_STYLES;
  doc.head.prepend(style);
};
