import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { AudioEngine } from '@toneflix/studio-audio';
import { Emitter, Grid } from '@toneflix/studio-core';
import { PluginRack } from '../src/rack.ts';
import type { WamConstructor, WamEvent, WebAudioModule } from '../src/types.ts';

/** A plugin that remembers its state and the events it was sent. */
const fakeModule = (name: string): WamConstructor => ({
  async createInstance(groupId, context, initialState) {
    let state: unknown = initialState ?? { level: 1 };
    const events: WamEvent[] = [];
    const audioNode = {
      context,
      groupId,
      events,
      disconnect() {},
      destroy() {},
      getState: async () => state,
      setState: async (next: unknown) => void (state = next),
      scheduleEvents: (...more: WamEvent[]) => void events.push(...more),
    };

    return { audioNode, descriptor: { name, vendor: 'Test', identifier: name }, createGui: async () => ({}), destroyGui() {} } as unknown as WebAudioModule;
  },
});

class FakeEngine extends Emitter<Record<string, unknown>> {
  context = { currentTime: 10, sampleRate: 48000 } as BaseAudioContext;
  metronome = { grid: new Grid({ bpm: 90, meter: [3, 4] }) };
  time = 4;
  isPlaying = false;
  chains = new Map<string | null, unknown[]>();
  mixer = {
    master: { setEffects: (effects: unknown[]) => this.chains.set(null, effects) },
    channel: (id: string) => ({ setEffects: (effects: unknown[]) => this.chains.set(id, effects) }),
  };
  fire(event: string) {
    this.emit(event, {});
  }
}

const setup = () => {
  const engine = new FakeEngine();
  const loaded: string[] = [];
  const rack = new PluginRack(engine as unknown as AudioEngine, {
    load: async (url) => {
      loaded.push(url);
      return fakeModule(url.split('/').pop()!);
    },
    host: async () => ['group', 'key'],
  });

  return { engine, rack, loaded };
};


test('plugins wire into the channel in order, without bypassed ones', async () => {
  const { engine, rack, loaded } = setup();
  const delay = await rack.add('vox', '/fx/delay');
  const reverb = await rack.add('vox', '/fx/reverb');
  const eq = await rack.add('vox', '/fx/eq', { index: 0 });

  assert.deepEqual(rack.slots('vox').map((s) => s.name), ['eq', 'delay', 'reverb']);
  assert.deepEqual(engine.chains.get('vox'), [eq, delay, reverb].map((s) => s.plugin.audioNode));

  rack.setBypass('vox', delay.id, true);
  assert.deepEqual(engine.chains.get('vox'), [eq, reverb].map((s) => s.plugin.audioNode));

  rack.move('vox', reverb.id, 0);
  rack.remove('vox', eq.id);
  assert.deepEqual(rack.slots('vox').map((s) => s.name), ['reverb', 'delay']);
  assert.deepEqual(engine.chains.get('vox'), [reverb.plugin.audioNode]);

  await rack.add(null, '/fx/delay');
  assert.equal(engine.chains.get(null)?.length, 1);
  assert.deepEqual(loaded, ['/fx/delay', '/fx/reverb', '/fx/eq'], 'each module loads once');
});

test('snapshot and restore keep plugins, order, bypass and state', async () => {
  const { rack } = setup();

  await rack.add('vox', '/fx/delay', { state: { time: 0.25 } });
  await rack.add('vox', '/fx/reverb', { bypass: true });
  await rack.add(null, '/fx/eq');

  const saved = await rack.snapshot();

  assert.deepEqual(saved, {
    master: [{ url: '/fx/eq', bypass: false, state: { level: 1 } }],
    tracks: { vox: [{ url: '/fx/delay', bypass: false, state: { time: 0.25 } }, { url: '/fx/reverb', bypass: true, state: { level: 1 } }] },
  });

  const other = setup();

  await other.rack.restore(saved);
  assert.deepEqual(await other.rack.snapshot(), saved);
});

test('render effects are new plugins with the same state, bypassed ones left out', async () => {
  const { rack } = setup();
  const delay = await rack.add('vox', '/fx/delay', { state: { time: 0.5 } });

  await rack.add('vox', '/fx/reverb', { bypass: true });

  const offline = { currentTime: 0 } as BaseAudioContext;
  const effects = (await rack.renderEffects('vox', offline)) as unknown as { context: unknown; getState(): Promise<unknown> }[];

  assert.equal(effects.length, 1);
  assert.notEqual(effects[0], delay.plugin.audioNode);
  assert.equal(effects[0]!.context, offline);
  assert.deepEqual(await effects[0]!.getState(), { time: 0.5 });
});

test('plugins hear the transport', async () => {
  const { engine, rack } = setup();
  const slot = await rack.add('vox', '/fx/delay');
  const events = (slot.plugin.audioNode as unknown as { events: WamEvent[] }).events;

  engine.isPlaying = true;
  engine.fire('play');

  const last = events.at(-1)!;

  assert.equal(last.type, 'wam-transport');
  assert.deepEqual(last.data, { currentBar: 2, currentBarStarted: 10 - (4 - 2 * 2), tempo: 90, timeSigNumerator: 3, timeSigDenominator: 4, playing: true });
});

test('a module that fails to load is reported and not kept', async () => {
  const engine = new FakeEngine();
  let tries = 0;
  const rack = new PluginRack(engine as unknown as AudioEngine, {
    load: async () => {
      tries++;
      throw new Error('404');
    },
    host: async () => ['group', 'key'],
  });
  const errors: unknown[] = [];

  rack.on('error', (e) => errors.push(e));
  await assert.rejects(rack.add('vox', '/missing'));
  await assert.rejects(rack.add('vox', '/missing'));
  assert.equal(errors.length, 2);
  assert.equal(tries, 2);
  assert.equal(rack.slots('vox').length, 0);
});
