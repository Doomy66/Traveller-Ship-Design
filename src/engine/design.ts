/**
 * A design: what the designer chose. ShipSpec 3.
 *
 * Only choices live here. Anything the rules can work out is worked out by
 * sheet(), so a design never holds a figure that could disagree with the book.
 * Absent means none, never a default the rules did not give. ShipSpec 3.3.
 */

import type {
  ArmourType,
  CockpitKind,
  FlatSystem,
  HullConfiguration,
  HullOption,
  MountKind,
  PerTonSystem,
  PowerPlantType,
  SensorGrade,
  SoftwarePackage,
  SpecialisedHull,
  StealthType,
  TurretWeapon,
} from "../rules/index";

/** The spec version a saved design was written under. ShipSpec 8.1. */
export const DESIGN_VERSION = 1;

export interface HullChoice {
  readonly tons: number;
  readonly configuration: HullConfiguration;
  /** Reinforced, light, military, non-gravity. They stack. ShipSpec 4.1.4. */
  readonly specialised?: readonly SpecialisedHull[];
  readonly options?: readonly HullOption[];
  readonly stealth?: StealthType;
}

export interface ArmourChoice {
  readonly type: ArmourType;
  /** Points of Protection bought, on top of anything the hull came with. */
  readonly protection: number;
}

export interface ReactionChoice {
  readonly thrust: number;
  /** Hours of burn the fuel tankage is sized for. ShipSpec 4.5.3. */
  readonly hours: number;
}

export interface PowerPlantChoice {
  readonly type: PowerPlantType;
  readonly tons: number;
  /** Weeks of operation the fuel tankage is sized for. ShipSpec 4.5.4. */
  readonly weeks: number;
}

export interface BridgeChoice {
  readonly kind: "standard" | "smaller" | CockpitKind;
  readonly command?: boolean;
  readonly holographic?: boolean;
}

export interface ComputerChoice {
  readonly processing: number;
  readonly core?: boolean;
  /** Jump Control specialisation. ShipSpec 4.7.2. */
  readonly bis?: boolean;
  /** Hardened against ion weapons. */
  readonly fib?: boolean;
}

export interface MountChoice {
  readonly mount: MountKind;
  readonly weapons?: readonly TurretWeapon[];
  readonly popUp?: boolean;
  /** How many identical mounts this line stands for. */
  readonly quantity?: number;
}

export interface CraftChoice {
  readonly label: string;
  readonly tons: number;
  /** MCr. The book prices an air/raft at MCr0.25 on its sheets. ShipSpec 4.11.3. */
  readonly cost: number;
  /** A small craft adds a pilot to the crew; a vehicle does not. */
  readonly kind: "smallCraft" | "vehicle";
  readonly berth: "dockingSpace" | "fullHangar" | "none";
}

export type SystemChoice =
  | { readonly flat: FlatSystem; readonly quantity?: number }
  /**
   * Tons may be left out where the rules size the system themselves: repair
   * drones from the hull, a cargo crane from the cargo. ShipSpec 4.11.2.
   */
  | { readonly perTon: PerTonSystem; readonly tons?: number }
  | { readonly fuelScoops: true }
  /** Anything not yet transcribed, so a design is never blocked. ShipSpec 4.11.1.1. */
  | {
      readonly custom: {
        readonly label: string;
        readonly tons?: number;
        readonly cost?: number;
        readonly power?: number;
      };
    };

export interface SoftwareChoice {
  readonly software: SoftwarePackage;
  /** Omitted for a package the book prints without levels. */
  readonly level?: number;
}

export interface PassengerChoice {
  readonly high: number;
  readonly middle: number;
  readonly low: number;
}

export interface Design {
  readonly version?: number;
  readonly name: string;
  /** The shipyard's TL, which caps every component. ShipSpec 2.4. */
  readonly tl: number;
  /** A design in production takes the 10% discount. ShipSpec 4.13.2. */
  readonly standardDesign?: boolean;
  /** Which column of the Crew Requirements table to read. ShipSpec 4.10.2. */
  readonly military?: boolean;
  readonly hull: HullChoice;
  readonly armour?: ArmourChoice;
  /** Thrust. */
  readonly manoeuvre?: number;
  readonly reaction?: ReactionChoice;
  /** Jump rating. */
  readonly jump?: number;
  readonly powerPlant: PowerPlantChoice;
  /** Tankage beyond what the drives and plant need. ShipSpec 4.5.5. */
  readonly extraFuelTons?: number;
  readonly bridge: BridgeChoice;
  readonly computer?: ComputerChoice;
  readonly sensors?: SensorGrade;
  readonly weapons?: readonly MountChoice[];
  readonly craft?: readonly CraftChoice[];
  readonly systems?: readonly SystemChoice[];
  readonly staterooms?: number;
  readonly doubleOccupancy?: boolean;
  readonly lowBerths?: number;
  readonly emergencyLowBerths?: number;
  readonly commonAreaTons?: number;
  readonly passengers?: PassengerChoice;
  readonly software?: readonly SoftwareChoice[];
}
