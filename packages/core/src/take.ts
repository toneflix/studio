import type { Note } from './types.ts';

/**
 * Notes played live, with their times on the timeline. A note starts on `down`
 * and gets its length on `up`; `finish` ends every note still held.
 */
export class NoteTake {
  private readonly done: Note[] = [];
  private readonly held = new Map<number, { start: number; velocity: number }>();

  down(pitch: number, velocity: number, time: number) {
    if (this.held.has(pitch)) this.up(pitch, time);
    this.held.set(pitch, { start: time, velocity });
  }

  up(pitch: number, time: number) {
    const note = this.held.get(pitch);
    if (!note) return;

    this.held.delete(pitch);
    this.done.push({ pitch, start: note.start, duration: Math.max(0.01, time - note.start), velocity: note.velocity });
  }

  /** Every note so far, held ones lasting until `time`, in order of their starts. */
  notes(time: number): Note[] {
    const held = [...this.held].map(([pitch, note]) => ({ pitch, start: note.start, duration: Math.max(0.01, time - note.start), velocity: note.velocity }));

    return [...this.done, ...held].sort((a, b) => a.start - b.start || a.pitch - b.pitch);
  }

  /** End the notes still held at `time`. Returns every note. */
  finish(time: number) {
    for (const pitch of [...this.held.keys()]) this.up(pitch, time);

    return this.notes(time);
  }

  get empty() {
    return !this.done.length && !this.held.size;
  }
}
