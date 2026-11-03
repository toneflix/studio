import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Grid, makeNoteClip, type TimelineState } from '@toneflix/studio-core';
import { fromMidi, midiClip, toMidi } from '../src/midi.ts';

const state: TimelineState = {
  tracks: [
    { id: 'beat', name: 'Beat', instrument: { id: 'drums' } },
    { id: 'bass', name: 'Bass', instrument: { id: 'synth' } },
    { id: 'vox', name: 'Vocals' },
  ],
  clips: [
    makeNoteClip({
      track: 'beat',
      start: 0,
      duration: 2,
      notes: [
        { pitch: 36, start: 0, duration: 0.25, velocity: 1 },
        { pitch: 38, start: 0.5, duration: 0.25, velocity: 0.5 },
      ],
    }),
    // Trimmed: the clip shows only its second second
    { ...makeNoteClip({ track: 'bass', start: 4, duration: 1, notes: [{ pitch: 40, start: 0, duration: 0.5, velocity: 0.8 }, { pitch: 43, start: 1, duration: 0.5, velocity: 0.8 }] }), offset: 1 },
  ],
  markers: [{ id: 'v', time: 2, name: 'Verse' }],
  tempo: [{ id: 't', time: 4, bpm: 60, meter: [3, 4] }],
};

const close = (actual: number, expected: number) => assert.ok(Math.abs(actual - expected) < 1e-3, `${actual} is not ${expected}`);

test('instrument tracks survive a trip through a MIDI file', () => {
  const data = toMidi(state, { bpm: 120, meter: [4, 4], name: 'Song' });
  const song = fromMidi(data);

  assert.equal(String.fromCharCode(...data.subarray(0, 4)), 'MThd');
  assert.equal(song.bpm, 120);
  assert.deepEqual(song.meter, [4, 4]);
  assert.equal(song.tempo.length, 1);
  close(song.tempo[0]!.time, 4);
  assert.equal(song.tempo[0]!.bpm, 60);
  assert.deepEqual(song.tempo[0]!.meter, [3, 4]);
  assert.deepEqual(song.markers.map((m) => [m.name, Math.round(m.time * 1000) / 1000]), [['Verse', 2]]);
  assert.deepEqual(
    song.parts.map((p) => [p.name, p.drums, p.channel]),
    [
      ['Beat', true, 9],
      ['Bass', false, 0],
    ],
  );

  const [beat, bass] = song.parts;

  assert.deepEqual(beat!.notes.map((n) => n.pitch), [36, 38]);
  close(beat!.notes[1]!.start, 0.5);
  close(beat!.notes[1]!.velocity, 64 / 127);
  // Only the note inside the trimmed clip, after the tempo change at 60 BPM
  assert.equal(bass!.notes.length, 1);
  assert.equal(bass!.notes[0]!.pitch, 43);
  close(bass!.notes[0]!.start, 4);
  close(bass!.notes[0]!.duration, 0.5);
});

test('a grid keeps the bars and beats of another tempo', () => {
  const song = fromMidi(toMidi(state, { bpm: 120, tracks: ['beat'] }), { grid: new Grid({ bpm: 60 }) });

  assert.equal(song.parts.length, 1);
  assert.deepEqual(song.tempo, []);
  close(song.parts[0]!.notes[1]!.start, 1);

  const clip = midiClip(song.parts[0]!, 'drums', 8, new Grid({ bpm: 60 }));

  assert.equal(clip.start, 8);
  assert.equal(clip.duration, 4);
  assert.equal(clip.notes?.length, 2);
});

test('a type 0 file with running status splits into one part per channel', () => {
  // prettier-ignore
  const events = [
    0x00, 0x90, 60, 100, 0x00, 64, 100,       // two notes on channel 1, the second with running status
    0x00, 0x99, 42, 90,                       // a hat on the drum channel
    0x83, 0x60, 0x80, 60, 0, 0x00, 64, 0,     // 480 ticks later: channel 1 notes off
    0x00, 0x89, 42, 0,
    0x00, 0xff, 0x2f, 0x00,
  ];
  const bytes = new Uint8Array([0x4d, 0x54, 0x68, 0x64, 0, 0, 0, 6, 0, 0, 0, 1, 0x01, 0xe0, 0x4d, 0x54, 0x72, 0x6b, 0, 0, 0, events.length, ...events]);
  const song = fromMidi(bytes);

  assert.deepEqual(
    song.parts.map((p) => [p.name, p.drums, p.notes.map((n) => n.pitch)]),
    [
      ['Track 1', false, [60, 64]],
      ['Drums', true, [42]],
    ],
  );
  close(song.parts[0]!.notes[0]!.duration, 0.5);
  assert.throws(() => fromMidi(new Uint8Array([1, 2, 3])), /Not a MIDI file/);
});
