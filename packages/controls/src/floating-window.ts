import { renderIcon, type IconSet } from './icons.ts';

export interface FloatingWindowOptions {
  title: string;
  /** The close button's label */
  close: string;
  icons?: Partial<IconSet>;
  onClose?: () => void;
}

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

  const count = doc.querySelectorAll('.tfs-plugin-window').length;

  win.style.left = `${40 + count * 24}px`;
  win.style.top = `${60 + count * 24}px`;

  /** Keep the window on screen once its content has a size. */
  const fit = () => {
    const view = doc.defaultView;
    if (!view || !open) return;

    win.style.left = `${Math.max(8, Math.min(win.offsetLeft, view.innerWidth - win.offsetWidth - 8))}px`;
    win.style.top = `${Math.max(8, Math.min(win.offsetTop, view.innerHeight - win.offsetHeight - 8))}px`;
  };

  // Drag by the title bar
  bar.addEventListener('pointerdown', (e) => {
    if (e.target !== bar && e.target !== title) return;

    const x = e.clientX - win.offsetLeft;
    const y = e.clientY - win.offsetTop;
    const move = (m: PointerEvent) => {
      win.style.left = `${Math.max(0, m.clientX - x)}px`;
      win.style.top = `${Math.max(0, m.clientY - y)}px`;
    };
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
      win.remove();
      options.onClose?.();
    },
  };

  close.addEventListener('click', () => handle.close());
  doc.defaultView?.requestAnimationFrame(fit);

  return handle;
};
