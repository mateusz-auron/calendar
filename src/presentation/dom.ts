type Attrs = Record<string, string | boolean | undefined>;
type Child = Node | string | null | undefined | false;

/**
 * Minimal hyperscript helper. Builds DOM nodes via the DOM API only —
 * never `innerHTML` — so event data can't inject markup (XSS-safe by design).
 */
export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Attrs = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [name, value] of Object.entries(attrs)) {
    if (value === undefined || value === false) continue;
    el.setAttribute(name, value === true ? '' : value);
  }
  for (const child of children) {
    if (child === null || child === undefined || child === false) continue;
    el.append(child);
  }
  return el;
}
