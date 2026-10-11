/**
 * Exported decks. FloorPlanSpec 10.6.
 */

import { describe, expect, it } from "vitest";
import { deckDocument, exportName, frame } from "./export";
import type { Manifest } from "./manifest";
import { addDeck, area, emptyPlan, paint, placeFixture, placeTile } from "./plan";

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

  it("names the file after the ship and the deck, safely", () => {
    expect(exportName(SHIP, twoDecks(), 1, "png")).toBe("Beowulf2 Deck 2.png");
  });
});
