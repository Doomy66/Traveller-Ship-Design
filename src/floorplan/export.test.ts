/**
 * Exported decks. FloorPlanSpec 10.6.
 */

import { describe, expect, it } from "vitest";
import { deckDocument, exportName, frame } from "./export";
import type { Manifest } from "./manifest";
import { addDeck, emptyPlan, paint, placeFixture, rectangle } from "./plan";

const SHIP: Manifest = {
  shipName: "Beowulf/2",
  usableTons: 20,
  components: [{ key: "jump", label: "Jump 1", group: "engineering", tons: 5, target: 10, count: 1, rooms: 1, required: true }],
};

function twoDecks() {
  let plan = paint(addDeck(emptyPlan()), 0, rectangle([0, 0], [4, 1]), "jump");
  plan = paint(plan, 1, rectangle([10, 5], [11, 6]), "~corridor");
  return placeFixture(plan, { kind: "door", deck: 0, x: 1, y: 0, edge: "n" });
}

describe("exporting a deck", () => {
  it("draws a complete SVG document, titled with the ship and the deck", () => {
    const svg = deckDocument(SHIP, twoDecks(), 0, (file) => file);
    expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"')).toBe(true);
    expect(svg).toContain("<title>Beowulf/2, Deck 1</title>");
    expect(svg).toContain("J-Drive");
    expect(svg).toContain('class="fp-door"');
  });

  it("frames every deck alike, so exported decks line up", () => {
    const plan = twoDecks();
    const box = (svg: string) => /viewBox="([^"]+)"/.exec(svg)?.[1];
    expect(box(deckDocument(SHIP, plan, 0, (f) => f))).toBe(box(deckDocument(SHIP, plan, 1, (f) => f)));
    expect(frame(plan)).toEqual({ minX: -1, minY: -2, maxX: 12, maxY: 7 });
  });

  it("names the file after the ship and the deck, safely", () => {
    expect(exportName(SHIP, twoDecks(), 1, "png")).toBe("Beowulf2 Deck 2.png");
  });
});
