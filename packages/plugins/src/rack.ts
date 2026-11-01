import type { AudioEngine, Effect } from '@toneflix/studio-audio';
import { Emitter, uid } from '@toneflix/studio-core';
import { initializeWamHost } from './host.ts';
import type { WamConstructor, WamTransportData, WebAudioModule } from './types.ts';

/** A plugin in an insert chain. */
export interface PluginSlot {
  id: string;
  /** The plugin module's URL */
  url: string;
  name: string;
  vendor: string;
  bypass: boolean;
  plugin: WebAudioModule;
}

/** A plugin as saved: where it came from and its settings. */
export interface SavedPlugin {
  url: string;
  bypass?: boolean;
  state?: unknown;
}

/** Every chain, to save with a project. `master` is the master chain. */
export interface RackSnapshot {
  master: SavedPlugin[];
  tracks: Record<string, SavedPlugin[]>;
}

export interface AddPluginOptions {
  /** Place in the chain; the end by default */
  index?: number;
  state?: unknown;
  bypass?: boolean;
}

export interface PluginRackOptions {
  /** Loads a plugin module. The default imports the URL and takes its default export. */
  load?: (url: string) => Promise<WamConstructor>;
  /** Sets a context up for plugins; the built-in WAM host by default */
  host?: (context: BaseAudioContext) => Promise<[string, string]>;
}

export interface PluginRackEvents extends Record<string, unknown> {
  /** A chain changed; `track` is null for the master */
  change: { track: string | null };
  /** A plugin failed to load */
  error: { track: string | null; url: string; error: unknown };
}

type Chain = string | null;

const importModule = async (url: string) => {
  const module = await import(/* @vite-ignore */ url);

  return (module.default ?? module) as WamConstructor;
};

/**
 * Hosts Web Audio Modules (WAM 2) plugins as insert effects on tracks and the
 * master, played live through the engine's mixer.
 */
export class PluginRack extends Emitter<PluginRackEvents> {
  readonly engine: AudioEngine;
  private readonly load: (url: string) => Promise<WamConstructor>;
  private readonly host: (context: BaseAudioContext) => Promise<[string, string]>;
  private readonly chains = new Map<Chain, PluginSlot[]>();
  private readonly modules = new Map<string, Promise<WamConstructor>>();
  private readonly unlisten: (() => void)[];

  constructor(engine: AudioEngine, options: PluginRackOptions = {}) {
    super();
    this.engine = engine;
    this.load = options.load ?? importModule;
    this.host = options.host ?? initializeWamHost;

    const transport = () => this.syncTransport();

    this.unlisten = [
      engine.on('play', transport),
      engine.on('pause', transport),
      engine.on('seek', transport),
      engine.on('loop', transport),
    ];
  }

  /** The plugins on a track, or on the master with null, first first. */
  slots(track: string | null): readonly PluginSlot[] {
    return this.chains.get(track) ?? [];
  }

  /** Every chain that has plugins. */
  get chainIds(): Chain[] {
    return [...this.chains.keys()].filter((id) => this.slots(id).length);
  }

  /** Load a plugin from its URL and insert it. Must follow a user gesture the first time, so audio can start. */
  async add(track: string | null, url: string, options: AddPluginOptions = {}): Promise<PluginSlot> {
    let plugin: WebAudioModule;

    try {
      plugin = await this.create(this.engine.context, url, options.state);
    } catch (error) {
      this.emit('error', { track, url, error });
      throw error;
    }

    const slot: PluginSlot = {
      id: uid('fx'),
      url,
      name: plugin.descriptor?.name ?? plugin.name ?? url,
      vendor: plugin.descriptor?.vendor ?? plugin.vendor ?? '',
      bypass: !!options.bypass,
      plugin,
    };
    const chain = [...this.slots(track)];

    chain.splice(options.index ?? chain.length, 0, slot);
    this.chains.set(track, chain);
    this.rewire(track);
    this.syncTransport([slot]);

    return slot;
  }

  /** Take a plugin out and free it. */
  remove(track: string | null, id: string) {
    const chain = this.slots(track);
    const slot = chain.find((s) => s.id === id);
    if (!slot) return;

    this.chains.set(
      track,
      chain.filter((s) => s !== slot),
    );
    this.rewire(track);
    slot.plugin.audioNode.disconnect();
    slot.plugin.audioNode.destroy?.();
  }

  /** Move a plugin to another place in its chain. */
  move(track: string | null, id: string, index: number) {
    const chain = [...this.slots(track)];
    const from = chain.findIndex((s) => s.id === id);
    if (from < 0) return;

    const [slot] = chain.splice(from, 1);

    chain.splice(Math.max(0, Math.min(chain.length, index)), 0, slot!);
    this.chains.set(track, chain);
    this.rewire(track);
  }

  /** Let the sound pass a plugin untouched, or through it again. */
  setBypass(track: string | null, id: string, bypass: boolean) {
    const slot = this.slots(track).find((s) => s.id === id);
    if (!slot || slot.bypass === bypass) return;

    slot.bypass = bypass;
    this.rewire(track);
  }

  /** Remove every plugin of a chain, as when its track is deleted. */
  clear(track: string | null) {
    for (const slot of this.slots(track)) this.remove(track, slot.id);
  }

  /** Every chain with each plugin's settings, to store with the project. */
  async snapshot(): Promise<RackSnapshot> {
    const save = (track: Chain) =>
      Promise.all(this.slots(track).map(async (slot) => ({ url: slot.url, bypass: slot.bypass, state: await slot.plugin.audioNode.getState() })));
    const snapshot: RackSnapshot = { master: await save(null), tracks: {} };

    for (const id of this.chainIds) if (id !== null) snapshot.tracks[id] = await save(id);

    return snapshot;
  }

  /** Replace every chain with a saved one. Plugins that fail to load are left out and reported as `error`. */
  async restore(snapshot: RackSnapshot) {
    for (const id of [...this.chains.keys()]) this.clear(id);

    const chains: [Chain, SavedPlugin[]][] = [[null, snapshot.master ?? []], ...Object.entries(snapshot.tracks ?? {})];

    await Promise.all(
      chains.map(async ([track, saved]) => {
        for (const entry of saved) await this.add(track, entry.url, { state: entry.state, bypass: entry.bypass }).catch(() => undefined);
      }),
    );
  }

  /**
   * Effects for `engine.render`: each chain made again in the render's context
   * with the same settings, so the mixdown has the plugins in it.
   */
  readonly renderEffects = async (track: string | null, context: BaseAudioContext): Promise<Effect[]> => {
    const slots = this.slots(track).filter((slot) => !slot.bypass);
    const plugins = await Promise.all(slots.map(async (slot) => this.create(context, slot.url, await slot.plugin.audioNode.getState())));

    return plugins.map((plugin) => plugin.audioNode);
  };

  /** The plugin's own editor. Call `closeEditor` when it is taken off the page. */
  openEditor(slot: PluginSlot) {
    return slot.plugin.createGui();
  }

  closeEditor(slot: PluginSlot, editor: Element) {
    slot.plugin.destroyGui(editor);
  }

  destroy() {
    for (const id of [...this.chains.keys()]) this.clear(id);
    for (const off of this.unlisten) off();
    this.removeAllListeners();
  }

  private async create(context: BaseAudioContext, url: string, state?: unknown) {
    let module = this.modules.get(url);

    if (!module) {
      module = this.load(url);
      this.modules.set(url, module);
      module.catch(() => this.modules.delete(url));
    }

    const [groupId] = await this.host(context);

    return (await module).createInstance(groupId, context, state);
  }

  private rewire(track: Chain) {
    const effects = this.slots(track)
      .filter((slot) => !slot.bypass)
      .map((slot) => slot.plugin.audioNode);
    const channel = track === null ? this.engine.mixer.master : this.engine.mixer.channel(track);

    channel.setEffects(effects);
    this.emit('change', { track });
  }

  /**
   * Tell plugins the tempo, time signature, bar and whether playback runs, as WAM
   * transport events. Sent on play, pause and seek; call it after changing the tempo.
   */
  syncTransport(slots = [...this.chains.values()].flat()) {
    if (!slots.length) return;

    const { engine } = this;
    const grid = engine.metronome.grid;
    const now = engine.context.currentTime;
    const section = grid.sectionAt(engine.time);
    const currentBar = grid.position(engine.time).bar - 1;
    const data: WamTransportData = {
      currentBar,
      currentBarStarted: now - (engine.time - grid.barTime(currentBar + 1)),
      tempo: section.bpm,
      timeSigNumerator: section.meter[0],
      timeSigDenominator: section.meter[1],
      playing: engine.isPlaying,
    };

    for (const slot of slots) slot.plugin.audioNode.scheduleEvents?.({ type: 'wam-transport', time: now, data });
  }
}
