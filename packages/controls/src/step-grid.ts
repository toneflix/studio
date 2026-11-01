import { DRUM_NAMES } from '@toneflix/studio-audio';
import { noteName, notesOnStep, setSwing, swingOf, toggleStep, type Clip, type Note, type SampleRef } from '@toneflix/studio-core';
import { openMenu, type MenuItem } from '@toneflix/studio-timeline';
import { DRAG_TYPE, draggedSound, type DraggedSound } from './browser.ts';

export interface StepGridLabels {
  /** The pattern length menu, in bars */
  length: string;
  swing: string;
  accent: string;
  /** A row's menu: pick an audio file for it */
  loadSample: string;
  /** A drum row's menu: go back to the kit's own sound */
  builtInSound: string;
  removeSample: string;
  /** Removes a pad that has no built-in sound, with its notes */
  removePad: string;
  /** Adds a row for a new sample */
  addPad: string;
}

/** Audio for a sample: a file from the device or a sound dragged from a library. */
export type SampleInput = File | DraggedSound;

/** A drop's audio: the first audio file, or the library sound being dragged. */
export const sampleInputOf = (e: DragEvent): SampleInput | null => {
  const file = [...(e.dataTransfer?.files ?? [])].find((f) => f.type.startsWith('audio/') || /\.(wav|mp3|ogg|oga|flac|m4a|aac|aiff?|webm|opus)$/i.test(f.name));

  return file ?? (e.dataTransfer?.types.includes(DRAG_TYPE) ? draggedSound() : null);
};

/** Whether a drag may carry audio for a sample. */
export const mayCarrySample = (e: DragEvent) => !!e.dataTransfer?.types.some((type) => type === 'Files' || (type === DRAG_TYPE && !!draggedSound()));

/** Ask for one audio file from the device. */
export const pickAudioFile = (doc: Document) =>
  new Promise<File | null>((resolve) => {
    const input = doc.createElement('input');

    input.type = 'file';
    input.accept = 'audio/*';
    input.addEventListener('change', () => resolve(input.files?.[0] ?? null), { once: true });
    input.addEventListener('cancel', () => resolve(null), { once: true });
    input.click();
  });

/** What the step grid needs from the editor around it. */
export interface StepGridHost {
  /** The open note clip, and whether its track plays drums */
  clip(): { clip: Clip; drums: boolean } | null;
  /** Seconds in one step and one bar at the clip's start */
  step(): number;
  bar(): number;
  editable(): boolean;
  draft(label: string, notes: readonly Note[]): void;
  commit(label: string): void;
  cancel(): void;
  setLength(duration: number): void;
  audition(pitch: number, velocity: number): void;
  /**
   * How the track's instrument takes samples: one per drum pad, one per root note
   * on a sampler, or none.
   */
  sampling(): 'pads' | 'zones' | null;
  /** The samples on the track's instrument, by note number */
  samples(): ReadonlyMap<number, SampleRef>;
  /** Put a sample on a note, or take it off with null */
  useSample(pitch: number, input: SampleInput | null): void;
  /** Take a pad's sample off and delete its notes, as one undo step */
  removePad(pitch: number): void;
}

/** The kit pieces in the order the grid lists them. */
const DRUM_ROWS = [36, 38, 39, 37, 42, 44, 46, 45, 47, 50, 49, 51, 56];
/** C major from C4 up to C5, the rows of a grid for other instruments */
const SCALE = [72, 71, 69, 67, 65, 64, 62, 60];
const LENGTHS = [1, 2, 4, 8, 16];
const NORMAL = 0.8;

type Paint = { id: number; mode: 'add' | 'remove' | 'accent'; base: readonly Note[]; done: Set<string>; mouse: boolean; started: boolean };

/**
 * A step sequencer view of a note clip: a row per drum (or note) and a column per
 * step, over the clip's notes. Steps turn on and off with a click or tap, a mouse
 * drag paints them, and the length and swing apply to the whole clip.
 */
export class StepGrid {
  readonly root: HTMLDivElement;
  private readonly doc: Document;
  private readonly host: StepGridHost;
  private readonly labels: StepGridLabels;
  private readonly lengthSelect: HTMLSelectElement;
  private readonly swingInput: HTMLInputElement;
  private readonly swingOutput: HTMLOutputElement;
  private readonly accentButton: HTMLButtonElement;
  private readonly scroller: HTMLDivElement;
  private readonly table: HTMLDivElement;
  private paint: Paint | null = null;
  private swingBase: readonly Note[] | null = null;
  private accent = false;
  /** Swing set by hand per clip, kept while no note sits on a swung step yet */
  private readonly swings = new Map<string, number>();
  private key = '';
  private playing = -1;
  private readonly addPadButton: HTMLButtonElement;

  constructor(doc: Document, host: StepGridHost, labels: StepGridLabels) {
    const el = <K extends keyof HTMLElementTagNameMap>(tag: K, className: string, parent?: HTMLElement) => {
      const node = doc.createElement(tag);

      node.className = className;
      parent?.append(node);

      return node;
    };

    this.doc = doc;
    this.host = host;
    this.labels = labels;
    this.root = el('div', 'tfs-steps');

    const bar = el('div', 'tfs-steps-bar', this.root);
    const length = el('label', 'tfs-roll-snap', bar);
    const swing = el('label', 'tfs-roll-snap tfs-steps-swing', bar);

    length.append(labels.length);
    this.lengthSelect = el('select', '', length);
    swing.append(labels.swing);
    this.swingInput = el('input', '', swing);
    this.swingInput.type = 'range';
    this.swingInput.min = '0';
    this.swingInput.max = '0.5';
    this.swingInput.step = '0.01';
    this.swingOutput = el('output', 'tfs-steps-value', swing);
    this.accentButton = el('button', 'tfs-roll-text', bar);
    this.accentButton.type = 'button';
    this.accentButton.textContent = labels.accent;
    this.accentButton.setAttribute('aria-pressed', 'false');
    this.scroller = el('div', 'tfs-steps-scroller', this.root);
    this.table = el('div', 'tfs-steps-table', this.scroller);
    this.table.setAttribute('role', 'grid');
    this.addPadButton = el('button', 'tfs-steps-add', this.scroller);
    this.addPadButton.type = 'button';
    this.addPadButton.textContent = `+ ${labels.addPad}`;
    this.addPadButton.addEventListener('click', () => void this.pick(this.freePad()));
    this.listenForDrops(this.addPadButton, () => this.freePad());
    this.table.addEventListener('click', (e) => {
      const name = (e.target as HTMLElement).closest<HTMLElement>('.tfs-steps-name');

      if (name?.dataset.pitch) this.openRowMenu(Number(name.dataset.pitch), name);
    });
    this.listenForDrops(this.table, (e) => {
      const row = (e.target as HTMLElement).closest<HTMLElement>('.tfs-steps-row');

      return row?.dataset.pitch ? Number(row.dataset.pitch) : null;
    });

    this.lengthSelect.addEventListener('change', () => this.host.setLength(Number(this.lengthSelect.value) * this.host.bar()));
    this.swingInput.addEventListener('input', () => this.onSwing(false));
    this.swingInput.addEventListener('change', () => this.onSwing(true));
    this.accentButton.addEventListener('click', () => {
      this.accent = !this.accent;
      this.accentButton.setAttribute('aria-pressed', String(this.accent));
    });
    this.table.addEventListener('pointerdown', (e) => this.onDown(e));
    this.table.addEventListener('pointermove', (e) => this.onMove(e));
    this.table.addEventListener('pointerup', (e) => this.onUp(e, false));
    this.table.addEventListener('pointercancel', (e) => this.onUp(e, true));
  }

  /** Draw the grid for the open clip. */
  render() {
    const open = this.host.clip();
    if (!open?.clip.notes) return;

    const { clip, drums } = open;
    const notes = clip.notes!;
    const step = this.host.step();
    const swing = this.swingBase ? Number(this.swingInput.value) : this.swingFor(clip, step);
    const count = Math.max(1, Math.round((clip.offset + clip.duration) / step));
    const used = notes.map((note) => note.pitch);
    const sampling = this.host.sampling();
    const samples = this.host.samples();
    const sampled = [...samples.keys()];
    const rows = drums ? [...new Set([...DRUM_ROWS, ...used, ...sampled])] : [...new Set([...SCALE, ...used, ...sampled])].sort((a, b) => b - a);
    const perBeat = Math.max(1, Math.round(this.host.bar() / step / 4));
    const names = rows.map((pitch) => samples.get(pitch)?.name ?? (drums ? (DRUM_NAMES[pitch] ?? noteName(pitch)) : noteName(pitch)));
    const key = [count, rows.join(','), perBeat, names.join('\n'), sampling, this.host.editable()].join('|');

    this.addPadButton.hidden = sampling !== 'pads' || !this.host.editable();

    if (!this.swingBase) {
      this.swingInput.value = String(swing);
      this.swingOutput.value = `${Math.round(50 + swing * 50)}%`;
    }

    this.renderLength(clip);
    this.swingInput.disabled = this.lengthSelect.disabled = !this.host.editable();

    if (key !== this.key) {
      this.key = key;
      this.table.style.setProperty('--tfs-steps', String(count));
      this.table.replaceChildren(
        ...rows.map((pitch, i) => {
          const row = this.doc.createElement('div');
          const menu = !!sampling && this.host.editable();
          const name = this.doc.createElement(menu ? 'button' : 'div');

          row.className = `tfs-steps-row${samples.has(pitch) ? ' tfs-steps-row--sample' : ''}`;
          row.setAttribute('role', 'row');
          row.dataset.pitch = String(pitch);
          name.className = 'tfs-steps-name';
          name.textContent = names[i]!;
          name.title = samples.has(pitch) ? `${names[i]} (${noteName(pitch)})` : names[i]!;
          name.dataset.pitch = String(pitch);
          if (name instanceof HTMLButtonElement) {
            name.type = 'button';
            name.setAttribute('aria-haspopup', 'menu');
          }
          row.append(name);

          for (let index = 0; index < count; index++) {
            const cell = this.doc.createElement('div');

            cell.className = `tfs-step${Math.floor(index / perBeat) % 2 ? ' tfs-step--odd' : ''}`;
            cell.setAttribute('role', 'gridcell');
            cell.dataset.pitch = String(pitch);
            cell.dataset.step = String(index);
            row.append(cell);
          }

          return row;
        }),
      );
      this.playing = -1;
    }

    for (const cell of this.table.querySelectorAll<HTMLElement>('.tfs-step')) {
      const on = notesOnStep(notes, Number(cell.dataset.pitch), Number(cell.dataset.step), step, swing);
      const velocity = on.length ? Math.max(...on.map((i) => notes[i]!.velocity)) : 0;

      cell.classList.toggle('tfs-step--on', on.length > 0);
      cell.classList.toggle('tfs-step--accent', velocity > NORMAL + 0.05);
      cell.setAttribute('aria-selected', String(on.length > 0));
    }
  }

  /** Light the column of the step at a time from the clip's content start, or none. */
  setPlaying(time: number | null) {
    const step = this.host.step();
    const index = time === null || time < 0 ? -1 : Math.floor(time / step);

    if (index === this.playing) return;

    for (const cell of this.table.querySelectorAll(`[data-step="${this.playing}"]`)) cell.classList.remove('tfs-step--playing');
    for (const cell of this.table.querySelectorAll(`[data-step="${index}"]`)) cell.classList.add('tfs-step--playing');

    this.playing = index;
  }

  /** A row's sample menu: load a file, or go back to no sample. */
  private openRowMenu(pitch: number, anchor: HTMLElement) {
    const sampling = this.host.sampling();
    if (!sampling || !this.host.editable()) return;

    const box = anchor.getBoundingClientRect();
    const sample = this.host.samples().get(pitch);
    const builtIn = sampling === 'pads' && pitch in DRUM_NAMES;
    const items: MenuItem[] = [{ label: this.labels.loadSample, onSelect: () => void this.pick(pitch) }];

    if (sampling === 'pads' && !builtIn) items.push({ label: this.labels.removePad, onSelect: () => this.host.removePad(pitch) });
    else if (sample) items.push({ label: builtIn ? this.labels.builtInSound : this.labels.removeSample, onSelect: () => this.host.useSample(pitch, null) });

    openMenu(this.doc, { x: box.left, y: box.bottom + 2 }, items, sample?.name ?? anchor.textContent ?? '');
  }

  private async pick(pitch: number) {
    const file = await pickAudioFile(this.doc);

    if (file) this.host.useSample(pitch, file);
  }

  /** The first note from C4 up with no row yet, for a new pad. */
  private freePad() {
    const taken = new Set([...DRUM_ROWS, ...(this.host.clip()?.clip.notes ?? []).map((note) => note.pitch), ...this.host.samples().keys()]);
    let pitch = 60;

    while (taken.has(pitch) && pitch < 127) pitch++;

    return pitch;
  }

  /** Dropping an audio file or a library sound on a target puts it on the note `pitchOf` gives. */
  private listenForDrops(target: HTMLElement, pitchOf: (e: DragEvent) => number | null) {
    target.addEventListener('dragover', (e) => {
      if (!this.host.sampling() || !this.host.editable() || !mayCarrySample(e) || pitchOf(e) === null) return;

      e.preventDefault();
      e.dataTransfer!.dropEffect = 'copy';
    });
    target.addEventListener('drop', (e) => {
      const pitch = pitchOf(e);
      const input = sampleInputOf(e);
      if (!this.host.sampling() || !this.host.editable() || pitch === null || !input) return;

      e.preventDefault();
      e.stopPropagation();
      this.host.useSample(pitch, input);
    });
  }

  private renderLength(clip: Clip) {
    const bars = Math.round(((clip.offset + clip.duration) / this.host.bar()) * 100) / 100;
    const choices = LENGTHS.includes(bars) ? LENGTHS : [...LENGTHS, bars].sort((a, b) => a - b);

    if (this.lengthSelect.options.length !== choices.length) {
      this.lengthSelect.replaceChildren(
        ...choices.map((n) => {
          const option = this.doc.createElement('option');

          option.value = String(n);
          option.textContent = String(n);

          return option;
        }),
      );
    }

    this.lengthSelect.value = String(bars);
  }

  /** The clip's swing: read from its notes, or the one last set when no note shows it. */
  private swingFor(clip: Clip, step: number) {
    const notes = clip.notes ?? [];
    const swung = notes.some((note) => Math.floor(note.start / step + 1e-6) % 2 === 1);

    return swung ? swingOf(notes, step) : (this.swings.get(clip.id) ?? 0);
  }

  private onSwing(final: boolean) {
    const clip = this.host.clip()?.clip;
    const notes = clip?.notes;
    if (!clip || !notes || !this.host.editable()) return;

    const step = this.host.step();
    const to = Number(this.swingInput.value);

    this.swingBase ??= notes;
    this.swingOutput.value = `${Math.round(50 + to * 50)}%`;

    const next = setSwing(this.swingBase, step, this.swingFor({ ...clip, notes: this.swingBase }, step), to);

    this.swings.set(clip.id, to);

    if (final) {
      this.swingBase = null;
      this.host.draft('Swing', next);
      this.host.commit('Swing');
    } else this.host.draft('Swing', next);
  }

  private cellAt(x: number, y: number) {
    const cell = this.doc.elementFromPoint(x, y)?.closest<HTMLElement>('.tfs-step');

    return cell && this.table.contains(cell) ? cell : null;
  }

  private onDown(e: PointerEvent) {
    // Focusing a row name would scroll the grid, which closes the menu it opens
    if ((e.target as HTMLElement).closest('button.tfs-steps-name')) e.preventDefault();

    const cell = (e.target as HTMLElement).closest<HTMLElement>('.tfs-step');
    const notes = this.host.clip()?.clip.notes;
    if (!cell || !notes || e.button !== 0 || this.paint || !this.host.editable()) return;

    const step = this.host.step();
    const swing = this.swingFor(this.host.clip()!.clip, step);
    const on = notesOnStep(notes, Number(cell.dataset.pitch), Number(cell.dataset.step), step, swing);
    const accented = on.some((i) => notes[i]!.velocity > NORMAL + 0.05);
    const mode = !on.length ? 'add' : this.accent && !accented ? 'accent' : 'remove';
    const mouse = e.pointerType === 'mouse';

    this.paint = { id: e.pointerId, mode, base: notes, done: new Set(), mouse, started: false };

    // A mouse paints as it drags; a touch counts only as a tap, so a swipe still scrolls
    if (mouse) {
      e.preventDefault();
      this.table.setPointerCapture(e.pointerId);
      this.apply(cell);
    }
  }

  private onMove(e: PointerEvent) {
    const paint = this.paint;
    if (!paint || paint.id !== e.pointerId || !paint.mouse) return;

    const cell = this.cellAt(e.clientX, e.clientY);

    if (cell) this.apply(cell);
  }

  private onUp(e: PointerEvent, cancelled: boolean) {
    const paint = this.paint;
    if (!paint || paint.id !== e.pointerId) return;

    this.paint = null;

    if (cancelled) {
      if (paint.started) this.host.cancel();

      return;
    }

    if (!paint.mouse) {
      const cell = this.cellAt(e.clientX, e.clientY);

      this.paint = paint;
      if (cell) this.apply(cell);
      this.paint = null;
    }

    if (paint.started) this.host.commit('Steps');
  }

  /** Paint one cell in the gesture's mode, once per gesture. */
  private apply(cell: HTMLElement) {
    const paint = this.paint;
    const open = this.host.clip();
    if (!paint || !open?.clip.notes) return;

    const id = `${cell.dataset.pitch}:${cell.dataset.step}`;
    if (paint.done.has(id)) return;

    const pitch = Number(cell.dataset.pitch);
    const index = Number(cell.dataset.step);
    const step = this.host.step();
    const notes = open.clip.notes;
    const swing = this.swingFor({ ...open.clip, notes: paint.base }, step);
    const on = notesOnStep(notes, pitch, index, step, swing);
    const velocity = this.accent ? 1 : NORMAL;
    let next = notes;

    if (paint.mode === 'add' && !on.length) {
      next = toggleStep(notes, pitch, index, step, swing, velocity);
      this.host.audition(pitch, velocity);
    } else if (paint.mode === 'remove' && on.length) next = toggleStep(notes, pitch, index, step, swing, velocity);
    else if (paint.mode === 'accent' && on.length) {
      next = notes.map((note, i) => (on.includes(i) ? { ...note, velocity: 1 } : note));
      this.host.audition(pitch, 1);
    }

    paint.done.add(id);

    if (next !== notes) {
      paint.started = true;
      this.host.draft('Steps', next);
    }
  }
}
