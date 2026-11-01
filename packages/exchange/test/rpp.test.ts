import assert from 'node:assert/strict';
import { test } from 'node:test';
import { deflateRawSync } from 'node:zlib';
import { makeClip, type TimelineState } from '@toneflix/studio-core';
import { fromReaper, toReaper } from '../src/rpp.ts';
import { unzip, zip } from '../src/zip.ts';

const state: TimelineState = {
  tracks: [
    { id: 'drums', name: 'Drums', color: '#4f9cf9' },
    {
      id: 'keys',
      name: 'Keys "soft"',
      automation: {
        volume: [
          { time: 4, value: 0.25 },
          { time: 8, value: 1 },
        ],
        pan: [{ time: 2, value: -0.5 }],
      },
    },
  ],
  clips: [
    makeClip({ track: 'drums', source: 'drums', start: 0, offset: 0, duration: 16, name: 'Drums' }),
    makeClip({ track: 'keys', source: 'keys', start: 4, offset: 1.5, duration: 6, gain: 0.5, fadeIn: 1, fadeOut: 0.25 }),
  ],
  markers: [{ id: 'v', time: 6, name: 'Verse' }],
  tempo: [{ id: 'x', time: 8, bpm: 90, meter: [3, 4] }],
};

test('a project survives a trip through REAPER', () => {
  const text = toReaper(state, { bpm: 128, meter: [4, 4], mixer: { tracks: { keys: { volume: 0.8, pan: 0.3, mute: true } } } });
  const project = fromReaper(text);

  assert.match(text, /^<REAPER_PROJECT/);
  assert.equal(project.bpm, 128);
  assert.deepEqual(project.meter, [4, 4]);
  assert.deepEqual(
    project.state.tracks.map((t) => [t.name, t.color]),
    [
      ['Drums', '#4f9cf9'],
      ['Keys "soft"', undefined],
    ],
  );
  assert.deepEqual(project.state.tracks[1]!.automation, state.tracks[1]!.automation);
  assert.deepEqual(project.mixer.tracks.t2, { volume: 0.8, pan: 0.3, mute: true, solo: false });
  assert.deepEqual(project.state.markers!.map((m) => [m.time, m.name]), [[6, 'Verse']]);
  assert.deepEqual(project.state.tempo!.map((c) => [c.time, c.bpm, c.meter]), [[8, 90, [3, 4]]]);

  const keys = project.state.clips[1]!;

  assert.deepEqual([keys.track, keys.source, keys.start, keys.offset, keys.duration, keys.gain, keys.fadeIn, keys.fadeOut], ['t2', 'keys', 4, 1.5, 6, 0.5, 1, 0.25]);
  assert.deepEqual(project.files, { drums: 'audio/drums.wav', keys: 'audio/keys.wav' });
});

test('REAPER regions and Windows paths are read', () => {
  const project = fromReaper(`<REAPER_PROJECT 0.1 "7.0" 0
  MARKER 1 2 "Chorus" 1
  MARKER 1 6 "" 1
  <TRACK
    NAME Lead
    <ITEM
      POSITION 1
      LENGTH 2
      <SOURCE WAVE
        FILE "C:\\Takes\\lead take.wav"
      >
    >
  >
>`);

  assert.deepEqual(project.state.markers!.map((m) => m.name), ['Chorus']);
  assert.equal(project.state.tracks[0]!.name, 'Lead');
  assert.deepEqual(project.files, { 'lead take': 'C:\\Takes\\lead take.wav' });
});

test('zip archives pack and unpack, stored or deflated', async () => {
  const data = new TextEncoder().encode('hello hello hello');
  const packed = zip([{ name: 'audio/a.txt', data }]);

  assert.deepEqual(await unzip(packed), [{ name: 'audio/a.txt', data }]);

  // Swap the stored data for deflated data, as other tools write it
  const deflated = deflateRawSync(data);
  const local = new Uint8Array(30 + 11);
  const view = new DataView(packed.buffer);
  const out = new Uint8Array(local.length + deflated.length + (packed.length - 41 - data.length));

  local.set(packed.subarray(0, 41));
  new DataView(local.buffer).setUint16(8, 8, true);
  new DataView(local.buffer).setUint32(18, deflated.length, true);
  out.set(local, 0);
  out.set(deflated, 41);

  const central = packed.slice(41 + data.length);
  const cv = new DataView(central.buffer);

  cv.setUint16(10, 8, true);
  cv.setUint32(20, deflated.length, true);
  cv.setUint32(central.length - 22 + 16, 41 + deflated.length, true);
  out.set(central, 41 + deflated.length);
  assert.equal(view.getUint32(0, true), 0x04034b50);
  assert.deepEqual((await unzip(out))[0]!.data, data);
});

test('project notes go to REAPER and come back line by line', () => {
  const notes = 'Made with Toneflix Music 2.1\n\n© Toneflix  ';
  const text = toReaper(state, { notes });

  assert.match(text, /<NOTES 0 2\n {4}\|Made with Toneflix Music 2\.1\n {4}\|\n/);
  assert.equal(fromReaper(text).notes, notes);
  assert.equal(fromReaper(toReaper(state)).notes, undefined);
});
