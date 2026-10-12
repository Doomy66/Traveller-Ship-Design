/**
 * A floor plan: decks of squares, who owns each part of them, and the
 * fixtures drawn on top. FloorPlanSpec section 4.
 *
 * Everything is measured in squares, and everything sits on a grid of half
 * squares (FP 4.2.1). A room is made of cells half a square on a side, four
 * to the square, each keyed by its top left corner: "2.5,3".
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

/** The grid everything sits on: half a square. FP 4.2.1. */
export const CELL = 0.5;

/** A position put on the nearest half square. */
export const toHalf = (v: number): number => Math.round(v / CELL) * CELL;

/** A position put on the half square at or before it, which is the cell it falls in. */
export const cellOf = (v: number): number => Math.floor(v / CELL) * CELL;

/** Which edge of a square a door or iris valve sits on. Only north and west are stored; FP 7.1. */
export type Edge = "n" | "w";

/** A door, an iris valve, or an opening: a stretch of wall left out, so two rooms run into one another. FP 7.1.4. */
export type EdgeKind = "door" | "iris" | "open";

/** Fixtures that join decks. FP 6.1. */
export const ACCESS_KINDS = ["lift", "hatch", "stairs"] as const;
export type AccessKind = (typeof ACCESS_KINDS)[number];

export interface EdgeFixture {
  readonly kind: EdgeKind;
  readonly deck: number;
  /** Where it starts along the wall, in whole or half squares. */
  readonly x: number;
  readonly y: number;
  readonly edge: Edge;
  /**
   * Squares of wall it spans, along the wall: east from (x, y) for a north
   * edge, south for a west one, in whole or half squares. Absent means one.
   * A wide door is one fixture; two doors side by side are two. FP 7.1.1.
   */
  readonly length?: number;
}

export interface SquareFixture {
  /** An access kind, or `symbol` for furniture drawn from the symbol library. */
  readonly kind: AccessKind | "symbol";
  readonly deck: number;
  /** The top left corner of its footprint, in whole or half squares. FP 7.1.3. */
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
  /** The top left corner of its footprint, in whole or half squares. FP 7.1.3. */
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
  /** Half-square cells by their top left corner, "x,y". An absent cell is empty. */
  readonly cells: Readonly<Record<string, Owner>>;
}

/** What each component was when the plan was last saved. FP 4.1 and section 9. */
export interface Remembered {
  readonly label: string;
  readonly tons: number;
}

export interface FloorPlan {
  readonly version: 2;
  readonly decks: readonly Deck[];
  readonly fixtures: readonly Fixture[];
  /** Geomorph tiles, in the order they were laid, so later ones draw over earlier ones. */
  readonly tiles: readonly PlacedTile[];
  readonly remembered: Readonly<Record<string, Remembered>>;
}

/**
 * 1 kept whole squares as its cells. 2 keeps half-square cells, four to the
 * square, and reads a 1 by splitting each square in four.
 */
export const PLAN_VERSION = 2;

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

/** Give cells to an owner, or empty them with `undefined`. Each is named by its top left corner. */
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

/** Every cell in the rectangle between two cells, both included. */
export function rectangle(a: readonly [number, number], b: readonly [number, number]): [number, number][] {
  const out: [number, number][] = [];
  const [x0, x1] = [Math.min(a[0], b[0]), Math.max(a[0], b[0])];
  const [y0, y1] = [Math.min(a[1], b[1]), Math.max(a[1], b[1])];
  for (let y = y0; y <= y1 + 1e-9; y += CELL) for (let x = x0; x <= x1 + 1e-9; x += CELL) out.push([toHalf(x), toHalf(y)]);
  return out;
}

/**
 * Every cell of an area of whole or half squares: x and y its top left
 * corner, w and h its size. Painting a square at a time is this with w and h
 * of one.
 */
export function area(x: number, y: number, w: number, h: number): [number, number][] {
  return rectangle([x, y], [x + w - CELL, y + h - CELL]);
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

/** Move a whole deck by whole or half squares, fixtures and all. FP 4.3.2. */
export function shiftDeck(plan: FloorPlan, at: number, dx: number, dy: number): FloorPlan {
  const deck = plan.decks[at];
  if (deck === undefined) return plan;
  const cells: Record<string, Owner> = {};
  for (const [key, owner] of Object.entries(deck.cells)) {
    const [x, y] = parseCell(key);
    cells[cellKey(toHalf(x + dx), toHalf(y + dy))] = owner;
  }
  return {
    ...replaceDeck(plan, at, { ...deck, cells }),
    fixtures: plan.fixtures.map((f) => (f.deck === at ? { ...f, x: f.x + dx, y: f.y + dy } : f)),
    tiles: plan.tiles.map((t) => (t.deck === at ? { ...t, x: t.x + dx, y: t.y + dy } : t)),
  };
}

/** Every half-square stretch of wall an edge fixture covers, as "x,y,n" or "x,y,w". */
export function edgesOf(f: EdgeFixture): string[] {
  const out: string[] = [];
  for (let along = 0; along < (f.length ?? 1) - 1e-9; along += CELL) {
    out.push(f.edge === "n" ? `${toHalf(f.x + along)},${f.y},n` : `${f.x},${toHalf(f.y + along)},w`);
  }
  return out;
}

/** Every stretch of wall on a deck that an opening leaves out. FP 7.1.4. */
export function openings(plan: FloorPlan, deck: number): Set<string> {
  const out = new Set<string>();
  for (const f of plan.fixtures) if (f.deck === deck && "edge" in f && f.kind === "open") for (const e of edgesOf(f)) out.add(e);
  return out;
}

/**
 * Two edge fixtures sharing any edge, or two lifts, hatches or stairs on the
 * same square, on the same deck. A new fixture replaces any it clashes with.
 * Furniture never clashes: a chair can stand on a fitted room's floor.
 */
function clashes(a: Fixture, b: Fixture): boolean {
  if (a.deck !== b.deck) return false;
  if ("edge" in a) {
    if (!("edge" in b)) return false;
    const taken = new Set(edgesOf(a));
    return edgesOf(b).some((e) => taken.has(e));
  }
  if ("edge" in b || a.kind === "symbol" || b.kind === "symbol") return false;
  return a.x === b.x && a.y === b.y;
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

/** The cells a footprint covers: those whose middle lies inside it. */
export function squaresUnder(x: number, y: number, w: number, h: number): [number, number][] {
  const out: [number, number][] = [];
  const half = CELL / 2;
  for (let cy = Math.ceil((y - half) / CELL) * CELL; cy + half < y + h; cy += CELL) {
    for (let cx = Math.ceil((x - half) / CELL) * CELL; cx + half < x + w; cx += CELL) out.push([toHalf(cx), toHalf(cy)]);
  }
  return out;
}

/** Every cell a deck's tiles cover. FP 12.3. */
export function tiledSquares(plan: FloorPlan, deck: number): Set<string> {
  const covered = new Set<string>();
  for (const t of plan.tiles) {
    if (t.deck !== deck || isOverlayTile(t)) continue;
    const [w, h] = tileFootprint(t);
    for (const [sx, sy] of squaresUnder(t.x, t.y, w, h)) covered.add(cellKey(sx, sy));
  }
  return covered;
}

/** Overlay tiles are transparent layers over another tile, and take no squares of their own. */
export function isOverlayTile(tile: Pick<PlacedTile, "tile">): boolean {
  return tile.tile.includes("-overlay-");
}

/** Move a set of cells on a deck by whole or half squares, keeping their owner. Whatever was under them is replaced. */
export function moveSquares(plan: FloorPlan, deck: number, squares: readonly (readonly [number, number])[], dx: number, dy: number): FloorPlan {
  const target = plan.decks[deck];
  if (target === undefined || squares.length === 0 || (dx === 0 && dy === 0)) return plan;
  const cells: Record<string, Owner> = { ...target.cells };
  const moving: [string, Owner][] = [];
  for (const [x, y] of squares) {
    const key = cellKey(x, y);
    const owner = cells[key];
    if (owner === undefined) continue;
    moving.push([cellKey(toHalf(x + dx), toHalf(y + dy)), owner]);
    delete cells[key];
  }
  for (const [key, owner] of moving) cells[key] = owner;
  return replaceDeck(plan, deck, { ...target, cells });
}

/** How far, in whole squares each way, a room sent to another deck looks for space before going past the deck's edge. */
const SEARCH_SQUARES = 60;

/**
 * Move a room's cells to another deck, into empty space: where they are, if
 * nothing is there, or else the nearest place, by whole squares, where none
 * lands on a painted cell or a tile. Its doors stay behind, as they do when a
 * room is moved on its deck. FP 4.3.3. Returns the plan and the cells now
 * held, in the order given, or undefined if there is nothing to move.
 */
export function moveSquaresToDeck(
  plan: FloorPlan,
  from: number,
  squares: readonly (readonly [number, number])[],
  to: number,
): { plan: FloorPlan; squares: [number, number][] } | undefined {
  const source = plan.decks[from];
  const target = plan.decks[to];
  if (source === undefined || target === undefined || from === to) return undefined;
  const moving = squares.filter(([x, y]) => source.cells[cellKey(x, y)] !== undefined);
  if (moving.length === 0) return undefined;

  const taken = tiledSquares(plan, to);
  for (const key of Object.keys(target.cells)) taken.add(key);
  const fits = (dx: number, dy: number) => moving.every(([x, y]) => !taken.has(cellKey(toHalf(x + dx), toHalf(y + dy))));

  // Rings of whole squares outward, nearest first in each, as far as a deck
  // of an ordinary ship runs. Failing that, just past the deck's right-hand
  // edge, where there is always room.
  let offset: [number, number] | undefined;
  for (let r = 0; r <= SEARCH_SQUARES && offset === undefined; r++) {
    const ring: [number, number][] = [];
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) if (Math.max(Math.abs(dx), Math.abs(dy)) === r) ring.push([dx, dy]);
    }
    ring.sort((a, b) => a[0] ** 2 + a[1] ** 2 - (b[0] ** 2 + b[1] ** 2));
    offset = ring.find(([dx, dy]) => fits(dx, dy));
  }
  if (offset === undefined) {
    let deckRight = -Infinity;
    for (const key of taken) deckRight = Math.max(deckRight, parseCell(key)[0]);
    let roomLeft = Infinity;
    for (const [x] of moving) roomLeft = Math.min(roomLeft, x);
    offset = [Math.ceil(deckRight + CELL - roomLeft), 0];
  }
  const [dx, dy] = offset;

  const left: Record<string, Owner> = { ...source.cells };
  const arrived: Record<string, Owner> = { ...target.cells };
  for (const [x, y] of moving) {
    const key = cellKey(x, y);
    arrived[cellKey(toHalf(x + dx), toHalf(y + dy))] = left[key]!;
    delete left[key];
  }
  const decks = plan.decks.map((d, i) => (i === from ? { ...d, cells: left } : i === to ? { ...d, cells: arrived } : d));
  return { plan: { ...plan, decks }, squares: moving.map(([x, y]) => [toHalf(x + dx), toHalf(y + dy)]) };
}

/**
 * Turn a set of cells a quarter clockwise, or mirror it left to right, about
 * the middle of the box around them, keeping their owners. The box's middle
 * stays where it was, to the half square, rounding towards it so that turning
 * four times or flipping twice puts the room back exactly. Whatever was under
 * the new cells is replaced. FP 7.1.2. Returns the plan and the cells now
 * held, in the order given.
 */
export function turnSquares(
  plan: FloorPlan,
  deck: number,
  squares: readonly (readonly [number, number])[],
  how: "turn" | "flip",
): { plan: FloorPlan; squares: [number, number][] } {
  const target = plan.decks[deck];
  if (target === undefined || squares.length === 0) return { plan, squares: squares.map(([x, y]) => [x, y]) };
  const minX = Math.min(...squares.map(([x]) => x));
  const minY = Math.min(...squares.map(([, y]) => y));
  const w = Math.max(...squares.map(([x]) => x)) + CELL - minX;
  const h = Math.max(...squares.map(([, y]) => y)) + CELL - minY;
  const towardsZero = (v: number) => Math.trunc(v / CELL) * CELL;
  const shiftX = how === "turn" ? towardsZero((w - h) / 2) : 0;
  const shiftY = how === "turn" ? towardsZero((h - w) / 2) : 0;
  const to = squares.map(([x, y]): [number, number] => {
    const u = x - minX;
    const v = y - minY;
    const [nu, nv] = how === "turn" ? [h - v - CELL, u] : [w - u - CELL, v];
    return [toHalf(minX + shiftX + nu), toHalf(minY + shiftY + nv)];
  });
  const cells: Record<string, Owner> = { ...target.cells };
  const moving: [string, Owner][] = [];
  for (const [i, [x, y]] of squares.entries()) {
    const key = cellKey(x, y);
    const owner = cells[key];
    if (owner === undefined) continue;
    moving.push([cellKey(...to[i]!), owner]);
    delete cells[key];
  }
  for (const [key, owner] of moving) cells[key] = owner;
  return { plan: replaceDeck(plan, deck, { ...target, cells }), squares: to };
}

/** Note what each component is now, so a later change to the design shows up. FP 9.1. */
export function remember(plan: FloorPlan, components: readonly { key: string; label: string; tons: number }[]): FloorPlan {
  const remembered: Record<string, Remembered> = {};
  for (const c of components) remembered[c.key] = { label: c.label, tons: c.tons };
  return { ...plan, remembered };
}

/** Every cell of the plan, with its deck, its corner and its owner. */
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
  // A version 1 plan's cells were whole squares; each becomes four.
  const whole = value.version !== PLAN_VERSION;
  const decks: Deck[] = [];
  for (const d of value.decks as unknown[]) {
    if (typeof d !== "object" || d === null) continue;
    const deck = d as { name?: unknown; cells?: unknown };
    const cells: Record<string, Owner> = {};
    if (typeof deck.cells === "object" && deck.cells !== null) {
      for (const [key, owner] of Object.entries(deck.cells as Record<string, unknown>)) {
        if (!/^-?\d+(\.5)?,-?\d+(\.5)?$/.test(key) || typeof owner !== "string" || owner === "") continue;
        const [x, y] = parseCell(key);
        if (whole) for (const [cx, cy] of area(x, y, 1, 1)) cells[cellKey(cx, cy)] = owner;
        else cells[key] = owner;
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
    const half = { deck: it["deck"], x: toHalf(it["x"]), y: toHalf(it["y"]) };
    if ((it["kind"] === "door" || it["kind"] === "iris" || it["kind"] === "open") && (it["edge"] === "n" || it["edge"] === "w")) {
      const length = typeof it["length"] === "number" && it["length"] !== 1 ? Math.max(CELL, toHalf(it["length"])) : undefined;
      fixtures.push({ kind: it["kind"], edge: it["edge"], ...half, ...(length === undefined ? {} : { length }) });
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
      ...half,
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
      x: toHalf(it["x"]),
      y: toHalf(it["y"]),
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
