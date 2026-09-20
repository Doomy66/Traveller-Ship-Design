/**
 * Patrol Corvette, Type T. High Guard Update 2022, PDF page 188. ShipSpec 7.4.
 *
 * The warship fixture, and the one that proves the weapons chapter: four
 * triple turrets, two of pulse lasers and two of missile racks, whose power
 * draw of 28 the book prints and the engine has to reach the same way.
 *
 * It reconciles exactly. Components come to 357 tons of 400, leaving the 43 of
 * cargo printed, and the costs total to MCr198.26.
 *
 * The book's crew list is not the Crew Requirements table's output and does not
 * claim to be. It adds a medic and eight marines, which no rule in the design
 * sequence generates, and it lists one pilot where the table asks for two,
 * because a carried small craft adds a pilot. The Subsidised Merchant on page
 * 190 says outright what is going on: "the pilot also operates the launch". The
 * sheets print a practical minimum crew; the fixture tests the table.
 * ShipSpec 7.4.1.
 */

import type { Design } from "../engine/design";

export const PATROL_CORVETTE: Design = {
  name: "Patrol Corvette",
  notes:
    "Customs patrol, anti-piracy and system defence. Four turrets, a ship's boat to board with and a G/carrier to follow anyone who runs for the ground.",
  tl: 12,
  standardDesign: true,
  hull: { tons: 400, configuration: "streamlined" },
  armour: { type: "crystaliron", protection: 4 },
  manoeuvre: 4,
  jump: 3,
  powerPlant: { type: "fusion12", tons: 20, weeks: 4 },
  bridge: { kind: "standard" },
  computer: { processing: 15 },
  sensors: "military",
  weapons: [
    { kind: "turret", mount: "triple", weapons: ["pulseLaser", "pulseLaser", "pulseLaser"], quantity: 2 },
    { kind: "turret", mount: "triple", weapons: ["missileRack", "missileRack", "missileRack"], quantity: 2 },
  ],
  craft: [
    { label: "Ship's Boat", tons: 30, cost: 7.58, kind: "smallCraft", berth: "dockingSpace" },
    { label: "G/carrier", tons: 15, cost: 11.58, kind: "vehicle", berth: "dockingSpace" },
  ],
  systems: [{ perTon: "fuelProcessor", tons: 4 }, { fuelScoops: true }],
  staterooms: 12,
  lowBerths: 4,
  commonAreaTons: 10,
  software: [
    { software: "manoeuvre" },
    { software: "jumpControl", level: 3 },
    { software: "library" },
    { software: "intellect" },
    { software: "evade", level: 1 },
    { software: "fireControl", level: 1 },
  ],
};
