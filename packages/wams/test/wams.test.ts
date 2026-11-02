import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import {
  COMMUNITY_WAMS,
  communityWamInstruments,
  communityWams,
  communityWamSource,
  CURATED_WAMS,
  curatedWams,
  curatedWamSource,
  isMouseOnlyWam,
  WAMS_VERSION,
  wamsBase,
} from '../src/index.ts';

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

test('module URLs pin the package version on jsDelivr by default', () => {
  assert.equal(WAMS_VERSION, pkg.version);
  assert.equal(wamsBase(), `https://cdn.jsdelivr.net/npm/@toneflix/studio-wams@${pkg.version}/plugins/`);
  assert.equal(curatedWams()[0]!.url, `${wamsBase()}toneflix/echo.js`);
  assert.equal(curatedWams({ base: 'https://cdn.example.com/wams/' }).find((wam) => wam.name === 'Reverb')!.url, 'https://cdn.example.com/wams/toneflix/reverb.js');
});

test('the browser source filters by words in the name, vendor, description and keywords', () => {
  const source = curatedWamSource({ allow: (plugin) => plugin.keywords.includes('dynamics') });
  const names = (search: string) => source.list({ search }).items.map((item) => item.name);

  assert.deepEqual(names(''), ['Compressor', 'Limiter', 'Gate']);
  assert.deepEqual(names('limiter'), ['Limiter']);
  assert.deepEqual(names('toneflix noise'), ['Gate']);
});

test('each plugin is listed once', () => {
  const ids = CURATED_WAMS.map((plugin) => plugin.identifier);

  assert.equal(new Set(ids).size, ids.length);
});

test('vetted community plugins load from the pinned wam-community package', () => {
  const base = 'https://cdn.jsdelivr.net/npm/wam-community@0.4.9/dist/plugins/';
  const synth = communityWams().find((item) => item.name === 'Synth-101')!;

  assert.equal(synth.url, `${base}burns-audio/synth101/index.js`);
  assert.equal(synth.image, `${base}burns-audio/synth101/screenshot.png`);
  assert.equal(new Set(COMMUNITY_WAMS.map((plugin) => plugin.identifier)).size, COMMUNITY_WAMS.length);
});

test('community effects go to the browser, instruments to the instrument picker', () => {
  const effects = communityWamSource().list({ search: '' }).items.map((item) => item.name);

  assert.ok(effects.includes('PingPongDelay'));
  assert.ok(!effects.includes('Synth-101'));
  assert.deepEqual(
    communityWamInstruments({ base: 'https://example.com/p/' }),
    [{ label: 'Synth-101', instrument: { id: 'https://example.com/p/burns-audio/synth101/index.js' } }],
  );
});

test('mouse-only editors are known by module URL', () => {
  const urls = Object.fromEntries(communityWams().map((item) => [item.name, item.url]));

  assert.equal(isMouseOnlyWam(urls['Simple Delay']!), true);
  assert.equal(isMouseOnlyWam(urls['QuadraFuzz']!), false);
  assert.equal(isMouseOnlyWam('https://example.com/other.js'), false);
});
