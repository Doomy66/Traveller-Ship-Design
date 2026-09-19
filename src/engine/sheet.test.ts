/**
 * The book's own ships, line by line. ShipSpec 7.
 *
 * A rule that makes one of these come out wrong is wrong, unless the sheet is a
 * known erratum and says so here.
 */

import { describe, expect, it } from "vitest";
import { FREE_TRADER } from "../fixtures/freeTrader";
import { PATROL_CORVETTE } from "../fixtures/patrolCorvette";
import { SCOUT_COURIER } from "../fixtures/scoutCourier";
import { sheet } from "./sheet";
import type { Sheet } from "./sheet";

/** The sheet as the book prints it: label, tons, cost, in order. */
function printed(result: Sheet): [string, number | undefined, number | undefined][] {
  return result.lines.map((line) => [line.label, line.tons, line.cost]);
}

function requirements(result: Sheet): [string, number][] {
  return result.powerRequirements.map((entry) => [entry.label, entry.power]);
}

function roles(result: Sheet): string[] {
  return result.crew.flatMap((entry) => Array.from({ length: entry.count }, () => entry.label));
}

describe("Scout/Courier, page 161", () => {
  const result = sheet(SCOUT_COURIER);

  it("prints the sheet the book prints", () => {
    expect(printed(result)).toEqual([
      ["100 tons, Streamlined", undefined, 6],
      ["Crystaliron, Armour: 4", 6, 1.2],
      ["Thrust 2", 2, 4],
      ["Jump 2", 10, 15],
      ["Fusion (TL12), Power 60", 4, 4],
      ["J-2, 12 weeks of operation", 23, undefined],
      ["Bridge", 10, 0.5],
      ["Computer/5bis", undefined, 0.045],
      ["Military Grade", 2, 4.1],
      ["Double Turret (empty)", 1, 0.5],
      ["Docking Space (4 tons)", 5, 1.25],
      ["Air/Raft", undefined, 0.25],
      ["Fuel Processor (40 tons/day)", 2, 0.1],
      ["Fuel Scoops", undefined, undefined],
      ["Probe Drones x10", 2, 1],
      ["Workshop", 6, 0.9],
      ["Standard x4", 16, 2],
      ["Manoeuvre", undefined, undefined],
      ["Jump Control/2", undefined, 0.2],
      ["Library", undefined, undefined],
      ["Intellect", undefined, undefined],
      ["Cargo", 11, undefined],
    ]);
  });

  it("fills the hull exactly", () => {
    expect(result.tonsUsed).toBe(89);
    expect(result.cargoTons).toBe(11);
    expect(result.hullPoints).toBe(40);
  });

  it("costs what the book says", () => {
    expect(result.totalCost).toBe(41.045);
    expect(result.purchaseCost).toBe(36.9405);
    expect(result.maintenanceCost).toBe(3079);
  });

  it("needs the power the book lists", () => {
    expect(result.powerAvailable).toBe(60);
    expect(requirements(result)).toEqual([
      ["Basic Ship Systems", 20],
      ["Manoeuvre Drive", 20],
      ["Jump Drive", 20],
      ["Sensors", 2],
      ["Fuel Processor", 2],
    ]);
  });

  it("is crewed by a pilot, an astrogator and an engineer", () => {
    expect(roles(result)).toEqual(["Pilot", "Astrogator", "Engineer"]);
  });

  it("has nothing wrong with it", () => {
    expect(result.problems.filter((problem) => problem.severity !== "note")).toEqual([]);
  });

  it("has one airlock and one unused hardpoint", () => {
    expect(result.airlocks).toBe(1);
    expect(result.hardpoints).toEqual({ available: 1, used: 1, firmpoints: false });
  });
});

describe("Free Trader, page 172", () => {
  const result = sheet(FREE_TRADER);

  it("prints the sheet the book prints", () => {
    expect(printed(result)).toEqual([
      ["200 tons, Streamlined", undefined, 12],
      ["Crystaliron, Armour: 2", 6, 1.2],
      ["Thrust 1", 2, 4],
      ["Jump 1", 10, 15],
      ["Fusion (TL12), Power 75", 5, 5],
      ["J-1, 4 weeks of operation", 21, undefined],
      ["Bridge", 10, 1],
      ["Computer/5", undefined, 0.03],
      ["Civilian Grade", 1, 3],
      ["Fuel Processor (20 tons/day)", 1, 0.05],
      ["Fuel Scoops", undefined, undefined],
      ["Cargo Crane", 3, 3],
      ["Standard x10", 40, 5],
      ["Low Berth x20", 10, 1],
      ["Manoeuvre", undefined, undefined],
      ["Jump Control/1", undefined, 0.1],
      ["Library", undefined, undefined],
      ["Intellect", undefined, undefined],
      ["Common Areas", 10, 1],
      // The book prints 80. Its own components come to 119 of 200. ShipSpec 7.3.2.
      ["Cargo", 81, undefined],
    ]);
  });

  it("costs what the book says", () => {
    expect(result.totalCost).toBe(51.38);
    expect(result.purchaseCost).toBe(46.242);
    expect(result.maintenanceCost).toBe(3854);
    expect(result.hullPoints).toBe(80);
  });

  it("needs the power the book lists", () => {
    expect(result.powerAvailable).toBe(75);
    expect(requirements(result)).toEqual([
      ["Basic Ship Systems", 40],
      ["Manoeuvre Drive", 20],
      ["Jump Drive", 20],
      ["Sensors", 1],
      ["Fuel Processor", 1],
      ["Low Berths", 2],
    ]);
  });

  it("is crewed by a pilot, an astrogator, an engineer and a steward", () => {
    expect(roles(result)).toEqual(["Pilot", "Astrogator", "Engineer", "Steward"]);
  });

  it("loses a ton somewhere in the book, and it is the book's ton", () => {
    // Components 119, hull 200, so cargo is 81 and the printed 80 leaves a ton
    // in nobody's hands. Core prints the same ship at 201. ShipSpec 7.3.2.
    expect(result.tonsUsed).toBe(119);
    expect(result.tonsUsed + result.cargoTons).toBe(200);
  });

  it("has nothing wrong with it", () => {
    expect(result.problems.filter((problem) => problem.severity !== "note")).toEqual([]);
  });
});

describe("Patrol Corvette, page 188", () => {
  const result = sheet(PATROL_CORVETTE);

  it("prints the sheet the book prints", () => {
    expect(printed(result)).toEqual([
      ["400 tons, Streamlined", undefined, 24],
      ["Crystaliron, Armour: 4", 24, 4.8],
      ["Thrust 4", 16, 32],
      ["Jump 3", 35, 52.5],
      ["Fusion (TL12), Power 300", 20, 20],
      ["J-3, 4 weeks of operation", 122, undefined],
      ["Bridge", 20, 2],
      ["Computer/15", undefined, 2],
      ["Military Grade", 2, 4.1],
      ["Triple Turret (Pulse Laser x3) x2", 2, 8],
      ["Triple Turret (Missile Rack x3) x2", 2, 6.5],
      ["Docking Space (30 tons)", 33, 8.25],
      ["Ship's Boat", undefined, 7.58],
      ["Docking Space (15 tons)", 17, 4.25],
      ["G/carrier", undefined, 11.58],
      ["Fuel Processor (80 tons/day)", 4, 0.2],
      ["Fuel Scoops", undefined, undefined],
      ["Standard x12", 48, 6],
      ["Low Berth x4", 2, 0.2],
      ["Manoeuvre", undefined, undefined],
      ["Jump Control/3", undefined, 0.3],
      ["Library", undefined, undefined],
      ["Intellect", undefined, undefined],
      ["Evade/1", undefined, 1],
      ["Fire Control/1", undefined, 2],
      ["Common Areas", 10, 1],
      ["Cargo", 43, undefined],
    ]);
  });

  it("fills the hull exactly", () => {
    expect(result.tonsUsed).toBe(357);
    expect(result.cargoTons).toBe(43);
    expect(result.hullPoints).toBe(160);
  });

  it("costs what the book says", () => {
    expect(result.totalCost).toBe(198.26);
    expect(result.purchaseCost).toBe(178.434);
    expect(result.maintenanceCost).toBe(14870);
  });

  it("draws the weapon power the book lists", () => {
    expect(result.powerAvailable).toBe(300);
    expect(requirements(result)).toEqual([
      ["Basic Ship Systems", 80],
      ["Manoeuvre Drive", 160],
      ["Jump Drive", 120],
      ["Sensors", 2],
      ["Weapons", 28],
      ["Fuel Processor", 4],
      ["Low Berths", 1],
    ]);
  });

  it("uses every hardpoint it has", () => {
    expect(result.hardpoints).toEqual({ available: 4, used: 4, firmpoints: false });
  });

  it("is crewed as the Crew Requirements table says", () => {
    // The book's list adds a medic and eight marines by editorial judgement.
    // ShipSpec 7.4.1.
    expect(roles(result)).toEqual([
      "Pilot",
      "Pilot",
      "Astrogator",
      "Engineer",
      "Engineer",
      "Gunner",
      "Gunner",
      "Gunner",
      "Gunner",
    ]);
  });

  it("has nothing wrong with it", () => {
    expect(result.problems.filter((problem) => problem.severity !== "note")).toEqual([]);
  });
});
