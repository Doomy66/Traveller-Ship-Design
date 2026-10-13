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
import type { SquareFixture } from "./plan";
import { CORRIDOR, parseCell } from "./plan";
import { footprint, symbolById } from "./symbols";

const EVERY_SHIP: readonly Design[] = [
  SCOUT_COURIER,
  FREE_TRADER,
  PATROL_CORVETTE,
  DESTROYER_ESCORT,
  ...CATALOGUE.map((entry) => entry.design),
];

describe("the suggested layout", () => {
  it.each(EVERY_SHIP.map((d) => [d.name, d] as const))("places every component of the %s at its target, bar fuel, on joined decks", (_, design) => {
    const m = manifest(design);
    const plan = suggestLayout(m);
    const report = check(m, plan);
    for (const tally of report.tallies) expect([tally.key, tally.placed]).toEqual([tally.key, tally.key === "fuel" ? 0 : tally.target]);
    expect(report.cutOff).toEqual([]);
    expect(report.problems.filter((p) => p.severity === "warning" && p.clause !== "5.3")).toEqual([]);
  });

  it("gives each stateroom its own room of six squares with a door to the corridor", () => {
    const m = manifest(SCOUT_COURIER);
    const plan = suggestLayout(m);
    const tally = check(m, plan).tallies.find((t) => t.key === "staterooms");
    expect(tally?.rooms).toEqual({ wanted: 4, drawn: 4 });
    expect(plan.fixtures.filter((f) => f.kind === "door")).toHaveLength(m.components.filter((c) => c.group !== "fuel" && c.target > 0).length + 3);
    expect(check(m, plan).tallies.find((t) => t.key === "fuel")?.status).toBe("unplaced");
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

describe("fitted rooms in the suggested layout", () => {
  const fittedOn = (design: Design) => {
    const plan = suggestLayout(manifest(design));
    return { plan, pieces: plan.fixtures.filter((f): f is SquareFixture => f.kind === "symbol") };
  };

  it("lays a fitted stateroom over every stateroom, with its door on the corridor", () => {
    const { plan, pieces } = fittedOn(FREE_TRADER);
    const staterooms = pieces.filter((p) => p.symbol === "stateroom-1");
    expect(staterooms).toHaveLength(manifest(FREE_TRADER).components.find((c) => c.key === "staterooms")!.count);
    for (const room of staterooms) {
      const [w, h] = footprint(symbolById("stateroom-1")!, room.rotation);
      expect([w, h]).toEqual([2, 3]);
      // The door is on the room's corridor side, within the room's width.
      const door = plan.fixtures.find((f) => f.kind === "door" && f.deck === room.deck && f.x >= room.x && f.x < room.x + w && (f.y === room.y || f.y === room.y + h));
      expect(door).toBeDefined();
    }
  });

  it.each(EVERY_SHIP.map((d) => [d.name, d] as const))("covers exactly its own room with each fitted room on the %s", (_, design) => {
    const { plan, pieces } = fittedOn(design);
    for (const piece of pieces) {
      const symbol = symbolById(piece.symbol)!;
      const [w, h] = footprint(symbol, piece.rotation);
      const owners = new Set<string>();
      for (let y = piece.y; y < piece.y + h; y += 0.5) {
        for (let x = piece.x; x < piece.x + w; x += 0.5) owners.add(plan.decks[piece.deck]!.cells[`${x},${y}`] ?? "empty");
      }
      expect([...owners]).toHaveLength(1);
      expect(owners.has("empty")).toBe(false);
    }
  });

  it("uses the workshop, medical bay and lounges where the ship has them at the library's size", () => {
    const symbols = new Set(EVERY_SHIP.flatMap((d) => fittedOn(d).pieces.map((p) => p.symbol)));
    for (const used of ["workshop", "medical-bay", "briefing-room", "brig", "laboratory", "lounge-small", "low-berth"]) expect(symbols).toContain(used);
  });

  it("puts a low berth on every square of the low berths", () => {
    const ship = EVERY_SHIP.find((d) => manifest(d).components.some((c) => c.key === "lowBerths"))!;
    const berths = manifest(ship).components.find((c) => c.key === "lowBerths")!;
    expect(fittedOn(ship).pieces.filter((p) => p.symbol === "low-berth")).toHaveLength(berths.target);
  });
});
