import assert from 'node:assert/strict';
import { test } from 'node:test';
import { resolveContainer } from '../src/container.ts';

const element = { id: 'editor' } as unknown as HTMLElement;
const root = { querySelector: (selector: string) => (selector === '#editor' ? element : null) } as Pick<ParentNode, 'querySelector'>;

test('takes an element as it is', () => {
  assert.equal(resolveContainer(element, root), element);
});

test('finds the element a selector points to', () => {
  assert.equal(resolveContainer('#editor', root), element);
});

test('throws when a selector matches nothing', () => {
  assert.throws(() => resolveContainer('#missing', root), /No element matches "#missing"/);
});
