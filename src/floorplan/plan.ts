/**
 * A floor plan: decks of squares, who owns each square, and the fixtures drawn
 * on top. FloorPlanSpec section 4.
 *
 * Every function here is pure. A change makes a new plan rather than altering
 * the old one, which is what lets the editor keep an undo history by holding
 * on to old plans.
 */

/** The owner of a corridor square, which belongs to no component. FP 2.5. */
export const CORRIDOR = "~corridor";

/**
 * Who owns a square: a component's key, a component's key and which of its
 * several things this is (`staterooms#3`), or the corridor.
 */
export type Owner = string;

export type Rotation = 0 | 90 | 180 | 270;

/** Which edge of a square a door or iris valve sits on. Only north and west are stored; FP 7.1. */
export type Edge = "n" | "w";

export type EdgeKind = "door" | "iris";

/** Fixtures that join decks. FP 6.1. */
export const ACCESS_KINDS = ["lift", "hatch", "stairs"] as const;
export type AccessKind = (typeof ACCESS_KINDS)[number];

export interface EdgeFixture {
  readonly kind: EdgeKind;
  readonly deck: number;
  /** The first edge it covers. */
  readonly x: number;
  readonly y: number;
  readonly edge: Edge;
  /**
   * Squares of wall it spans, along the wall: east from (x, y) for a north
   * edge, south for a west one. Absent means one. A wide door is one fixture;
   * two doors side by side are two. FP 7.1.1.
   */
  readonly length?: number;
}

export interface SquareFixture {
  /** An access kind, or `symbol` for furniture drawn from the symbol library. */
  readonly kind: AccessKind | "symbol";
  readonly deck: number;
  /** The top left square of its footprint. */
  readonly x: number;
  readonly y: number;
  readonly rotation: Rotation;
  /** Mirrored left to right before it is turned. FP 7.1.2. */
  readonly flip?: boolean;
  /** The symbol's id in the library, for kind `symbol`, or an alternative drawing for the others. */
  readonly symbol?: string;
}

export type Fixture = EdgeFixture | SquareFixture;

/**
 * A geomorph tile laid on a deck. It carries its own size, so a plan draws
 * its outline correctly even where the image is not to hand. FP 12.
 */
export interface PlacedTile {
  readonly deck: number;
  /** The top left square of its footprint. */
  readonly x: number;
  readonly y: number;
  readonly rotation: Rotation;
  /** Mirrored left to right before it is turned. FP 7.1.2. */
  readonly flip?: boolean;
  /** The tile's id: its filename made into an id (FP 12.2). */
  readonly tile: string;
  /** Squares at rotation 0, wide and high. */
  readonly squares: readonly [number, number];
  /** The image's size in pixels, margin and all. */
  readonly pixels: readonly [number, number];
  /** The tile's code, shown on its outline when the image is missing. */
  readonly code: string;
}

export interface Deck {
  readonly name: string;
  /** Squares by "x,y". An absent square is empty. */
  readonly cells: Readonly<Record<string, Owner>>;
}

/** What each component was when the plan was last saved. FP 4.1 and section 9. */
export interface Remembered {
  readonly label: string;
  readonly tons: number;
}

export interface FloorPlan {
  readonly version: 1;
  readonly decks: readonly Deck[];
  readonly fixtures: readonly Fixture[];
  /** Geomorph tiles, in the order they were laid, so later ones draw over earlier ones. */
  readonly tiles: readonly PlacedTile[];
  readonly remembered: Readonly<Record<string, Remembered>>;
}

export const PLAN_VERSION = 1;

export function emptyPlan(): FloorPlan {
  return { version: PLAN_VERSION, decks: [{ name: "Deck 1", cells: {} }], fixtures: [], tiles: [], remembered: {} };
}

export const cellKey = (x: number, y: number): string => `${x},${y}`;

export function parseCell(key: string): [number, number] {
  const [x, y] = key.split(",").map(Number);
  return [x ?? 0, y ?? 0];
}

/** The component key an owner belongs to, with any instance number taken off. */
export function baseKey(owner: Owner): string {
  const hash = owner.indexOf("#");
  return hash === -1 ? owner : owner.slice(0, hash);
}

/** Which of a component's several things an owner is, counting from 1, or undefined for the whole. */
export function instanceOf(owner: Owner): number | undefined {
  const hash = owner.indexOf("#");
  return hash === -1 ? undefined : Number(owner.slice(hash + 1));
}

export const instanceOwner = (key: string, instance: number): Owner => `${key}#${instance}`;

function replaceDeck(plan: FloorPlan, at: number, deck: Deck): FloorPlan {
  return { ...plan, decks: plan.decks.map((d, i) => (i === at ? deck : d)) };
}

/** Give squares to an owner, or empty them with `undefined`. */
export function paint(plan: FloorPlan, deck: number, squares: readonly (readonly [number, number])[], owner: Owner | undefined): FloorPlan {
  const target = plan.decks[deck];
  if (target === undefined || squares.length === 0) return plan;
  const cells: Record<string, Owner> = { ...target.cells };
  for (const [x, y] of squares) {
    const key = cellKey(x, y);
    if (owner === undefined) delete cells[key];
    else cells[key] = owner;
  }
  return replaceDeck(plan, deck, { ...target, cells });
}

/** Every square in the rectangle between two corners, both included. */
export function rectangle(a: readonly [number, number], b: readonly [number, number]): [number, number][] {
  const out: [number, number][] = [];
  const [x0, x1] = [Math.min(a[0], b[0]), Math.max(a[0], b[0])];
  const [y0, y1] = [Math.min(a[1], b[1]), Math.max(a[1], b[1])];
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) out.push([x, y]);
  return out;
}

/** Every square of a deck an owner has, or every square of a component with any instance. */
export function squaresOf(deck: Deck, owner: Owner): [number, number][] {
  return Object.entries(deck.cells)
    .filter(([, o]) => o === owner)
    .map(([key]) => parseCell(key));
}

export function addDeck(plan: FloorPlan, name = `Deck ${plan.decks.length + 1}`): FloorPlan {
  return { ...plan, decks: [...plan.decks, { name, cells: {} }] };
}

export function renameDeck(plan: FloorPlan, at: number, name: string): FloorPlan {
  const deck = plan.decks[at];
  return deck === undefined ? plan : replaceDeck(plan, at, { ...deck, name });
}

/** Take a deck away, with its fixtures. The last deck cannot go. */
export function removeDeck(plan: FloorPlan, at: number): FloorPlan {
  if (plan.decks.length <= 1 || plan.decks[at] === undefined) return plan;
  return {
    ...plan,
    decks: plan.decks.filter((_, i) => i !== at),
    fixtures: plan.fixtures
      .filter((f) => f.deck !== at)
      .map((f) => (f.deck > at ? { ...f, deck: f.deck - 1 } : f)),
    tiles: plan.tiles.filter((t) => t.deck !== at).map((t) => (t.deck > at ? { ...t, deck: t.deck - 1 } : t)),
  };
}

/** Swap a deck with its neighbour above (-1) or below (+1). */
export function moveDeck(plan: FloorPlan, at: number, by: -1 | 1): FloorPlan {
  const to = at + by;
  const a = plan.decks[at];
  const b = plan.decks[to];
  if (a === undefined || b === undefined) return plan;
  const decks = [...plan.decks];
  decks[at] = b;
  decks[to] = a;
  const swap = (d: number) => (d === at ? to : d === to ? at : d);
  return {
    ...plan,
    decks,
    fixtures: plan.fixtures.map((f) => ({ ...f, deck: swap(f.deck) })),
    tiles: plan.tiles.map((t) => ({ ...t, deck: swap(t.deck) })),
  };
}

/** Move a whole deck by whole squares, fixtures and all. FP 4.3.2. */
export function shiftDeck(plan: FloorPlan, at: number, dx: number, dy: number): FloorPlan {
  const deck = plan.decks[at];
  if (deck === undefined) return plan;
  const cells: Record<string, Owner> = {};
  for (const [key, owner] of Object.entries(deck.cells)) {
    const [x, y] = parseCell(key);
    cells[cellKey(x + dx, y + dy)] = owner;
  }
  return {
    ...replaceDeck(plan, at, { ...deck, cells }),
    fixtures: plan.fixtures.map((f) => (f.deck === at ? { ...f, x: f.x + dx, y: f.y + dy } : f)),
    tiles: plan.tiles.map((t) => (t.deck === at ? { ...t, x: t.x + dx, y: t.y + dy } : t)),
  };
}

/** Every edge an edge fixture covers, as "x,y,n" or "x,y,w". */
export function edgesOf(f: EdgeFixture): string[] {
  const out: string[] = [];
  for (let i = 0; i < (f.length ?? 1); i++) {
    out.push(f.edge === "n" ? `${f.x + i},${f.y},n` : `${f.x},${f.y + i},w`);
  }
  return out;
}

/**
 * Two edge fixtures sharing any edge, or two square fixtures at the same
 * square, on the same deck. A new fixture replaces any it clashes with.
 */
function clashes(a: Fixture, b: Fixture): boolean {
  if (a.deck !== b.deck) return false;
  if ("edge" in a) {
    if (!("edge" in b)) return false;
    const taken = new Set(edgesOf(a));
    return edgesOf(b).some((e) => taken.has(e));
  }
  return !("edge" in b) && a.x === b.x && a.y === b.y;
}

/** Add a fixture, replacing whatever it clashes with. */
export function placeFixture(plan: FloorPlan, fixture: Fixture): FloorPlan {
  return { ...plan, fixtures: [...plan.fixtures.filter((f) => !clashes(f, fixture)), fixture] };
}

export function removeFixture(plan: FloorPlan, fixture: Fixture): FloorPlan {
  return { ...plan, fixtures: plan.fixtures.filter((f) => f !== fixture) };
}

/** Replace the fixture at an index, as moving or turning it does. */
export function replaceFixture(plan: FloorPlan, at: number, fixture: Fixture): FloorPlan {
  return { ...plan, fixtures: plan.fixtures.map((f, i) => (i === at ? fixture : f)) };
}

export function placeTile(plan: FloorPlan, tile: PlacedTile): FloorPlan {
  return { ...plan, tiles: [...plan.tiles, tile] };
}

export function replaceTile(plan: FloorPlan, at: number, tile: PlacedTile): FloorPlan {
  return { ...plan, tiles: plan.tiles.map((t, i) => (i === at ? tile : t)) };
}

export function removeTile(plan: FloorPlan, at: number): FloorPlan {
  return { ...plan, tiles: plan.tiles.filter((_, i) => i !== at) };
}

/** Squares a tile covers at its rotation, wide and high. */
export function tileFootprint(tile: Pick<PlacedTile, "squares" | "rotation">): readonly [number, number] {
  const [w, h] = tile.squares;
  return tile.rotation === 90 || tile.rotation === 270 ? [h, w] : [w, h];
}

/** Every square a deck's tiles cover. FP 12.3. */
export function tiledSquares(plan: FloorPlan, deck: number): Set<string> {
  const covered = new Set<string>();
  for (const t of plan.tiles) {
    if (t.deck !== deck || isOverlayTile(t)) continue;
    const [w, h] = tileFootprint(t);
    for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) covered.add(cellKey(t.x + dx, t.y + dy));
  }
  return covered;
}

/** Overlay tiles are transparent layers over another tile, and take no squares of their own. */
export function isOverlayTile(tile: Pick<PlacedTile, "tile">): boolean {
  return tile.tile.includes("-overlay-");
}

/** Move a set of squares on a deck by whole squares, keeping their owner. Whatever was under them is replaced. */
export function moveSquares(plan: FloorPlan, deck: number, squares: readonly (readonly [number, number])[], dx: number, dy: number): FloorPlan {
  const target = plan.decks[deck];
  if (target === undefined || squares.length === 0 || (dx === 0 && dy === 0)) return plan;
  const cells: Record<string, Owner> = { ...target.cells };
  const moving: [string, Owner][] = [];
  for (const [x, y] of squares) {
    const key = cellKey(x, y);
    const owner = cells[key];
    if (owner === undefined) continue;
    moving.push([cellKey(x + dx, y + dy), owner]);
    delete cells[key];
  }
  for (const [key, owner] of moving) cells[key] = owner;
  return replaceDeck(plan, deck, { ...target, cells });
}

/** Note what each component is now, so a later change to the design shows up. FP 9.1. */
export function remember(plan: FloorPlan, components: readonly { key: string; label: string; tons: number }[]): FloorPlan {
  const remembered: Record<string, Remembered> = {};
  for (const c of components) remembered[c.key] = { label: c.label, tons: c.tons };
  return { ...plan, remembered };
}

/** Squares, decks, owners: every square of the plan with where it is. */
export function* allSquares(plan: FloorPlan): Generator<{ deck: number; x: number; y: number; owner: Owner }> {
  for (const [deck, d] of plan.decks.entries()) {
    for (const [key, owner] of Object.entries(d.cells)) {
      const [x, y] = parseCell(key);
      yield { deck, x, y, owner };
    }
  }
}

const ROTATIONS: readonly number[] = [0, 90, 180, 270];

/**
 * Read a plan back from a saved ship. Whatever cannot be read is dropped
 * rather than refused, so a damaged plan loses its damaged part and keeps the
 * rest. Nothing that is not a plan at all comes back as one.
 */
export function readPlan(raw: unknown): FloorPlan | undefined {
  if (typeof raw !== "object" || raw === null) return undefined;
  const value = raw as Partial<Record<keyof FloorPlan, unknown>>;
  if (!Array.isArray(value.decks)) return undefined;
  const decks: Deck[] = [];
  for (const d of value.decks as unknown[]) {
    if (typeof d !== "object" || d === null) continue;
    const deck = d as { name?: unknown; cells?: unknown };
    const cells: Record<string, Owner> = {};
    if (typeof deck.cells === "object" && deck.cells !== null) {
      for (const [key, owner] of Object.entries(deck.cells as Record<string, unknown>)) {
        if (/^-?\d+,-?\d+$/.test(key) && typeof owner === "string" && owner !== "") cells[key] = owner;
      }
    }
    decks.push({ name: typeof deck.name === "string" ? deck.name : `Deck ${decks.length + 1}`, cells });
  }
  if (decks.length === 0) return undefined;
  const fixtures: Fixture[] = [];
  for (const f of Array.isArray(value.fixtures) ? (value.fixtures as unknown[]) : []) {
    if (typeof f !== "object" || f === null) continue;
    const it = f as Record<string, unknown>;
    if (typeof it["deck"] !== "number" || typeof it["x"] !== "number" || typeof it["y"] !== "number") continue;
    if (it["deck"] < 0 || it["deck"] >= decks.length) continue;
    const at = { deck: it["deck"], x: Math.round(it["x"]), y: Math.round(it["y"]) };
    if ((it["kind"] === "door" || it["kind"] === "iris") && (it["edge"] === "n" || it["edge"] === "w")) {
      const length = typeof it["length"] === "number" && it["length"] > 1 ? Math.round(it["length"]) : undefined;
      fixtures.push({ kind: it["kind"], edge: it["edge"], ...at, ...(length === undefined ? {} : { length }) });
      continue;
    }
    const kind = it["kind"];
    if (kind !== "symbol" && !(ACCESS_KINDS as readonly unknown[]).includes(kind)) continue;
    const rotation = ROTATIONS.includes(it["rotation"] as number) ? (it["rotation"] as Rotation) : 0;
    const symbol = typeof it["symbol"] === "string" ? it["symbol"] : undefined;
    if (kind === "symbol" && symbol === undefined) continue;
    fixtures.push({
      kind: kind as SquareFixture["kind"],
      rotation,
      ...at,
      ...(it["flip"] === true ? { flip: true } : {}),
      ...(symbol === undefined ? {} : { symbol }),
    });
  }
  const tiles: PlacedTile[] = [];
  for (const t of Array.isArray(value.tiles) ? (value.tiles as unknown[]) : []) {
    if (typeof t !== "object" || t === null) continue;
    const it = t as Record<string, unknown>;
    const pair = (v: unknown) =>
      Array.isArray(v) && v.length === 2 && v.every((n) => typeof n === "number" && n > 0) ? (v as [number, number]) : undefined;
    const squares = pair(it["squares"]);
    const pixels = pair(it["pixels"]);
    if (typeof it["tile"] !== "string" || squares === undefined || pixels === undefined) continue;
    if (typeof it["deck"] !== "number" || it["deck"] < 0 || it["deck"] >= decks.length) continue;
    if (typeof it["x"] !== "number" || typeof it["y"] !== "number") continue;
    tiles.push({
      deck: it["deck"],
      x: Math.round(it["x"]),
      y: Math.round(it["y"]),
      rotation: ROTATIONS.includes(it["rotation"] as number) ? (it["rotation"] as Rotation) : 0,
      ...(it["flip"] === true ? { flip: true } : {}),
      tile: it["tile"],
      squares,
      pixels,
      code: typeof it["code"] === "string" ? it["code"] : it["tile"],
    });
  }
  const remembered: Record<string, Remembered> = {};
  if (typeof value.remembered === "object" && value.remembered !== null) {
    for (const [key, r] of Object.entries(value.remembered as Record<string, unknown>)) {
      if (typeof r !== "object" || r === null) continue;
      const it = r as { label?: unknown; tons?: unknown };
      if (typeof it.label === "string" && typeof it.tons === "number") remembered[key] = { label: it.label, tons: it.tons };
    }
  }
  return { version: PLAN_VERSION, decks, fixtures, tiles, remembered };
}
