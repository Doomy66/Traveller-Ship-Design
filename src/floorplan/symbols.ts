/**
 * The symbol library: furniture, lifts, stairs and fitted rooms drawn from
 * Robert Pearce's Starship Symbols. FloorPlanSpec section 7.
 *
 * symbols.json is written by copying the chosen images in, and records each
 * one's footprint. The footprint comes from the size in feet in the original
 * filename, not from the image, because most images carry a square of empty
 * margin all round and some carry none (FP 7.4).
 */

import catalogue from "./symbols.json";

export type SymbolCategory = "access" | "rooms" | "furniture" | "consoles";

export interface ShipSymbol {
  readonly id: string;
  readonly name: string;
  readonly category: SymbolCategory;
  /** Relative to the site root. */
  readonly file: string;
  /** Feet, wide and high, as drawn at rotation 0. */
  readonly feet: readonly [number, number];
  /** Squares the symbol claims, wide and high, at rotation 0: its feet rounded up to whole squares. */
  readonly squares: readonly [number, number];
  /** The image's own size, at 60 pixels to the square. */
  readonly pixels: readonly [number, number];
}

/** The symbols are drawn at this scale, the same as the geomorph tiles. */
export const PIXELS_PER_SQUARE = 60;

export const SYMBOLS: readonly ShipSymbol[] = catalogue as unknown as ShipSymbol[];

const BY_ID = new Map(SYMBOLS.map((s) => [s.id, s]));

export function symbolById(id: string | undefined): ShipSymbol | undefined {
  return id === undefined ? undefined : BY_ID.get(id);
}

export const CATEGORY_LABELS: Readonly<Record<SymbolCategory, string>> = {
  access: "Access",
  rooms: "Fitted rooms",
  furniture: "Furniture",
  consoles: "Consoles",
};

/** The drawing used for each access fixture when no other is chosen. */
export const ACCESS_SYMBOLS = { lift: "lift", stairs: "stairs" } as const;

/** Squares a symbol claims at a rotation, wide and high. */
export function footprint(symbol: ShipSymbol, rotation: number): readonly [number, number] {
  const [w, h] = symbol.squares;
  return rotation === 90 || rotation === 270 ? [h, w] : [w, h];
}
