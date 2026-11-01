import type { AudioEngine } from '@toneflix/studio-audio';
import { timelineEnd } from '@toneflix/studio-core';
import type { StudioTimeline } from '@toneflix/studio-timeline';
import { clockTime } from './display.ts';
import { renderIcon, type IconSet } from './icons.ts';

/** A row of the info dialog: a label and its value. */
export type InfoRow = [label: string, value: string];

/** The rows the info dialog shows by default. */
export const sessionInfo = (timeline: StudioTimeline): InfoRow[] => {
  const { state, grid } = timeline;

  return [
    ['Tracks', String(state.tracks.length)],
    ['Clips', String(state.clips.length)],
    ['Selected', String(timeline.selection.length)],
    ['Playhead', clockTime(timeline.time)],
    ['Length', clockTime(timelineEnd(state))],
    ['Tempo', `${grid.bpm} BPM`],
    ['Time signature', grid.meter.join('/')],
  ];
};

export interface InfoDialogOptions {
  title: string;
  closeLabel: string;
  icons: Partial<IconSet>;
  /** All the rows to show, read again whenever the dialog refreshes */
  rows: () => InfoRow[];
}

/**
 * A modal dialog that lists details about the session. It stays up to date
 * while open, through `update()`.
 */
export const createInfoDialog = (doc: Document, timeline: StudioTimeline, engine: AudioEngine | undefined, options: InfoDialogOptions) => {
  const dialog = doc.createElement('dialog');
  const head = doc.createElement('div');
  const title = doc.createElement('h2');
  const close = doc.createElement('button');
  const list = doc.createElement('dl');
  let frame = 0;

  const update = () => {
    if (!dialog.open) return;

    list.replaceChildren(
      ...options.rows().flatMap(([label, value]) => {
        const term = doc.createElement('dt');
        const detail = doc.createElement('dd');

        term.textContent = label;
        detail.textContent = value;

        return [term, detail];
      }),
    );
  };
  const follow = () => {
    update();
    frame = dialog.open && engine?.isPlaying && typeof requestAnimationFrame === 'function' ? requestAnimationFrame(follow) : 0;
  };

  dialog.className = 'tfs-dialog';
  head.className = 'tfs-dialog-head';
  title.textContent = options.title;
  close.type = 'button';
  close.className = 'tfs-tool';
  close.title = options.closeLabel;
  close.setAttribute('aria-label', options.closeLabel);
  close.append(renderIcon(doc, 'close', options.icons));
  close.addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', (e) => e.target === dialog && dialog.close());
  dialog.addEventListener('close', () => frame && cancelAnimationFrame(frame));
  head.append(title, close);
  dialog.append(head, list);
  dialog.setAttribute('aria-label', options.title);
  doc.body.append(dialog);

  const off = [timeline.on('change', update), timeline.on('select', update), timeline.on('seek', update), engine?.on('play', follow), engine?.on('pause', update)];

  return {
    element: dialog,
    open() {
      if (!dialog.open) dialog.showModal();
      follow();
    },
    update,
    destroy() {
      for (const unsubscribe of off) unsubscribe?.();
      if (frame) cancelAnimationFrame(frame);
      dialog.remove();
    },
  };
};
