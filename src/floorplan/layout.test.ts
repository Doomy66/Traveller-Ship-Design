/**
 * The suggested first layout. FloorPlanSpec 7.9.
 */

import { describe, expect, it } from "vitest";
import { CATALOGUE } from "../catalogue/index";
import type { Design } from "../engine/design";
import { DESTROYER_ESCORT } from "../fixtures/destroyerEscort";
import { FREE_TRADER } from "../fixtures/freeTrader";
import { PATROL_CORVETTE } from "../fixtures/patrolCorvette";
import { SCOUT_COURIER } from "../fixtures/scoutCourier";
import { check } from "./check";
import { regions } from "./geometry";
import { suggestLayout } from "./layout";
import { manifest } from "./manifest";
import { CORRIDOR, parseCell } from "./plan";

const EVERY_SHIP: readonly Design[] = [
  SCOUT_COURIER,
  FREE_TRADER,
  PATROL_CORVETTE,
  DESTROYER_ESCORT,
  ...CATALOGUE.map((entry) => entry.design),
];

describe("the suggested layout", () => {
  it.each(EVERY_SHIP.map((d) => [d.name, d] as const))("places every component of the %s at its target, on joined decks", (_, design) => {
    const m = manifest(design);
    const plan = suggestLayout(m);
    const report = check(m, plan);
    for (const tally of report.tallies) expect([tally.key, tally.placed]).toEqual([tally.key, tally.target]);
    expect(report.cutOff).toEqual([]);
    expect(report.problems.filter((p) => p.severity === "warning" && p.clause !== "5.3")).toEqual([]);
  });

  it("gives each stateroom its own room of six squares with a door to the corridor", () => {
    const m = manifest(SCOUT_COURIER);
    const plan = suggestLayout(m);
    const tally = check(m, plan).tallies.find((t) => t.key === "staterooms");
    expect(tally?.rooms).toEqual({ wanted: 4, drawn: 4 });
    expect(plan.fixtures.filter((f) => f.kind === "door")).toHaveLength(m.components.filter((c) => c.group !== "fuel").length + 3);
  });

  it("keeps every room in one piece", () => {
    const plan = suggestLayout(manifest(FREE_TRADER));
    const owners = regions(plan.decks[0]!).map((r) => r.owner).filter((o) => o !== CORRIDOR);
    expect(new Set(owners).size).toBe(owners.length);
  });

  it("starts at the bow with the bridge and ends aft with the drives", () => {
    const plan = suggestLayout(manifest(SCOUT_COURIER));
    const xs = (owner: string) => Object.entries(plan.decks[0]!.cells).filter(([, o]) => o === owner).map(([k]) => parseCell(k)[0]);
    expect(Math.min(...xs("bridge"))).toBeLessThan(Math.min(...xs("jump")));
  });

  it("puts a long ship on several decks, joined by a lift", () => {
    const big = CATALOGUE.map((e) => e.design).reduce((a, b) => (b.hull.tons > a.hull.tons ? b : a));
    const plan = suggestLayout(manifest(big));
    expect(plan.decks.length).toBeGreaterThan(1);
    expect(plan.fixtures.filter((f) => f.kind === "lift")).toHaveLength(plan.decks.length);
  });
});
