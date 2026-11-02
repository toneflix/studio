import {
  AUTOMATION_PARAMS,
  type AutomationParam,
  type AutomationPoint,
  type Clip,
  Grid,
  makeClip,
  makeNoteClip,
  type Note,
  type Marker,
  type TempoChange,
  type TimelineState,
  type Track,
} from '@toneflix/studio-core';

/** A track's mixer settings, as `mixer.snapshot()` keeps them. */
export interface ChannelValues {
  volume: number;
  pan: number;
  mute: boolean;
  solo: boolean;
}

export interface MixerValues {
  master?: Partial<ChannelValues>;
  tracks?: Record<string, Partial<ChannelValues>>;
}

export interface ReaperExportOptions {
  /** Tempo and meter at the start */
  bpm?: number;
  meter?: [number, number];
  /** Volume, pan, mute and solo of each track and the master */
  mixer?: MixerValues;
  /** Where a source's audio file is, relative to the project; `audio/<source>.wav` by default */
  file?: (source: string) => string;
  /** A track's colour when it has none of its own, like the timeline's `colorOf` */
  colorOf?: (track: Track) => string | undefined;
  /** Project notes, shown in REAPER under View > Project notes */
  notes?: string;
}

/** A REAPER project read back: the timeline state, the grid, the mixer and the audio files it uses. */
export interface ReaperProject {
  state: TimelineState;
  bpm: number;
  meter: [number, number];
  mixer: Required<MixerValues>;
  /** Source id to the file path written in the project */
  files: Record<string, string>;
  /** The project notes, if any */
  notes?: string;
}

/** Envelope chunk names, by setting */
const ENVELOPES: Record<AutomationParam, string> = { volume: 'VOLENV2', pan: 'PANENV2' };

const num = (value: number) => String(Math.round(value * 1e10) / 1e10);

const quote = (text: string) => {
  if (!text.includes('"')) return `"${text}"`;
  if (!text.includes("'")) return `'${text}'`;

  return `\`${text.replace(/`/g, "'")}\``;
};

const guid = () => {
  const hex = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-8xxx-xxxxxxxxxxxx'.replace(/x/g, () => Math.floor(Math.random() * 16).toString(16));

  return `{${hex.toUpperCase()}}`;
};

/** A CSS hex colour as REAPER's custom colour: 0x01BBGGRR. */
const reaperColor = (color: string | undefined) => {
  const hex = color?.match(/^#([0-9a-f]{6})$/i)?.[1];
  if (!hex) return null;

  const [r, g, b] = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16));

  return 0x1000000 | r! | (g! << 8) | (b! << 16);
};

const cssColor = (value: number) => {
  if (!(value & 0x1000000)) return undefined;

  const [r, g, b] = [value & 0xff, (value >> 8) & 0xff, (value >> 16) & 0xff];

  return `#${[r, g, b].map((c) => c.toString(16).padStart(2, '0')).join('')}`;
};

/** REAPER keeps a time signature in tempo points as numerator + denominator × 65536. */
const packMeter = ([beats, unit]: [number, number]) => beats + unit * 65536;

/** REAPER's pan envelope runs from 1 (left) to -1 (right), the other way round from ours. */
/** Ticks per quarter note in the MIDI items written. */
const PPQ = 960;

/** General MIDI's drum channel, 10, counted from 0. */
const DRUM_CHANNEL = 9;

const hex = (byte: number) => byte.toString(16).padStart(2, '0');

/**
 * A note clip's notes as REAPER MIDI events, timed in ticks from the clip's content
 * start along the tempo map, ending with an all-notes-off at the clip's end.
 */
const midiEvents = (clip: Clip, grid: Grid, channel: number) => {
  const origin = clip.start - clip.offset;
  const base = grid.quarters(origin);
  const tick = (time: number) => Math.max(0, Math.round((grid.quarters(origin + time) - base) * PPQ));
  const events: { tick: number; order: number; bytes: number[] }[] = [];

  for (const note of clip.notes ?? []) {
    const pitch = Math.min(127, Math.max(0, Math.round(note.pitch)));
    const velocity = Math.min(127, Math.max(1, Math.round(note.velocity * 127)));
    const on = tick(note.start);

    events.push({ tick: on, order: 1, bytes: [0x90 | channel, pitch, velocity] });
    events.push({ tick: Math.max(on + 1, tick(note.start + note.duration)), order: 0, bytes: [0x80 | channel, pitch, 0] });
  }

  // Note offs go before note ons at the same tick, so repeated notes stay separate
  events.sort((a, b) => a.tick - b.tick || a.order - b.order);
  events.push({ tick: Math.max(events.at(-1)?.tick ?? 0, tick(clip.offset + clip.duration)), order: 2, bytes: [0xb0 | channel, 0x7b, 0] });

  let last = 0;

  return events.map((event) => {
    const delta = event.tick - last;

    last = event.tick;

    return `E ${delta} ${event.bytes.map(hex).join(' ')}`;
  });
};

/** Notes from REAPER MIDI events, timed from the item's position. Notes before it are left out. */
const midiNotes = (source: Chunk, grid: Grid, position: number, offset: number, length: number) => {
  const ppq = number(first(source, 'HASDATA')?.args[1], PPQ) || PPQ;
  const origin = position - offset;
  const base = grid.quarters(origin);
  const timeAt = (tick: number) => grid.timeAtQuarters(base + tick / ppq) - position;
  const held = new Map<string, { start: number; velocity: number }>();
  const notes: Note[] = [];
  let tick = 0;

  const end = (key: string, pitch: number, at: number) => {
    const on = held.get(key);
    if (!on) return;

    held.delete(key);
    if (on.start >= -1e-9 && on.start < length) notes.push({ pitch, start: Math.max(0, on.start), duration: Math.max(0.01, Math.min(at, length) - on.start), velocity: on.velocity });
  };

  for (const line of source.children) {
    if (isChunk(line) || !/^[EeXx]$/.test(line.name)) continue;

    tick += number(line.args[0]);
    if (line.name.toUpperCase() !== 'E') continue;

    const [status = 0, pitch = 0, value = 0] = line.args.slice(1, 4).map((byte) => parseInt(byte, 16));
    const kind = status & 0xf0;
    const key = `${status & 0x0f}:${pitch}`;
    const at = timeAt(tick);

    if (kind === 0x90 && value > 0) {
      end(key, pitch, at);
      held.set(key, { start: at, velocity: value / 127 });
    } else if (kind === 0x80 || kind === 0x90) end(key, pitch, at);
  }

  for (const key of [...held.keys()]) end(key, Number(key.split(':')[1]), length);

  return notes.sort((a, b) => a.start - b.start || a.pitch - b.pitch);
};

/** Whether MIDI events use the drum channel. */
const onDrumChannel = (source: Chunk) =>
  source.children.some((line) => !isChunk(line) && /^[Ee]$/.test(line.name) && (parseInt(line.args[1] ?? '0', 16) & 0x0f) === DRUM_CHANNEL);

const toEnvelope = (param: AutomationParam, value: number) => (param === 'pan' ? -value : value);

/**
 * Write a timeline as a REAPER project (.rpp). Tracks, clips with their offsets,
 * gain and fades, volume and pan automation, markers, tempo changes and the
 * mixer settings carry over. Audio files are referenced, not included. Note clips
 * become MIDI items, on channel 10 for drum tracks and channel 1 otherwise; the
 * instruments stay behind, since REAPER can't load them.
 */
export const toReaper = (state: TimelineState, options: ReaperExportOptions = {}) => {
  const bpm = options.bpm ?? 120;
  const meter = options.meter ?? [4, 4];
  const file = options.file ?? ((source: string) => `audio/${source}.wav`);
  const lines: string[] = [];
  const add = (depth: number, line: string) => lines.push(`${'  '.repeat(depth)}${line}`);
  const master = { volume: 1, pan: 0, ...options.mixer?.master };
  const grid = new Grid({ bpm, meter });

  grid.setTempo(state.tempo);

  add(0, `<REAPER_PROJECT 0.1 "7.0" ${Math.floor(Date.now() / 1000)}`);
  add(1, `TEMPO ${num(bpm)} ${meter[0]} ${meter[1]}`);
  add(1, `MASTER_VOLUME ${num(master.volume)} ${num(master.pan)} -1 -1 1`);

  if (options.notes) {
    add(1, '<NOTES 0 2');
    for (const line of options.notes.split(/\r?\n/)) add(2, `|${line}`);
    add(1, '>');
  }

  if (state.tempo?.length) {
    let current = meter;

    add(1, '<TEMPOENVEX');
    add(2, 'ACT 1 -1');
    add(2, `PT 0 ${num(bpm)} 1 ${packMeter(meter)}`);
    for (const change of state.tempo) {
      const changed = change.meter && change.meter.join('/') !== current.join('/');

      current = change.meter ?? current;
      add(2, `PT ${num(change.time)} ${num(change.bpm)} 1${changed ? ` ${packMeter(current)}` : ''}`);
    }
    add(1, '>');
  }

  (state.markers ?? []).forEach((marker, i) => add(1, `MARKER ${i + 1} ${num(marker.time)} ${quote(marker.name)} 0 ${reaperColor(marker.color) ?? 0}`));

  for (const track of state.tracks) {
    const channel = { volume: 1, pan: 0, mute: false, solo: false, ...options.mixer?.tracks?.[track.id] };
    const color = reaperColor(track.color ?? options.colorOf?.(track));

    add(1, `<TRACK ${guid()}`);
    add(2, `NAME ${quote(track.name)}`);
    if (color !== null) add(2, `PEAKCOL ${color}`);
    add(2, `VOLPAN ${num(channel.volume)} ${num(channel.pan)} -1 -1 1`);
    add(2, `MUTESOLO ${channel.mute ? 1 : 0} ${channel.solo ? 2 : 0} 0`);

    for (const param of AUTOMATION_PARAMS) {
      const points = track.automation?.[param];
      if (!points?.length) continue;

      add(2, `<${ENVELOPES[param]}`);
      add(3, `EGUID ${guid()}`);
      add(3, 'ACT 1 -1');
      add(3, 'VIS 1 1 1');
      add(3, 'ARM 0');
      add(3, 'DEFSHAPE 0 -1 -1');
      for (const point of points) add(3, `PT ${num(point.time)} ${num(toEnvelope(param, point.value))} 0`);
      add(2, '>');
    }

    for (const clip of state.clips.filter((c) => c.track === track.id)) {
      add(2, '<ITEM');
      add(3, `POSITION ${num(clip.start)}`);
      add(3, `LENGTH ${num(clip.duration)}`);
      add(3, `FADEIN 1 ${num(clip.fadeIn)} 0 1 0 0 0`);
      add(3, `FADEOUT 1 ${num(clip.fadeOut)} 0 1 0 0 0`);
      add(3, `IGUID ${guid()}`);
      add(3, `NAME ${quote(clip.name ?? track.name)}`);
      add(3, `VOLPAN ${num(clip.gain)} 0 1 -1`);
      add(3, `SOFFS ${num(clip.offset)}`);

      if (clip.notes) {
        // Drum tracks play on General MIDI's drum channel, so other apps pick a kit
        const channel = track.instrument?.id === 'drums' ? DRUM_CHANNEL : 0;

        add(3, '<SOURCE MIDI');
        add(4, `HASDATA 1 ${PPQ} QN`);
        for (const event of midiEvents(clip, grid, channel)) add(4, event);
        add(3, '>');
      } else {
        add(3, '<SOURCE WAVE');
        add(4, `FILE ${quote(file(clip.source))}`);
        add(3, '>');
      }

      add(2, '>');
    }

    add(1, '>');
  }

  add(0, '>');

  return `${lines.join('\n')}\n`;
};

interface Line {
  name: string;
  args: string[];
}

interface Chunk extends Line {
  children: (Line | Chunk)[];
}

/** Split a project line into words, keeping quoted text together. */
const words = (line: string) => {
  const out: string[] = [];
  const pattern = /"([^"]*)"|'([^']*)'|`([^`]*)`|(\S+)/g;

  for (const match of line.matchAll(pattern)) out.push(match[1] ?? match[2] ?? match[3] ?? match[4]!);

  return out;
};

const parseChunks = (text: string): Chunk => {
  const root: Chunk = { name: '', args: [], children: [] };
  const stack = [root];

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;

    const parent = stack[stack.length - 1]!;

    // Notes are kept as written
    if (line.startsWith('|')) {
      parent.children.push({ name: '|', args: [raw.trimStart().slice(1)] });
      continue;
    }

    if (line.startsWith('>')) {
      if (stack.length > 1) stack.pop();
      continue;
    }

    if (line.startsWith('<')) {
      const [name, ...args] = words(line.slice(1));
      const chunk: Chunk = { name: name!, args, children: [] };

      parent.children.push(chunk);
      stack.push(chunk);
      continue;
    }

    const [name, ...args] = words(line);

    parent.children.push({ name: name!, args });
  }

  return root;
};

const isChunk = (line: Line | Chunk): line is Chunk => 'children' in line;
const first = (chunk: Chunk, name: string) => chunk.children.find((line) => line.name === name);
const all = (chunk: Chunk, name: string) => chunk.children.filter((line) => line.name === name);
const number = (value: string | undefined, fallback = 0) => (value !== undefined && Number.isFinite(Number(value)) ? Number(value) : fallback);

/** A file's name without folders or extension, for a readable source id. */
const baseName = (path: string) =>
  path
    .split(/[\\/]/)
    .pop()!
    .replace(/\.[^.]+$/, '') || 'audio';

/**
 * Read a REAPER project (.rpp). Gives the timeline state, the starting tempo and
 * meter, the mixer settings and, for each source, the audio file the project names.
 */
export const fromReaper = (text: string): ReaperProject => {
  const root = parseChunks(text);
  const project = root.children.find((line): line is Chunk => isChunk(line) && line.name === 'REAPER_PROJECT');
  if (!project) throw new Error('Not a REAPER project');

  const tempoLine = first(project, 'TEMPO');
  const bpm = number(tempoLine?.args[0], 120);
  const meter: [number, number] = [number(tempoLine?.args[1], 4), number(tempoLine?.args[2], 4)];
  const masterLine = first(project, 'MASTER_VOLUME');
  const mixer: Required<MixerValues> = { master: { volume: number(masterLine?.args[0], 1), pan: number(masterLine?.args[1], 0) }, tracks: {} };
  const files: Record<string, string> = {};
  const sourceOf = new Map<string, string>();
  const tracks: Track[] = [];
  const clips: Clip[] = [];
  const markers: Marker[] = [];
  const tempo: TempoChange[] = [];

  const sourceId = (path: string) => {
    let id = sourceOf.get(path);

    if (!id) {
      const base = baseName(path);
      let n = 1;

      id = base;
      while (files[id]) id = `${base}-${++n}`;
      sourceOf.set(path, id);
      files[id] = path;
    }

    return id;
  };

  const tempoEnvelope = first(project, 'TEMPOENVEX');
  const grid = new Grid({ bpm, meter });

  if (tempoEnvelope && isChunk(tempoEnvelope)) {
    for (const point of all(tempoEnvelope, 'PT')) {
      const time = number(point.args[0]);
      const packed = number(point.args[3]);
      const pointMeter: [number, number] | undefined = packed > 0 ? [packed % 65536, Math.floor(packed / 65536)] : undefined;

      if (time <= 1e-6) continue;
      tempo.push({ id: `tc${tempo.length + 1}`, time, bpm: number(point.args[1], bpm), ...(pointMeter && { meter: pointMeter }) });
    }
  }

  grid.setTempo(tempo);

  for (const marker of all(project, 'MARKER')) {
    const isRegion = number(marker.args[3]) & 1;

    // A region is written as two lines; its start becomes a marker
    if (isRegion && !marker.args[2]) continue;

    markers.push({ id: `m${markers.length + 1}`, time: number(marker.args[1]), name: marker.args[2] || `Marker ${marker.args[0]}`, ...(cssColor(number(marker.args[4])) && { color: cssColor(number(marker.args[4])) }) });
  }

  project.children.filter((line): line is Chunk => isChunk(line) && line.name === 'TRACK').forEach((chunk, index) => {
    const id = `t${index + 1}`;
    const volpan = first(chunk, 'VOLPAN');
    const mutesolo = first(chunk, 'MUTESOLO');
    const color = cssColor(number(first(chunk, 'PEAKCOL')?.args[0]));
    const automation: Track['automation'] = {};

    for (const param of AUTOMATION_PARAMS) {
      const envelope = first(chunk, ENVELOPES[param]);
      if (!envelope || !isChunk(envelope)) continue;

      const points: AutomationPoint[] = all(envelope, 'PT').map((pt) => ({ time: number(pt.args[0]), value: toEnvelope(param, number(pt.args[1])) }));

      if (points.length) automation[param] = points;
    }

    const items = chunk.children.filter((line): line is Chunk => isChunk(line) && line.name === 'ITEM');
    const midi = items.map((item) => item.children.find((line): line is Chunk => isChunk(line) && line.name === 'SOURCE' && line.args[0] === 'MIDI')).filter((source) => !!source);
    // A track with MIDI items plays them on the built-in drums when they use the drum channel, otherwise the synth
    const instrument = midi.length ? { id: midi.some(onDrumChannel) ? 'drums' : 'synth' } : undefined;

    tracks.push({
      id,
      name: first(chunk, 'NAME')?.args[0] || `Track ${index + 1}`,
      ...(color && { color }),
      ...(Object.keys(automation).length && { automation }),
      ...(instrument && { instrument }),
    });
    mixer.tracks[id] = {
      volume: number(volpan?.args[0], 1),
      pan: number(volpan?.args[1], 0),
      mute: number(mutesolo?.args[0]) > 0,
      solo: number(mutesolo?.args[1]) > 0,
    };

    for (const item of items) {
      const source = item.children.find((line): line is Chunk => isChunk(line) && line.name === 'SOURCE');
      const start = number(first(item, 'POSITION')?.args[0]);
      const duration = number(first(item, 'LENGTH')?.args[0]);
      const offset = number(first(item, 'SOFFS')?.args[0]);

      if (source?.args[0] === 'MIDI') {
        clips.push(
          makeNoteClip({
            track: id,
            start,
            duration,
            gain: number(first(item, 'VOLPAN')?.args[0], 1),
            name: first(item, 'NAME')?.args[0],
            notes: midiNotes(source, grid, start, offset, duration),
          }),
        );
        continue;
      }

      // Sections and other wrappers keep the file one level further in
      const fileLine = source && (first(source, 'FILE') ?? source.children.filter(isChunk).map((inner) => first(inner, 'FILE')).find(Boolean));
      if (!fileLine?.args[0]) continue;

      clips.push(
        makeClip({
          track: id,
          source: sourceId(fileLine.args[0]),
          start,
          duration,
          offset,
          gain: number(first(item, 'VOLPAN')?.args[0], 1),
          fadeIn: number(first(item, 'FADEIN')?.args[1]),
          fadeOut: number(first(item, 'FADEOUT')?.args[1]),
          name: first(item, 'NAME')?.args[0],
        }),
      );
    }
  });

  const notes = first(project, 'NOTES');
  const notesText = notes && isChunk(notes) ? all(notes, '|').map((line) => line.args[0]).join('\n') : '';

  return { state: { tracks, clips, markers, tempo }, bpm, meter, mixer, files, ...(notesText && { notes: notesText }) };
};
