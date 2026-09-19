/**
 * The rules the two fixture ships never touch.
 *
 * A standard trader exercises a narrow path: one hull shape, one armour, a
 * bridge of the ordinary size, no cockpit, no reaction drive, nothing over
 * 5,000 tons. Everything else in the engine is checked here, against the book's
 * own worked examples where it gives one.
 */

import { describe, expect, it } from "vitest";
import type { Design } from "./design";
import { sheet } from "./sheet";
import type { Sheet } from "./sheet";

/** A minimal legal ship to vary one thing at a time against. */
const BASE: Design = {
  name: "Test",
  tl: 15,
  hull: { tons: 200, configuration: "standard" },
  powerPlant: { type: "fusion12", tons: 5, weeks: 4 },
  bridge: { kind: "standard" },
};

function line(result: Sheet, label: string) {
  const found = result.lines.find((entry) => entry.label.startsWith(label));
  if (found === undefined) throw new Error(`no line starting "${label}" in: ${result.lines.map((l) => l.label).join(" | ")}`);
  return found;
}

function errors(result: Sheet): string[] {
  return result.problems.filter((problem) => problem.severity === "error").map((problem) => problem.message);
}

describe("hulls", () => {
  it("prices a configuration and then a specialised hull on top, as the book's example does", () => {
    // Page 14: a 2,000-ton light cruiser. MCr100 base, streamlined to MCr120,
    // reinforced to MCr180.
    const cruiser = sheet({
      ...BASE,
      hull: { tons: 2_000, configuration: "streamlined", specialised: ["reinforced"] },
    });
    expect(line(cruiser, "2000 tons").cost).toBe(180);
  });

  it("adds two specialised hull costs together before applying them", () => {
    // Page 14 again: reinforced and military are added, not compounded, so a
    // 6,000-ton hull at MCr300 goes to MCr300 x 1.75, not x 1.5 x 1.25.
    const capital = sheet({
      ...BASE,
      hull: { tons: 6_000, configuration: "standard", specialised: ["reinforced", "military"] },
    });
    expect(line(capital, "6000 tons").cost).toBe(525);
  });

  it("gives a big ship more Hull points per ton", () => {
    expect(sheet({ ...BASE, hull: { tons: 20_000, configuration: "standard" } }).hullPoints).toBe(8_000);
    expect(sheet({ ...BASE, hull: { tons: 30_000, configuration: "standard" } }).hullPoints).toBe(15_000);
    expect(sheet({ ...BASE, hull: { tons: 100_000, configuration: "standard" } }).hullPoints).toBe(66_666);
  });

  it("hollows out a planetoid and armours it for nothing", () => {
    const rock = sheet({ ...BASE, hull: { tons: 1_000, configuration: "planetoid" } });
    expect(line(rock, "1000 tons").cost).toBe(4);
    expect(rock.usableTons).toBe(800);
    expect(rock.hullPoints).toBe(500);
    expect(rock.armourProtection).toBe(2);
  });

  it("halves basic systems power for a hull with no grav plating", () => {
    const spun = sheet({ ...BASE, hull: { tons: 200, configuration: "standard", specialised: ["nonGravity"] } });
    expect(spun.powerRequirements[0]).toEqual({ label: "Basic Ship Systems", power: 20 });
  });

  it("refuses a military hull on a ship too small for one", () => {
    const small = sheet({ ...BASE, hull: { tons: 1_000, configuration: "standard", specialised: ["military"] } });
    expect(errors(small)).toEqual(["A military hull needs more than 5,000 tons."]);
  });
});

describe("armour", () => {
  it("costs a small hull four times the tonnage, as the book's light fighter does", () => {
    // Page 14: a 10-ton fighter with crystaliron pays 1.25% x 4, so 5% a point.
    const fighter = sheet({
      ...BASE,
      hull: { tons: 10, configuration: "standard" },
      armour: { type: "crystaliron", protection: 1 },
      bridge: { kind: "cockpit" },
    });
    expect(line(fighter, "Crystaliron").tons).toBe(0.5);
  });

  it("counts a dispersed structure's doubled armour volume", () => {
    const frame = sheet({
      ...BASE,
      hull: { tons: 1_000, configuration: "dispersedStructure" },
      armour: { type: "crystaliron", protection: 4 },
    });
    expect(line(frame, "Crystaliron").tons).toBe(100);
  });

  it("caps protection at the Tech Level, and a military hull doubles the cap", () => {
    // A TL10 shipyard, so a TL10 power plant too.
    const yard = { ...BASE, tl: 10, powerPlant: { type: "fusion8", tons: 5, weeks: 4 } } as const;

    const over = sheet({ ...yard, armour: { type: "titaniumSteel", protection: 10 } });
    expect(errors(over)).toEqual(["Titanium Steel at TL10 allows Protection 9, not 10."]);

    const warship = sheet({
      ...yard,
      hull: { tons: 6_000, configuration: "standard", specialised: ["military"] },
      armour: { type: "titaniumSteel", protection: 10 },
    });
    expect(errors(warship)).toEqual([]);
  });
});

describe("drives and fuel", () => {
  it("raises a small jump drive to its ten-ton minimum and says so", () => {
    const short = sheet({ ...BASE, hull: { tons: 100, configuration: "standard" }, jump: 1 });
    expect(line(short, "Jump 1").tons).toBe(10);
    expect(short.problems.map((problem) => problem.message)).toContain(
      "The jump drive is raised to its 10-ton minimum.",
    );
  });

  it("burns reaction fuel by thrust and by the hour", () => {
    const rocket = sheet({ ...BASE, hull: { tons: 100, configuration: "standard" }, reaction: { thrust: 4, hours: 4 } });
    expect(rocket.fuel.reaction).toBe(40);
  });

  it("feeds a chemical plant by the fortnight and everything else by the month", () => {
    expect(sheet({ ...BASE, powerPlant: { type: "chemical", tons: 5, weeks: 4 } }).fuel.powerPlant).toBe(100);
    expect(sheet({ ...BASE, powerPlant: { type: "fusion12", tons: 40, weeks: 8 } }).fuel.powerPlant).toBe(8);
  });

  it("refuses a jump on a plant that cannot make the burst", () => {
    const fission = sheet({ ...BASE, jump: 1, powerPlant: { type: "fission", tons: 20, weeks: 4 } });
    expect(errors(fission)).toContain("A Fission power plant cannot drive a jump.");
  });

  it("charges a thrust 0 drive a quarter of the power", () => {
    const station = sheet({ ...BASE, manoeuvre: 0 });
    expect(station.powerRequirements).toContainEqual({ label: "Manoeuvre Drive", power: 5 });
  });
});

describe("bridges", () => {
  it("lets a hundred-ton scout have a six-ton bridge at half the price", () => {
    // Page 20 says exactly this ship.
    const scout = sheet({ ...BASE, hull: { tons: 100, configuration: "standard" }, bridge: { kind: "smaller" } });
    expect(line(scout, "Bridge (smaller)")).toMatchObject({ tons: 6, cost: 0.25 });
  });

  it("grows past a hundred thousand tons in twenty-ton steps", () => {
    expect(line(sheet({ ...BASE, hull: { tons: 100_000, configuration: "standard" } }), "Bridge").tons).toBe(60);
    expect(line(sheet({ ...BASE, hull: { tons: 250_000, configuration: "standard" } }), "Bridge").tons).toBe(100);
  });

  it("gives a cockpit no airlock and refuses it to a larger ship", () => {
    const fighter = sheet({ ...BASE, hull: { tons: 10, configuration: "standard" }, bridge: { kind: "cockpit" } });
    expect(line(fighter, "Cockpit")).toMatchObject({ tons: 1.5, cost: 0.01 });
    expect(fighter.airlocks).toBe(0);

    const tooBig = sheet({ ...BASE, bridge: { kind: "cockpit" } });
    expect(errors(tooBig)).toContain("A cockpit is only for a hull of 50 tons or less.");
  });

  it("puts a command bridge only on a capital ship", () => {
    const flagship = sheet({
      ...BASE,
      hull: { tons: 20_000, configuration: "standard" },
      bridge: { kind: "standard", command: true },
    });
    expect(line(flagship, "Bridge, command").tons).toBe(100);
    expect(errors(sheet({ ...BASE, bridge: { kind: "standard", command: true } }))).toContain(
      "A command bridge needs more than 5,000 tons.",
    );
  });
});

describe("computers", () => {
  it("charges half again for each option and double for both", () => {
    const bis = sheet({ ...BASE, computer: { processing: 20, bis: true } });
    expect(line(bis, "Computer/20bis").cost).toBe(7.5);
    const both = sheet({ ...BASE, computer: { processing: 20, bis: true, fib: true } });
    expect(line(both, "Computer/20bisfib").cost).toBe(10);
  });

  it("refuses Jump Control the computer cannot run, and allows what /bis buys", () => {
    const short = sheet({
      ...BASE,
      jump: 2,
      computer: { processing: 5 },
      software: [{ software: "jumpControl", level: 2 }],
    });
    expect(errors(short)).toContain("Jump Control needs 10 bandwidth against Processing 5.");

    const specialised = sheet({
      ...BASE,
      jump: 2,
      computer: { processing: 5, bis: true },
      software: [{ software: "jumpControl", level: 2 }],
    });
    expect(errors(specialised)).toEqual([]);
  });

  it("includes Jump Control in a core", () => {
    const capital = sheet({
      ...BASE,
      hull: { tons: 50_000, configuration: "standard" },
      jump: 4,
      computer: { processing: 40, core: true },
      software: [{ software: "jumpControl", level: 4 }],
    });
    expect(capital.software.jumpControl).toBe(0);
    expect(errors(capital)).toEqual([]);
  });
});

describe("weapons", () => {
  it("counts a hardpoint for every hundred tons and firmpoints below that", () => {
    expect(sheet({ ...BASE, hull: { tons: 800, configuration: "standard" } }).hardpoints).toMatchObject({
      available: 8,
      firmpoints: false,
    });
    expect(sheet({ ...BASE, hull: { tons: 40, configuration: "standard" }, bridge: { kind: "cockpit" } }).hardpoints)
      .toMatchObject({ available: 2, firmpoints: true });
  });

  it("refuses more mounts than there are hardpoints", () => {
    const bristling = sheet({
      ...BASE,
      weapons: [{ kind: "turret", mount: "triple", weapons: ["pulseLaser"], quantity: 3 }],
    });
    expect(errors(bristling)).toContain("3 mounts against 2 hardpoints.");
  });

  it("prices a turret with its weapons and draws power only when it is armed", () => {
    const armed = sheet({ ...BASE, weapons: [{ kind: "turret", mount: "triple", weapons: ["beamLaser", "beamLaser"] }] });
    expect(line(armed, "Triple Turret")).toMatchObject({ tons: 1, cost: 2, power: 9 });
    const empty = sheet({ ...BASE, weapons: [{ kind: "turret", mount: "triple" }] });
    expect(line(empty, "Triple Turret").power).toBeUndefined();
  });
});

describe("crew", () => {
  it("crews a small craft with one pilot", () => {
    const launch = sheet({
      ...BASE,
      hull: { tons: 20, configuration: "standard" },
      bridge: { kind: "cockpit" },
      manoeuvre: 4,
    });
    expect(launch.crew).toEqual([{ role: "pilot", label: "Pilot", count: 1, salary: 6_000 }]);
  });

  it("reduces the reducible roles on a large ship and works officers out afterwards", () => {
    const cruiser = sheet({
      ...BASE,
      military: true,
      hull: { tons: 10_000, configuration: "standard" },
      manoeuvre: 3,
      jump: 2,
      powerPlant: { type: "fusion15", tons: 500, weeks: 8 },
      staterooms: 200,
    });
    const count = (role: string) => cruiser.crew.find((entry) => entry.role === role)?.count ?? 0;
    // Maintenance is 1 per 500 tons on a military ship, so 20, then three quarters.
    expect(count("maintenance")).toBe(15);
    // Officers are 1 per full 10 crew, counted after the reduction.
    expect(count("officer")).toBe(Math.floor((cruiser.crewTotal - count("officer")) / 10));
  });

  it("wants a steward for high passengers and a medic only once there are enough people", () => {
    const liner = sheet({
      ...BASE,
      hull: { tons: 2_000, configuration: "standard" },
      jump: 2,
      staterooms: 200,
      passengers: { high: 150, middle: 0, low: 0 },
    });
    const count = (role: string) => liner.crew.find((entry) => entry.role === role)?.count ?? 0;
    expect(count("steward")).toBe(15);
    expect(count("medic")).toBe(1);
  });
});

describe("finalising", () => {
  it("discounts a standard design and charges an architect for a new one", () => {
    const standard = sheet({ ...BASE, standardDesign: true });
    expect(standard.purchaseCost).toBe(Math.round(standard.totalCost * 0.9 * 1e6) / 1e6);
    const bespoke = sheet({ ...BASE });
    expect(bespoke.purchaseCost).toBe(Math.round(bespoke.totalCost * 1.01 * 1e6) / 1e6);
  });

  it("builds faster at a higher Tech Level", () => {
    const slow = sheet({ ...BASE, tl: 11 });
    const fast = sheet({ ...BASE, tl: 16 });
    expect(fast.constructionDays).toBe(Math.ceil(slow.constructionDays * 0.5));
  });

  it("refuses a ship whose components do not fit", () => {
    const stuffed = sheet({ ...BASE, hull: { tons: 100, configuration: "standard" }, staterooms: 30 });
    expect(errors(stuffed)[0]).toMatch(/^Components come to /);
    expect(stuffed.cargoTons).toBeLessThan(0);
  });
});

describe("the heavier weapons", () => {
  /** A capital ship to hang things off. */
  const CAPITAL: Design = {
    ...BASE,
    military: true,
    hull: { tons: 20_000, configuration: "standard" },
    powerPlant: { type: "fusion15", tons: 2_000, weeks: 4 },
  };

  it("gives a barbette five tons and a hardpoint", () => {
    const armed = sheet({ ...CAPITAL, weapons: [{ kind: "barbette", weapon: "particle" }] });
    expect(line(armed, "Particle Barbette")).toMatchObject({ tons: 5, cost: 8, power: 15 });
    expect(armed.hardpoints.used).toBe(1);
  });

  it("takes three firmpoints for a barbette on a small hull, and two more tons for a missile one", () => {
    const boat = sheet({
      ...BASE,
      hull: { tons: 80, configuration: "standard" },
      weapons: [{ kind: "barbette", weapon: "missile" }],
    });
    expect(line(boat, "Missile Barbette").tons).toBe(7);
    expect(boat.hardpoints).toMatchObject({ available: 3, used: 3, firmpoints: true });
  });

  it("sizes a bay by the bay and prices it by the weapon", () => {
    const small = sheet({ ...CAPITAL, weapons: [{ kind: "bay", size: "small", weapon: "particleBeam" }] });
    expect(line(small, "Particle Beam Bay")).toMatchObject({ tons: 50, cost: 20, power: 30 });
    const large = sheet({ ...CAPITAL, weapons: [{ kind: "bay", size: "large", weapon: "particleBeam" }] });
    expect(line(large, "Particle Beam Bay")).toMatchObject({ tons: 500, cost: 60, power: 80 });
    expect(large.hardpoints.used).toBe(5);
  });

  it("scales a spinal mount by its multiple, as the book's worked example does", () => {
    // Page 36: a 15,000-ton meson spinal mount, so two multiples of 7,500,
    // consumes 2,000 Power, deals 12D and costs MCr4000.
    const meson = sheet({
      ...CAPITAL,
      hull: { tons: 40_000, configuration: "standard" },
      weapons: [{ kind: "spinal", weapon: "meson", multiple: 2 }],
    });
    expect(line(meson, "Meson Spinal Mount x2")).toMatchObject({ tons: 15_000, cost: 4_000, power: 2_000 });
    expect(meson.hardpoints.used).toBe(150);
  });

  it("shrinks a spinal mount built above its Tech Level and charges for it", () => {
    const advanced = sheet({
      ...CAPITAL,
      tl: 15,
      hull: { tons: 40_000, configuration: "standard" },
      weapons: [{ kind: "spinal", weapon: "meson", multiple: 2, levelsAboveBase: 3 }],
    });
    // Three levels above TL12: a fifth off the tonnage, three tenths on the price.
    expect(line(advanced, "Meson Spinal Mount x2")).toMatchObject({ tons: 12_000, cost: 5_200 });
  });

  it("refuses a spinal mount over half the ship", () => {
    const overgrown = sheet({
      ...CAPITAL,
      hull: { tons: 10_000, configuration: "standard" },
      weapons: [{ kind: "spinal", weapon: "meson", multiple: 1 }],
    });
    expect(errors(overgrown)).toContain("A spinal mount cannot exceed half the tonnage of the ship carrying it.");
  });

  it("gives a screen no hardpoint but a gunner, and a point defence battery both", () => {
    const screened = sheet({ ...CAPITAL, tl: 15, weapons: [{ kind: "screen", screen: "mesonScreen" }] });
    expect(line(screened, "Meson Screen")).toMatchObject({ tons: 10, cost: 20, power: 30 });
    expect(screened.hardpoints.used).toBe(0);

    const defended = sheet({ ...CAPITAL, weapons: [{ kind: "pointDefence", battery: "laser", type: "typeII" }] });
    expect(line(defended, "Point Defence Laser Battery Type II")).toMatchObject({ tons: 20, cost: 10 });
    expect(defended.hardpoints.used).toBe(1);
  });

  it("crews bays and spinal mounts at military rates on a civilian ship, and says so", () => {
    const civilian = sheet({
      ...CAPITAL,
      military: false,
      weapons: [{ kind: "bay", size: "large", weapon: "missile" }],
    });
    const gunners = civilian.crew.find((entry) => entry.role === "gunner")?.count ?? 0;
    // Four for a large bay, then the three-quarters reduction a 20,000-ton hull gets.
    expect(gunners).toBe(3);
    expect(civilian.problems.map((problem) => problem.message)).toContain(
      "Bay and spinal weapons require military crewing, so they are crewed at military rates.",
    );
  });

  it("buys ordnance by the ton it comes in", () => {
    const loaded = sheet({
      ...CAPITAL,
      ordnance: [
        { missile: "standard", count: 24 },
        { torpedo: "nuclear", count: 6 },
        { canister: "sand", count: 40 },
      ],
    });
    expect(line(loaded, "Standard Missile x24")).toMatchObject({ tons: 2, cost: 0.5 });
    expect(line(loaded, "Nuclear Torpedo x6")).toMatchObject({ tons: 2, cost: 0.45 });
    expect(line(loaded, "Sand Canister x40")).toMatchObject({ tons: 2, cost: 0.05 });
  });

  it("discounts the power of a weapon on a firmpoint by a quarter", () => {
    const fighter = sheet({
      ...BASE,
      hull: { tons: 20, configuration: "standard" },
      bridge: { kind: "cockpit" },
      weapons: [{ kind: "turret", mount: "single", weapons: ["beamLaser"] }],
    });
    // A single turret and a beam laser want 5; three quarters of that, rounded up.
    expect(line(fighter, "Single Turret").power).toBe(4);
  });
});
