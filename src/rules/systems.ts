/**
 * Step 9, Install Optional Systems: the Spacecraft Options the fixtures and the
 * next few standard ships need. High Guard Update 2022, PDF pages 50-64.
 * ShipSpec 4.11.
 *
 * A flat entry has fixed tons and cost. A sized entry is priced per ton of
 * something the designer chooses or the engine works out; the rule says what.
 */

export interface FlatSystemRule {
  readonly kind: "flat";
  readonly label: string;
  readonly page: number;
  readonly tl?: number;
  readonly tons: number;
  /** MCr. */
  readonly cost: number;
  readonly power?: number;
  /**
   * How many of the thing one entry buys, where the book sells them in sets.
   * Drones come five to an entry, and a sheet says "Probe Drones x10" for two.
   */
  readonly units?: number;
}

export interface PerTonSystemRule {
  readonly kind: "perTon";
  readonly label: string;
  readonly page: number;
  readonly tl?: number;
  /** MCr per ton. */
  readonly costPerTon: number;
  readonly powerPerTon?: number;
  readonly minTons?: number;
}

export type SystemRule = FlatSystemRule | PerTonSystemRule;

export type FlatSystem =
  | "cargoScoop"
  | "cargoNet"
  | "sensorStation"
  | "probeDrones"
  | "advancedProbeDrones"
  | "miningDrones"
  | "armoury"
  | "briefingRoom"
  | "workshop";

export type PerTonSystem =
  | "fuelProcessor"
  | "dockingSpace"
  | "fullHangar"
  | "cargoCrane"
  | "repairDrones"
  | "additionalAirlock";

export const FLAT_SYSTEMS: Readonly<Record<FlatSystem, FlatSystemRule>> = {
  cargoScoop: { kind: "flat", label: "Cargo Scoop", page: 53, tons: 2, cost: 0.5 },
  cargoNet: { kind: "flat", label: "Cargo Net", page: 53, tons: 5, cost: 1 },
  sensorStation: { kind: "flat", label: "Sensor Station", page: 53, tons: 1, cost: 0.5 },
  probeDrones: { kind: "flat", label: "Probe Drones", page: 55, tl: 9, tons: 1, cost: 0.5, units: 5 },
  advancedProbeDrones: { kind: "flat", label: "Advanced Probe Drones", page: 55, tl: 12, tons: 1, cost: 0.8, units: 5 },
  miningDrones: { kind: "flat", label: "Mining Drones", page: 55, tl: 12, tons: 10, cost: 1, units: 5 },
  armoury: { kind: "flat", label: "Armoury", page: 59, tons: 1, cost: 0.25 },
  briefingRoom: { kind: "flat", label: "Briefing Room", page: 60, tons: 4, cost: 0.5 },
  workshop: { kind: "flat", label: "Workshop", page: 64, tons: 6, cost: 0.9 },
};

export const PER_TON_SYSTEMS: Readonly<Record<PerTonSystem, PerTonSystemRule>> = {
  /** Each ton refines FUEL_PROCESSOR_TONS_PER_DAY of fuel a day. */
  fuelProcessor: { kind: "perTon", label: "Fuel Processor", page: 50, costPerTon: 0.05, powerPerTon: 1 },
  /** Sized at DOCKING_SPACE_FACTOR of the craft, rounded up. */
  dockingSpace: { kind: "perTon", label: "Docking Space", page: 62, costPerTon: 0.25 },
  /** Sized at FULL_HANGAR_FACTOR of the craft, rounded up. */
  fullHangar: { kind: "perTon", label: "Full Hangar", page: 62, costPerTon: 0.2 },
  /** Sized by cargoCraneTons. */
  cargoCrane: { kind: "perTon", label: "Cargo Crane", page: 53, costPerTon: 1 },
  /** Sized at REPAIR_DRONES_HULL_FRACTION of the hull, minimum 1. */
  repairDrones: { kind: "perTon", label: "Repair Drones", page: 55, tl: 10, costPerTon: 0.2, minTons: 1 },
  additionalAirlock: { kind: "perTon", label: "Additional Airlock", page: 59, costPerTon: 0.1, minTons: 2 },
};

/** Page 50. */
export const FUEL_PROCESSOR_TONS_PER_DAY = 20;

/** Fuel Scoops, page 50: free on a streamlined hull, otherwise this, and no tons. */
export const FUEL_SCOOPS = { label: "Fuel Scoops", page: 50, cost: 1 } as const;

/** Page 62. */
export const DOCKING_SPACE_FACTOR = 1.1;
export const FULL_HANGAR_FACTOR = 2;

/** Page 55. */
export const REPAIR_DRONES_HULL_FRACTION = 0.01;

/** Cargo Crane, page 53: 2.5 tons plus 0.5 per 150 tons of cargo or part. ShipSpec 4.11.2. */
export function cargoCraneTons(cargoTons: number): number {
  return 2.5 + 0.5 * Math.ceil(Math.max(cargoTons, 0) / 150);
}

export function dockingSpaceTons(craftTons: number): number {
  return Math.ceil(craftTons * DOCKING_SPACE_FACTOR);
}

export function fullHangarTons(craftTons: number): number {
  return Math.ceil(craftTons * FULL_HANGAR_FACTOR);
}

export function repairDroneTons(hullTons: number): number {
  return Math.max(PER_TON_SYSTEMS.repairDrones.minTons ?? 1, hullTons * REPAIR_DRONES_HULL_FRACTION);
}
