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
import type { Deck, EdgeFixture, FloorPlan, Owner, SquareFixture } from "./plan";
import { ACCESS_KINDS, baseKey, CORRIDOR, instanceOf, parseCell } from "./plan";
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

/** How each owner on a plan looks, from the manifest and what the plan remembers. FP 8.1, 9.2. */
export function looksFor(components: readonly Component[], plan: FloorPlan): (owner: Owner) => OwnerLook {
  const byKey = new Map(components.map((c) => [c.key, c]));
  return (owner) => {
    if (owner === CORRIDOR) return { floor: "corridor", label: "" };
    const key = baseKey(owner);
    const component = byKey.get(key);
    if (component === undefined) {
      return { floor: "orphan", label: plan.remembered[key]?.label ?? key };
    }
    const n = instanceOf(owner);
    const name = shortLabel(component);
    return { floor: component.group, label: n === undefined ? name : `${name} ${n}` };
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

/** Walls wherever a square meets another owner or empty space, as one path. FP 8.2. */
export function wallsMarkup(deck: Deck, palette: Palette, width = 0.1, extra = ""): string {
  const d = walls(deck)
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
export function fittedSquares(plan: FloorPlan, deck: number): Set<string> {
  const covered = new Set<string>();
  for (const f of plan.fixtures) {
    if (f.deck !== deck || "edge" in f || f.kind !== "symbol") continue;
    const symbol = symbolById(f.symbol);
    if (symbol === undefined || symbol.category !== "rooms") continue;
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
    if (label === "" || region.squares.length < 2) continue;
    const [x, y] = labelSquare(region);
    if (fitted.has(`${x},${y}`)) continue;
    // Shrink long names in small rooms, within limits that stay legible.
    const xs = region.squares.map((s) => s[0]);
    const width = Math.max(...xs) - Math.min(...xs) + 1;
    const size = Math.max(0.22, Math.min(0.42, (width * 1.7) / Math.max(label.length, 1)));
    out.push(
      `<text x="${n(x + 0.5)}" y="${n(y + 0.5)}" font-size="${n(size)}" fill="${palette.label}" text-anchor="middle" dominant-baseline="central" class="fp-label">${esc(label)}</text>`,
    );
  }
  return out.join("");
}

/** A door or iris valve across an edge. Doors open the wall; iris valves sit in it. */
function edgeMarkup(fixture: EdgeFixture, palette: Palette): string {
  const horizontal = fixture.edge === "n";
  const cx = horizontal ? fixture.x + 0.5 : fixture.x;
  const cy = horizontal ? fixture.y : fixture.y + 0.5;
  if (fixture.kind === "door") {
    // A gap in the wall the width of a door, with the door itself drawn across it.
    const gap = horizontal
      ? `<rect x="${n(cx - 0.35)}" y="${n(cy - 0.09)}" width="0.7" height="0.18" fill="${palette.background}"/>`
      : `<rect x="${n(cx - 0.09)}" y="${n(cy - 0.35)}" width="0.18" height="0.7" fill="${palette.background}"/>`;
    const leaf = horizontal
      ? `<path d="M${n(cx - 0.35)} ${n(cy)}H${n(cx + 0.35)}" stroke="${palette.fixture}" stroke-width="0.06"/>`
      : `<path d="M${n(cx)} ${n(cy - 0.35)}V${n(cy + 0.35)}" stroke="${palette.fixture}" stroke-width="0.06"/>`;
    return `<g class="fp-door">${gap}${leaf}</g>`;
  }
  return (
    `<g class="fp-iris"><circle cx="${n(cx)}" cy="${n(cy)}" r="0.3" fill="${palette.background}" stroke="${palette.fixture}" stroke-width="0.05"/>` +
    `<path d="M${n(cx - 0.21)} ${n(cy - 0.21)}L${n(cx + 0.21)} ${n(cy + 0.21)}M${n(cx + 0.21)} ${n(cy - 0.21)}L${n(cx - 0.21)} ${n(cy + 0.21)}" stroke="${palette.fixture}" stroke-width="0.04"/></g>`
  );
}

/** A floor hatch, drawn rather than taken from the library: a circle with a cross, on its square. */
function hatchMarkup(x: number, y: number, palette: Palette): string {
  const cx = x + 0.5;
  const cy = y + 0.5;
  return (
    `<g class="fp-hatch"><circle cx="${n(cx)}" cy="${n(cy)}" r="0.34" fill="none" stroke="${palette.fixture}" stroke-width="0.06"/>` +
    `<circle cx="${n(cx)}" cy="${n(cy)}" r="0.2" fill="none" stroke="${palette.fixture}" stroke-width="0.04"/></g>`
  );
}

/** A symbol from the library, centred on its footprint and turned with it. FP 7.4. */
export function symbolMarkup(
  fixture: Pick<SquareFixture, "x" | "y" | "rotation" | "symbol">,
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
    ` transform="rotate(${fixture.rotation} ${n(cx)} ${n(cy)})" opacity="${opacity}" preserveAspectRatio="none"${filter}/>`
  );
}

/** Every fixture on a deck. */
export function fixturesMarkup(plan: FloorPlan, deck: number, palette: Palette, href: (file: string) => string): string {
  const out: string[] = [];
  for (const fixture of plan.fixtures) {
    if (fixture.deck !== deck) continue;
    if ("edge" in fixture) {
      out.push(edgeMarkup(fixture, palette));
    } else if (fixture.kind === "hatch") {
      out.push(hatchMarkup(fixture.x, fixture.y, palette));
    } else {
      const symbol = fixture.symbol ?? (fixture.kind === "symbol" ? undefined : ACCESS_SYMBOLS[fixture.kind]);
      out.push(symbolMarkup({ ...fixture, symbol }, palette, href));
    }
  }
  return out.join("");
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
