export interface KnobOptions {
  label: string;
  min: number;
  max: number;
  /** Where a double click puts it back */
  initial: number;
  /** Change for one arrow key press */
  step: number;
  format: (value: number) => string;
  /** Turn in equal ratios instead of equal steps, for frequencies and times; `min` must be above 0 */
  log?: boolean;
  onInput: (value: number) => void;
  /** Called once a change is finished: a drag let go, a key press or a reset */
  onCommit?: (value: number) => void;
}

const clamp01 = (share: number) => Math.min(1, Math.max(0, share));

/** Turn of the knob at either end, in degrees from straight up. */
const SWEEP = 135;

/**
 * A rotary knob, used for pan. Drag up or down to turn it, use the arrow keys
 * when focused, and double-click to reset it.
 */
export const createKnob = (doc: Document, options: KnobOptions) => {
  const element = doc.createElement('div');
  const dial = doc.createElement('span');
  let value = options.initial;

  const { min, max } = options;
  const log = !!options.log && min > 0;
  const clamp = (next: number) => Math.min(max, Math.max(min, next));
  /** How far round the knob a value sits, 0 to 1 */
  const shareOf = (v: number) => (log ? Math.log(v / min) / Math.log(max / min) : (v - min) / (max - min));
  const valueAt = (share: number) => (log ? min * (max / min) ** share : min + share * (max - min));
  const show = () => {
    const share = shareOf(value);

    dial.style.transform = `rotate(${(share * 2 - 1) * SWEEP}deg)`;
    element.setAttribute('aria-valuenow', String(value));
    element.setAttribute('aria-valuetext', options.format(value));
    element.title = `${options.label}: ${options.format(value)}`;
  };
  const change = (next: number) => {
    const rounded = Math.round(clamp(next) / options.step) * options.step;
    if (rounded === value) return;

    value = rounded;
    show();
    options.onInput(value);
  };

  element.className = 'tfs-knob';
  element.tabIndex = 0;
  element.setAttribute('role', 'slider');
  element.setAttribute('aria-label', options.label);
  element.setAttribute('aria-valuemin', String(options.min));
  element.setAttribute('aria-valuemax', String(options.max));
  dial.className = 'tfs-knob-dial';
  element.append(dial);

  element.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;

    const startY = e.clientY;
    const startValue = value;
    const pointer = e.pointerId;
    const move = (m: PointerEvent) => change(valueAt(clamp01(shareOf(startValue) + (startY - m.clientY) / 120)));
    const up = (u: PointerEvent) => {
      if (u.pointerId !== pointer) return;

      element.removeEventListener('pointermove', move);
      element.removeEventListener('pointerup', up);
      element.removeEventListener('pointercancel', up);
      if (value !== startValue) options.onCommit?.(value);
    };

    e.preventDefault();
    element.focus();
    element.setPointerCapture?.(e.pointerId);
    element.addEventListener('pointermove', move);
    element.addEventListener('pointerup', up);
    element.addEventListener('pointercancel', up);
  });
  element.addEventListener('dblclick', () => {
    const before = value;

    change(options.initial);
    if (value !== before) options.onCommit?.(value);
  });
  element.addEventListener('keydown', (e) => {
    const before = value;
    const steps: Record<string, number> = { ArrowUp: 1, ArrowRight: 1, ArrowDown: -1, ArrowLeft: -1, PageUp: 10, PageDown: -10 };

    if (e.key in steps) change(log ? valueAt(clamp01(shareOf(value) + steps[e.key]! / 100)) : value + steps[e.key]! * options.step);
    else if (e.key === 'Home') change(options.min);
    else if (e.key === 'End') change(options.max);
    else return;

    e.preventDefault();
    if (value !== before) options.onCommit?.(value);
  });
  show();

  return {
    element,
    /** Show a value set elsewhere, without calling `onInput`. */
    set(next: number) {
      value = clamp(next);
      show();
    },
  };
};
