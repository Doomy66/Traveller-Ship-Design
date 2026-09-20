/**
 * Saving and loading. ShipSpec 8.
 *
 * What matters is that a design survives the round trip unchanged, and that
 * nothing which is not a design is accepted as one.
 */

import { describe, expect, it } from "vitest";
import { DESTROYER_ESCORT } from "../fixtures/destroyerEscort";
import { SCOUT_COURIER } from "../fixtures/scoutCourier";
import { sheet } from "../engine/sheet";
import { fileNameFor, parse, serialise } from "./save";

describe("saving a design", () => {
  it("brings a ship back exactly as it went out", () => {
    for (const design of [SCOUT_COURIER, DESTROYER_ESCORT]) {
      const back = parse(serialise(design));
      expect(back).not.toBeNull();
      // The version is written in on the way out, so compare what the rules see.
      expect(sheet(back!)).toEqual(sheet(design));
    }
  });

  it("carries the designer's own notes there and back, newlines and all", () => {
    const written = { ...SCOUT_COURIER, notes: "Sold off at Regina.\nRefitted 1104." };
    const back = parse(serialise(written));
    expect(back?.notes).toBe(written.notes);
    expect(sheet(back!).notes).toBe(written.notes);
  });

  it("stamps the design with the spec version it was written under", () => {
    expect(JSON.parse(serialise(SCOUT_COURIER)).version).toBe(1);
  });

  it("refuses anything that is not a design", () => {
    expect(parse("not json")).toBeNull();
    expect(parse("null")).toBeNull();
    expect(parse("[]")).toBeNull();
    expect(parse('{"name":"No hull"}')).toBeNull();
    expect(parse('{"hull":{"tons":100}}')).toBeNull();
  });

  it("names the file after the ship, and never after nothing", () => {
    // The Scout is "Scout/Courier", and a slash is no use in a filename.
    expect(fileNameFor(SCOUT_COURIER)).toBe("ScoutCourier.ship");
    expect(fileNameFor({ ...SCOUT_COURIER, name: "  " })).toBe("ship.ship");
    expect(fileNameFor({ ...SCOUT_COURIER, name: "Beowulf/2" })).toBe("Beowulf2.ship");
  });
});
