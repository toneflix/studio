const mouse = (type: string, touch: Touch, target: EventTarget) =>
  target.dispatchEvent(
    new MouseEvent(type, {
      bubbles: true,
      cancelable: true,
      composed: true,
      clientX: touch.clientX,
      clientY: touch.clientY,
      screenX: touch.screenX,
      screenY: touch.screenY,
      button: 0,
      buttons: type === 'mouseup' || type === 'click' ? 0 : 1,
      view: touch.target instanceof Node ? touch.target.ownerDocument?.defaultView : null,
    }),
  );

/**
 * Lets an editor that only answers the mouse be used by touch: one finger on it is
 * passed on as mouse down, moves, up and a click, sent to what the finger first touched.
 * Returns a function that stops it.
 */
export const touchAsMouse = (element: Element) => {
  let target: EventTarget | null = null;
  let finger: number | null = null;

  const find = (event: TouchEvent) => [...event.changedTouches].find((touch) => touch.identifier === finger);

  const start = (event: Event) => {
    const touch = (event as TouchEvent).changedTouches[0];
    if (finger !== null || !touch) return;

    finger = touch.identifier;
    target = event.composedPath()[0] ?? element;
    event.preventDefault();
    mouse('mousedown', touch, target);
  };

  const move = (event: Event) => {
    const touch = find(event as TouchEvent);
    if (!touch || !target) return;

    event.preventDefault();
    mouse('mousemove', touch, target);
  };

  const end = (event: Event) => {
    const touch = find(event as TouchEvent);
    if (!touch || !target) return;

    event.preventDefault();
    mouse('mouseup', touch, target);
    if (event.type === 'touchend') mouse('click', touch, target);
    finger = null;
    target = null;
  };

  const listeners: [string, (event: Event) => void][] = [
    ['touchstart', start],
    ['touchmove', move],
    ['touchend', end],
    ['touchcancel', end],
  ];

  for (const [type, listener] of listeners) element.addEventListener(type, listener, { passive: false });

  return () => {
    for (const [type, listener] of listeners) element.removeEventListener(type, listener);
  };
};
