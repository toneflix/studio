import { DRUM_NAMES } from '@toneflix/studio-audio';
import { noteName, notesOnStep, setSwing, swingOf, toggleStep, type Clip, type Note } from '@toneflix/studio-core';

export interface StepGridLabels {
  /** The pattern length menu, in bars */
  length: string;
  swing: string;
  accent: string;
}

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
    const rows = drums ? [...new Set([...DRUM_ROWS, ...used])] : [...new Set([...SCALE, ...used])].sort((a, b) => b - a);
    const perBeat = Math.max(1, Math.round(this.host.bar() / step / 4));
    const key = [count, rows.join(','), perBeat].join('|');

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
        ...rows.map((pitch) => {
          const row = this.doc.createElement('div');
          const name = this.doc.createElement('div');

          row.className = 'tfs-steps-row';
          row.setAttribute('role', 'row');
          name.className = 'tfs-steps-name';
          name.textContent = drums ? (DRUM_NAMES[pitch] ?? noteName(pitch)) : noteName(pitch);
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
