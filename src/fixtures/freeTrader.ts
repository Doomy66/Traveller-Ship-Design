/**
 * Free Trader, Type A (Beowulf class). High Guard Update 2022, PDF page 172.
 * ShipSpec 7.3.
 *
 * Its costs total to the printed MCr51.38 to the credit. Its tonnage does not
 * balance in either book, and the fixture does not pretend it does: components
 * come to 119 tons of 200, so cargo is 81 where the sheet prints 80.
 * ShipSpec 7.3.2.
 *
 * The passengers are declared rather than printed. The sheet's crew includes a
 * steward, which needs at least one high passenger, and no medic, which caps
 * the total. Ten staterooms less four crew is six, which is what is used here.
 */

import type { Design } from "../engine/design";

export const FREE_TRADER: Design = {
  name: "Free Trader",
  notes:
    "Cargo and passengers along the space lanes, on the cheapest jump-capable hull that pays its way. Ten staterooms and twenty low berths against eighty tons of hold.",
  tl: 12,
  standardDesign: true,
  hull: { tons: 200, configuration: "streamlined" },
  armour: { type: "crystaliron", protection: 2 },
  manoeuvre: 1,
  jump: 1,
  powerPlant: { type: "fusion12", tons: 5, weeks: 4 },
  bridge: { kind: "standard" },
  computer: { processing: 5 },
  sensors: "civilian",
  systems: [{ perTon: "fuelProcessor", tons: 1 }, { fuelScoops: true }, { perTon: "cargoCrane" }],
  staterooms: 10,
  lowBerths: 20,
  commonAreaTons: 10,
  passengers: { high: 6, middle: 0, low: 20 },
  software: [
    { software: "manoeuvre" },
    { software: "jumpControl", level: 1 },
    { software: "library" },
    { software: "intellect" },
  ],
};
