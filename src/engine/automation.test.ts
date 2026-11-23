/**
 * Starship automation, the Companion's optional rule. ShipSpec 4.10.4.
 */

import { describe, expect, it } from "vitest";
import { DESTROYER_ESCORT } from "../fixtures/destroyerEscort";
import { SCOUT_COURIER } from "../fixtures/scoutCourier";
import { AUTOMATED_SECTIONS } from "../rules/index";
import type { Design } from "./design";
import { sheet } from "./sheet";
import type { Sheet } from "./sheet";

function count(result: Sheet, role: string): number {
  return result.crew.find((entry) => entry.role === role)?.count ?? 0;
}

function automatedCost(result: Sheet): number {
  return result.lines
    .filter((line) => AUTOMATED_SECTIONS.includes(line.section))
    .reduce((sum, line) => sum + (line.cost ?? 0), 0);
}

describe("automation", () => {
  const standard = sheet(DESTROYER_ESCORT);

  it("leaves the book's ships alone when it is not chosen", () => {
    expect(standard.lines.some((line) => line.key === "automation")).toBe(false);
    expect(sheet({ ...DESTROYER_ESCORT, automation: "standard" })).toEqual(standard);
  });

  it("prices high automation at the whole cost of hull, drives and plant again", () => {
    const high = sheet({ ...DESTROYER_ESCORT, automation: "high" });
    const line = high.lines.find((entry) => entry.key === "automation");
    expect(line?.cost).toBeCloseTo(automatedCost(standard), 6);
    expect(line?.tons).toBeUndefined();
    expect(high.totalCost).toBeCloseTo(standard.totalCost + automatedCost(standard), 6);
    expect(high.cargoTons).toBe(standard.cargoTons);
  });

  it("takes money off for low automation", () => {
    const low = sheet({ ...DESTROYER_ESCORT, automation: "low" });
    expect(low.lines.find((entry) => entry.key === "automation")?.cost).toBeCloseTo(-0.2 * automatedCost(standard), 6);
  });

  it("cuts only the jobs that can be shared, rounding up", () => {
    expect(count(standard, "engineer")).toBe(7);
    expect(count(standard, "gunner")).toBe(20);
    const high = sheet({ ...DESTROYER_ESCORT, automation: "high" });
    expect(count(high, "engineer")).toBe(5); // 7 x 0.6 = 4.2
    expect(count(high, "gunner")).toBe(12);
    for (const role of ["captain", "pilot", "astrogator", "steward"]) {
      expect(count(high, role)).toBe(count(standard, role));
    }
  });

  it("doubles the shareable jobs on a crew-intensive ship", () => {
    const manual = sheet({ ...DESTROYER_ESCORT, automation: "crewIntensive" });
    expect(count(manual, "engineer")).toBe(14);
    expect(count(manual, "gunner")).toBe(40);
  });

  it("never takes the last engineer", () => {
    const scout: Design = { ...SCOUT_COURIER, automation: "high" };
    expect(count(sheet(scout), "engineer")).toBe(1);
  });

  it("says what it does to shipboard tasks", () => {
    const advanced = sheet({ ...DESTROYER_ESCORT, automation: "advanced" });
    expect(advanced.problems.some((p) => p.clause === "4.10.4" && p.message.includes("DM+1"))).toBe(true);
    const enhanced = sheet({ ...DESTROYER_ESCORT, automation: "enhanced" });
    expect(enhanced.problems.some((p) => p.clause === "4.10.4")).toBe(false);
  });
});
