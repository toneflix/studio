import { Emitter } from './emitter.ts';

/** One undoable step. */
export interface HistoryEntry {
  label: string;
  undo(): void;
  redo(): void;
}

export interface HistoryInfo {
  canUndo: boolean;
  canRedo: boolean;
  undoLabel?: string;
  redoLabel?: string;
}

/**
 * The editor's single undo history. The timeline pushes its edits here, and the
 * host app can push its own steps (mixer, effects, tempo) into the same list.
 */
export class History extends Emitter<{ change: HistoryInfo }> {
  private done: HistoryEntry[] = [];
  private undone: HistoryEntry[] = [];
  private busy = false;
  readonly limit: number;

  constructor(limit = 200) {
    super();
    this.limit = limit;
  }

  /** Record a step that has already been applied. */
  push(entry: HistoryEntry) {
    if (this.busy) return;

    this.done.push(entry);
    if (this.done.length > this.limit) this.done.shift();
    this.undone = [];
    this.changed();
  }

  undo() {
    const entry = this.done.pop();
    if (!entry) return false;

    this.run(() => entry.undo());
    this.undone.push(entry);
    this.changed();

    return true;
  }

  redo() {
    const entry = this.undone.pop();
    if (!entry) return false;

    this.run(() => entry.redo());
    this.done.push(entry);
    this.changed();

    return true;
  }

  clear() {
    this.done = [];
    this.undone = [];
    this.changed();
  }

  get info(): HistoryInfo {
    return {
      canUndo: this.done.length > 0,
      canRedo: this.undone.length > 0,
      undoLabel: this.done.at(-1)?.label,
      redoLabel: this.undone.at(-1)?.label,
    };
  }

  get canUndo() {
    return this.done.length > 0;
  }

  get canRedo() {
    return this.undone.length > 0;
  }

  /** Steps that undo and redo run don't record new entries. */
  private run(fn: () => void) {
    this.busy = true;

    try {
      fn();
    } finally {
      this.busy = false;
    }
  }

  private changed() {
    this.emit('change', this.info);
  }
}
