/**
 * The ship catalogue: designs to open and pull apart, beyond the four fixtures.
 *
 * These are Mainline's ship classes, which were built in this designer, and are
 * kept here as the same `.ship` files the application saves, so a design moves
 * between the two projects by copying a file. SOURCES.md says where each one
 * came from and what was changed to make it a legal High Guard 2022 design.
 *
 * Unlike the fixtures, nothing here reproduces a printed sheet, so nothing here
 * is tested against one. The test is only that every design is legal.
 */

import type { Design } from "../engine/design";
import { parse } from "../io/save";

export type CatalogueGroup = "highGuard" | "rebuilt" | "original";

export interface CatalogueEntry {
  readonly file: string;
  readonly group: CatalogueGroup;
  readonly design: Design;
}

export const GROUP_LABELS: Readonly<Record<CatalogueGroup, string>> = {
  highGuard: "High Guard 2022",
  rebuilt: "Rebuilt from other editions",
  original: "Original designs",
};

/** Printed in High Guard 2022, but not reproduced exactly, so not a fixture. */
const HIGH_GUARD = new Set(["Dragon-System-Defence-Boat.ship"]);

/** Designed from scratch in this designer rather than taken from a source. */
const ORIGINAL = new Set([
  "FOO3.ship",
  "Maul-class-Bombardment-Ship.ship",
  "Roam-Pod.ship",
  "Tern-class-Fighter-Carrier.ship",
  "Wasp-Heavy-Fighter.ship",
]);

const files = import.meta.glob<string>("./*.ship", { eager: true, query: "?raw", import: "default" });

/** Every design, grouped, smallest first within its group. */
export const CATALOGUE: readonly CatalogueEntry[] = Object.entries(files)
  .map(([path, text]) => {
    const file = path.slice(2);
    const design = parse(text);
    if (design === null) throw new Error(`${file} is not a ship design.`);
    const group: CatalogueGroup = HIGH_GUARD.has(file) ? "highGuard" : ORIGINAL.has(file) ? "original" : "rebuilt";
    return { file, group, design };
  })
  .sort((a, b) => a.design.hull.tons - b.design.hull.tons || a.design.name.localeCompare(b.design.name));
