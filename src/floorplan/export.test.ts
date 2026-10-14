/**
 * Exported decks. FloorPlanSpec 10.6.
 */

import { describe, expect, it } from "vitest";
import { deckDocument, exportName, frame } from "./export";
import type { Manifest } from "./manifest";
import { addDeck, area, emptyPlan, paint, placeFixture, placeTile } from "./plan";
import { PAPER, symbolMarkup } from "./render";

const SOURCES = { symbol: (file: string) => file, tile: () => undefined };

const SHIP: Manifest = {
  shipName: "Beowulf/2",
  usableTons: 20,
  components: [{ key: "jump", label: "Jump 1", group: "engineering", tons: 5, target: 10, count: 1, rooms: 1, required: true }],
};

function twoDecks() {
  let plan = paint(addDeck(emptyPlan()), 0, area(0, 0, 5, 2), "jump");
  plan = paint(plan, 1, area(10, 5, 2, 2), "~corridor");
  return placeFixture(plan, { kind: "door", deck: 0, x: 1, y: 0, edge: "n" });
}

describe("exporting a deck", () => {
  it("draws a complete SVG document, titled with the ship and the deck", () => {
    const svg = deckDocument(SHIP, twoDecks(), 0, SOURCES);
    expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"')).toBe(true);
    expect(svg).toContain("<title>Beowulf/2, Deck 1</title>");
    expect(svg).toContain("J-Drive");
    expect(svg).toContain('class="fp-door"');
  });

  it("frames every deck alike, so exported decks line up", () => {
    const plan = twoDecks();
    const box = (svg: string) => /viewBox="([^"]+)"/.exec(svg)?.[1];
    expect(box(deckDocument(SHIP, plan, 0, SOURCES))).toBe(box(deckDocument(SHIP, plan, 1, SOURCES)));
    expect(frame(plan)).toEqual({ minX: -1, minY: -2, maxX: 12, maxY: 7 });
  });

  it("frames tiles as well as squares", () => {
    const plan = placeTile(emptyPlan(), { deck: 0, x: 0, y: 0, rotation: 90, tile: "sc-001", squares: [6, 20], pixels: [600, 1440], code: "SC-001" });
    // Turned a quarter, the tile is twenty wide and six high.
    expect(frame(plan)).toEqual({ minX: -1, minY: -2, maxX: 20, maxY: 6 });
    expect(deckDocument(SHIP, plan, 0, SOURCES)).toContain(">SC-001<");
  });

  it("numbers the rooms and adds a key when asked to", () => {
    const named = deckDocument(SHIP, twoDecks(), 0, SOURCES);
    const numbered = deckDocument(SHIP, twoDecks(), 0, SOURCES, { labels: "numbers" });
    expect(named).toContain(">J-Drive<");
    expect(named).not.toContain(">Key<");
    expect(numbered).toContain(">1<");
    expect(numbered).toContain(">Key<");
    expect(numbered).toContain("J-Drive");
  });

  it("leaves the rooms unlabelled, with no key, when labels are off", () => {
    const bare = deckDocument(SHIP, twoDecks(), 0, SOURCES, { labels: "off" });
    expect(bare).not.toContain("fp-label");
    expect(bare).not.toContain(">Key<");
    expect(bare).not.toContain("J-Drive");
  });

  it("draws a wall put in to split a room, on paper as on screen", () => {
    const plan = placeFixture(twoDecks(), { kind: "wall", deck: 0, x: 2, y: 0, edge: "w", length: 2 });
    const svg = deckDocument(SHIP, plan, 0, SOURCES, { palette: PAPER, pixelsPerSquare: 60, grid: false, labels: "names" });
    expect(svg).toContain('class="fp-wall" d="M2 0v2"');
  });

  it("names the file after the ship and the deck, safely", () => {
    expect(exportName(SHIP, twoDecks(), 1, "png")).toBe("Beowulf2 Deck 2.png");
  });
});

describe("library pieces drawn to their footprint", () => {
  const image = (symbol: string) => {
    const markup = symbolMarkup({ x: 3, y: 4, rotation: 0, symbol }, PAPER, (f) => f);
    const num = (attr: string) => Number(new RegExp(`${attr}="([^"]+)"`).exec(markup)![1]);
    return { x: num("x"), y: num("y"), width: num("width"), height: num("height") };
  };

  it("fits a locker to its one square", () => {
    const locker = image("sheet-locker");
    expect(Math.max(locker.width, locker.height)).toBeCloseTo(1);
    expect(locker.y).toBeGreaterThanOrEqual(4);
    expect(locker.y + locker.height).toBeLessThanOrEqual(5 + 1e-9);
  });

  it("puts the head of a small bed and a medical bed against the left of their footprint", () => {
    for (const bed of ["bed-small", "medical-bed"]) {
      const drawn = image(bed);
      expect(drawn.x).toBe(3);
      expect(drawn.y + drawn.height / 2).toBeCloseTo(4.5);
    }
  });

  it("puts a toilet against the wall behind it, and a corner booth into its corner", () => {
    const toilet = image("sheet-toilet");
    expect(toilet.y).toBe(4);
    expect(toilet.x + toilet.width / 2).toBeCloseTo(3.5);
    const booth = image("sheet-booth");
    expect([booth.x, booth.y]).toEqual([3, 4]);
  });

  it("sets a small locker against the top of its square", () => {
    const small = image("sheet-locker-small");
    expect(small.width).toBeCloseTo(1);
    expect(small.y).toBe(4);
    expect(small.height).toBeLessThan(1);
  });
});
