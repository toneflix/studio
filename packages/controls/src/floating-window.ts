import { renderIcon, type IconSet } from './icons.ts';

export interface FloatingWindowOptions {
  title: string;
  /** The close button's label */
  close: string;
  icons?: Partial<IconSet>;
  onClose?: () => void;
  /** The element the window opens in and stays inside, such as the studio's container; the page by default */
  container?: HTMLElement;
}

/** The part of the screen a window may use: its container's visible box, or the whole screen. */
const roomFor = (doc: Document, container?: HTMLElement) => {
  const view = doc.defaultView;
  const screen = { left: 0, top: 0, right: view?.innerWidth ?? 0, bottom: view?.innerHeight ?? 0 };
  if (!container) return screen;

  const box = container.getBoundingClientRect();

  return { left: Math.max(screen.left, box.left), top: Math.max(screen.top, box.top), right: Math.min(screen.right, box.right), bottom: Math.min(screen.bottom, box.bottom) };
};

/** Each open window's container. */
const containers = new WeakMap<Element, HTMLElement>();

/** The container of the window that holds an element. */
const containerOf = (element: Element) => {
  const win = element.closest('.tfs-plugin-window');

  return win ? containers.get(win) : undefined;
};

/**
 * Shrink an editor wider than its window's room so all of it shows, as on a phone.
 * Call it once the editor is in a window.
 */
export const shrinkToFit = (editor: HTMLElement | SVGElement) => {
  const width = Math.max(editor.getBoundingClientRect().width, editor.scrollWidth);
  const area = roomFor(editor.ownerDocument, containerOf(editor));
  const room = area.right - area.left - 18;
  if (!width || room <= 0 || width <= room) return;

  // Its own width, so a block that fills the window shrinks with its content
  editor.style.width = `${width}px`;
  editor.style.zoom = String(room / width);
};

/** Stacking order of floating windows; the last one touched is on top. */
let topLayer = 1000;

/**
 * A window over the page, dragged by its title bar, like a plugin editor. Each new
 * one opens a little below and right of the last.
 */
export const openFloatingWindow = (doc: Document, options: FloatingWindowOptions) => {
  const win = doc.createElement('div');
  const bar = doc.createElement('div');
  const title = doc.createElement('span');
  const close = doc.createElement('button');
  const body = doc.createElement('div');

  win.className = 'tfs-plugin-window';
  win.setAttribute('role', 'dialog');
  win.setAttribute('aria-label', options.title);
  bar.className = 'tfs-plugin-window-bar';
  title.textContent = options.title;
  close.type = 'button';
  close.className = 'tfs-tool';
  close.title = options.close;
  close.setAttribute('aria-label', options.close);
  close.append(renderIcon(doc, 'close', options.icons));
  body.className = 'tfs-plugin-window-body';
  bar.append(title, close);
  win.append(bar, body);
  doc.body.append(win);

  const { container } = options;
  const count = doc.querySelectorAll('.tfs-plugin-window').length;
  const origin = () => {
    const box = container?.getBoundingClientRect();

    return { x: box?.left ?? 0, y: box?.top ?? 0 };
  };
  // Where the window sits from its container's corner, so it moves with it on scroll
  let at = { x: 16 + count * 24, y: 16 + count * 24 };

  if (container) containers.set(win, container);

  /** Place the window at a spot on screen, kept inside its room. */
  const place = (left: number, top: number) => {
    const area = roomFor(doc, container);
    const corner = origin();

    win.style.maxWidth = `${Math.max(160, area.right - area.left - 16)}px`;
    win.style.maxHeight = `${Math.max(120, area.bottom - area.top - 16)}px`;
    left = Math.max(area.left + 8, Math.min(left, area.right - win.offsetWidth - 8));
    top = Math.max(area.top + 8, Math.min(top, area.bottom - win.offsetHeight - 8));
    win.style.left = `${left}px`;
    win.style.top = `${top}px`;
    at = { x: left - corner.x, y: top - corner.y };
  };

  /** Keep the window inside its room, for example once its content has a size. */
  const fit = () => {
    if (!open) return;

    const corner = origin();
    const keep = at;

    place(corner.x + keep.x, corner.y + keep.y);
    // Remember the spot it was given, so it comes back when there is room again
    at = keep;
  };
  const view = doc.defaultView;

  view?.addEventListener('scroll', fit, { capture: true, passive: true });
  view?.addEventListener('resize', fit);

  // Drag by the title bar
  bar.addEventListener('pointerdown', (e) => {
    if (e.target !== bar && e.target !== title) return;

    const x = e.clientX - win.offsetLeft;
    const y = e.clientY - win.offsetTop;
    const move = (m: PointerEvent) => place(m.clientX - x, m.clientY - y);
    const up = () => {
      bar.removeEventListener('pointermove', move);
      bar.removeEventListener('pointerup', up);
    };

    bar.setPointerCapture(e.pointerId);
    bar.addEventListener('pointermove', move);
    bar.addEventListener('pointerup', up);
  });
  // Raise without moving the node, so clicks and slider drags inside keep working
  win.style.zIndex = String(++topLayer);
  win.addEventListener('pointerdown', () => {
    if (Number(win.style.zIndex) < topLayer) win.style.zIndex = String(++topLayer);
  });

  let open = true;
  const handle = {
    element: win,
    body,
    title,
    get open() {
      return open;
    },
    /** Move it back on screen, for example after its content changed size */
    fit,
    raise() {
      win.style.zIndex = String(++topLayer);
    },
    close() {
      if (!open) return;

      open = false;
      view?.removeEventListener('scroll', fit, { capture: true });
      view?.removeEventListener('resize', fit);
      win.remove();
      options.onClose?.();
    },
  };

  close.addEventListener('click', () => handle.close());
  fit();
  view?.requestAnimationFrame(fit);

  return handle;
};
