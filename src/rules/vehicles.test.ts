import { describe, expect, it } from "vitest";
import { VEHICLES, vehicleBand } from "./vehicles";

describe("Vehicle Handbook vehicles", () => {
  it("has each vehicle once, with a size, a price and a Tech Level", () => {
    expect(new Set(VEHICLES.map((v) => v.label)).size).toBe(VEHICLES.length);
    for (const v of VEHICLES) {
      expect(v.tons, v.label).toBeGreaterThan(0);
      expect(v.cost, v.label).toBeGreaterThan(0);
      expect(v.tl, v.label).toBeGreaterThanOrEqual(1);
      expect(v.tl, v.label).toBeLessThanOrEqual(15);
    }
  });

  it("agrees with High Guard's ship sheets on the air/raft", () => {
    expect(VEHICLES.find((v) => v.label === "Air/Raft")).toMatchObject({ tl: 8, tons: 4, cost: 0.25 });
  });

  it("is in the book's order, chapter by chapter", () => {
    const bands = ["TL1-3", "TL4-5", "TL6-7", "TL8-9", "TL10-12", "TL13-15"];
    const order = VEHICLES.map((v) => bands.indexOf(vehicleBand(v.tl)));
    expect(order).toEqual([...order].sort((a, b) => a - b));
  });
});
