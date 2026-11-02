import type { Clip, Note, TimelineState } from './types.ts';

/** Note numbers from 0 to 127, as in MIDI. */
export const MIN_PITCH = 0;
export const MAX_PITCH = 127;

const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

/** A note number's name, with middle C (60) as C4. */
export const noteName = (pitch: number) => `${NAMES[pitch % 12]}${Math.floor(pitch / 12) - 1}`;

/** Whether a note number is a black key. */
export const isBlackKey = (pitch: number) => [1, 3, 6, 8, 10].includes(pitch % 12);

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/** The picked notes, or every note when none are picked. */
const targets = (notes: readonly Note[], picked: ReadonlySet<number>) => (picked.size ? picked : new Set(notes.keys()));

/**
 * Replace a note clip's notes. Note clips that share its source are copies of one
 * pattern, so they all get the notes.
 */
export const replaceNotes = (state: TimelineState, id: string, notes: readonly Note[]): TimelineState => {
  const source = state.clips.find((clip) => clip.id === id && clip.notes)?.source;
  if (source === undefined) return state;

  return { ...state, clips: state.clips.map((clip): Clip => (clip.notes && clip.source === source ? { ...clip, notes } : clip)) };
};

/**
 * Move notes by a time and a number of semitones. The shift is held back so the
 * earliest note stays at or after 0 and every pitch stays on the keyboard.
 */
export const moveNotes = (notes: readonly Note[], picked: ReadonlySet<number>, time: number, semitones: number) => {
  const moving = notes.filter((_, i) => picked.has(i));
  if (!moving.length) return notes;

  const earliest = Math.min(...moving.map((n) => n.start));
  const lowest = Math.min(...moving.map((n) => n.pitch));
  const highest = Math.max(...moving.map((n) => n.pitch));
  const shift = Math.max(time, -earliest);
  const steps = clamp(Math.round(semitones), MIN_PITCH - lowest, MAX_PITCH - highest);

  if (!shift && !steps) return notes;

  return notes.map((n, i) => (picked.has(i) ? { ...n, start: n.start + shift, pitch: n.pitch + steps } : n));
};

/** Lengthen or shorten notes by a time, keeping each at least `min` long. */
export const resizeNotes = (notes: readonly Note[], picked: ReadonlySet<number>, by: number, min: number) =>
  notes.map((n, i) => (picked.has(i) ? { ...n, duration: Math.max(min, n.duration + by) } : n));

/** Change the velocity of notes by an amount, between 0.01 and 1. */
export const changeVelocity = (notes: readonly Note[], picked: ReadonlySet<number>, by: number) =>
  notes.map((n, i) => (picked.has(i) ? { ...n, velocity: clamp(n.velocity + by, 0.01, 1) } : n));

/** Put note starts on the grid; `round` takes and gives a time from the clip's content start. Every note when none are picked. */
export const quantizeNotes = (notes: readonly Note[], picked: ReadonlySet<number>, round: (time: number) => number) => {
  const which = targets(notes, picked);

  return notes.map((n, i) => (which.has(i) ? { ...n, start: Math.max(0, round(n.start)) } : n));
};

/** Notes without the picked ones. */
export const deleteNotes = (notes: readonly Note[], picked: ReadonlySet<number>) => notes.filter((_, i) => !picked.has(i));

/**
 * Copies of the picked notes, right after them, added at the end of the list.
 * `gap` rounds the shift up, for example to whole bars. Returns the notes and the copies' indices.
 */
export const duplicateNotes = (notes: readonly Note[], picked: ReadonlySet<number>, gap = 0) => {
  const copies = notes.filter((_, i) => picked.has(i));
  if (!copies.length) return { notes, created: new Set<number>() };

  const from = Math.min(...copies.map((n) => n.start));
  const to = Math.max(...copies.map((n) => n.start + n.duration));
  const span = gap > 0 ? Math.ceil((to - from) / gap - 1e-6) * gap : to - from;
  const created = new Set(copies.map((_, i) => notes.length + i));

  return { notes: [...notes, ...copies.map((n) => ({ ...n, start: n.start + span }))], created };
};
