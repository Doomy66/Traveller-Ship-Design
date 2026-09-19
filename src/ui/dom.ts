/**
 * The little that stands between this application and the DOM.
 *
 * No framework: the whole interface is one design object, a render that reads
 * it, and these four helpers. Everything redraws on every change, which is
 * affordable because a sheet is a few dozen rows and sheet() is pure.
 */

export type Attrs = Record<string, string | number | boolean | undefined>;
export type Child = Node | string | null | undefined;

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Attrs = {},
  children: readonly Child[] = [],
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [name, value] of Object.entries(attrs)) {
    if (value === undefined || value === false) continue;
    if (value === true) node.setAttribute(name, "");
    else node.setAttribute(name, String(value));
  }
  for (const child of children) {
    if (child === null || child === undefined) continue;
    node.append(child);
  }
  return node;
}

export function clear(node: Element): void {
  while (node.firstChild !== null) node.firstChild.remove();
}

export function find<T extends Element = HTMLElement>(selector: string): T {
  const node = document.querySelector<T>(selector);
  if (node === null) throw new Error(`no element matching ${selector}`);
  return node;
}

/** MCr, shown the way the book shows it: enough places for the credit, no more. */
export function mcr(value: number): string {
  const rounded = Math.round(value * 1e6) / 1e6;
  return Number.isInteger(rounded) ? String(rounded) : String(rounded);
}

/** Tons, likewise: whole where they are whole. */
export function tons(value: number): string {
  const rounded = Math.round(value * 1e3) / 1e3;
  return String(rounded);
}

export function credits(value: number): string {
  return value.toLocaleString("en-GB");
}
