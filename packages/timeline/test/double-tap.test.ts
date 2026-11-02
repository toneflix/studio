import assert from 'node:assert/strict';
import { test } from 'node:test';
import { onDoubleTap } from '../src/double-tap.ts';

/** An element that takes events made of plain fields. */
const target = () => {
  const element = new EventTarget() as unknown as HTMLElement;
  const send = (type: string, fields: Record<string, unknown>) => {
    const event = new Event(type);

    for (const [key, value] of Object.entries(fields)) Object.defineProperty(event, key, { value });

    return element.dispatchEvent(event);
  };
  const tap = (at: number, x = 10, y = 10, pointerType = 'touch', pointerId = 1) => {
    send('pointerdown', { pointerType, pointerId, clientX: x, clientY: y, timeStamp: at });
    send('pointerup', { pointerType, pointerId, clientX: x, clientY: y, timeStamp: at + 40 });
  };

  return { element, send, tap };
};

test('two quick taps in one place count as a double tap', () => {
  const { element, tap } = target();
  let calls = 0;

  onDoubleTap(element, () => calls++);
  tap(0);
  tap(200);

  assert.equal(calls, 1);
});

test('slow taps, far taps and drags do not', () => {
  const { element, send, tap } = target();
  let calls = 0;

  onDoubleTap(element, () => calls++);
  tap(0);
  tap(1000);
  tap(2000, 10, 10);
  tap(2200, 80, 10);
  send('pointerdown', { pointerType: 'touch', pointerId: 1, clientX: 10, clientY: 10, timeStamp: 3000 });
  send('pointerup', { pointerType: 'touch', pointerId: 1, clientX: 60, clientY: 10, timeStamp: 3100 });
  tap(3200, 60, 10);

  assert.equal(calls, 0);
});

test('a mouse uses dblclick, which is skipped right after a double tap', () => {
  const { element, send, tap } = target();
  let calls = 0;

  const stop = onDoubleTap(element, () => calls++);

  tap(0, 10, 10, 'mouse');
  tap(100, 10, 10, 'mouse');
  assert.equal(calls, 0);

  send('dblclick', { timeStamp: 200 });
  assert.equal(calls, 1);

  tap(1000);
  tap(1200);
  send('dblclick', { timeStamp: 1300 });
  assert.equal(calls, 2);

  stop();
  send('dblclick', { timeStamp: 5000 });
  assert.equal(calls, 2);
});
