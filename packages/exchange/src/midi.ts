import { addClips, addTrack, Grid, makeNoteClip, uid, type Clip, type Marker, type Note, type TempoChange, type TimelineState, type Track } from '@toneflix/studio-core';
import type { StudioTimeline } from '@toneflix/studio-timeline';

/** Ticks per quarter note in the files written. */
const PPQ = 960;

/** General MIDI's drum channel, 10, counted from 0. */
const DRUM_CHANNEL = 9;

/** One part of a MIDI file: the notes of one track on one channel. */
export interface MidiPart {
  name: string;
  /** Plays on General MIDI's drum channel (10) */
  drums: boolean;
  /** MIDI channel, from 0 */
  channel: number;
  /** Notes in seconds from the start of the song */
  notes: Note[];
}

/** What a MIDI file holds, timed in seconds. */
export interface MidiSong {
  /** Tempo at the start, in quarter notes per minute */
  bpm: number;
  meter: [number, number];
  /** Tempo and meter changes after the start */
  tempo: TempoChange[];
  markers: Marker[];
  parts: MidiPart[];
  /** Seconds to the end of the last note */
  duration: number;
}

export interface MidiExportOptions {
  /** Tempo at the start; 120 when left out */
  bpm?: number;
  meter?: [number, number];
  /** Tracks to write, by id; every instrument track when left out */
  tracks?: readonly string[];
  /** Written as the song's name */
  name?: string;
}

export interface MidiImportOptions {
  /**
   * Times notes on this grid instead of the file's own tempo, so they keep their
   * bars and beats in a project with another tempo.
   */
  grid?: Grid;
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/** A number as a MIDI variable-length quantity. */
const varLength = (value: number) => {
  const bytes = [value & 0x7f];

  for (let rest = value >>> 7; rest > 0; rest >>>= 7) bytes.unshift((rest & 0x7f) | 0x80);

  return bytes;
};

const text = (value: string) => [...new TextEncoder().encode(value)];

const u32 = (value: number) => [(value >>> 24) & 0xff, (value >>> 16) & 0xff, (value >>> 8) & 0xff, value & 0xff];

interface Event {
  tick: number;
  /** Sorts events at the same tick: meta first, note offs before note ons */
  order: number;
  bytes: number[];
}

const meta = (tick: number, type: number, data: number[]): Event => ({ tick, order: 0, bytes: [0xff, type, ...varLength(data.length), ...data] });

/** A track chunk from its events, ending with End of Track. */
const chunk = (events: Event[]) => {
  const sorted = [...events].sort((a, b) => a.tick - b.tick || a.order - b.order);
  const data: number[] = [];
  let last = 0;

  for (const event of sorted) {
    data.push(...varLength(event.tick - last), ...event.bytes);
    last = event.tick;
  }

  data.push(0, 0xff, 0x2f, 0);

  return [...text('MTrk'), ...u32(data.length), ...data];
};

/** The notes a clip plays, in seconds on the timeline: cut where the clip is trimmed, scaled by its gain. */
const clipNotes = (clip: Clip) => {
  const origin = clip.start - clip.offset;
  const end = clip.offset + clip.duration;

  return (clip.notes ?? [])
    .filter((note) => note.start < end && note.start + note.duration > clip.offset)
    .map((note) => {
      const start = Math.max(note.start, clip.offset);

      return {
        pitch: note.pitch,
        start: origin + start,
        duration: Math.min(note.start + note.duration, end) - start,
        velocity: note.velocity * clip.gain,
      };
    });
};

/**
 * Write instrument tracks as a Standard MIDI File (type 1). The first track holds
 * the tempo map, meters and markers; then each instrument track becomes a MIDI
 * track with its note clips, drum tracks on channel 10 and the others on their
 * own channels. Muted parts of trimmed clips are left out.
 */
export const toMidi = (state: TimelineState, options: MidiExportOptions = {}) => {
  const grid = new Grid({ bpm: options.bpm ?? 120, meter: options.meter ?? [4, 4] });

  grid.setTempo(state.tempo);

  const tick = (time: number) => Math.max(0, Math.round(grid.quarters(time) * PPQ));
  const wanted = options.tracks ? new Set(options.tracks) : null;
  const tracks = state.tracks.filter((track) => (wanted ? wanted.has(track.id) : track.instrument));
  const tempo = (bpm: number) => {
    const micro = Math.round(60_000_000 / bpm);

    return [(micro >>> 16) & 0xff, (micro >>> 8) & 0xff, micro & 0xff];
  };
  const meter = ([beats, unit]: [number, number]) => [beats, Math.round(Math.log2(unit)), 24, 8];
  const conductor: Event[] = [meta(0, 0x51, tempo(grid.bpm)), meta(0, 0x58, meter(grid.meter))];

  if (options.name) conductor.unshift(meta(0, 0x03, text(options.name)));
  for (const change of grid.tempo) {
    conductor.push(meta(tick(change.time), 0x51, tempo(change.bpm)));
    if (change.meter) conductor.push(meta(tick(change.time), 0x58, meter(change.meter)));
  }
  for (const marker of state.markers ?? []) conductor.push(meta(tick(marker.time), 0x06, text(marker.name)));

  let melodic = 0;
  const chunks = tracks.map((track) => {
    const drums = track.instrument?.id === 'drums';
    // Channels 1 to 16 for melodic tracks, skipping the drum channel
    const channel = drums ? DRUM_CHANNEL : [0, 1, 2, 3, 4, 5, 6, 7, 8, 10, 11, 12, 13, 14, 15][melodic++ % 15]!;
    const events: Event[] = [meta(0, 0x03, text(track.name))];

    for (const clip of state.clips) {
      if (clip.track !== track.id || !clip.notes) continue;

      for (const note of clipNotes(clip)) {
        const pitch = clamp(Math.round(note.pitch), 0, 127);
        const on = tick(note.start);
        const off = Math.max(on + 1, tick(note.start + note.duration));

        events.push({ tick: on, order: 2, bytes: [0x90 | channel, pitch, clamp(Math.round(note.velocity * 127), 1, 127)] });
        events.push({ tick: off, order: 1, bytes: [0x80 | channel, pitch, 0] });
      }
    }

    return chunk(events);
  });

  const header = [...text('MThd'), ...u32(6), 0, 1, 0, chunks.length + 1, (PPQ >>> 8) & 0xff, PPQ & 0xff];

  return new Uint8Array([...header, ...chunk(conductor), ...chunks.flat()]);
};

interface RawNote {
  pitch: number;
  on: number;
  off: number;
  velocity: number;
}

/**
 * Read a Standard MIDI File (type 0 or 1). Each track's notes come back as one
 * part per channel, timed in seconds along the file's tempo map, or along
 * `grid` when given. Tempo, meter and marker events become the song's tempo map
 * and markers.
 */
export const fromMidi = (data: ArrayBuffer | Uint8Array, options: MidiImportOptions = {}): MidiSong => {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  const word = (at: number) => (bytes[at]! << 8) | bytes[at + 1]!;
  const long = (at: number) => ((bytes[at]! << 24) | (bytes[at + 1]! << 16) | (bytes[at + 2]! << 8) | bytes[at + 3]!) >>> 0;
  const tag = (at: number) => String.fromCharCode(...bytes.subarray(at, at + 4));

  if (bytes.length < 14 || tag(0) !== 'MThd') throw new Error('Not a MIDI file');

  const division = word(12);
  if (division & 0x8000) throw new Error('MIDI files timed in SMPTE frames are not supported');

  const ppq = division || PPQ;
  const tempos: { tick: number; bpm: number }[] = [];
  const meters: { tick: number; meter: [number, number] }[] = [];
  const marks: { tick: number; name: string }[] = [];
  const raw: { name: string; channel: number; notes: RawNote[] }[] = [];
  const decode = (from: number, to: number) => new TextDecoder().decode(bytes.subarray(from, to)).trim();
  let at = 8 + long(4);

  while (at + 8 <= bytes.length) {
    const size = long(at + 4);
    const end = Math.min(bytes.length, at + 8 + size);

    if (tag(at) !== 'MTrk') {
      at = end;
      continue;
    }

    let pos = at + 8;
    let tick = 0;
    let status = 0;
    let name = '';
    const held = new Map<number, { on: number; velocity: number }>();
    const parts = new Map<number, RawNote[]>();
    const read = () => {
      let value = 0;

      for (let i = 0; i < 4 && pos < end; i++) {
        const byte = bytes[pos++]!;

        value = (value << 7) | (byte & 0x7f);
        if (!(byte & 0x80)) break;
      }

      return value;
    };
    const release = (channel: number, pitch: number) => {
      const key = channel * 128 + pitch;
      const on = held.get(key);
      if (!on) return;

      held.delete(key);
      if (!parts.has(channel)) parts.set(channel, []);
      parts.get(channel)!.push({ pitch, on: on.on, off: Math.max(tick, on.on + 1), velocity: on.velocity });
    };

    while (pos < end) {
      tick += read();

      let byte = bytes[pos]!;

      if (byte & 0x80) pos++;
      else byte = status;

      if (byte === 0xff) {
        const type = bytes[pos++]!;
        const length = read();
        const from = pos;

        pos += length;
        if (type === 0x2f) break;
        if (type === 0x03 && !name) name = decode(from, pos);
        else if (type === 0x51 && length === 3) tempos.push({ tick, bpm: 60_000_000 / ((bytes[from]! << 16) | (bytes[from + 1]! << 8) | bytes[from + 2]!) });
        else if (type === 0x58 && length >= 2) meters.push({ tick, meter: [bytes[from]!, 2 ** bytes[from + 1]!] });
        else if (type === 0x06) marks.push({ tick, name: decode(from, pos) });
        continue;
      }

      if (byte === 0xf0 || byte === 0xf7) {
        pos += read();
        continue;
      }

      status = byte;

      const kind = byte & 0xf0;
      const channel = byte & 0x0f;
      const first = bytes[pos++]!;
      const second = kind === 0xc0 || kind === 0xd0 ? 0 : bytes[pos++]!;

      if (kind === 0x90 && second > 0) {
        release(channel, first);
        held.set(channel * 128 + first, { on: tick, velocity: second / 127 });
      } else if (kind === 0x80 || kind === 0x90) release(channel, first);
    }

    for (const key of [...held.keys()]) release(Math.floor(key / 128), key % 128);
    for (const [channel, notes] of [...parts].sort((a, b) => a[0] - b[0])) raw.push({ name, channel, notes });
    at = end;
  }

  tempos.sort((a, b) => a.tick - b.tick);
  meters.sort((a, b) => a.tick - b.tick);

  const startBpm = tempos.find((t) => t.tick === 0)?.bpm ?? 120;
  const startMeter = meters.find((m) => m.tick === 0)?.meter ?? [4, 4];
  const own = new Grid({ bpm: startBpm, meter: startMeter });
  const changes: TempoChange[] = [];
  const later = [...new Set([...tempos, ...meters].map((e) => e.tick).filter((t) => t > 0))].sort((a, b) => a - b);

  // Each change's time depends on the ones before it, so they are added one by one
  for (const at of later) {
    const time = own.timeAtQuarters(at / ppq);
    const bpm = [...tempos].reverse().find((t) => t.tick <= at)?.bpm ?? startBpm;
    const meter = meters.find((m) => m.tick === at)?.meter;

    changes.push({ id: uid('tempo'), time, bpm: Math.round(bpm * 1000) / 1000, ...(meter ? { meter } : {}) });
    own.setTempo(changes);
  }

  const grid = options.grid ?? own;
  const time = (tick: number) => grid.timeAtQuarters(tick / ppq);
  const counts = new Map<string, number>();
  const parts = raw.map((part, i): MidiPart => {
    const drums = part.channel === DRUM_CHANNEL;
    const base = part.name || (drums ? 'Drums' : `Track ${i + 1}`);
    const seen = (counts.get(base) ?? 0) + 1;

    counts.set(base, seen);

    return {
      name: seen > 1 ? `${base} ${seen}` : base,
      drums,
      channel: part.channel,
      notes: part.notes
        .map((note) => ({ pitch: note.pitch, start: time(note.on), duration: Math.max(0.01, time(note.off) - time(note.on)), velocity: note.velocity }))
        .sort((a, b) => a.start - b.start || a.pitch - b.pitch),
    };
  });

  return {
    bpm: Math.round(startBpm * 1000) / 1000,
    meter: startMeter,
    tempo: options.grid ? [] : changes,
    markers: marks.map((mark) => ({ id: uid('m'), time: time(mark.tick), name: mark.name })),
    parts,
    duration: Math.max(0, ...parts.flatMap((part) => part.notes.map((note) => note.start + note.duration))),
  };
};

/**
 * A note clip that plays a part from a time on the timeline. Notes keep their
 * times from the start of the song, so parts of one file stay in step. The clip
 * lasts `length` seconds, or to the last note, rounded up to whole bars when a
 * grid is given.
 */
export const midiClip = (part: MidiPart, track: string, at = 0, grid?: Grid, length?: number): Clip => {
  const last = Math.max(0.01, length ?? 0, ...part.notes.map((note) => note.start + note.duration));
  const duration = grid ? Math.ceil(last / grid.bar - 1e-6) * grid.bar : last;

  return makeNoteClip({ track, start: at, duration, notes: part.notes, name: part.name });
};

export interface ImportMidiOptions {
  /** Where the notes start on the timeline; the playhead's time is a good choice. 0 when left out */
  at?: number;
  /** Instrument for parts on the drum channel; the built-in drums when left out */
  drums?: Track['instrument'];
  /** Instrument for the other parts; the built-in synth when left out */
  synth?: Track['instrument'];
}

/**
 * Add a MIDI file to the timeline: one instrument track per part with a note
 * clip, timed on the timeline's own tempo so the notes keep their bars and
 * beats. Returns the new tracks.
 */
export const importMidi = async (file: Blob, timeline: StudioTimeline, options: ImportMidiOptions = {}) => {
  const song = fromMidi(await file.arrayBuffer(), { grid: timeline.grid });
  const parts = song.parts.filter((part) => part.notes.length);
  const tracks = parts.map(
    (part): Track => ({
      id: uid('t'),
      name: part.name,
      instrument: part.drums ? (options.drums ?? { id: 'drums' }) : (options.synth ?? { id: 'synth' }),
    }),
  );
  const clips = parts.map((part, i) => midiClip(part, tracks[i]!.id, options.at ?? 0, timeline.grid, song.duration));

  if (tracks.length) {
    timeline.model.apply('Import MIDI', (state) => addClips(tracks.reduce((next, track) => addTrack(next, track, next.tracks.length), state), clips));
  }

  return tracks;
};

/** The timeline's instrument tracks as a .mid file, with its tempo map and markers. */
export const exportMidi = (timeline: StudioTimeline, options: Omit<MidiExportOptions, 'bpm' | 'meter'> = {}) => {
  const data = toMidi(timeline.state, { ...options, bpm: timeline.grid.bpm, meter: timeline.grid.meter });
  const name = (options.name ?? 'song').replace(/[\\/:*?"<>|]+/g, '-').trim() || 'song';

  return { blob: new Blob([data], { type: 'audio/midi' }), fileName: `${name}.mid` };
};
