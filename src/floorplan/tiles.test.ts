/**
 * Tiles in a plan, wide doors, moving things, and the tile catalogue.
 * FloorPlanSpec 7.1.1, 10.9 and section 12.
 */

import { describe, expect, it } from "vitest";
import type { PlacedTile } from "./plan";
import {
  addDeck,
  area,
  edgesOf,
  emptyPlan,
  moveSquares,
  openings,
  paint,
  placeFixture,
  placeTile,
  readPlan,
  removeDeck,
  shiftDeck,
  tiledSquares,
  tileFootprint,
} from "./plan";
import { fixturesMarkup, PAPER, SCREEN, tileMarkup, wallsMarkup } from "./render";
import { SYMBOLS } from "./symbols";
import { parseTileName, tileId } from "./tiles";

const CORE: PlacedTile = { deck: 0, x: 2, y: 3, rotation: 0, tile: "sc-001-30x100-37-dtons-bridge-staterooms", squares: [6, 20], pixels: [600, 1440], code: "SC-001" };

describe("tiles on a plan", () => {
  it("cover their footprint, turned with them", () => {
    expect(tileFootprint(CORE)).toEqual([6, 20]);
    expect(tileFootprint({ ...CORE, rotation: 90 })).toEqual([20, 6]);
    const covered = tiledSquares(placeTile(emptyPlan(), CORE), 0);
    // Six squares by twenty is a hundred and twenty squares, four cells each.
    expect(covered.size).toBe(480);
    expect(covered.has("2,3")).toBe(true);
    expect(covered.has("7,22")).toBe(true);
    expect(covered.has("8,3")).toBe(false);
  });

  it("do not count an overlay as covering anything", () => {
    const overlay = { ...CORE, tile: "sc-002-20x150-overlay-cargo" };
    expect(tiledSquares(placeTile(emptyPlan(), overlay), 0).size).toBe(0);
  });

  it("move with their deck, and go with it", () => {
    let plan = placeTile(addDeck(emptyPlan()), { ...CORE, deck: 1 });
    plan = shiftDeck(plan, 1, -2, 1);
    expect(plan.tiles[0]).toMatchObject({ x: 0, y: 4 });
    expect(removeDeck(plan, 1).tiles).toEqual([]);
  });

  it("come back from a saved plan, size and all", () => {
    const plan = placeTile(emptyPlan(), CORE);
    expect(readPlan(JSON.parse(JSON.stringify(plan)))?.tiles).toEqual([CORE]);
    expect(readPlan({ decks: [{ cells: {} }], tiles: [{ tile: "x", deck: 0, x: 0, y: 0 }] })?.tiles).toEqual([]);
  });
});

describe("doors", () => {
  it("can be wider than a square, as one fixture", () => {
    const plan = placeFixture(emptyPlan(), { kind: "door", deck: 0, x: 3, y: 2, edge: "n", length: 3 });
    expect(edgesOf(plan.fixtures[0] as never)).toEqual(["3,2,n", "3.5,2,n", "4,2,n", "4.5,2,n", "5,2,n", "5.5,2,n"]);
  });

  it("stay separate side by side, each one its own", () => {
    let plan = placeFixture(emptyPlan(), { kind: "door", deck: 0, x: 3, y: 2, edge: "n" });
    plan = placeFixture(plan, { kind: "door", deck: 0, x: 4, y: 2, edge: "n" });
    expect(plan.fixtures).toHaveLength(2);
  });

  it("replace whatever they overlap", () => {
    let plan = placeFixture(emptyPlan(), { kind: "iris", deck: 0, x: 4, y: 2, edge: "n" });
    plan = placeFixture(plan, { kind: "door", deck: 0, x: 3, y: 2, edge: "n", length: 2 });
    expect(plan.fixtures.map((f) => f.kind)).toEqual(["door"]);
  });

  it("keep their width through a save", () => {
    const plan = placeFixture(emptyPlan(), { kind: "door", deck: 0, x: 0, y: 0, edge: "w", length: 2 });
    expect(readPlan(JSON.parse(JSON.stringify(plan)))?.fixtures).toEqual(plan.fixtures);
  });
});

describe("openings", () => {
  it("leave out the wall between two rooms, as long as they are drawn", () => {
    // Two rooms side by side, three squares deep, with the wall between them at x = 2.
    let plan = paint(emptyPlan(), 0, area(0, 0, 2, 3), "jump");
    plan = paint(plan, 0, area(2, 0, 2, 3), "~corridor");
    const shared = (p: typeof plan) => (wallsMarkup(p.decks[0]!, PAPER, 0.1, "", new Set(), openings(p, 0)).match(/M2 [\d.]+v0\.5/g) ?? []).length;
    expect(shared(plan)).toBe(6);
    plan = placeFixture(plan, { kind: "open", deck: 0, x: 2, y: 0.5, edge: "w", length: 2 });
    expect(shared(plan)).toBe(2);
  });

  it("draw nothing on paper, and a faint line on screen to find them by", () => {
    const plan = placeFixture(emptyPlan(), { kind: "open", deck: 0, x: 2, y: 0, edge: "w", length: 2 });
    expect(fixturesMarkup(plan, 0, PAPER, (f) => f)).toBe("");
    expect(fixturesMarkup(plan, 0, SCREEN, (f) => f)).toContain("fp-open");
  });

  it("come back from a saved plan", () => {
    const plan = placeFixture(emptyPlan(), { kind: "open", deck: 0, x: 2, y: 0, edge: "w", length: 2 });
    expect(readPlan(JSON.parse(JSON.stringify(plan)))?.fixtures).toEqual(plan.fixtures);
  });
});

describe("placing pieces", () => {
  it("lets furniture stand on another piece rather than replace it", () => {
    let plan = placeFixture(emptyPlan(), { kind: "symbol", deck: 0, x: 0, y: 0, rotation: 0, symbol: "stateroom-1" });
    plan = placeFixture(plan, { kind: "symbol", deck: 0, x: 0, y: 0, rotation: 0, symbol: "chair" });
    expect(plan.fixtures).toHaveLength(2);
  });

  it("puts one lift, hatch or stairs on a square, the newest", () => {
    let plan = placeFixture(emptyPlan(), { kind: "lift", deck: 0, x: 1, y: 1, rotation: 0 });
    plan = placeFixture(plan, { kind: "hatch", deck: 0, x: 1, y: 1, rotation: 0 });
    expect(plan.fixtures.map((f) => f.kind)).toEqual(["hatch"]);
  });
});

describe("moving a room", () => {
  it("carries its squares and owner by whole squares, over whatever is there", () => {
    let plan = paint(emptyPlan(), 0, area(0, 0, 2, 2), "jump");
    plan = paint(plan, 0, area(3, 0, 1, 1), "~corridor");
    plan = moveSquares(plan, 0, area(0, 0, 2, 2), 2, 0);
    expect(plan.decks[0]!.cells).toEqual(Object.fromEntries(area(2, 0, 2, 2).map(([x, y]) => [`${x},${y}`, "jump"])));
  });

  it("moves by half squares as readily as whole ones", () => {
    let plan = paint(emptyPlan(), 0, area(0, 0, 1, 1), "jump");
    plan = moveSquares(plan, 0, area(0, 0, 1, 1), 0.5, 1.5);
    expect(Object.keys(plan.decks[0]!.cells).sort()).toEqual(["0.5,1.5", "0.5,2", "1,1.5", "1,2"]);
  });
});

describe("reading a geomorph's filename", () => {
  it("finds its code, side, size, tonnage and description", () => {
    const t = parseTileName("SE-240 [Fore] [50x100] [50-dTons] Bridge, Staterooms.png", "05 SE Small Ends - Fore")!;
    expect(t).toMatchObject({
      code: "SE-240",
      side: "Fore",
      feet: [50, 100],
      squares: [10, 20],
      tons: "50",
      overlay: false,
      name: "Bridge, Staterooms",
      category: "SE Small Ends - Fore",
    });
    expect(t.id).toBe(tileId("SE-240 [Fore] [50x100] [50-dTons] Bridge, Staterooms.png"));
  });

  it("knows an overlay, and a tonnage given as a sum", () => {
    expect(parseTileName("SC-002 [20x150] [Overlay] Cargo.png", "x")).toMatchObject({ overlay: true, tons: null, name: "Cargo" });
    expect(parseTileName("SS-090 [Port] [50x50] [10+14-dTons] Engineering, Aerofin.png", "x")?.tons).toBe("10+14");
  });

  it("is not fooled by files that are not tiles", () => {
    expect(parseTileName("AN-008 Spider.png", "Animals")).toBeUndefined();
    expect(parseTileName("Read Me v2.2.txt", "AdventureClass")).toBeUndefined();
  });
});

describe("flipping", () => {
  it("mirrors a piece about its middle before turning it", () => {
    const plain = fixturesMarkup(placeFixture(emptyPlan(), { kind: "symbol", deck: 0, x: 0, y: 0, rotation: 90, symbol: "bed" }), 0, PAPER, (f) => f);
    const flipped = fixturesMarkup(placeFixture(emptyPlan(), { kind: "symbol", deck: 0, x: 0, y: 0, rotation: 90, flip: true, symbol: "bed" }), 0, PAPER, (f) => f);
    expect(plain).toContain('transform="rotate(90 0.5 1)"');
    expect(flipped).toContain('transform="rotate(90 0.5 1) translate(0.5 1) scale(-1 1) translate(-0.5 -1)"');
    expect(tileMarkup({ ...CORE, flip: true }, PAPER, "x.png")).toContain("scale(-1 1)");
  });

  it("is kept through a save", () => {
    let plan = placeFixture(emptyPlan(), { kind: "symbol", deck: 0, x: 0, y: 0, rotation: 0, flip: true, symbol: "bed" });
    plan = placeTile(plan, { ...CORE, flip: true });
    const back = readPlan(JSON.parse(JSON.stringify(plan)));
    expect(back?.fixtures).toEqual(plan.fixtures);
    expect(back?.tiles).toEqual(plan.tiles);
  });
});

describe("the library", () => {
  it("has the turrets and barbettes, DV-001 to DV-009", () => {
    const fromDV = SYMBOLS.filter((s) => s.category === "turrets" && (s as { source?: string }).source?.includes("/DV-00"));
    expect(fromDV).toHaveLength(13);
  });

  it("has the pieces cut from the Symbols & Abbreviations sheet, each in its section", () => {
    const sheet = SYMBOLS.filter((s) => s.id.startsWith("sheet-"));
    expect(sheet.length).toBeGreaterThan(60);
    const sections = new Set(sheet.map((s) => s.category));
    for (const c of ["freshers", "medical", "cargo", "landscape", "engineering", "access", "common"]) expect(sections.has(c as never)).toBe(true);
    // Cut at the sheet's own sixty pixels to the square: the 10 by 20 foot cargo is about 2 by 4 squares.
    const cargo = SYMBOLS.find((s) => s.id === "sheet-cargo-10x20")!;
    expect(cargo.squares).toEqual([4, 2]);
  });

  it("has engineering sections under a hundred tons, larger staterooms and common areas", () => {
    const tons = (id: string) => {
      const s = SYMBOLS.find((x) => x.id === id)!;
      return (s.squares[0] * s.squares[1]) / 2;
    };
    const engineering = SYMBOLS.filter((s) => s.category === "engineering");
    expect(engineering.length).toBeGreaterThanOrEqual(6);
    expect(engineering.every((s) => tons(s.id) < 100)).toBe(true);
    expect(tons("engineering-63")).toBe(63);
    expect(SYMBOLS.some((s) => s.category === "rooms" && tons(s.id) >= 8)).toBe(true);
    expect(SYMBOLS.filter((s) => s.category === "common").length).toBeGreaterThanOrEqual(4);
  });

  it("names every piece once", () => {
    expect(new Set(SYMBOLS.map((s) => s.id)).size).toBe(SYMBOLS.length);
  });
});
