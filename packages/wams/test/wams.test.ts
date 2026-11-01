import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { CURATED_WAMS, curatedWams, curatedWamSource, WAMS_VERSION, wamsBase } from '../src/index.ts';

const plugins = join(import.meta.dirname, '../plugins');
const pkg = JSON.parse(readFileSync(join(import.meta.dirname, '../package.json'), 'utf8'));

test('every curated plugin is in the package, with its thumbnail', () => {
  for (const plugin of CURATED_WAMS) {
    assert.ok(existsSync(join(plugins, plugin.path)), plugin.path);
    if (plugin.thumbnail) assert.ok(existsSync(join(plugins, plugin.thumbnail)), plugin.thumbnail);
  }
});

test('plugins.json matches the catalog', () => {
  assert.deepEqual(JSON.parse(readFileSync(join(plugins, 'plugins.json'), 'utf8')), CURATED_WAMS);
});

test('a vendored plugin keeps the identifier its descriptor gives', () => {
  for (const plugin of CURATED_WAMS.filter((p) => p.path.endsWith('/index.js'))) {
    const descriptor = JSON.parse(readFileSync(join(plugins, plugin.path.replace('index.js', 'descriptor.json')), 'utf8'));

    assert.equal(descriptor.identifier, plugin.identifier);
    assert.equal(descriptor.isInstrument, false);
  }
});

test('module URLs pin the package version on jsDelivr by default', () => {
  assert.equal(WAMS_VERSION, pkg.version);
  assert.equal(wamsBase(), `https://cdn.jsdelivr.net/npm/@toneflix/studio-wams@${pkg.version}/plugins/`);
  assert.equal(curatedWams()[0]!.url, `${wamsBase()}toneflix/echo.js`);
  assert.equal(curatedWams({ base: 'https://cdn.example.com/wams/' })[2]!.url, 'https://cdn.example.com/wams/sequencer-party/delay/index.js');
});

test('the browser source filters by words in the name, vendor, description and keywords', () => {
  const source = curatedWamSource({ allow: (plugin) => plugin.vendor !== 'Toneflix' });
  const names = (search: string) => source.list({ search }).items.map((item) => item.name);

  assert.deepEqual(names(''), ['Simple Delay', 'Simple Distortion', 'Simple EQ']);
  assert.deepEqual(names('delay'), ['Simple Delay']);
  assert.deepEqual(names('sequencer equalizer'), ['Simple EQ']);
});
