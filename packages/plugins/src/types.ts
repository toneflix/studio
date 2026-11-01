/** What the studio uses of the Web Audio Modules 2 API (https://github.com/webaudiomodules/api). */

export interface WamParameterInfo {
  id: string;
  label: string;
  type: 'float' | 'int' | 'boolean' | 'choice';
  defaultValue: number;
  minValue: number;
  maxValue: number;
  units?: string;
  choices?: string[];
}

export interface WamParameterData {
  id: string;
  value: number;
  normalized: boolean;
}

export interface WamTransportData {
  currentBar: number;
  currentBarStarted: number;
  tempo: number;
  timeSigNumerator: number;
  timeSigDenominator: number;
  playing: boolean;
}

export type WamEvent =
  | { type: 'wam-transport'; time?: number; data: WamTransportData }
  | { type: 'wam-automation'; time?: number; data: WamParameterData }
  | { type: string; time?: number; data?: unknown };

/** A plugin's audio node. */
export interface WamNode extends AudioNode {
  getState(): Promise<unknown>;
  setState(state: unknown): Promise<void>;
  getParameterInfo(...ids: string[]): Promise<Record<string, WamParameterInfo>>;
  getParameterValues(normalized?: boolean, ...ids: string[]): Promise<Record<string, WamParameterData>>;
  setParameterValues(values: Record<string, WamParameterData>): Promise<void>;
  scheduleEvents(...events: WamEvent[]): void;
  clearEvents(): void;
  destroy(): void;
}

export interface WamDescriptor {
  identifier: string;
  name: string;
  vendor: string;
  version?: string;
  description?: string;
  thumbnail?: string;
  keywords?: string[];
  isInstrument?: boolean;
  hasAudioInput?: boolean;
  hasAudioOutput?: boolean;
}

/** A loaded plugin. */
export interface WebAudioModule {
  readonly isWebAudioModule: boolean;
  readonly audioContext: BaseAudioContext;
  readonly audioNode: WamNode;
  readonly descriptor: WamDescriptor;
  readonly moduleId: string;
  readonly instanceId: string;
  readonly name: string;
  readonly vendor: string;
  createGui(): Promise<Element>;
  destroyGui(gui: Element): void;
}

/** A plugin module's default export. */
export interface WamConstructor {
  createInstance(groupId: string, context: BaseAudioContext, initialState?: unknown): Promise<WebAudioModule>;
}
