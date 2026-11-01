import assert from 'node:assert/strict';
import { test } from 'node:test';
import { listSource, matchesSearch, pluginSource, wamCommunitySource, type LibraryItem } from '../src/library.ts';

const signal = new AbortController().signal;
const sounds: LibraryItem[] = Array.from({ length: 5 }, (_, i) => ({ id: String(i), name: `Kick ${i}`, detail: i % 2 ? 'Acoustic' : 'Electronic', kind: 'audio' }));

test('a search matches every word against the name and detail', () => {
  assert.ok(matchesSearch({ name: 'Kick 1', detail: 'Acoustic' }, 'kick acou'));
  assert.ok(!matchesSearch({ name: 'Kick 1', detail: 'Acoustic' }, 'kick snare'));
  assert.ok(matchesSearch({ name: 'Anything' }, ''));
});

test('a list source searches and pages its items', async () => {
  const source = listSource('kicks', 'Kicks', sounds, { pageSize: 2 });

  assert.deepEqual(await source.list({ search: '', page: 1, signal }), { items: sounds.slice(0, 2), more: true });
  assert.deepEqual(await source.list({ search: '', page: 3, signal }), { items: sounds.slice(4), more: false });
  assert.deepEqual((await source.list({ search: 'acoustic', page: 1, signal })).items.map((item) => item.id), ['1', '3']);
});

test('a plugin source lists the catalog as plugins', async () => {
  const { items } = await pluginSource([{ name: 'Echo', url: 'https://example.com/echo.js' }]).list({ search: '', page: 1, signal });

  assert.deepEqual(items, [{ id: 'https://example.com/echo.js', name: 'Echo', kind: 'plugin', url: 'https://example.com/echo.js' }]);
});

test('the WAM community source fetches once, resolves paths under plugins/ and shows only allowed effects', async (t) => {
  let calls = 0;
  const list = [
    { identifier: 'com.a.delay', name: 'Delay', vendor: 'A', path: 'a/delay/index.js', thumbnail: 'a/delay/screenshot.png' },
    { identifier: 'com.b.synth', name: 'Synth', vendor: 'B', path: 'b/synth/index.js', isInstrument: true },
    { identifier: 'com.c.fuzz', name: 'Fuzz', vendor: 'C', url: 'https://plugins.example.com/fuzz/index.js' },
  ];

  t.mock.method(globalThis, 'fetch', async () => {
    calls++;

    return new Response(JSON.stringify(list));
  });

  const source = wamCommunitySource({ url: 'https://example.com/community/plugins.json', allow: (plugin) => plugin.vendor !== 'C' });
  const { items } = await source.list({ search: '', page: 1, signal });

  await source.list({ search: 'delay', page: 1, signal });
  assert.equal(calls, 1);
  assert.deepEqual(
    items.map((item) => [item.name, item.url, item.detail, item.image]),
    [['Delay', 'https://example.com/community/plugins/a/delay/index.js', 'A', 'https://example.com/community/plugins/a/delay/screenshot.png']],
  );
});

test('the WAM community source takes another base for plugin paths', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => new Response(JSON.stringify([{ name: 'Delay', path: 'a/delay/index.js' }])));

  const source = wamCommunitySource({ url: 'https://example.com/wams/plugins.json', base: './', allow: () => true });
  const { items } = await source.list({ search: '', page: 1, signal });

  assert.equal(items[0]!.url, 'https://example.com/wams/a/delay/index.js');
});

test('the WAM community source tries again after a failed fetch', async (t) => {
  let fail = true;

  t.mock.method(globalThis, 'fetch', async () => (fail ? new Response('', { status: 503 }) : new Response('[]')));

  const source = wamCommunitySource({ allow: () => true });

  await assert.rejects(Promise.resolve(source.list({ search: '', page: 1, signal })), /503/);
  fail = false;
  assert.deepEqual(await source.list({ search: '', page: 1, signal }), { items: [], more: false });
});
