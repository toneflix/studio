/** Taps closer than this in time and distance make a double tap. */
const TAP_TIME = 350;
const TAP_DISTANCE = 24;

/**
 * Call `handler` on a double click, or on a double tap with a finger or pen. iOS
 * never sends `dblclick` for touches, and other phones do so only sometimes, so
 * taps are counted from pointer events and a `dblclick` right after a double tap is
 * skipped. Returns a function that stops listening.
 */
export const onDoubleTap = (element: HTMLElement, handler: (e: MouseEvent) => void) => {
  let last: { x: number; y: number; at: number } | null = null;
  let tapped = -Infinity;
  // Where each finger went down; one that travels is a drag, not a tap
  const starts = new Map<number, { x: number; y: number }>();

  const down = (e: PointerEvent) => {
    if (e.pointerType !== 'mouse') starts.set(e.pointerId, { x: e.clientX, y: e.clientY });
  };
  const up = (e: PointerEvent) => {
    const start = starts.get(e.pointerId);
    if (!start) return;

    starts.delete(e.pointerId);
    if (Math.hypot(e.clientX - start.x, e.clientY - start.y) > 10) {
      last = null;
      return;
    }

    const now = e.timeStamp;

    if (last && now - last.at < TAP_TIME && Math.hypot(e.clientX - last.x, e.clientY - last.y) < TAP_DISTANCE) {
      last = null;
      tapped = now;
      handler(e);

      return;
    }

    last = { x: e.clientX, y: e.clientY, at: now };
  };
  const cancel = (e: PointerEvent) => {
    starts.delete(e.pointerId);
    last = null;
  };
  const double = (e: MouseEvent) => {
    if (e.timeStamp - tapped > 600) handler(e);
  };

  element.addEventListener('pointerdown', down);
  element.addEventListener('pointerup', up);
  element.addEventListener('pointercancel', cancel);
  element.addEventListener('dblclick', double);

  return () => {
    element.removeEventListener('pointerdown', down);
    element.removeEventListener('pointerup', up);
    element.removeEventListener('pointercancel', cancel);
    element.removeEventListener('dblclick', double);
  };
};
