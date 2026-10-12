/**
 * Shapes on a deck: rooms, the walls round them, where a label goes. Pure
 * functions of a deck's squares, shared by `check` and the drawing.
 */

import type { Deck, Edge, Owner } from "./plan";
import { CELL, cellKey, parseCell, toHalf } from "./plan";

export interface Region {
  readonly owner: Owner;
  readonly squares: readonly (readonly [number, number])[];
}

const STEPS: readonly (readonly [number, number])[] = [
  [CELL, 0],
  [-CELL, 0],
  [0, CELL],
  [0, -CELL],
];

/**
 * The deck's rooms: squares of one owner that touch edge to edge. A corner
 * touching is not enough, since nobody walks through a corner. FP 2.4.
 */
export function regions(deck: Deck): Region[] {
  const seen = new Set<string>();
  const out: Region[] = [];
  for (const [start, owner] of Object.entries(deck.cells)) {
    if (seen.has(start)) continue;
    seen.add(start);
    const squares: [number, number][] = [];
    const queue = [parseCell(start)];
    while (queue.length > 0) {
      const square = queue.pop()!;
      squares.push(square);
      for (const [dx, dy] of STEPS) {
        const nx = toHalf(square[0] + dx);
        const ny = toHalf(square[1] + dy);
        const next = cellKey(nx, ny);
        if (!seen.has(next) && deck.cells[next] === owner) {
          seen.add(next);
          queue.push([nx, ny]);
        }
      }
    }
    out.push({ owner, squares });
  }
  return out;
}

/** One side of one square, as the square and which side. */
export interface Side {
  readonly x: number;
  readonly y: number;
  readonly side: "n" | "s" | "e" | "w";
}

/**
 * Every side where a square meets a square of another owner, or nothing. Each
 * such boundary is listed once, from the occupied square's point of view, or
 * from the north or west square where both are occupied. FP 8.2.
 */
export function walls(deck: Deck): Side[] {
  const out: Side[] = [];
  for (const [key, owner] of Object.entries(deck.cells)) {
    const [x, y] = parseCell(key);
    const north = deck.cells[cellKey(x, toHalf(y - CELL))];
    const south = deck.cells[cellKey(x, toHalf(y + CELL))];
    const west = deck.cells[cellKey(toHalf(x - CELL), y)];
    const east = deck.cells[cellKey(toHalf(x + CELL), y)];
    // A side shared with another occupied square is drawn once, by the square to the north or west of it.
    if (north === undefined) out.push({ x, y, side: "n" });
    if (west === undefined) out.push({ x, y, side: "w" });
    if (south === undefined || south !== owner) out.push({ x, y, side: "s" });
    if (east === undefined || east !== owner) out.push({ x, y, side: "e" });
  }
  return out;
}

/** A side in the stored form edge fixtures use: the north or west side of some square. FP 7.1. */
export function storedEdge(side: Side): { x: number; y: number; edge: Edge } {
  switch (side.side) {
    case "n":
      return { x: side.x, y: side.y, edge: "n" };
    case "w":
      return { x: side.x, y: side.y, edge: "w" };
    case "s":
      return { x: side.x, y: toHalf(side.y + CELL), edge: "n" };
    case "e":
      return { x: toHalf(side.x + CELL), y: side.y, edge: "w" };
  }
}

/**
 * Where a region's label goes: the square of the region nearest its middle,
 * so an L-shaped room is not labelled in the gap between its arms.
 */
export function labelSquare(region: Region): readonly [number, number] {
  let sx = 0;
  let sy = 0;
  for (const [x, y] of region.squares) {
    sx += x;
    sy += y;
  }
  const cx = sx / region.squares.length;
  const cy = sy / region.squares.length;
  let best = region.squares[0]!;
  let bestDistance = Infinity;
  for (const square of region.squares) {
    const d = (square[0] - cx) ** 2 + (square[1] - cy) ** 2;
    if (d < bestDistance) {
      best = square;
      bestDistance = d;
    }
  }
  return best;
}

/**
 * Where a room's label is centred: the middle of the room, on the half
 * square, so a label sits squarely in its room rather than in one cell of
 * it. Where the middle falls outside the room, as in an L, the middle of the
 * cell nearest it instead. FP 8.3.
 */
export function labelPoint(region: Region): readonly [number, number] {
  let sx = 0;
  let sy = 0;
  for (const [x, y] of region.squares) {
    sx += x + CELL / 2;
    sy += y + CELL / 2;
  }
  const px = toHalf(sx / region.squares.length);
  const py = toHalf(sy / region.squares.length);
  const inside = new Set(region.squares.map(([x, y]) => cellKey(x, y)));
  // The point is a corner of four cells; it is in the room if any of them is.
  const corners = [
    [px - CELL, py - CELL],
    [px, py - CELL],
    [px - CELL, py],
    [px, py],
  ];
  if (corners.some(([x, y]) => inside.has(cellKey(toHalf(x!), toHalf(y!))))) return [px, py];
  const [x, y] = labelSquare(region);
  return [x + CELL / 2, y + CELL / 2];
}

export interface Bounds {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
}

/** The corners of the cells any of these decks use, or undefined if they are all empty. The far edge is a cell further on. */
export function bounds(decks: readonly Deck[]): Bounds | undefined {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const deck of decks) {
    for (const key of Object.keys(deck.cells)) {
      const [x, y] = parseCell(key);
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }
  return minX === Infinity ? undefined : { minX, minY, maxX, maxY };
}
