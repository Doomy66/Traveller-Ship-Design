/**
 * Step 8, Install Weapons: hardpoints, turrets and fixed mounts, and the weapons
 * that go in them. High Guard Update 2022, PDF pages 27-29. ShipSpec 4.9.
 *
 * Barbettes, bays, spinal mounts, ammunition and screens are not yet here.
 * ShipSpec 9.2.
 */

/** One hardpoint per this many tons of hull. Page 27. ShipSpec 4.9.1. */
export const TONS_PER_HARDPOINT = 100;

/** Firmpoints table, page 27: ships under 100 tons. ShipSpec 4.9.1. */
export function firmpoints(hullTons: number): number {
  if (hullTons >= TONS_PER_HARDPOINT) return 0;
  if (hullTons >= 70) return 3;
  if (hullTons >= 35) return 2;
  return 1;
}

export function hardpoints(hullTons: number): number {
  return Math.floor(hullTons / TONS_PER_HARDPOINT);
}

/** A weapon on a firmpoint needs a quarter less power, rounded up. Page 27. */
export const FIRMPOINT_POWER_FACTOR = 0.75;

export type MountKind = "fixed" | "single" | "double" | "triple";

export interface MountRule {
  readonly label: string;
  /** Undefined where the book prints none. */
  readonly tl?: number;
  readonly power: number;
  readonly tons: number;
  /** MCr. */
  readonly cost: number;
  /** Weapons the mount can carry. */
  readonly weapons: number;
  readonly hardpoints: number;
}

/** Turrets table, page 29. ShipSpec 4.9.2. */
export const MOUNTS: Readonly<Record<MountKind, MountRule>> = {
  fixed: { label: "Fixed Mount", power: 0, tons: 0, cost: 0.1, weapons: 3, hardpoints: 1 },
  single: { label: "Single Turret", tl: 7, power: 1, tons: 1, cost: 0.2, weapons: 1, hardpoints: 1 },
  double: { label: "Double Turret", tl: 8, power: 1, tons: 1, cost: 0.5, weapons: 2, hardpoints: 1 },
  triple: { label: "Triple Turret", tl: 9, power: 1, tons: 1, cost: 1, weapons: 3, hardpoints: 1 },
};

/** Pop-Up Mounting, page 29: applied to any mount. */
export const POP_UP_MOUNTING = { label: "Pop-Up Mounting", tl: 10, power: 0, tons: 1, cost: 1 } as const;

export type WeaponRange = "adjacent" | "close" | "short" | "medium" | "long" | "veryLong" | "distant" | "special";

export type TurretWeapon =
  | "beamLaser"
  | "fusionGun"
  | "laserDrill"
  | "missileRack"
  | "particleBeam"
  | "plasmaGun"
  | "pulseLaser"
  | "railgun"
  | "sandcaster";

export interface TurretWeaponRule {
  readonly label: string;
  readonly tl: number;
  readonly range: WeaponRange;
  readonly power: number;
  /** As printed: dice, or Special. */
  readonly damage: string;
  /** MCr. */
  readonly cost: number;
  readonly traits: readonly string[];
  /** Missile racks in a turret hold this many missiles; four on a firmpoint. Page 29. */
  readonly ammunition?: { turret: number; firmpoint: number };
}

/** Turret Weapons table, page 29. ShipSpec 4.9.3. */
export const TURRET_WEAPONS: Readonly<Record<TurretWeapon, TurretWeaponRule>> = {
  beamLaser: { label: "Beam Laser", tl: 10, range: "medium", power: 4, damage: "1D", cost: 0.5, traits: [] },
  fusionGun: { label: "Fusion Gun", tl: 14, range: "medium", power: 12, damage: "4D", cost: 2, traits: ["Radiation"] },
  laserDrill: { label: "Laser Drill", tl: 8, range: "adjacent", power: 4, damage: "2D", cost: 0.15, traits: ["AP 4"] },
  missileRack: { label: "Missile Rack", tl: 7, range: "special", power: 0, damage: "4D", cost: 0.75, traits: ["Smart"], ammunition: { turret: 12, firmpoint: 4 } },
  particleBeam: { label: "Particle Beam", tl: 12, range: "veryLong", power: 8, damage: "3D", cost: 4, traits: ["Radiation"] },
  plasmaGun: { label: "Plasma Gun", tl: 11, range: "medium", power: 6, damage: "3D", cost: 2.5, traits: [] },
  pulseLaser: { label: "Pulse Laser", tl: 9, range: "long", power: 4, damage: "2D", cost: 1, traits: [] },
  railgun: { label: "Railgun", tl: 10, range: "short", power: 2, damage: "2D", cost: 1, traits: ["AP 4"] },
  sandcaster: { label: "Sandcaster", tl: 9, range: "special", power: 0, damage: "Special", cost: 0.25, traits: [] },
};
