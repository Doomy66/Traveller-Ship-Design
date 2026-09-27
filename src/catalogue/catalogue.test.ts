/**
 * The catalogue. Nothing in it reproduces a printed sheet, so the only promise
 * is that every design is legal: it opens with no errors.
 */

import { describe, expect, it } from "vitest";
import { sheet } from "../engine/sheet";
import { CATALOGUE } from "./index";

describe("the ship catalogue", () => {
  it("holds every design it was given", () => {
    expect(CATALOGUE.length).toBe(36);
  });

  it.each(CATALOGUE.map((entry) => [entry.design.name, entry] as const))("%s opens with no errors", (_, entry) => {
    const errors = sheet(entry.design).problems.filter((p) => p.severity === "error").map((p) => p.message);
    expect(errors).toEqual([]);
  });

  it("names every design differently", () => {
    const names = CATALOGUE.map((entry) => entry.design.name);
    expect(new Set(names).size).toBe(names.length);
  });
});
