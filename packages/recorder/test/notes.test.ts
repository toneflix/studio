import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Emitter } from '@toneflix/studio-core';
import type { AudioEngine } from '@toneflix/studio-audio';
import { NoteRecorder, type NoteTakeResult } from '../src/notes.ts';

/** Just enough of the engine for a note recorder: a clock, play and pause. */
class FakeEngine extends Emitter<{ play: object; pause: object; seek: object }> {
  time = 0;
  isPlaying = false;
  stopAtEnd = true;
  loop: { start: number; end: number } | null = { start: 0, end: 4 };
  context = { baseLatency: 0, outputLatency: 0 };
  async play(from: number) {
    this.time = from;
    this.isPlaying = true;
  }
  pause() {
    this.isPlaying = false;
    this.emit('pause', {});
  }
  setLoop(loop: { start: number; end: number } | null) {
    this.loop = loop;
  }
}

const setup = (latency = 0) => {
  const engine = new FakeEngine();
  const recorder = new NoteRecorder(engine as unknown as AudioEngine, { latency });

  return { engine, recorder };
};

test('notes played while recording land at the engine time, less the latency', async () => {
  const { engine, recorder } = setup(0.1);

  await recorder.start('keys', 2);
  assert.equal(engine.isPlaying, true);
  assert.equal(engine.loop, null);
  assert.equal(engine.stopAtEnd, false);

  engine.time = 2.6;
  recorder.noteOn(60, 0.8);
  engine.time = 3.1;
  recorder.noteOff(60);
  engine.time = 3.5;
  recorder.noteOn(64, 1);
  assert.deepEqual(
    recorder.notes().map((n) => [n.pitch, +n.start.toFixed(3), +n.duration.toFixed(3)]),
    [
      [60, 2.5, 0.5],
      [64, 3.4, 0.01],
    ],
  );

  engine.time = 4.1;

  const take = recorder.stop()!;

  assert.equal(take.track, 'keys');
  assert.equal(take.from, 2);
  assert.equal(+take.to.toFixed(3), 4);
  assert.equal(+take.notes.at(-1)!.duration.toFixed(3), 0.6);
  assert.deepEqual(engine.loop, { start: 0, end: 4 });
  assert.equal(engine.stopAtEnd, true);
});

test('pausing ends the take, and a take with no notes is null', async () => {
  const { engine, recorder } = setup();
  const takes: (NoteTakeResult | null)[] = [];

  recorder.on('stop', ({ take }) => void takes.push(take));
  await recorder.start('keys');
  engine.pause();
  assert.equal(recorder.isRecording, false);
  assert.deepEqual(takes, [null]);
  recorder.noteOn(60, 1);
  assert.deepEqual(recorder.notes(), []);
});
