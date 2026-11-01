/**
 * A tiny base for the demo plugins: a Web Audio Module (WAM 2) made of plain
 * Web Audio nodes, with parameters, state, transport events and a slider editor.
 */

/** One AudioNode outside, a graph inside: input is this node, output is `this.output`. */
class CompositeNode extends GainNode {
  constructor(context) {
    super(context);
    this.output = new GainNode(context);
  }

  connect(...args) {
    return this.output.connect(...args);
  }

  disconnect(...args) {
    return this.output.disconnect(...args);
  }

  /** Connect the input itself, not the output. */
  connectInput(target) {
    return GainNode.prototype.connect.call(this, target);
  }
}

export const makePlugin = ({ identifier, name, params, build, apply }) => {
  class Node extends CompositeNode {
    constructor(context) {
      super(context);
      this.values = Object.fromEntries(Object.entries(params).map(([id, p]) => [id, p.defaultValue]));
      this.transport = { tempo: 120, playing: false };
      this.parts = build(context, this);
      this.update();
    }

    update() {
      apply(this.parts, this.values, this.transport, this.context);
    }

    async getState() {
      return { ...this.values };
    }

    async setState(state) {
      Object.assign(this.values, state);
      this.update();
    }

    async getParameterInfo(...ids) {
      return Object.fromEntries(Object.entries(params).filter(([id]) => !ids.length || ids.includes(id)).map(([id, p]) => [id, { id, type: 'float', ...p }]));
    }

    async getParameterValues(normalized, ...ids) {
      return Object.fromEntries(Object.entries(this.values).filter(([id]) => !ids.length || ids.includes(id)).map(([id, value]) => [id, { id, value, normalized: false }]));
    }

    async setParameterValues(values) {
      for (const { id, value } of Object.values(values)) this.values[id] = value;
      this.update();
    }

    scheduleEvents(...events) {
      for (const event of events) {
        if (event.type === 'wam-transport') this.transport = event.data;
        if (event.type === 'wam-automation') this.values[event.data.id] = event.data.value;
      }
      this.update();
    }

    clearEvents() {}

    destroy() {
      this.disconnect();
    }
  }

  return class Plugin {
    static async createInstance(groupId, audioContext, initialState) {
      const plugin = new Plugin(groupId, audioContext);
      if (initialState) await plugin.audioNode.setState(initialState);
      return plugin;
    }

    constructor(groupId, audioContext) {
      this.groupId = groupId;
      this.audioContext = audioContext;
      this.audioNode = new Node(audioContext);
      this.descriptor = { identifier, name, vendor: 'Toneflix Studio demo', version: '1.0.0', apiVersion: '2.0.0', hasAudioInput: true, hasAudioOutput: true };
      this.instanceId = `${identifier}-${Math.random().toString(36).slice(2)}`;
    }

    get isWebAudioModule() {
      return true;
    }

    get moduleId() {
      return identifier;
    }

    get name() {
      return name;
    }

    get vendor() {
      return this.descriptor.vendor;
    }

    async createGui() {
      const node = this.audioNode;
      const root = document.createElement('div');

      root.style.cssText = 'display:grid;gap:10px;padding:14px 16px;min-width:220px;font:12px system-ui,sans-serif;color:#e8e8ea';

      for (const [id, p] of Object.entries(params)) {
        const row = document.createElement('label');
        const top = document.createElement('div');
        const value = document.createElement('span');
        const input = document.createElement('input');
        const show = () => (value.textContent = `${(+node.values[id]).toFixed((p.step ?? 0.01) < 1 ? 2 : 0)}${p.units ? ` ${p.units}` : ''}`);

        top.style.cssText = 'display:flex;justify-content:space-between;margin-bottom:4px';
        top.append(p.label, value);
        input.type = 'range';
        input.min = p.minValue;
        input.max = p.maxValue;
        input.step = p.step ?? 0.01;
        input.value = node.values[id];
        input.style.cssText = 'width:100%;accent-color:#03bfff';
        input.addEventListener('input', () => {
          node.values[id] = +input.value;
          node.update();
          show();
        });
        show();
        row.append(top, input);
        root.append(row);
      }

      return root;
    }

    destroyGui(gui) {
      gui.remove();
    }
  };
};
