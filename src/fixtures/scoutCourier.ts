/**
 * Scout/Courier, Type S (Suliemann class). High Guard Update 2022, PDF page 161.
 * ShipSpec 7.2.
 *
 * The reference design. Its components come to 89 tons of a 100-ton hull,
 * leaving the 11 of cargo the book prints, and its costs total to MCr41.045 to
 * the credit. Every rule the engine applies to it is confirmed by that.
 */

import type { Design } from "../engine/design";

export const SCOUT_COURIER: Design = {
  name: "Scout/Courier",
  tl: 12,
  standardDesign: true,
  hull: { tons: 100, configuration: "streamlined" },
  armour: { type: "crystaliron", protection: 4 },
  manoeuvre: 2,
  jump: 2,
  powerPlant: { type: "fusion12", tons: 4, weeks: 12 },
  bridge: { kind: "standard" },
  computer: { processing: 5, bis: true },
  sensors: "military",
  weapons: [{ mount: "double" }],
  craft: [{ label: "Air/Raft", tons: 4, cost: 0.25, kind: "vehicle", berth: "dockingSpace" }],
  systems: [
    { perTon: "fuelProcessor", tons: 2 },
    { fuelScoops: true },
    { flat: "probeDrones", quantity: 2 },
    { flat: "workshop" },
  ],
  staterooms: 4,
  software: [
    { software: "manoeuvre" },
    { software: "jumpControl", level: 2 },
    { software: "library" },
    { software: "intellect" },
  ],
};
