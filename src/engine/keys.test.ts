/**
 * Sheet line keys and counts. ShipSpec 5.2.2 and 5.2.3.
 *
 * A key is only worth having if it is unique on the sheet and survives a
 * change of figures, so those are the two things tested, across every ship
 * the project has.
 */

import { describe, expect, it } from "vitest";
import { CATALOGUE } from "../catalogue/index";
import { DESTROYER_ESCORT } from "../fixtures/destroyerEscort";
import { FREE_TRADER } from "../fixtures/freeTrader";
import { PATROL_CORVETTE } from "../fixtures/patrolCorvette";
import { SCOUT_COURIER } from "../fixtures/scoutCourier";
import type { Design } from "./design";
import { sheet } from "./sheet";

const EVERY_SHIP: readonly Design[] = [
  SCOUT_COURIER,
  FREE_TRADER,
  PATROL_CORVETTE,
  DESTROYER_ESCORT,
  ...CATALOGUE.map((entry) => entry.design),
];

const keysOf = (design: Design) => sheet(design).lines.map((line) => line.key);

describe("sheet line keys", () => {
  it.each(EVERY_SHIP.map((d) => [d.name, d] as const))("are present and unique on the %s", (_, design) => {
    const keys = keysOf(design);
    expect(keys.every((key) => key !== "")).toBe(true);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("stay the same when the figures change", () => {
    const changed: Design = {
      ...PATROL_CORVETTE,
      manoeuvre: 3,
      jump: 2,
      powerPlant: { ...PATROL_CORVETTE.powerPlant, tons: 30, weeks: 8 },
      staterooms: 14,
    };
    const before = sheet(PATROL_CORVETTE).lines;
    const after = sheet(changed).lines;
    expect(after.map((line) => line.key)).toEqual(before.map((line) => line.key));
    // The labels did change, which is the point.
    expect(after.find((line) => line.key === "manoeuvre")?.label).not.toBe(
      before.find((line) => line.key === "manoeuvre")?.label,
    );
  });

  it("name list entries by their place in the list", () => {
    const keys = keysOf(PATROL_CORVETTE);
    expect(keys).toContain("weapon:0");
    expect(keys).toContain("weapon:1");
    expect(keys).toContain("craft:0:berth");
    expect(keys).toContain("craft:1");
    expect(keys).toContain("system:0");
    expect(keys).toContain("software:5");
  });

  it("keep the cargo crane's key when its line is filled in last", () => {
    const lines = sheet(FREE_TRADER).lines;
    const crane = lines.find((line) => line.label.startsWith("Cargo Crane"));
    expect(crane?.key).toBe("system:2");
    expect(crane?.tons).toBeGreaterThan(0);
  });
});

describe("sheet line counts", () => {
  it("say how many things a line stands for", () => {
    const lines = sheet(PATROL_CORVETTE).lines;
    expect(lines.find((line) => line.key === "staterooms")?.count).toBe(12);
    expect(lines.find((line) => line.key === "weapon:0")?.count).toBe(2);
    expect(lines.find((line) => line.key === "lowBerths")?.count).toBe(4);
  });

  it("are left off a line for one thing", () => {
    const lines = sheet(PATROL_CORVETTE).lines;
    expect(lines.find((line) => line.key === "bridge")?.count).toBeUndefined();
    expect(lines.find((line) => line.key === "craft:0")?.count).toBeUndefined();
  });

  it("carry a squadron's number onto its berth and its craft", () => {
    const tern = CATALOGUE.find((entry) => entry.design.name === "Tern-class Fighter Carrier")!.design;
    const lines = sheet(tern).lines;
    expect(lines.find((line) => line.key === "craft:0:berth")?.count).toBe(24);
    expect(lines.find((line) => line.key === "craft:0")?.count).toBe(24);
  });
});
