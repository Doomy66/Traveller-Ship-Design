/**
 * The plan model, its geometry, and `check`. FloorPlanSpec sections 4 to 9.
 */

import { describe, expect, it } from "vitest";
import { check, unreachableDecks } from "./check";
import { labelSquare, regions, storedEdge, walls } from "./geometry";
import type { Manifest } from "./manifest";
import type { FloorPlan } from "./plan";
import {
  addDeck,
  area,
  CORRIDOR,
  emptyPlan,
  instanceOwner,
  moveDeck,
  paint,
  placeFixture,
  readPlan,
  remember,
  removeDeck,
  shiftDeck,
} from "./plan";

/** A small ship to plan: 20 tons, so a 40-square plan, two staterooms. */
const SHIP: Manifest = {
  shipName: "Test",
  usableTons: 20,
  components: [
    { key: "jump", label: "Jump 1", group: "engineering", tons: 5, target: 10, count: 1, rooms: 1, required: true },
    { key: "fuel", label: "J-1, 4 weeks", group: "fuel", tons: 3, target: 6, count: 1, rooms: 1, required: false },
    { key: "staterooms", label: "Standard x2", group: "accommodation", tons: 8, target: 12, count: 2, rooms: 2, required: true },
  ],
};

/** Paint whole squares, from one corner square to another, both included. */
const block = (plan: FloorPlan, owner: string, x0: number, y0: number, x1: number, y1: number, deck = 0) =>
  paint(plan, deck, area(x0, y0, x1 - x0 + 1, y1 - y0 + 1), owner);

describe("painting", () => {
  it("gives squares to one owner each, and takes them back", () => {
    let plan = block(emptyPlan(), "jump", 0, 0, 4, 1);
    // Ten squares is forty half-square cells.
    expect(Object.keys(plan.decks[0]!.cells)).toHaveLength(40);
    plan = block(plan, CORRIDOR, 4, 0, 4, 1);
    expect(plan.decks[0]!.cells["4,0"]).toBe(CORRIDOR);
    plan = paint(plan, 0, [[0, 0]], undefined);
    expect(plan.decks[0]!.cells["0,0"]).toBeUndefined();
  });

  it("never changes the plan it was given", () => {
    const before = emptyPlan();
    block(before, "jump", 0, 0, 2, 2);
    expect(before.decks[0]!.cells).toEqual({});
  });
});

describe("decks", () => {
  it("shift by whole squares with their fixtures", () => {
    let plan = block(emptyPlan(), "jump", 0, 0, 1, 0);
    plan = placeFixture(plan, { kind: "lift", deck: 0, x: 1, y: 0, rotation: 0 });
    plan = shiftDeck(plan, 0, 3, -2);
    expect(Object.keys(plan.decks[0]!.cells).sort()).toEqual(area(3, -2, 2, 1).map(([x, y]) => `${x},${y}`).sort());
    expect(plan.fixtures[0]).toMatchObject({ x: 4, y: -2 });
  });

  it("take their fixtures with them when removed, and renumber the rest", () => {
    let plan = addDeck(addDeck(emptyPlan()));
    plan = placeFixture(plan, { kind: "lift", deck: 1, x: 0, y: 0, rotation: 0 });
    plan = placeFixture(plan, { kind: "lift", deck: 2, x: 0, y: 0, rotation: 0 });
    plan = removeDeck(plan, 1);
    expect(plan.decks.map((d) => d.name)).toEqual(["Deck 1", "Deck 3"]);
    expect(plan.fixtures.map((f) => f.deck)).toEqual([1]);
  });

  it("keep the last deck", () => {
    expect(removeDeck(emptyPlan(), 0).decks).toHaveLength(1);
  });

  it("swap with a neighbour, fixtures following", () => {
    let plan = addDeck(emptyPlan());
    plan = placeFixture(plan, { kind: "hatch", deck: 0, x: 0, y: 0, rotation: 0 });
    plan = moveDeck(plan, 0, 1);
    expect(plan.decks.map((d) => d.name)).toEqual(["Deck 2", "Deck 1"]);
    expect(plan.fixtures[0]!.deck).toBe(1);
  });
});

describe("geometry", () => {
  it("finds rooms that touch edge to edge, not corner to corner", () => {
    let plan = block(emptyPlan(), "jump", 0, 0, 1, 1);
    plan = paint(plan, 0, [[2.5, 2.5]], "jump");
    const rooms = regions(plan.decks[0]!);
    // One cell on its own, and a block of two squares by two, which is sixteen cells.
    expect(rooms.map((r) => r.squares.length).sort((a, b) => a - b)).toEqual([1, 16]);
  });

  it("walls a room all round, and draws a shared wall once", () => {
    let plan = block(emptyPlan(), "jump", 0, 0, 1, 0);
    // Two squares by one: four cells along, two across, so twelve half-square sides.
    expect(walls(plan.decks[0]!)).toHaveLength(12);
    plan = block(plan, CORRIDOR, 2, 0, 2, 0);
    // Eight outer sides and one between the drive and the corridor.
    // Sixteen outer sides and the two between the drive and the corridor.
    expect(walls(plan.decks[0]!)).toHaveLength(18);
  });

  it("stores every side as the north or west side of a square", () => {
    expect(storedEdge({ x: 3, y: 4, side: "s" })).toEqual({ x: 3, y: 4.5, edge: "n" });
    expect(storedEdge({ x: 3, y: 4, side: "e" })).toEqual({ x: 3.5, y: 4, edge: "w" });
  });

  it("labels an L-shaped room inside the room", () => {
    let plan = block(emptyPlan(), "jump", 0, 0, 0, 4);
    plan = block(plan, "jump", 0, 4, 4, 4);
    const [x, y] = labelSquare(regions(plan.decks[0]!)[0]!);
    expect(plan.decks[0]!.cells[`${x},${y}`]).toBe("jump");
  });
});

describe("check", () => {
  it("counts each component against its target", () => {
    const plan = block(emptyPlan(), "jump", 0, 0, 4, 0);
    const jump = check(SHIP, plan).tallies.find((t) => t.key === "jump")!;
    expect(jump).toMatchObject({ placed: 5, target: 10, status: "short" });
  });

  it("warns of a component short or over, and is quiet when it is met", () => {
    const short = check(SHIP, block(emptyPlan(), "jump", 0, 0, 4, 0));
    expect(short.problems.map((p) => p.message)).toContain("Jump 1 has 5 squares of 10.");
    const over = check(SHIP, block(emptyPlan(), "jump", 0, 0, 5, 1));
    expect(over.problems.map((p) => p.message)).toContain("Jump 1 has 12 squares, 2 more than its 10.");
    const met = check(SHIP, block(emptyPlan(), "jump", 0, 0, 4, 1));
    expect(met.tallies.find((t) => t.key === "jump")!.status).toBe("met");
    expect(met.problems.some((p) => p.message.startsWith("Jump 1"))).toBe(false);
  });

  it("counts a half-square cell as a quarter of a square", () => {
    const plan = paint(block(emptyPlan(), "jump", 0, 0, 1, 0), 0, [[2, 0], [2, 0.5]], "jump");
    expect(check(SHIP, plan).tallies.find((t) => t.key === "jump")!.placed).toBe(2.5);
  });

  it("lists every component not yet started in one warning", () => {
    const report = check(SHIP, emptyPlan());
    expect(report.problems.map((p) => p.message)).toEqual(["Not placed yet: Jump 1, Standard x2."]);
    expect(report.tallies.find((t) => t.key === "jump")!.status).toBe("short");
  });

  it("does not call unplaced fuel short, but counts fuel that is placed", () => {
    const none = check(SHIP, emptyPlan());
    expect(none.tallies.find((t) => t.key === "fuel")!.status).toBe("unplaced");
    expect(none.problems.some((p) => p.message.startsWith("J-1"))).toBe(false);
    const some = check(SHIP, block(emptyPlan(), "fuel", 0, 0, 1, 0));
    expect(some.tallies.find((t) => t.key === "fuel")!.status).toBe("short");
  });

  it("wants staterooms drawn as separate rooms", () => {
    // Twelve squares of stateroom in one block is one room, not two.
    const lumped = check(SHIP, block(emptyPlan(), "staterooms", 0, 0, 5, 1));
    expect(lumped.problems.map((p) => p.message)).toContain("2 staterooms are drawn as 1 room.");
    // The same squares as two numbered staterooms are two rooms, even side by side.
    let plan = block(emptyPlan(), instanceOwner("staterooms", 1), 0, 0, 2, 1);
    plan = block(plan, instanceOwner("staterooms", 2), 3, 0, 5, 1);
    const report = check(SHIP, plan);
    const staterooms = report.tallies.find((t) => t.key === "staterooms")!;
    expect(staterooms).toMatchObject({ placed: 12, status: "met", rooms: { wanted: 2, drawn: 2 } });
    expect(staterooms.instances).toEqual({ 1: 6, 2: 6 });
  });

  it("holds the whole ship to two squares a ton, ten per cent either way", () => {
    // Every component in place: ten of drive, two staterooms of six.
    const placed = () => {
      let plan = block(emptyPlan(), "jump", 0, 0, 4, 1);
      plan = block(plan, instanceOwner("staterooms", 1), 0, 2, 2, 3);
      return block(plan, instanceOwner("staterooms", 2), 3, 2, 5, 3);
    };
    const report = check(SHIP, block(placed(), CORRIDOR, 0, 4, 7, 4));
    expect(report.ship).toEqual({ target: 40, low: 36, high: 44 });
    expect(report.total).toBe(30);
    expect(report.corridor).toBe(8);
    expect(report.problems.map((p) => p.message)).toContain(
      "The plan covers 30 squares, outside the 36 to 44 a 20-ton ship allows.",
    );
    const fits = check(SHIP, block(placed(), CORRIDOR, 0, 4, 7, 5));
    expect(fits.problems.some((p) => p.clause === "5.3")).toBe(false);
  });

  it("says nothing of the ship's total while components are still to be placed", () => {
    const report = check(SHIP, block(emptyPlan(), CORRIDOR, 0, 0, 9, 2));
    expect(report.problems.some((p) => p.clause === "5.3")).toBe(false);
  });

  it("waits for all the stateroom squares before saying there are too few rooms", () => {
    const half = check(SHIP, block(emptyPlan(), instanceOwner("staterooms", 1), 0, 0, 2, 1));
    expect(half.problems.some((p) => p.clause === "5.4")).toBe(false);
  });

  it("says when squares belong to something the design no longer has", () => {
    let plan = block(emptyPlan(), "weapon:0", 0, 0, 1, 0);
    plan = remember(plan, [{ key: "weapon:0", label: "Triple Turret", tons: 1 }]);
    const report = check(SHIP, plan);
    expect(report.orphans).toEqual([{ key: "weapon:0", label: "Triple Turret", squares: 2 }]);
    expect(report.problems.map((p) => p.message)).toContain("2 squares belong to Triple Turret, which the design no longer has.");
  });

  it("notes a component whose tonnage changed since the plan was drawn", () => {
    const plan = remember(emptyPlan(), [{ key: "jump", label: "Jump 1", tons: 4 }]);
    expect(check(SHIP, plan).problems.map((p) => p.message)).toContain(
      "Jump 1 was 4 tons when the plan was drawn and is 5 now.",
    );
  });
});

describe("access between decks", () => {
  const twoDecks = () => block(block(addDeck(emptyPlan()), "jump", 0, 0, 1, 1), "fuel", 0, 0, 1, 1, 1);

  it("cuts off a deck with no lift, hatch or stairs to the others", () => {
    expect(unreachableDecks(twoDecks())).toEqual([1]);
    expect(check(SHIP, twoDecks()).problems.map((p) => p.message)).toContain(
      "Deck 2 has no lift, hatch or stairs to the rest of the ship.",
    );
  });

  it("joins decks through access on the same square of both", () => {
    let plan = placeFixture(twoDecks(), { kind: "lift", deck: 0, x: 1, y: 1, rotation: 0 });
    expect(unreachableDecks(plan)).toEqual([1]);
    plan = placeFixture(plan, { kind: "hatch", deck: 1, x: 1, y: 1, rotation: 0 });
    expect(unreachableDecks(plan)).toEqual([]);
  });

  it("does not join decks through a shaft that does not line up", () => {
    let plan = placeFixture(twoDecks(), { kind: "lift", deck: 0, x: 0, y: 0, rotation: 0 });
    plan = placeFixture(plan, { kind: "lift", deck: 1, x: 1, y: 1, rotation: 0 });
    expect(unreachableDecks(plan)).toEqual([1]);
  });

  it("does not count an empty deck as cut off", () => {
    expect(unreachableDecks(addDeck(block(emptyPlan(), "jump", 0, 0, 1, 1)))).toEqual([]);
  });
});

describe("reading a saved plan", () => {
  it("brings a plan back as it went out", () => {
    let plan = block(addDeck(emptyPlan()), instanceOwner("staterooms", 1), 0, 0, 2, 1, 1);
    plan = placeFixture(plan, { kind: "door", deck: 1, x: 1, y: 0, edge: "n" });
    plan = placeFixture(plan, { kind: "symbol", deck: 1, x: 0, y: 0, rotation: 90, symbol: "bed-1" });
    plan = remember(plan, SHIP.components);
    expect(readPlan(JSON.parse(JSON.stringify(plan)))).toEqual(plan);
  });

  it("refuses what is not a plan, and drops what it cannot read", () => {
    expect(readPlan(undefined)).toBeUndefined();
    expect(readPlan({ decks: "no" })).toBeUndefined();
    expect(readPlan({ decks: [] })).toBeUndefined();
    const damaged = readPlan({
      decks: [{ name: "Main", cells: { "0,0": "jump", "bad": "jump", "1,0": 7 } }],
      fixtures: [{ kind: "door", deck: 0, x: 0, y: 0, edge: "n" }, { kind: "door", deck: 5, x: 0, y: 0, edge: "n" }, { kind: "piano" }],
    });
    // A plan with no version is an old one, whose cells were whole squares: each becomes four.
    expect(damaged?.decks[0]!.cells).toEqual({ "0,0": "jump", "0.5,0": "jump", "0,0.5": "jump", "0.5,0.5": "jump" });
    expect(damaged?.fixtures).toHaveLength(1);
  });
});
