export interface KnobOptions {
  label: string;
  min: number;
  max: number;
  /** Where a double click puts it back */
  initial: number;
  /** Change for one arrow key press */
  step: number;
  format: (value: number) => string;
  onInput: (value: number) => void;
}

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

  const clamp = (next: number) => Math.min(options.max, Math.max(options.min, next));
  const show = () => {
    const share = (value - options.min) / (options.max - options.min);

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
    const range = options.max - options.min;
    const move = (m: PointerEvent) => change(startValue + ((startY - m.clientY) / 120) * range);
    const up = () => {
      element.removeEventListener('pointermove', move);
      element.removeEventListener('pointerup', up);
      element.removeEventListener('pointercancel', up);
    };

    e.preventDefault();
    element.focus();
    element.setPointerCapture?.(e.pointerId);
    element.addEventListener('pointermove', move);
    element.addEventListener('pointerup', up);
    element.addEventListener('pointercancel', up);
  });
  element.addEventListener('dblclick', () => change(options.initial));
  element.addEventListener('keydown', (e) => {
    const steps: Record<string, number> = { ArrowUp: 1, ArrowRight: 1, ArrowDown: -1, ArrowLeft: -1, PageUp: 10, PageDown: -10 };

    if (e.key in steps) change(value + steps[e.key]! * options.step);
    else if (e.key === 'Home') change(options.min);
    else if (e.key === 'End') change(options.max);
    else return;

    e.preventDefault();
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
