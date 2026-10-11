/**
 * Drawing a deck as SVG. FloorPlanSpec section 8.
 *
 * Everything is built as markup in square units, one unit to the square, so
 * the editor and the export draw exactly the same thing. The editor puts the
 * markup into its own SVG and moves the view box; the export wraps it in a
 * standalone document.
 */

import type { Bounds } from "./geometry";
import { labelSquare, regions, walls } from "./geometry";
import type { Component, ComponentGroup } from "./manifest";
import type { Deck, EdgeFixture, FloorPlan, Owner, PlacedTile, SquareFixture } from "./plan";
import { ACCESS_KINDS, baseKey, CORRIDOR, instanceOf, parseCell, tileFootprint } from "./plan";
import { ACCESS_SYMBOLS, PIXELS_PER_SQUARE, footprint, symbolById } from "./symbols";

export type Floor = ComponentGroup | "corridor" | "orphan";

export interface Palette {
  readonly background: string;
  readonly grid: string;
  readonly floor: Readonly<Record<Floor, string>>;
  readonly wall: string;
  readonly label: string;
  readonly fixture: string;
  readonly overlay: string;
  readonly warn: string;
  /** Applied to the symbol images, which are black line art. */
  readonly symbolFilter: string;
}

/** On screen, over the dark theme. The floors stay muted so walls and labels read over them. */
export const SCREEN: Palette = {
  background: "#14161a",
  grid: "#262a31",
  floor: {
    engineering: "#5c3f2c",
    fuel: "#26465c",
    command: "#47386b",
    weapons: "#6b2f33",
    craft: "#2f5240",
    accommodation: "#5e5530",
    systems: "#2f4f59",
    cargo: "#4d4438",
    corridor: "#2a2e36",
    orphan: "#3a2a2a",
  },
  wall: "#dfe3ea",
  label: "#f1f3f6",
  fixture: "#e0b341",
  overlay: "#6f8cc0",
  warn: "#ff6b63",
  symbolFilter: "invert(0.92)",
};

/** On paper and in exports: pale floors, black walls, the symbols as drawn. */
export const PAPER: Palette = {
  background: "#ffffff",
  grid: "#e3e6ea",
  floor: {
    engineering: "#f3dccb",
    fuel: "#d4e4f0",
    command: "#e2dbf2",
    weapons: "#f2d3d4",
    craft: "#d5eadc",
    accommodation: "#efe8c8",
    systems: "#d3e7ec",
    cargo: "#e6e0d6",
    corridor: "#f5f5f5",
    orphan: "#f0d8d8",
  },
  wall: "#111111",
  label: "#111111",
  fixture: "#8a6a10",
  overlay: "#3a5a9a",
  warn: "#c0302a",
  symbolFilter: "none",
};

/** What the drawing needs to know about each owner, which the caller works out from the manifest. */
export interface OwnerLook {
  readonly floor: Floor;
  readonly label: string;
}

/**
 * Rooms are labelled by name while a plan is designed and by number when it
 * is used, with a key beside the plan saying which number is what. FP 8.4.
 */
export type LabelMode = "names" | "numbers";

/** A short name for a room, since a sheet line's label is usually too long to fit inside one. */
export function shortLabel(component: Pick<Component, "key" | "label">): string {
  const fixed: Record<string, string> = {
    manoeuvre: "M-Drive",
    jump: "J-Drive",
    reaction: "R-Drive",
    highBurn: "High-Burn",
    powerPlant: "Power Plant",
    fuel: "Fuel",
    sensors: "Sensors",
    staterooms: "Stateroom",
    lowBerths: "Low Berths",
    emergencyLowBerths: "Emergency Low",
    commonAreas: "Common Area",
    cargo: "Cargo",
    capacitors: "Capacitors",
  };
  const known = fixed[component.key];
  if (known !== undefined) return known;
  return component.label.replace(/\s*\(.*?\)/g, "").replace(/\s+x\d+$/, "").trim();
}

/** The order components are grouped in, down the panel and through the key. */
export const GROUP_ORDER: readonly ComponentGroup[] = [
  "engineering",
  "fuel",
  "command",
  "weapons",
  "craft",
  "accommodation",
  "systems",
  "cargo",
];

/**
 * The components numbered as a plan's key numbers them: by group, then in the
 * sheet's order within the group, counting from 1. The panel lists them the
 * same way, so its numbers read straight down. FP 8.4.
 */
export function numbered(components: readonly Component[]): { readonly component: Component; readonly number: number }[] {
  const out: { component: Component; number: number }[] = [];
  for (const group of GROUP_ORDER) {
    for (const component of components) if (component.group === group) out.push({ component, number: out.length + 1 });
  }
  return out;
}

/** How each owner on a plan looks, from the manifest and what the plan remembers. FP 8.1, 8.4, 9.2. */
export function looksFor(
  components: readonly Component[],
  plan: FloorPlan,
  mode: LabelMode = "names",
): (owner: Owner) => OwnerLook {
  const numbers = new Map(numbered(components).map((n) => [n.component.key, n]));
  return (owner) => {
    if (owner === CORRIDOR) return { floor: "corridor", label: "" };
    const key = baseKey(owner);
    const known = numbers.get(key);
    if (known === undefined) {
      return { floor: "orphan", label: mode === "numbers" ? "?" : (plan.remembered[key]?.label ?? key) };
    }
    if (mode === "numbers") return { floor: known.component.group, label: String(known.number) };
    const n = instanceOf(owner);
    const name = shortLabel(known.component);
    return { floor: known.component.group, label: n === undefined ? name : `${name} ${n}` };
  };
}

const esc = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const n = (v: number) => Number(v.toFixed(3)).toString();

/** The grid over an area, as one path of lines. */
export function gridMarkup(area: Bounds, palette: Palette): string {
  const parts: string[] = [];
  for (let x = area.minX; x <= area.maxX + 1; x++) parts.push(`M${x} ${area.minY}V${area.maxY + 1}`);
  for (let y = area.minY; y <= area.maxY + 1; y++) parts.push(`M${area.minX} ${y}H${area.maxX + 1}`);
  return `<path d="${parts.join("")}" stroke="${palette.grid}" stroke-width="0.03" fill="none"/>`;
}

/** The floor of every square, coloured by what it is. */
export function floorsMarkup(deck: Deck, look: (owner: Owner) => OwnerLook, palette: Palette): string {
  const out: string[] = [];
  for (const [key, owner] of Object.entries(deck.cells)) {
    const [x, y] = parseCell(key);
    const floor = look(owner).floor;
    out.push(`<rect x="${x}" y="${y}" width="1" height="1" fill="${palette.floor[floor]}"${floor === "orphan" ? ` class="fp-orphan"` : ""}/>`);
  }
  return out.join("");
}

/**
 * Walls wherever a square meets another owner or empty space, as one path.
 * Squares under a geomorph tile get none, since the tile draws its own. FP 8.2, 12.3.
 */
export function wallsMarkup(deck: Deck, palette: Palette, width = 0.1, extra = "", tiled: ReadonlySet<string> = new Set()): string {
  const d = walls(deck)
    .filter(({ x, y }) => !tiled.has(`${x},${y}`))
    .map(({ x, y, side }) => {
      switch (side) {
        case "n":
          return `M${x} ${y}h1`;
        case "s":
          return `M${x} ${y + 1}h1`;
        case "w":
          return `M${x} ${y}v1`;
        case "e":
          return `M${x + 1} ${y}v1`;
      }
    })
    .join("");
  return d === "" ? "" : `<path d="${d}" stroke="${palette.wall}" stroke-width="${width}" stroke-linecap="square" fill="none"${extra}/>`;
}

/**
 * Squares covered by a fitted room from the symbol library, a stateroom drawn
 * complete. Those symbols carry their own lettering, so the room is not
 * labelled a second time over the top of it.
 */
const LETTERED: ReadonlySet<string> = new Set(["rooms", "common", "engineering", "turrets"]);

export function fittedSquares(plan: FloorPlan, deck: number): Set<string> {
  const covered = new Set<string>();
  for (const f of plan.fixtures) {
    if (f.deck !== deck || "edge" in f || f.kind !== "symbol") continue;
    const symbol = symbolById(f.symbol);
    if (symbol === undefined || !LETTERED.has(symbol.category)) continue;
    const [w, h] = footprint(symbol, f.rotation);
    for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) covered.add(`${f.x + dx},${f.y + dy}`);
  }
  return covered;
}

/** A label in each room, unless a fitted room's own lettering is there already. FP 8.3. */
export function labelsMarkup(
  deck: Deck,
  look: (owner: Owner) => OwnerLook,
  palette: Palette,
  fitted: ReadonlySet<string> = new Set(),
): string {
  const out: string[] = [];
  for (const region of regions(deck)) {
    const label = look(region.owner).label;
    // A number fits in a single square; a name needs two.
    if (label === "" || (region.squares.length < 2 && label.length > 2)) continue;
    const [x, y] = labelSquare(region);
    if (fitted.has(`${x},${y}`)) continue;
    // Shrink long names in small rooms, within limits that stay legible.
    const xs = region.squares.map((s) => s[0]);
    const width = Math.max(...xs) - Math.min(...xs) + 1;
    const size = /^\d+$/.test(label) ? 0.5 : Math.max(0.22, Math.min(0.42, (width * 1.7) / Math.max(label.length, 1)));
    out.push(
      `<text x="${n(x + 0.5)}" y="${n(y + 0.5)}" font-size="${n(size)}" fill="${palette.label}" text-anchor="middle" dominant-baseline="central" class="fp-label">${esc(label)}</text>`,
    );
  }
  return out.join("");
}

/**
 * A door or an iris valve in a wall. Both open a gap the width of the
 * fixture; a door lays its leaf across the gap, or two meeting in the middle
 * when it is wider than a square, and an iris valve is the bowtie the
 * geomorph tiles draw for one. FP 7.6.
 */
function edgeMarkup(fixture: EdgeFixture, palette: Palette): string {
  const length = fixture.length ?? 1;
  const horizontal = fixture.edge === "n";
  // Work along the wall in "a" and across it in "b", then turn into x and y.
  const a0 = (horizontal ? fixture.x : fixture.y) + 0.12;
  const a1 = (horizontal ? fixture.x : fixture.y) + length - 0.12;
  const b = horizontal ? fixture.y : fixture.x;
  const at = (a: number, across: number) => (horizontal ? `${n(a)} ${n(b + across)}` : `${n(b + across)} ${n(a)}`);
  const gap = horizontal
    ? `<rect x="${n(a0)}" y="${n(b - 0.09)}" width="${n(a1 - a0)}" height="0.18" fill="${palette.background}"/>`
    : `<rect x="${n(b - 0.09)}" y="${n(a0)}" width="0.18" height="${n(a1 - a0)}" fill="${palette.background}"/>`;
  const jambs = `<path d="M${at(a0, -0.12)}L${at(a0, 0.12)}M${at(a1, -0.12)}L${at(a1, 0.12)}" stroke="${palette.wall}" stroke-width="0.08"/>`;
  if (fixture.kind === "door") {
    const mid = (a0 + a1) / 2;
    const leaves =
      length === 1
        ? `M${at(a0, 0)}L${at(a1, 0)}`
        : `M${at(a0, 0)}L${at(mid - 0.04, 0)}M${at(mid + 0.04, 0)}L${at(a1, 0)}`;
    return `<g class="fp-door">${gap}${jambs}<path d="${leaves}" stroke="${palette.fixture}" stroke-width="0.07"/></g>`;
  }
  // The bowtie: two triangles pointing at the middle of the gap.
  const mid = (a0 + a1) / 2;
  const tie =
    `M${at(a0, -0.12)}L${at(mid, 0)}L${at(a0, 0.12)}Z` +
    `M${at(a1, -0.12)}L${at(mid, 0)}L${at(a1, 0.12)}Z`;
  return `<g class="fp-iris">${gap}${jambs}<path d="${tie}" fill="${palette.fixture}"/></g>`;
}

/** A symbol from the library, centred on its footprint and turned with it. FP 7.4. */
/**
 * The transform that turns an image about its centre, mirroring it first if
 * it is flipped, so a flipped piece keeps its footprint. FP 7.1.2.
 */
function placement(rotation: number, flip: boolean | undefined, cx: number, cy: number): string {
  const turn = `rotate(${rotation} ${n(cx)} ${n(cy)})`;
  return flip === true ? `${turn} translate(${n(cx)} ${n(cy)}) scale(-1 1) translate(${n(-cx)} ${n(-cy)})` : turn;
}

export function symbolMarkup(
  fixture: Pick<SquareFixture, "x" | "y" | "rotation" | "symbol" | "flip">,
  palette: Palette,
  href: (file: string) => string,
  opacity = 1,
): string {
  const symbol = symbolById(fixture.symbol);
  if (symbol === undefined) {
    return `<rect x="${fixture.x + 0.1}" y="${fixture.y + 0.1}" width="0.8" height="0.8" fill="none" stroke="${palette.fixture}" stroke-width="0.05" stroke-dasharray="0.1 0.1"/>`;
  }
  const [fw, fh] = footprint(symbol, fixture.rotation);
  const cx = fixture.x + fw / 2;
  const cy = fixture.y + fh / 2;
  const w = symbol.pixels[0] / PIXELS_PER_SQUARE;
  const h = symbol.pixels[1] / PIXELS_PER_SQUARE;
  const filter = palette.symbolFilter === "none" ? "" : ` style="filter:${palette.symbolFilter}"`;
  return (
    `<image href="${esc(href(symbol.file))}" x="${n(cx - w / 2)}" y="${n(cy - h / 2)}" width="${n(w)}" height="${n(h)}"` +
    ` transform="${placement(fixture.rotation, fixture.flip, cx, cy)}" opacity="${opacity}" preserveAspectRatio="none"${filter}/>`
  );
}

/** Every fixture on a deck. */
export function fixturesMarkup(plan: FloorPlan, deck: number, palette: Palette, href: (file: string) => string): string {
  const out: string[] = [];
  for (const fixture of plan.fixtures) {
    if (fixture.deck !== deck) continue;
    if ("edge" in fixture) {
      out.push(edgeMarkup(fixture, palette));
    } else {
      const symbol = fixture.symbol ?? (fixture.kind === "symbol" ? undefined : ACCESS_SYMBOLS[fixture.kind]);
      out.push(symbolMarkup({ ...fixture, symbol }, palette, href));
    }
  }
  return out.join("");
}

/**
 * A deck's geomorph tiles, each centred on its footprint and turned with it.
 * The tile images are 60 pixels to the square with two squares of margin all
 * round, so centring the whole image puts the drawing on the footprint. A
 * tile whose image is not to hand is its outline and its code. FP 12.
 */
export function tilesMarkup(
  plan: FloorPlan,
  deck: number,
  palette: Palette,
  href: (id: string) => string | undefined,
  only?: (tile: PlacedTile, at: number) => boolean,
): string {
  const out: string[] = [];
  for (const [at, tile] of plan.tiles.entries()) {
    if (tile.deck !== deck || (only !== undefined && !only(tile, at))) continue;
    out.push(tileMarkup(tile, palette, href(tile.tile)));
  }
  return out.join("");
}

export function tileMarkup(tile: Pick<PlacedTile, "x" | "y" | "rotation" | "flip" | "squares" | "pixels" | "code">, palette: Palette, href: string | undefined, opacity = 1): string {
  const [fw, fh] = tileFootprint(tile);
  const cx = tile.x + fw / 2;
  const cy = tile.y + fh / 2;
  if (href === undefined) {
    return (
      `<g opacity="${opacity}"><rect x="${tile.x}" y="${tile.y}" width="${fw}" height="${fh}" fill="none" stroke="${palette.fixture}" stroke-width="0.06" stroke-dasharray="0.3 0.2"/>` +
      `<text x="${n(cx)}" y="${n(cy)}" font-size="0.6" fill="${palette.fixture}" text-anchor="middle" dominant-baseline="central">${esc(tile.code)}</text></g>`
    );
  }
  const w = tile.pixels[0] / PIXELS_PER_SQUARE;
  const h = tile.pixels[1] / PIXELS_PER_SQUARE;
  const filter = palette.symbolFilter === "none" ? "" : ` style="filter:${palette.symbolFilter}"`;
  return (
    `<image href="${esc(href)}" x="${n(cx - w / 2)}" y="${n(cy - h / 2)}" width="${n(w)}" height="${n(h)}"` +
    ` transform="${placement(tile.rotation, tile.flip, cx, cy)}" opacity="${opacity}" preserveAspectRatio="none"${filter}/>`
  );
}

/** The key to a numbered plan: each component placed on any deck, by number. FP 8.4. */
export function legendMarkup(components: readonly Component[], plan: FloorPlan, x: number, y: number, palette: Palette): string {
  const placed = new Set<string>();
  for (const d of plan.decks) for (const owner of Object.values(d.cells)) placed.add(baseKey(owner));
  const rows = numbered(components)
    .map(({ component, number }) => ({ c: component, number }))
    .filter(({ c }) => placed.has(c.key))
    .map(({ c, number }, row) =>
      `<text x="${x}" y="${n(y + 1.2 + row * 0.7)}" font-size="0.45" fill="${palette.label}"><tspan font-weight="600">${number}</tspan>  ${esc(shortLabel(c))}</text>`,
    );
  if (rows.length === 0) return "";
  return `<text x="${x}" y="${n(y + 0.4)}" font-size="0.5" font-weight="600" fill="${palette.label}">Key</text>${rows.join("")}`;
}

/** Another deck, faint, to line this one up against. FP 10.7. */
export function overlayMarkup(deck: Deck, palette: Palette): string {
  const floors = Object.keys(deck.cells)
    .map((key) => {
      const [x, y] = parseCell(key);
      return `<rect x="${x}" y="${y}" width="1" height="1"/>`;
    })
    .join("");
  const outline = wallsMarkup(deck, { ...palette, wall: palette.overlay }, 0.06, ` stroke-dasharray="0.2 0.12"`);
  return `<g fill="${palette.overlay}" fill-opacity="0.12">${floors}</g><g opacity="0.85">${outline}</g>`;
}

/**
 * Access on the overlay deck with nothing on the current deck's same square:
 * a shaft that stops short. FP 10.8.
 */
export function unmatchedAccessMarkup(plan: FloorPlan, current: number, overlay: number, palette: Palette): string {
  const isAccess = (f: (typeof plan.fixtures)[number]): f is SquareFixture =>
    !("edge" in f) && (ACCESS_KINDS as readonly string[]).includes(f.kind);
  const here = new Set(plan.fixtures.filter((f) => f.deck === current && isAccess(f)).map((f) => `${f.x},${f.y}`));
  return plan.fixtures
    .filter((f): f is SquareFixture => f.deck === overlay && isAccess(f))
    .map((f) => {
      const matched = here.has(`${f.x},${f.y}`);
      const colour = matched ? palette.overlay : palette.warn;
      return `<rect x="${f.x + 0.06}" y="${f.y + 0.06}" width="0.88" height="0.88" fill="none" stroke="${colour}" stroke-width="0.07" stroke-dasharray="0.16 0.1"${matched ? "" : ` class="fp-unmatched"`}/>`;
    })
    .join("");
}
