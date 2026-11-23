/**
 * Starship automation. An optional rule from the *Traveller Companion Update
 * 2024*, page 178, not from High Guard. ShipSpec 4.10.4.
 *
 * Automation is priced as a share of the hull, drives and power plant, and
 * scales the crew the ship needs. It reaches only the jobs that can be shared:
 * a ship that needs one astrogator still needs one, and every craft flown at
 * once still wants its own pilot. The roles it scales are the ones High Guard
 * already lets a large ship cut (`reducible` in crew.ts).
 */

export type AutomationLevel = "crewIntensive" | "low" | "standard" | "enhanced" | "advanced" | "high";

export interface AutomationRule {
  readonly label: string;
  /** Fraction of the hull, drives and power plant's cost, added or taken off. */
  readonly costFraction: number;
  /** What the shareable crew counts are multiplied by. */
  readonly crewFactor: number;
  /** The DM it puts on shipboard tasks, said in a few words, or nothing. */
  readonly effect?: string;
}

export const AUTOMATION: Readonly<Record<AutomationLevel, AutomationRule>> = {
  crewIntensive: { label: "Crew-intensive", costFraction: -0.4, crewFactor: 2, effect: "DM-4 to all shipboard tasks" },
  low: { label: "Low Automation", costFraction: -0.2, crewFactor: 1.4, effect: "DM-1 to all shipboard tasks after a week in space" },
  standard: { label: "Standard Automation", costFraction: 0, crewFactor: 1 },
  enhanced: { label: "Enhanced Automation", costFraction: 0.25, crewFactor: 0.9 },
  advanced: { label: "Advanced Automation", costFraction: 0.5, crewFactor: 0.75, effect: "DM+1 to all shipboard tasks" },
  high: { label: "High Automation", costFraction: 1, crewFactor: 0.6, effect: "DM+2 to all shipboard tasks" },
};

/** The sheet sections whose cost automation is a share of. */
export const AUTOMATED_SECTIONS: readonly string[] = ["Hull", "M-Drive", "R-Drive", "J-Drive", "Power Plant"];
