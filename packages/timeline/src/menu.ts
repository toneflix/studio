export interface MenuItem {
  label: string;
  onSelect: () => void;
  disabled?: boolean;
  /** Draw it in the warning colour, for actions like delete */
  danger?: boolean;
}

let current: (() => void) | null = null;

/** Close the open menu, if any. */
export const closeMenu = () => current?.();

/**
 * A small popup menu at a point on the page. It closes on a pick, Escape, a
 * click elsewhere, or scrolling.
 */
export const openMenu = (doc: Document, at: { x: number; y: number }, items: MenuItem[], label = 'Menu') => {
  closeMenu();

  const menu = doc.createElement('div');
  const view = doc.defaultView;

  menu.className = 'tfs-menu';
  menu.setAttribute('role', 'menu');
  menu.setAttribute('aria-label', label);

  for (const item of items) {
    const button = doc.createElement('button');

    button.type = 'button';
    button.setAttribute('role', 'menuitem');
    button.textContent = item.label;
    button.disabled = !!item.disabled;
    if (item.danger) button.classList.add('tfs-menu-danger');
    button.addEventListener('click', () => {
      close();
      item.onSelect();
    });
    menu.append(button);
  }

  doc.body.append(menu);

  // Keep it on screen
  const width = view?.innerWidth ?? Infinity;
  const height = view?.innerHeight ?? Infinity;
  const box = menu.getBoundingClientRect();

  menu.style.left = `${Math.max(4, Math.min(at.x, width - box.width - 4))}px`;
  menu.style.top = `${Math.max(4, Math.min(at.y, height - box.height - 4))}px`;

  const outside = (e: Event) => {
    if (!menu.contains(e.target as Node)) close();
  };
  const onKey = (e: KeyboardEvent) => {
    const buttons = [...menu.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')];
    const index = buttons.indexOf(doc.activeElement as HTMLButtonElement);

    if (e.key === 'Escape') close();
    else if (e.key === 'ArrowDown') buttons[(index + 1) % buttons.length]?.focus();
    else if (e.key === 'ArrowUp') buttons[(index - 1 + buttons.length) % buttons.length]?.focus();
    else return;

    e.preventDefault();
    e.stopPropagation();
  };
  const close = () => {
    if (current !== close) return;

    current = null;
    menu.remove();
    doc.removeEventListener('pointerdown', outside, true);
    doc.removeEventListener('keydown', onKey, true);
    view?.removeEventListener('scroll', close, true);
    view?.removeEventListener('resize', close);
  };

  current = close;
  doc.addEventListener('pointerdown', outside, true);
  doc.addEventListener('keydown', onKey, true);
  view?.addEventListener('scroll', close, true);
  view?.addEventListener('resize', close);
  menu.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus({ preventScroll: true });

  return close;
};
