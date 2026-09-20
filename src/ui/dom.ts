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

/**
 * Figures for the summary panels, where the reading matters more than the last
 * credit. Units are spaced away from their numbers, nothing carries more than
 * two decimals, and thousands are separated.
 *
 * The component table is not put through these: it is the sheet proper and has
 * to match what the book prints, down to a computer at MCr0.045.
 */

function places(value: number, most = 2): string {
  const rounded = Math.round(value * 10 ** most) / 10 ** most;
  return rounded.toLocaleString("en-GB", { maximumFractionDigits: most });
}

/** MCr in the component table: exactly the book's figure, however many places. */
export function mcr(value: number): string {
  return String(Math.round(value * 1e6) / 1e6);
}

/** Tons in the component table, with float noise cleared. */
export function tons(value: number): string {
  return String(Math.round(value * 1e3) / 1e3);
}

/** A number for a summary line: separated, and never more than two decimals. */
export function figure(value: number, most = 2): string {
  return places(value, most);
}

/** Millions of credits, for a summary line. */
export function millions(value: number): string {
  return `MCr ${places(value)}`;
}

/**
 * The exact figure behind a rounded one, or nothing when the two agree.
 *
 * Two decimals of MCr is a clean read but it is not always the whole number:
 * the Destroyer Escort is bought for MCr559.602, and the book prints it that
 * way. Rather than choose between the two, the summary shows the short form and
 * keeps the exact one a hover away.
 */
export function exactly(value: number): string | undefined {
  const shown = Math.round(value * 100) / 100;
  if (shown === Math.round(value * 1e6) / 1e6) return undefined;
  return `Exactly Cr ${(Math.round(value * 1e6)).toLocaleString("en-GB")}`;
}

/** Credits, for a summary line. Kept for callers that want no unit of time. */
export function credits(value: number): string {
  return `Cr ${places(value, 0)}`;
}

/** Credits a month, for a summary line. */
export function monthly(value: number): string {
  return `Cr ${places(value, 0)} / month`;
}
