/**
 * The manifest. FloorPlanSpec section 3, and the boundary of FP 1.2.
 */

import { describe, expect, it } from "vitest";
import { CATALOGUE } from "../catalogue/index";
import type { Design } from "../engine/design";
import { sheet } from "../engine/sheet";
import { DESTROYER_ESCORT } from "../fixtures/destroyerEscort";
import { FREE_TRADER } from "../fixtures/freeTrader";
import { PATROL_CORVETTE } from "../fixtures/patrolCorvette";
import { SCOUT_COURIER } from "../fixtures/scoutCourier";
import { manifest, SQUARES_PER_STATEROOM } from "./manifest";

const EVERY_SHIP: readonly Design[] = [
  SCOUT_COURIER,
  FREE_TRADER,
  PATROL_CORVETTE,
  DESTROYER_ESCORT,
  ...CATALOGUE.map((entry) => entry.design),
];

describe("the manifest", () => {
  it.each(EVERY_SHIP.map((d) => [d.name, d] as const))(
    "lists every line of the %s that takes up room, once, and nothing else",
    (_, design) => {
      const wanted = sheet(design)
        .lines.filter((line) => (line.tons ?? 0) > 0)
        .filter((line) => !["Hull", "Hull Options", "Armour", "Software"].includes(line.section))
        .map((line) => line.key);
      expect(manifest(design).components.map((c) => c.key)).toEqual(wanted);
    },
  );

  it("leaves off the hull and the armour, as the book says", () => {
    const keys = manifest(PATROL_CORVETTE).components.map((c) => c.key);
    expect(keys).not.toContain("hull");
    expect(keys).not.toContain("armour");
  });

  it("asks for two squares a ton, rounded up to the whole square", () => {
    const scout = manifest(SCOUT_COURIER).components;
    const target = (key: string) => scout.find((c) => c.key === key)?.target;
    expect(target("jump")).toBe(20);
    expect(target("powerPlant")).toBe(8);
    // A one-ton turret is two squares.
    expect(target("weapon:0")).toBe(2);
    // Half a ton is a square, and a ton and a quarter rounds up to three.
    const tiny = manifest({ ...SCOUT_COURIER, systems: [{ flat: "reEntryCapsule" }, { perTon: "laboratory", tons: 1.25 }] });
    expect(tiny.components.find((c) => c.key === "system:0")?.target).toBe(1);
    expect(tiny.components.find((c) => c.key === "system:1")?.target).toBe(3);
  });

  it("gives a stateroom six squares, not eight, and wants one room each", () => {
    const staterooms = manifest(SCOUT_COURIER).components.find((c) => c.key === "staterooms")!;
    expect(staterooms.tons).toBe(16);
    expect(staterooms.target).toBe(4 * SQUARES_PER_STATEROOM);
    expect(staterooms.rooms).toBe(4);
  });

  it("keeps a single stateroom at six squares too", () => {
    const one = manifest({ ...SCOUT_COURIER, staterooms: 1 }).components.find((c) => c.key === "staterooms")!;
    expect(one.target).toBe(SQUARES_PER_STATEROOM);
    expect(one.rooms).toBe(1);
  });

  it("makes fuel optional and everything else required", () => {
    const components = manifest(PATROL_CORVETTE).components;
    expect(components.find((c) => c.key === "fuel")?.required).toBe(false);
    expect(components.filter((c) => c.key !== "fuel").every((c) => c.required)).toBe(true);
  });

  it("carries a squadron's number, but asks for its hangars as one target", () => {
    const tern = CATALOGUE.find((entry) => entry.design.name === "Tern-class Fighter Carrier")!.design;
    const hangars = manifest(tern).components.find((c) => c.key === "craft:0:berth")!;
    expect(hangars.count).toBe(24);
    expect(hangars.target).toBe(1920 * 2);
    // Only staterooms are checked room by room.
    expect(hangars.rooms).toBe(1);
  });

  it("groups components for colouring", () => {
    const group = (key: string) => manifest(SCOUT_COURIER).components.find((c) => c.key === key)?.group;
    expect(group("jump")).toBe("engineering");
    expect(group("fuel")).toBe("fuel");
    expect(group("bridge")).toBe("command");
    expect(group("staterooms")).toBe("accommodation");
    expect(group("cargo")).toBe("cargo");
  });

  it("knows how much of a planetoid a plan has to fill", () => {
    const rock = manifest({ ...SCOUT_COURIER, hull: { tons: 1000, configuration: "planetoid" } });
    expect(rock.usableTons).toBe(sheet({ ...SCOUT_COURIER, hull: { tons: 1000, configuration: "planetoid" } }).usableTons);
    expect(rock.usableTons).toBeLessThan(1000);
  });
});

describe("the floor plan's boundary", () => {
  // FP 1.2: only manifest.ts may reach into the ship designer.
  const sources = import.meta.glob<string>("./**/*.ts", { eager: true, query: "?raw", import: "default" });

  it("lets only the manifest import the engine or the rules", () => {
    // A glob that found nothing would pass vacuously.
    expect(Object.keys(sources)).toContain("./manifest.ts");
    expect(sources["./manifest.ts"]).toMatch(/from "\.\.\/engine\/sheet"/);
    const offenders = Object.entries(sources)
      .filter(([path]) => path !== "./manifest.ts" && !path.endsWith(".test.ts"))
      .filter(([, text]) => /from\s+["']\.\.\/(\.\.\/)*(engine|rules)\//.test(text))
      .map(([path]) => path);
    expect(offenders).toEqual([]);
  });
});
