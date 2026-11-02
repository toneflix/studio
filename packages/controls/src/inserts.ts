import type { PluginRack, PluginSlot } from '@toneflix/studio-plugins';
import { openFloatingWindow } from './floating-window.ts';
import { type IconSet } from './icons.ts';

/** A plugin offered in the add menu. */
export interface PluginChoice {
  name: string;
  url: string;
}

export interface InsertsLabels {
  add: string;
  bypass: string;
  remove: string;
  close: string;
  loading: string;
  failed: string;
}

export const DEFAULT_INSERTS_LABELS: InsertsLabels = {
  add: 'Add plugin',
  bypass: 'Bypass',
  remove: 'Remove',
  close: 'Close',
  loading: 'Loading…',
  failed: 'Failed to load',
};

export interface InsertsOptions {
  /** Plugins the add button offers */
  catalog?: PluginChoice[];
  /** Pick a plugin your own way instead of the built-in menu; resolve to null to cancel */
  pick?: (track: string | null) => Promise<PluginChoice | null>;
  labels?: InsertsLabels;
  icons?: Partial<IconSet>;
}

const editors = new WeakMap<PluginSlot, { close: () => void }>();

/** A floating window with a plugin's own editor in it. Opening it again brings it forward. */
export const openPluginEditor = async (doc: Document, rack: PluginRack, slot: PluginSlot, options: Pick<InsertsOptions, 'labels' | 'icons'> = {}) => {
  const open = editors.get(slot);
  if (open) return open;

  const labels = options.labels ?? DEFAULT_INSERTS_LABELS;
  let editor: Element | null = null;
  const win = openFloatingWindow(doc, {
    title: slot.vendor ? `${slot.name} · ${slot.vendor}` : slot.name,
    close: labels.close,
    icons: options.icons,
    onClose: () => {
      editors.delete(slot);
      off();
      if (editor) rack.closeEditor(slot, editor);
    },
  });
  const body = win.body;
  const handle = { close: () => win.close() };
  const off = rack.on('change', () => {
    if (!rack.chainIds.some((id) => rack.slots(id).includes(slot))) handle.close();
  });

  win.element.setAttribute('aria-label', slot.name);
  body.textContent = labels.loading;
  editors.set(slot, handle);

  try {
    editor = await rack.openEditor(slot);
    body.replaceChildren(editor);
  } catch {
    body.textContent = labels.failed;
  }

  return handle;
};

/**
 * A channel's insert slots: each plugin with a bypass switch, its name (opens its
 * editor) and a remove button, then an add button.
 */
export const createInserts = (doc: Document, rack: PluginRack, track: string | null, options: InsertsOptions = {}) => {
  const labels = options.labels ?? DEFAULT_INSERTS_LABELS;
  const element = doc.createElement('div');
  const list = doc.createElement('div');
  const add = doc.createElement('button');
  let menu: HTMLElement | null = null;

  element.className = 'tfs-inserts';
  list.className = 'tfs-inserts-list';
  add.type = 'button';
  add.className = 'tfs-insert tfs-insert--add';
  add.textContent = '+';
  add.title = labels.add;
  add.setAttribute('aria-label', labels.add);
  element.append(list, add);

  const closeMenu = () => {
    menu?.remove();
    menu = null;
    doc.removeEventListener('pointerdown', outside, true);
  };
  const outside = (e: Event) => {
    if (!menu?.contains(e.target as Node) && e.target !== add) closeMenu();
  };

  const insert = async (choice: PluginChoice) => {
    add.disabled = true;
    add.textContent = '…';

    try {
      const slot = await rack.add(track, choice.url);

      void openPluginEditor(doc, rack, slot, options);
    } catch {
      add.title = `${labels.failed}: ${choice.name}`;
    } finally {
      add.disabled = false;
      add.textContent = '+';
    }
  };

  add.addEventListener('click', async () => {
    if (menu) return closeMenu();

    if (options.pick) {
      const choice = await options.pick(track);

      if (choice) await insert(choice);

      return;
    }

    menu = doc.createElement('div');
    menu.className = 'tfs-insert-menu';
    menu.setAttribute('role', 'menu');

    for (const choice of options.catalog ?? []) {
      const item = doc.createElement('button');

      item.type = 'button';
      item.setAttribute('role', 'menuitem');
      item.textContent = choice.name;
      item.addEventListener('click', () => {
        closeMenu();
        void insert(choice);
      });
      menu.append(item);
    }

    const box = add.getBoundingClientRect();

    menu.style.left = `${box.left}px`;
    menu.style.top = `${box.bottom + 2}px`;
    doc.body.append(menu);
    doc.addEventListener('pointerdown', outside, true);
  });

  const render = () => {
    list.replaceChildren(
      ...rack.slots(track).map((slot) => {
        const row = doc.createElement('div');
        const power = doc.createElement('button');
        const name = doc.createElement('button');
        const remove = doc.createElement('button');

        row.className = 'tfs-insert';
        row.dataset.bypass = String(slot.bypass);
        power.type = 'button';
        power.className = 'tfs-insert-power';
        power.title = labels.bypass;
        power.setAttribute('aria-label', `${labels.bypass} ${slot.name}`);
        power.setAttribute('aria-pressed', String(slot.bypass));
        power.addEventListener('click', () => rack.setBypass(track, slot.id, !slot.bypass));
        name.type = 'button';
        name.className = 'tfs-insert-name';
        name.textContent = slot.name;
        name.title = slot.vendor ? `${slot.name} · ${slot.vendor}` : slot.name;
        name.addEventListener('click', () => void openPluginEditor(doc, rack, slot, options));
        remove.type = 'button';
        remove.className = 'tfs-insert-remove';
        remove.title = labels.remove;
        remove.setAttribute('aria-label', `${labels.remove} ${slot.name}`);
        remove.textContent = '×';
        remove.addEventListener('click', () => rack.remove(track, slot.id));
        row.append(power, name, remove);

        return row;
      }),
    );
  };

  const off = rack.on('change', ({ track: changed }) => changed === track && render());

  add.hidden = !options.pick && !options.catalog?.length;
  render();

  return {
    element,
    stop: () => {
      off();
      closeMenu();
    },
  };
};
