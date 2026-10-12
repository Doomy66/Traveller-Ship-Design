/**
 * A first layout suggested from the manifest. FloorPlanSpec 7.9.
 *
 * Every component is laid down as a room of its target size along one
 * corridor, in order from the bow: command and weapons, accommodation, the
 * ship's systems, craft, cargo, fuel and, aft, the drives. Each room goes on
 * whichever side of the corridor is shorter so far, so the two sides keep
 * level, and each but the fuel gets a door onto the corridor. A ship too long
 * for one deck goes on to the next, with a lift at the bow end of every
 * corridor joining them.
 *
 * It is a starting point to move about, not a design: the rooms are the right
 * size and reachable, and the rest is the designer's.
 */

import type { Component, ComponentGroup, Manifest } from "./manifest";
import { SQUARES_PER_STATEROOM } from "./manifest";
import type { Deck, EdgeFixture, Fixture, FloorPlan, Owner } from "./plan";
import { CORRIDOR, PLAN_VERSION, area, cellKey, instanceOwner } from "./plan";

/** Bow to stern. */
const FORE_TO_AFT: readonly ComponentGroup[] = [
  "command",
  "weapons",
  "accommodation",
  "systems",
  "craft",
  "cargo",
  "fuel",
  "engineering",
];

/** A stateroom is two squares along the corridor and three deep. */
const STATEROOM_DEPTH = 3;

interface Room {
  readonly owner: Owner;
  readonly squares: number;
  /** Squares back from the corridor. */
  readonly depth: number;
  /** Squares along the corridor. */
  readonly width: number;
  readonly door: boolean;
}

/**
 * How deep a room goes from the corridor: about half as deep as it is long,
 * so a room reads as a room rather than a strip.
 */
function depthFor(squares: number): number {
  if (squares <= 3) return squares;
  return Math.max(2, Math.round(Math.sqrt(squares / 2)));
}

function roomsOf(component: Component): Room[] {
  const door = component.group !== "fuel";
  if (component.key === "staterooms") {
    return Array.from({ length: component.count }, (_, i) => ({
      owner: instanceOwner(component.key, i + 1),
      squares: SQUARES_PER_STATEROOM,
      depth: STATEROOM_DEPTH,
      width: Math.ceil(SQUARES_PER_STATEROOM / STATEROOM_DEPTH),
      door,
    }));
  }
  const depth = depthFor(component.target);
  return [{ owner: component.key, squares: component.target, depth, width: Math.ceil(component.target / depth), door }];
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

/**
 * Rooms put on decks and sides, with the decks about the same length: as few
 * decks as keep each within the longest a deck should run, then the shortest
 * run that still fits the rooms on that many.
 */
function arrange(rooms: readonly Room[]): { laid: Laid[]; lengths: number[] } {
  const oneDeck = arrangeWithin(rooms, Infinity);
  const decks = Math.ceil((oneDeck.lengths[0] ?? 0) / longestDeck(rooms));
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
export function suggestLayout(manifest: Manifest, remembered: FloorPlan["remembered"] = {}): FloorPlan {
  const rooms = roomsFor(manifest);
  const { laid, lengths } = arrange(rooms);
  // Every deck's corridor is on the same row, so decks line up over one another.
  const corridor = laid.reduce((most, l) => (l.side === "north" ? Math.max(most, l.room.depth) : most), 0);
  const cells: Record<string, Owner>[] = lengths.map(() => ({}));
  const fixtures: Fixture[] = [];
  const set = (deck: number, x: number, y: number, owner: Owner) => {
    for (const [cx, cy] of area(x, y, 1, 1)) cells[deck]![cellKey(cx, cy)] = owner;
  };

  for (const [deck, length] of lengths.entries()) {
    for (let x = 0; x < length; x++) set(deck, x, corridor, CORRIDOR);
    if (lengths.length > 1) fixtures.push({ kind: "lift", deck, x: 0, y: corridor, rotation: 0 });
  }
  for (const { room, deck, x, side } of laid) {
    for (const [sx, sy] of roomSquares(room, x, corridor, side)) set(deck, sx, sy, room.owner);
    if (!room.door) continue;
    // The middle of the room's run along the corridor, on the wall between them.
    const door: EdgeFixture = { kind: "door", deck, x: x + Math.floor((room.width - 1) / 2), y: side === "north" ? corridor : corridor + 1, edge: "n" };
    fixtures.push(door);
  }

  const decks: Deck[] = lengths.map((_, i) => ({ name: `Deck ${i + 1}`, cells: cells[i]! }));
  return { version: PLAN_VERSION, decks, fixtures, tiles: [], remembered };
}
