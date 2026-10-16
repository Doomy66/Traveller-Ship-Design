/**
 * A first layout suggested from the manifest. FloorPlanSpec 7.9.
 *
 * Every component is laid down as a room of its target size along one
 * corridor, in order from the bow: command and weapons, accommodation, the
 * ship's systems, craft, cargo and, aft, the drives. Each room goes on
 * whichever side of the corridor is shorter so far, so the two sides keep
 * level, and each gets a door onto the corridor. Fuel is left for the
 * designer, since a plan need not show it (FP 3.5). A ship too long
 * for one deck goes on to the next, with a lift at the bow end of every
 * corridor joining them.
 *
 * Where a component is plainly one of the library's fitted rooms, at the
 * library room's size, the room is drawn that shape and the fitted room laid
 * over it, turned so its own door opens onto the corridor: staterooms,
 * workshops, medical bays, laboratories, briefing rooms, brigs, and common
 * areas as lounges. Low berths get a berth on every square.
 *
 * It is a starting point to move about, not a design: the rooms are the right
 * size and reachable, and the rest is the designer's.
 */

import type { Component, ComponentGroup, Manifest } from "./manifest";
import { SQUARES_PER_STATEROOM } from "./manifest";
import type { Deck, EdgeFixture, Fixture, FloorPlan, Owner, Rotation } from "./plan";
import { CORRIDOR, PLAN_VERSION, area, cellKey, instanceOwner } from "./plan";
import { symbolById } from "./symbols";

/** Bow to stern. */
const FORE_TO_AFT: readonly ComponentGroup[] = [
  "command",
  "weapons",
  "accommodation",
  "systems",
  "craft",
  "cargo",
  "engineering",
];

/** A stateroom is two squares along the corridor and three deep. */
const STATEROOM_DEPTH = 3;

type Side = "n" | "e" | "s" | "w";

/**
 * A library room and where its own door is, as drawn before turning: on which
 * edge, and how far along it from the left or the top, in squares. Measured
 * from the drawings.
 */
interface Fitted {
  readonly symbol: string;
  readonly door: { readonly edge: Side; readonly at: number };
}

const STATEROOM: Fitted = { symbol: "stateroom-1", door: { edge: "s", at: 1 } };

/** Fitted rooms for the systems the sheet names, by the start of its label. */
const FITTED_SYSTEMS: readonly (readonly [RegExp, Fitted])[] = [
  [/^Workshop\b/, { symbol: "workshop", door: { edge: "n", at: 1 } }],
  [/^Medical Bay\b/, { symbol: "medical-bay", door: { edge: "w", at: 1 } }],
  [/^Laborator/, { symbol: "laboratory", door: { edge: "n", at: 2 } }],
  [/^Briefing Room\b/, { symbol: "briefing-room", door: { edge: "w", at: 1 } }],
  [/^Brig\b/, { symbol: "brig", door: { edge: "w", at: 0 } }],
];

/** Lounges for common areas, largest first. */
const LOUNGES: readonly Fitted[] = [
  { symbol: "lounge-large", door: { edge: "s", at: 1 } },
  { symbol: "lounge", door: { edge: "w", at: 0 } },
  { symbol: "lounge-small", door: { edge: "n", at: 1.5 } },
];

/** What fills a room a square at a time: a low berth to each square. */
const FILLED: Readonly<Record<string, string>> = { lowBerths: "low-berth" };

interface Room {
  readonly owner: Owner;
  readonly squares: number;
  /** Squares back from the corridor. */
  readonly depth: number;
  /** Squares along the corridor. */
  readonly width: number;
  /** A fitted room laid over it, the room being exactly its shape. */
  readonly fitted?: Fitted;
  /** A piece put on each of its squares. */
  readonly fill?: string;
  /** A piece set against the far wall, centred across the room. */
  readonly inset?: string;
}

/**
 * Craft drawn in their docking spaces, by the start of the craft's name: the
 * piece and the squares of docking space each takes. An air/raft is 4 tons,
 * so 5 of docking space, a bay two squares wide and five deep with the
 * craft at the back and a row for the door.
 */
const DOCKED: readonly (readonly [RegExp, { readonly symbol: string; readonly squares: number; readonly width: number }])[] = [
  [/^Air\/Raft\b/i, { symbol: "air-raft", squares: 10, width: 2 }],
];

const squaresOf = (fitted: Fitted): readonly [number, number] => symbolById(fitted.symbol)?.squares ?? [1, 1];

/** A room the shape of a fitted room, turned so its door faces the corridor. */
function fittedRoom(owner: Owner, fitted: Fitted): Room {
  const [w, h] = squaresOf(fitted);
  const across = fitted.door.edge === "n" || fitted.door.edge === "s";
  return { owner, squares: w * h, width: across ? w : h, depth: across ? h : w, fitted };
}

/** The fitted room a component is, and how many of it, if it is plainly one at the library's size. */
function fittedFor(component: Component): { fitted: Fitted; units: number } | undefined {
  const fits = (fitted: Fitted) => {
    const [w, h] = squaresOf(fitted);
    const units = component.target / (w * h);
    return Number.isInteger(units) && units >= 1 ? { fitted, units } : undefined;
  };
  if (component.key === "commonAreas") {
    for (const lounge of LOUNGES) {
      const found = fits(lounge);
      if (found !== undefined) return found;
    }
    return undefined;
  }
  const system = FITTED_SYSTEMS.find(([label]) => label.test(component.label));
  return system === undefined ? undefined : fits(system[1]);
}

const SIDES: readonly Side[] = ["n", "e", "s", "w"];

/**
 * A fitted room put down with its door on the corridor: the turn that brings
 * its door's edge round to face the corridor, and where along the corridor
 * the door then is, from the room's first square.
 */
function turnToCorridor(fitted: Fitted, side: "north" | "south"): { rotation: Rotation; doorAt: number } {
  const [w, h] = squaresOf(fitted);
  const facing: Side = side === "north" ? "s" : "n";
  const quarters = (SIDES.indexOf(facing) - SIDES.indexOf(fitted.door.edge) + 4) % 4;
  const { edge, at } = fitted.door;
  // The door's two ends as drawn, then turned a quarter clockwise at a time
  // within the box, which takes (u, v) in a w by h box to (h - v, u).
  let ends: [number, number][] =
    edge === "n"
      ? [[at, 0], [at + 1, 0]]
      : edge === "s"
        ? [[at, h], [at + 1, h]]
        : edge === "w"
          ? [[0, at], [0, at + 1]]
          : [[w, at], [w, at + 1]];
  let bh = h;
  let bw = w;
  for (let q = 0; q < quarters; q++) {
    const height = bh;
    ends = ends.map(([u, v]) => [height - v, u]);
    [bw, bh] = [bh, bw];
  }
  return { rotation: (quarters * 90) as Rotation, doorAt: Math.min(ends[0]![0], ends[1]![0]) };
}

/**
 * How deep a room goes from the corridor: about half as deep as it is long,
 * so a room reads as a room rather than a strip.
 */
function depthFor(squares: number): number {
  if (squares <= 3) return squares;
  return Math.max(2, Math.round(Math.sqrt(squares / 2)));
}

/**
 * A room's shape: an exact rectangle, as near twice as long as it is deep
 * as its size allows and no longer than six to one; or, where no rectangle
 * that shape holds exactly its squares, whole columns and a part one.
 */
function shapeFor(squares: number): { width: number; depth: number } {
  let best: { width: number; depth: number; off: number } | undefined;
  for (let depth = 1; depth * depth <= squares; depth++) {
    if (squares % depth !== 0) continue;
    const width = squares / depth;
    if (width / depth > MOST_ELONGATED) continue;
    const off = Math.abs(Math.log(width / depth / 2));
    if (best === undefined || off <= best.off) best = { width, depth, off };
  }
  if (best !== undefined) return { width: best.width, depth: best.depth };
  const depth = depthFor(squares);
  return { width: Math.ceil(squares / depth), depth };
}

/** The longest a rectangular room is drawn, to its depth. */
const MOST_ELONGATED = 6;

function roomsOf(component: Component): Room[] {
  // Each of several rooms is laid as a room of its own, with its own owner
  // as each stateroom has, and fitted or furnished as one would be alone.
  if (component.key !== "staterooms" && component.rooms > 1) {
    const each = { ...component, target: component.target / component.rooms, count: 1, rooms: 1 };
    return Array.from({ length: component.rooms }, (_, i) =>
      roomsOf(each).map((room) => ({ ...room, owner: instanceOwner(component.key, i + 1) })),
    ).flat();
  }
  if (component.key === "staterooms") {
    const [w, h] = squaresOf(STATEROOM);
    const fits = w * h === SQUARES_PER_STATEROOM;
    return Array.from({ length: component.count }, (_, i) =>
      fits
        ? fittedRoom(instanceOwner(component.key, i + 1), STATEROOM)
        : {
            owner: instanceOwner(component.key, i + 1),
            squares: SQUARES_PER_STATEROOM,
            depth: STATEROOM_DEPTH,
            width: Math.ceil(SQUARES_PER_STATEROOM / STATEROOM_DEPTH),
          },
    );
  }
  // Several fitted rooms are laid as rooms of their own, of the one component.
  const docked = component.carries === undefined || !component.label.startsWith("Docking Space")
    ? undefined
    : DOCKED.find(([name]) => name.test(component.carries!))?.[1];
  if (docked !== undefined && component.target === docked.squares * component.count) {
    return Array.from({ length: component.count }, () => ({
      owner: component.key,
      squares: docked.squares,
      width: docked.width,
      depth: docked.squares / docked.width,
      inset: docked.symbol,
    }));
  }
  const found = fittedFor(component);
  if (found !== undefined) {
    // Several lounges and the like are each a room, numbered, so they do not run together.
    return Array.from({ length: found.units }, (_, i) => fittedRoom(found.units > 1 ? instanceOwner(component.key, i + 1) : component.key, found.fitted));
  }
  const { width, depth } = shapeFor(component.target);
  const fill = FILLED[component.key];
  return [
    {
      owner: component.key,
      squares: component.target,
      depth,
      width,
      ...(fill === undefined ? {} : { fill }),
    },
  ];
}

/** The rooms to lay, bow first, each group in the sheet's order. */
function roomsFor(manifest: Manifest): Room[] {
  const rooms: Room[] = [];
  for (const group of FORE_TO_AFT) {
    for (const component of manifest.components) if (component.group === group && component.target > 0) rooms.push(...roomsOf(component));
  }
  return rooms;
}

interface Laid {
  readonly room: Room;
  readonly deck: number;
  /** The first square along the corridor. */
  readonly x: number;
  readonly side: "north" | "south";
}

/**
 * The longest a deck's corridor runs before the next deck is started: about
 * twice and a half the side of a square holding the whole plan, or the
 * longest room, whichever is more.
 */
function longestDeck(rooms: readonly Room[]): number {
  const squares = rooms.reduce((sum, r) => sum + r.squares, 0);
  const widest = rooms.reduce((most, r) => Math.max(most, r.width), 0);
  return Math.max(widest, Math.ceil(2.5 * Math.sqrt(squares)));
}

/** The decks a layout would take by itself: as few as keep each within the longest a deck should run. */
function sensibleDecks(rooms: readonly Room[]): number {
  const oneDeck = arrangeWithin(rooms, Infinity);
  return Math.max(1, Math.ceil((oneDeck.lengths[0] ?? 0) / longestDeck(rooms)));
}

/** The number of decks Suggest a layout offers for a ship. FP 7.9. */
export function suggestedDecks(manifest: Manifest): number {
  return sensibleDecks(roomsFor(manifest));
}

/**
 * Rooms put on that many decks, or as many as make sense, with the decks
 * about the same length: the shortest run that fits the rooms on no more
 * decks than that. A deck asked for and not needed is left empty.
 */
function arrange(rooms: readonly Room[], wanted?: number): { laid: Laid[]; lengths: number[] } {
  const decks = Math.max(1, Math.min(wanted ?? sensibleDecks(rooms), Math.max(1, rooms.length)));
  const oneDeck = arrangeWithin(rooms, Infinity);
  if (decks <= 1) return oneDeck;
  for (let most = Math.ceil((oneDeck.lengths[0] ?? 0) / decks); ; most++) {
    const tried = arrangeWithin(rooms, most);
    if (tried.lengths.length <= decks) return tried;
  }
}

/** Rooms put on decks and sides, a deck at most `most` squares long. Corridors start one square in from x = 0, where the lift goes. */
function arrangeWithin(rooms: readonly Room[], most: number): { laid: Laid[]; lengths: number[] } {
  const laid: Laid[] = [];
  const lengths: number[] = [];
  let deck = 0;
  let north = 1;
  let south = 1;
  for (const room of rooms) {
    let side: "north" | "south" = north <= south ? "north" : "south";
    let at = side === "north" ? north : south;
    if (at + room.width - 1 > most && (north > 1 || south > 1)) {
      lengths[deck] = Math.max(north, south);
      deck += 1;
      north = 1;
      south = 1;
      side = "north";
      at = 1;
    }
    laid.push({ room, deck, x: at, side });
    if (side === "north") north = at + room.width;
    else south = at + room.width;
  }
  lengths[deck] = Math.max(north, south);
  return { laid, lengths };
}

/**
 * The squares of a room of `squares` squares, `depth` deep, starting at
 * column x: whole columns back from the corridor, and what is left over in a
 * last column against it, so the room keeps to its target exactly.
 */
function roomSquares(room: Room, x: number, corridor: number, side: "north" | "south"): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 0; i < room.squares; i++) {
    const column = Math.floor(i / room.depth);
    const back = i % room.depth;
    out.push([x + column, side === "north" ? corridor - 1 - back : corridor + 1 + back]);
  }
  return out;
}

/** A suggested plan for the manifest, keeping what the old plan remembered. */
export function suggestLayout(manifest: Manifest, remembered: FloorPlan["remembered"] = {}, deckCount?: number): FloorPlan {
  const rooms = roomsFor(manifest);
  const arranged = arrange(rooms, deckCount);
  const { laid } = arranged;
  // Decks asked for beyond those the rooms filled are there, and empty, to draw on.
  const lengths = [...arranged.lengths, ...Array.from({ length: Math.max(0, (deckCount ?? 0) - arranged.lengths.length) }, () => 0)];
  // Every deck's corridor is on the same row, so decks line up over one another.
  const corridor = laid.reduce((most, l) => (l.side === "north" ? Math.max(most, l.room.depth) : most), 0);
  const cells: Record<string, Owner>[] = lengths.map(() => ({}));
  const fixtures: Fixture[] = [];
  const set = (deck: number, x: number, y: number, owner: Owner) => {
    for (const [cx, cy] of area(x, y, 1, 1)) cells[deck]![cellKey(cx, cy)] = owner;
  };

  for (const [deck, length] of lengths.entries()) {
    for (let x = 0; x < length; x++) set(deck, x, corridor, CORRIDOR);
    if (length === 0) continue;
    if (lengths.length > 1) fixtures.push({ kind: "lift", deck, x: 0, y: corridor, rotation: 0 });
  }
  for (const { room, deck, x, side } of laid) {
    const squares = roomSquares(room, x, corridor, side);
    for (const [sx, sy] of squares) set(deck, sx, sy, room.owner);
    const wall = side === "north" ? corridor : corridor + 1;
    if (room.fitted !== undefined) {
      // The fitted room over the floor, and a door where its own is.
      const { rotation, doorAt } = turnToCorridor(room.fitted, side);
      const top = side === "north" ? corridor - room.depth : corridor + 1;
      fixtures.push({ kind: "symbol", deck, x, y: top, rotation, symbol: room.fitted.symbol });
      fixtures.push({ kind: "door", deck, x: x + doorAt, y: wall, edge: "n" });
      continue;
    }
    if (room.inset !== undefined) {
      const symbol = symbolById(room.inset);
      if (symbol !== undefined) {
        const [w, h] = symbol.squares;
        const far = side === "north" ? corridor - room.depth : corridor + 1 + room.depth - h;
        fixtures.push({ kind: "symbol", deck, x: x + (room.width - w) / 2, y: far, rotation: 0, symbol: room.inset });
      }
    }
    if (room.fill !== undefined) {
      for (const [sx, sy] of squares) fixtures.push({ kind: "symbol", deck, x: sx, y: sy, rotation: 0, symbol: room.fill });
    }
    // The middle of the room's run along the corridor, on the wall between them.
    const door: EdgeFixture = { kind: "door", deck, x: x + Math.floor((room.width - 1) / 2), y: wall, edge: "n" };
    fixtures.push(door);
  }

  const decks: Deck[] = lengths.map((_, i) => ({ name: `Deck ${i + 1}`, cells: cells[i]! }));
  return { version: PLAN_VERSION, decks, fixtures, tiles: [], remembered };
}
