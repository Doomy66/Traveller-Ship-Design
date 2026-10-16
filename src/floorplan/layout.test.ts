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
import { suggestedDecks, suggestLayout } from "./layout";
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

describe("craft in their docking spaces", () => {
  it("draws the Scout's air/raft at the back of a two by five bay", () => {
    const m = manifest(SCOUT_COURIER);
    const berth = m.components.find((c) => c.carries?.startsWith("Air/Raft"))!;
    expect(berth.target).toBe(10);
    const plan = suggestLayout(m);
    const raft = plan.fixtures.find((f): f is SquareFixture => f.kind === "symbol" && f.symbol === "air-raft")!;
    expect(raft).toBeDefined();
    // All eight of its squares are the bay's, and the bay has two more for the door.
    const cells = plan.decks[raft.deck]!.cells;
    for (let y = raft.y; y < raft.y + 4; y += 0.5) for (let x = raft.x; x < raft.x + 2; x += 0.5) expect(cells[`${x},${y}`]).toBe(berth.key);
    const bay = Object.values(cells).filter((o) => o === berth.key);
    expect(bay).toHaveLength(10 * 4);
  });
});

describe("room shapes and rooms of their own", () => {
  const regionsOf = (design: Design) => {
    const m = manifest(design);
    const plan = suggestLayout(m);
    return { m, plan, regions: plan.decks.flatMap((d) => regions(d)).filter((r) => r.owner !== CORRIDOR) };
  };

  it.each(EVERY_SHIP.map((d) => [d.name, d] as const))("draws every room of the %s as a rectangle no longer than six to one where its size allows", (_, design) => {
    const { regions: rooms } = regionsOf(design);
    for (const room of rooms) {
      const squares = room.squares.length / 4;
      const xs = room.squares.map(([x]) => x);
      const ys = room.squares.map(([, y]) => y);
      const w = Math.max(...xs) + 0.5 - Math.min(...xs);
      const h = Math.max(...ys) + 0.5 - Math.min(...ys);
      // A size with a rectangle within 6:1 is drawn as one.
      const can = Array.from({ length: squares }, (_, i) => i + 1).some((d) => squares % d === 0 && Math.max(d, squares / d) / Math.min(d, squares / d) <= 6);
      if (can) {
        expect(w * h).toBe(squares);
        expect(Math.max(w, h) / Math.min(w, h)).toBeLessThanOrEqual(6);
      }
    }
  });

  it("gives each turret and each of several fitted rooms a room of its own, with its own number", () => {
    const corvette = PATROL_CORVETTE;
    const { m, plan } = regionsOf(corvette);
    const turrets = m.components.find((c) => c.label.startsWith("Triple Turret") && c.count > 1) ?? m.components.find((c) => c.key.startsWith("weapon:") && c.rooms > 1);
    if (turrets !== undefined) {
      const owners = new Set(Object.values(plan.decks.flatMap((d) => Object.values(d.cells))).filter((o) => o.startsWith(`${turrets.key}#`)));
      expect(owners.size).toBe(turrets.rooms);
    }
    const ships = CATALOGUE.map((e) => e.design);
    const bays = ships.find((d) => manifest(d).components.some((c) => c.label.startsWith("Medical Bay x")))!;
    const mb = manifest(bays).components.find((c) => c.label.startsWith("Medical Bay x"))!;
    const laid = suggestLayout(manifest(bays));
    const report = check(manifest(bays), laid);
    expect(report.tallies.find((t) => t.key === mb.key)?.rooms).toEqual({ wanted: mb.rooms, drawn: mb.rooms });
    expect(laid.fixtures.filter((f) => f.kind === "symbol" && f.symbol === "medical-bay")).toHaveLength(mb.rooms);
  });
});

describe("the number of decks", () => {
  it("offers the number it would choose by itself, and uses it when not told otherwise", () => {
    for (const design of [SCOUT_COURIER, FREE_TRADER, PATROL_CORVETTE, DESTROYER_ESCORT]) {
      const m = manifest(design);
      expect(suggestLayout(m).decks).toHaveLength(suggestedDecks(m));
    }
  });

  it("lays the ship over as many decks as asked, joined by lifts", () => {
    const m = manifest(FREE_TRADER);
    for (const wanted of [1, 2, 3]) {
      const plan = suggestLayout(m, {}, wanted);
      expect(plan.decks).toHaveLength(wanted);
      const report = check(m, plan);
      expect(report.cutOff).toEqual([]);
      for (const tally of report.tallies) expect(tally.placed).toBe(tally.key === "fuel" ? 0 : tally.target);
      if (wanted > 1) expect(plan.decks.every((d) => Object.keys(d.cells).length > 0)).toBe(true);
    }
  });

  it("leaves a deck empty, ready to draw on, when asked for more than the rooms can fill", () => {
    const plan = suggestLayout(manifest(SCOUT_COURIER), {}, 40);
    expect(plan.decks).toHaveLength(40);
    expect(plan.decks.filter((d) => Object.keys(d.cells).length === 0).length).toBeGreaterThan(0);
  });
});
