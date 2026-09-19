/**
 * The book's own ships, line by line. ShipSpec 7.
 *
 * A rule that makes one of these come out wrong is wrong, unless the sheet is a
 * known erratum and says so here.
 */

import { describe, expect, it } from "vitest";
import { DESTROYER_ESCORT } from "../fixtures/destroyerEscort";
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

describe("Destroyer Escort, page 208", () => {
  const result = sheet(DESTROYER_ESCORT);

  it("prints the sheet the book prints", () => {
    expect(printed(result)).toEqual([
      // The book gives the reinforcement a line of its own at MCr20; here it
      // is folded into the hull, which comes to the same MCr60.
      ["1000 tons, Close Structure, Reinforced Hull", undefined, 60],
      ["Bonded Superdense, Armour: 2", 24, 12],
      ["Thrust 6", 60, 120],
      ["Jump 4", 105, 157.5],
      ["Fusion (TL15), Power 1280", 64, 128],
      ["J-4, 8 weeks of operation", 414, undefined],
      ["Bridge, holographic", 20, 6.25],
      ["Computer/35fib", undefined, 45],
      ["Advanced", 5, 5.3],
      ["Fusion Barbette", 5, 4],
      ["Particle Barbette x2", 10, 16],
      ["Triple Turret (Missile Rack x3) x2", 2, 6.5],
      ["Triple Turret (Sandcaster x3) x5", 5, 8.75],
      ["Standard Missile x384", 32, undefined],
      ["Sand Canister x640", 32, undefined],
      ["Docking Space (40 tons)", 44, 11],
      ["Pinnace", undefined, 9.68],
      ["Fuel Processor (200 tons/day)", 10, 0.5],
      ["Fuel Scoops", undefined, 1],
      ["Armoury x2", 2, 0.5],
      ["Medical Bay", 4, 2],
      ["Repair Drones", 10, 2],
      // The book prints "Standard x24"; the sheet here records the double
      // occupancy that a crew of thirty-nine in twenty-four rooms implies.
      ["Standard x24 (double occupancy)", 96, 12],
      ["Manoeuvre", undefined, undefined],
      ["Intellect", undefined, undefined],
      ["Library", undefined, undefined],
      ["Jump Control/4", undefined, 0.4],
      ["Auto-Repair/1", undefined, 5],
      ["Evade/2", undefined, 2],
      ["Fire Control/2", undefined, 4],
      ["Common Areas", 24, 2.4],
      ["Cargo", 32, undefined],
    ]);
  });

  it("fills the hull exactly", () => {
    expect(result.tonsUsed).toBe(968);
    expect(result.cargoTons).toBe(32);
    // A thousand tons at one Hull point per 2.5, and a tenth more for being reinforced.
    expect(result.hullPoints).toBe(440);
  });

  it("costs what the book says", () => {
    expect(result.totalCost).toBe(621.78);
    expect(result.purchaseCost).toBe(559.602);
    expect(result.maintenanceCost).toBe(46634);
  });

  it("keeps its ammunition out of its price", () => {
    // Put this into the total and neither the printed total nor the purchase
    // cost works any more. ShipSpec 4.9.5.1.
    expect(result.ordnanceCost).toBe(8.8);
  });

  it("needs the power the book lists", () => {
    expect(result.powerAvailable).toBe(1_280);
    expect(requirements(result)).toEqual([
      ["Basic Ship Systems", 200],
      ["Manoeuvre Drive", 600],
      ["Jump Drive", 400],
      ["Sensors", 6],
      ["Weapons", 57],
      ["Fuel Processor", 10],
      ["Medical Bay", 1],
    ]);
  });

  it("is crewed as the Crew Requirements table says", () => {
    const count = (role: string) => result.crew.find((entry) => entry.role === role)?.count ?? 0;
    // The three the book's own figures turn on.
    expect(count("engineer")).toBe(7);
    expect(count("gunner")).toBe(20);
    expect(count("maintenance")).toBe(2);
    // And the rest of what the table gives.
    expect(count("captain")).toBe(1);
    expect(count("astrogator")).toBe(1);
    expect(count("officer")).toBe(3);
    // ShipSpec 7.5.1 on the three the printed list does not agree with.
    expect(count("pilot")).toBe(4);
    expect(count("administrator")).toBe(1);
    expect(count("medic")).toBe(0);
  });

  it("has nothing wrong with it", () => {
    expect(result.problems.filter((problem) => problem.severity !== "note")).toEqual([]);
  });
});
