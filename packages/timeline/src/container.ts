/** An element, or a CSS selector for one. */
export type ContainerTarget = HTMLElement | string;

/** The element a selector points to, or the element itself. Throws when a selector matches nothing. */
export const resolveContainer = (target: ContainerTarget, root: Pick<ParentNode, 'querySelector'> = document): HTMLElement => {
  if (typeof target !== 'string') return target;

  const element = root.querySelector<HTMLElement>(target);

  if (!element) throw new Error(`No element matches "${target}"`);

  return element;
};
