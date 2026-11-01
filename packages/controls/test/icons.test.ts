import assert from 'node:assert/strict';
import { test } from 'node:test';
import { renderIcon, setDefaultIcons } from '../src/icons.ts';
import { lucideIcons } from '../src/lucide.ts';

/** Records the markup a template is given and hands back a stand-in element. */
const fakeDocument = () => {
  const made: string[] = [];
  const element = (tag: string) => {
    const attributes: Record<string, string> = {};
    const classes = new Set<string>();

    return {
      tag,
      attributes,
      classes,
      classList: { add: (name: string) => classes.add(name) },
      setAttribute: (name: string, value: string) => (attributes[name] = value),
    };
  };

  const doc = {
    createElement: (tag: string) => {
      if (tag !== 'template') return element(tag);

      let markup = '';

      return {
        set innerHTML(value: string) {
          markup = value;
          made.push(value);
        },
        get content() {
          return { firstElementChild: markup ? element('svg') : null };
        },
      };
    },
  };

  return { doc: doc as unknown as Document, made };
};

test('icons are Lucide shapes wrapped in a stroked 24×24 svg', () => {
  const { doc, made } = fakeDocument();
  const icon = renderIcon(doc, 'play') as unknown as { classes: Set<string>; attributes: Record<string, string> };

  assert.match(made[0]!, /^<svg [^>]*viewBox="0 0 24 24"[^>]*stroke="currentColor"[^>]*>.*<\/svg>$/);
  assert.ok(made[0]!.includes(lucideIcons.play));
  assert.ok(icon.classes.has('tfs-icon'));
  assert.equal(icon.attributes['aria-hidden'], 'true');
});

test('an icon passed in replaces the default, as markup or as a function', () => {
  const { doc, made } = fakeDocument();
  const custom = { tag: 'i', classList: { add() {} }, setAttribute() {} } as unknown as Element;

  renderIcon(doc, 'stop', { stop: '<svg viewBox="0 0 16 16"><rect/></svg>' });
  assert.equal(made[0], '<svg viewBox="0 0 16 16"><rect/></svg>');
  assert.equal(renderIcon(doc, 'stop', { stop: () => custom }), custom);
});

test('default icons can be replaced for every control', () => {
  const { doc, made } = fakeDocument();

  setDefaultIcons({ loop: '<circle r="4"/>' });
  renderIcon(doc, 'loop');
  setDefaultIcons({ loop: lucideIcons.loop });

  assert.ok(made[0]!.includes('<circle r="4"/>'));
});

test('every default icon is plain SVG shapes', () => {
  for (const [name, markup] of Object.entries(lucideIcons)) {
    assert.match(markup, /^(<(path|circle|rect|line|polyline|polygon|ellipse)( [a-z0-9-]+="[^"<>]*")*\/>)+$/, name);
  }
});
