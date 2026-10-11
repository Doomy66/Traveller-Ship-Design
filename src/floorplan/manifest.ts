/**
 * The manifest: what a floor plan has to place. FloorPlanSpec section 3.
 *
 * This is the only file under src/floorplan that knows the ship designer
 * exists (FP 1.2). Everything else in the floor plan works from the
 * manifest, so lifting the floor plan out into an application of its own
 * means replacing this one file with something that reads the same thing
 * from a saved ship.
 */

import type { Design } from "../engine/design";
import { sheet } from "../engine/sheet";
import type { SheetLine } from "../engine/sheet";

/** What a component is for, which is what colours its floor. FP 8.1. */
export type ComponentGroup =
  | "engineering"
  | "fuel"
  | "command"
  | "weapons"
  | "craft"
  | "accommodation"
  | "systems"
  | "cargo";

export interface Component {
  /** The sheet line's key, which survives a change of figures. FP 3.3. */
  readonly key: string;
  readonly label: string;
  readonly group: ComponentGroup;
  readonly tons: number;
  /** Squares it should cover. FP 3.7 and 3.8. */
  readonly target: number;
  /** How many identical things the line stands for. FP 3.6. */
  readonly count: number;
  /** How many separate rooms it should be drawn as. FP 5.4. */
  readonly rooms: number;
  /** False only for fuel, which the book lets a plan leave off. FP 3.5. */
  readonly required: boolean;
}

export interface Manifest {
  readonly shipName: string;
  /** The tons a plan has to fit, which is all of the hull but the unusable part of a planetoid. FP 5.3. */
  readonly usableTons: number;
  readonly components: readonly Component[];
}

/** Two squares to the ton. FP 2.1. */
export const SQUARES_PER_TON = 2;

/** A stateroom is four tons and six squares; the rest goes to corridors. FP 3.7. */
export const SQUARES_PER_STATEROOM = 6;

/** Sheet sections that never go on a plan: the hull and what is spread over it, and software. FP 3.4. */
const LEFT_OFF: ReadonlySet<string> = new Set(["Hull", "Hull Options", "Armour", "Software"]);

const GROUPS: Readonly<Record<string, ComponentGroup>> = {
  "M-Drive": "engineering",
  "R-Drive": "engineering",
  "J-Drive": "engineering",
  "Power Plant": "engineering",
  "Fuel Tanks": "fuel",
  Bridge: "command",
  Computer: "command",
  Sensors: "command",
  Weapons: "weapons",
  Ammunition: "weapons",
  Craft: "craft",
  Staterooms: "accommodation",
  "Common Areas": "accommodation",
  Systems: "systems",
  Cargo: "cargo",
};

/**
 * Squares for a component. Rounded up, because a half square is still a
 * square of floor; the small epsilon keeps 2.0000000001 from becoming 3.
 */
function squaresFor(tons: number): number {
  return Math.ceil(tons * SQUARES_PER_TON - 1e-9);
}

function componentFrom(line: SheetLine): Component | undefined {
  if (LEFT_OFF.has(line.section)) return undefined;
  const tons = line.tons ?? 0;
  if (tons <= 0) return undefined;
  const count = line.count ?? 1;
  const staterooms = line.key === "staterooms";
  return {
    key: line.key,
    label: line.label,
    group: GROUPS[line.section] ?? "systems",
    tons,
    target: staterooms ? count * SQUARES_PER_STATEROOM : squaresFor(tons),
    count,
    rooms: staterooms ? count : 1,
    required: line.key !== "fuel",
  };
}

/** The design's components that take up room, in the sheet's order. */
export function manifest(design: Design): Manifest {
  const result = sheet(design);
  return {
    shipName: design.name,
    usableTons: result.usableTons,
    components: result.lines.map(componentFrom).filter((c): c is Component => c !== undefined),
  };
}
