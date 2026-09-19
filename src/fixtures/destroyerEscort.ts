/**
 * Destroyer Escort, Chrysanthemum class. High Guard Update 2022, PDF page 208.
 * ShipSpec 7.5.
 *
 * The capital-ship fixture, and the one the Spacecraft Options chapter was
 * needed for. It reconciles exactly: 968 tons of components in a 1,000-ton
 * hull leaving the 32 of cargo printed, and MCr621.78 to the credit.
 *
 * It is also where three rules earned their keep at once. Its seven engineers
 * come out of 229 tons of machinery only under the rounding of ShipSpec
 * 4.10.2.1. Its twenty gunners are two apiece for three barbettes and seven
 * turrets. And its 414 tons of fuel need the power plant's monthly round-up
 * applied twice over, for eight weeks.
 *
 * Its ammunition is 384 missiles and 640 sandcaster canisters, which the sheet
 * carries as 32 tons each with the cost column empty. That is not an oversight:
 * put the MCr8.8 of ordnance into the ship's price and the printed total and
 * purchase cost both stop working. ShipSpec 4.9.5.1.
 */

import type { Design } from "../engine/design";

export const DESTROYER_ESCORT: Design = {
  name: "Destroyer Escort",
  tl: 15,
  standardDesign: true,
  military: true,
  hull: { tons: 1_000, configuration: "closeStructure", specialised: ["reinforced"] },
  armour: { type: "bondedSuperdense", protection: 2 },
  manoeuvre: 6,
  jump: 4,
  powerPlant: { type: "fusion15", tons: 64, weeks: 8 },
  bridge: { kind: "standard", holographic: true },
  computer: { processing: 35, fib: true },
  sensors: "advanced",
  weapons: [
    { kind: "barbette", weapon: "fusion" },
    { kind: "barbette", weapon: "particle", quantity: 2 },
    { kind: "turret", mount: "triple", weapons: ["missileRack", "missileRack", "missileRack"], quantity: 2 },
    { kind: "turret", mount: "triple", weapons: ["sandcaster", "sandcaster", "sandcaster"], quantity: 5 },
  ],
  ordnance: [
    { missile: "standard", count: 384 },
    { canister: "sand", count: 640 },
  ],
  craft: [{ label: "Pinnace", tons: 40, cost: 9.68, kind: "smallCraft", berth: "dockingSpace" }],
  systems: [
    { perTon: "fuelProcessor", tons: 10 },
    { fuelScoops: true },
    { flat: "armoury", quantity: 2 },
    { flat: "medicalBay" },
    { perTon: "repairDrones" },
  ],
  staterooms: 24,
  // Twenty-four staterooms for a crew of thirty-nine only works with two to a
  // room, which page 25 calls common on military ships and charges nothing for.
  // The book's sheet prints "Standard x24" and does not record the choice.
  doubleOccupancy: true,
  commonAreaTons: 24,
  software: [
    { software: "manoeuvre" },
    { software: "intellect" },
    { software: "library" },
    { software: "jumpControl", level: 4 },
    { software: "autoRepair", level: 1 },
    { software: "evade", level: 2 },
    { software: "fireControl", level: 2 },
  ],
};
