import { lucideIcons } from './lucide.ts';

export type IconName = keyof typeof lucideIcons;

/**
 * SVG markup (a whole `<svg>`, or only its shapes drawn in a 24×24 box), or a
 * function that makes the element, for icon fonts or framework components.
 */
export type Icon = string | ((name: IconName) => Element);

export type IconSet = Record<IconName, Icon>;

let defaults: IconSet = { ...lucideIcons };

/** Replace icons everywhere, for controls made from now on. */
export const setDefaultIcons = (icons: Partial<IconSet>) => {
  defaults = { ...defaults, ...icons };
};

/** The icon element for a name: from `icons` first, then the defaults. */
export const renderIcon = (doc: Document, name: IconName, icons: Partial<IconSet> = {}): Element => {
  const icon = icons[name] ?? defaults[name];
  let element: Element;

  if (typeof icon === 'function') element = icon(name);
  else {
    const template = doc.createElement('template');

    template.innerHTML = icon.trimStart().startsWith('<svg')
      ? icon
      : `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${icon}</svg>`;
    element = template.content.firstElementChild ?? doc.createElement('span');
  }

  element.classList.add('tfs-icon');
  element.setAttribute('aria-hidden', 'true');

  return element;
};
