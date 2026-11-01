/** WAM API version the host offers to plugins. */
export const WAM_API_VERSION = '2.0.0-alpha.6';

/**
 * The audio-thread side of a WAM host: the `webAudioModules` environment that
 * plugin processors register with, and a group that passes events between them.
 * Runs in the audio worklet scope, so it uses nothing from outside.
 */
function wamEnvironment(apiVersion: string, groupId: string, groupKey: string) {
  type Processor = { groupId: string; instanceId: string; scheduleEvents(...events: unknown[]): void };
  type Group = {
    groupId: string;
    validate(key: string): boolean;
    addWam(wam: Processor): void;
    removeWam(wam: Processor): void;
    connectEvents(from: string, to: string, output?: number): void;
    disconnectEvents(from: string, to?: string, output?: number): void;
    emitEvents(from: Processor, ...events: unknown[]): void;
  };

  const scope = globalThis as unknown as { AudioWorkletProcessor?: unknown; webAudioModules?: Record<string, unknown> & { addGroup(group: Group): void } };

  if (!scope.AudioWorkletProcessor) return;

  if (!scope.webAudioModules) {
    const groups = new Map<string, Group>();
    const moduleScopes = new Map<string, Record<string, unknown>>();

    scope.webAudioModules = {
      apiVersion,
      getModuleScope(id: string) {
        if (!moduleScopes.has(id)) moduleScopes.set(id, {});
        return moduleScopes.get(id);
      },
      getGroup(id: string, key: string) {
        const group = groups.get(id);
        if (group?.validate(key)) return group;
        throw new Error('Invalid key');
      },
      addGroup(group: Group) {
        if (!groups.has(group.groupId)) groups.set(group.groupId, group);
      },
      removeGroup(group: Group) {
        groups.delete(group.groupId);
      },
      addWam(wam: Processor) {
        groups.get(wam.groupId)?.addWam(wam);
      },
      removeWam(wam: Processor) {
        groups.get(wam.groupId)?.removeWam(wam);
      },
      connectEvents(id: string, from: string, to: string, output = 0) {
        groups.get(id)?.connectEvents(from, to, output);
      },
      disconnectEvents(id: string, from: string, to?: string, output?: number) {
        groups.get(id)?.disconnectEvents(from, to, output);
      },
      emitEvents(from: Processor, ...events: unknown[]) {
        groups.get(from.groupId)?.emitEvents(from, ...events);
      },
    };
  }

  const processors = new Map<string, Processor>();
  const graph = new Map<Processor, Set<Processor>[]>();

  scope.webAudioModules.addGroup({
    groupId,
    validate: (key) => key === groupKey,
    addWam: (wam) => void processors.set(wam.instanceId, wam),
    removeWam(wam) {
      graph.delete(wam);
      for (const outputs of graph.values()) for (const set of outputs) set?.delete(wam);
      processors.delete(wam.instanceId);
    },
    connectEvents(fromId, toId, output = 0) {
      const from = processors.get(fromId);
      const to = processors.get(toId);
      if (!from || !to) return;

      const outputs = graph.get(from) ?? [];

      graph.set(from, outputs);
      (outputs[output] ??= new Set()).add(to);
    },
    disconnectEvents(fromId, toId, output) {
      const outputs = graph.get(processors.get(fromId)!);
      if (!outputs) return;

      const to = toId === undefined ? undefined : processors.get(toId);

      outputs.forEach((set, i) => {
        if (output !== undefined && i !== output) return;
        if (to) set?.delete(to);
        else set?.clear();
      });
    },
    emitEvents(from, ...events) {
      for (const set of graph.get(from) ?? []) for (const wam of set ?? []) wam.scheduleEvents(...events);
    },
  });
}

const hosts = new WeakMap<BaseAudioContext, Promise<[string, string]>>();

/**
 * Set a context up to host WAM plugins, once. Resolves to the host's group id
 * and key; plugins are made with the group id.
 */
export const initializeWamHost = (context: BaseAudioContext) => {
  let ready = hosts.get(context);

  if (!ready) {
    const groupId = `toneflix-studio-${Math.random().toString(36).slice(2)}`;
    const groupKey = Math.random().toString(36).slice(2);
    const code = `(${wamEnvironment.toString()})(${[WAM_API_VERSION, groupId, groupKey].map((v) => JSON.stringify(v)).join(', ')});`;
    const url = URL.createObjectURL(new Blob([code], { type: 'text/javascript' }));

    ready = context.audioWorklet
      .addModule(url)
      .then((): [string, string] => [groupId, groupKey])
      .finally(() => URL.revokeObjectURL(url));
    hosts.set(context, ready);
  }

  return ready;
};
