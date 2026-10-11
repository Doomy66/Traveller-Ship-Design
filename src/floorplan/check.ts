/**
 * What a plan has placed, what it is missing, and what is wrong with it.
 * FloorPlanSpec sections 5, 6 and 9.
 *
 * `check` is pure, as the sheet is: same manifest, same plan, same answer.
 * The screen draws what it says and works nothing out for itself.
 */

import { regions } from "./geometry";
import type { Component, ComponentGroup, Manifest } from "./manifest";
import { SQUARES_PER_TON } from "./manifest";
import type { FloorPlan } from "./plan";
import { ACCESS_KINDS, allSquares, baseKey, CELL, CORRIDOR } from "./plan";

/** The whole ship may be this far either way of two squares a ton. FP 5.3. */
export const SHIP_TOLERANCE = 0.1;

export type Status = "met" | "short" | "over" | "unplaced";

export interface Tally {
  readonly key: string;
  readonly label: string;
  readonly group: ComponentGroup;
  readonly target: number;
  readonly placed: number;
  readonly required: boolean;
  readonly status: Status;
  /** For staterooms: rooms wanted and rooms drawn. FP 5.4. */
  readonly rooms?: { readonly wanted: number; readonly drawn: number };
  /** Squares placed for each of a component's several things, by number. */
  readonly instances?: Readonly<Record<number, number>>;
}

export interface Orphan {
  readonly key: string;
  readonly label: string;
  readonly squares: number;
}

export interface PlanProblem {
  readonly severity: "warning" | "note";
  readonly message: string;
  /** The FloorPlanSpec clause the rule is in. */
  readonly clause: string;
}

export interface Report {
  readonly tallies: readonly Tally[];
  readonly orphans: readonly Orphan[];
  readonly corridor: number;
  /** Every non-empty square, corridors and orphans included. FP 5.3. */
  readonly total: number;
  readonly ship: { readonly target: number; readonly low: number; readonly high: number };
  /** Decks with no way to the first deck. FP 6.2. */
  readonly cutOff: readonly number[];
  readonly problems: readonly PlanProblem[];
}

/** Squares, to the quarter: a cell is a quarter of a square. */
export const formatSquares = (n: number): string => String(Math.round(n * 100) / 100);
const squares = (n: number) => `${formatSquares(n)} ${n === 1 ? "square" : "squares"}`;

/** How much of a square one cell is. FP 4.2.1. */
const PER_CELL = CELL * CELL;

function statusOf(component: Component, placed: number): Status {
  if (placed === 0) return component.required ? "short" : "unplaced";
  if (placed < component.target) return "short";
  if (placed > component.target) return "over";
  return "met";
}

export function check(manifest: Manifest, plan: FloorPlan): Report {
  const problems: PlanProblem[] = [];
  const warn = (message: string, clause: string) => problems.push({ severity: "warning", message, clause });
  const note = (message: string, clause: string) => problems.push({ severity: "note", message, clause });

  // Count every square by the component it belongs to.
  const placed = new Map<string, number>();
  const instances = new Map<string, Record<number, number>>();
  let corridor = 0;
  let total = 0;
  for (const square of allSquares(plan)) {
    total += PER_CELL;
    if (square.owner === CORRIDOR) {
      corridor += PER_CELL;
      continue;
    }
    const key = baseKey(square.owner);
    placed.set(key, (placed.get(key) ?? 0) + PER_CELL);
    const hash = square.owner.indexOf("#");
    if (hash !== -1) {
      const n = Number(square.owner.slice(hash + 1));
      const counts = instances.get(key) ?? {};
      counts[n] = (counts[n] ?? 0) + PER_CELL;
      instances.set(key, counts);
    }
  }

  // Rooms drawn for each component, counted over every deck. FP 5.4.
  const roomsDrawn = new Map<string, number>();
  for (const deck of plan.decks) {
    for (const region of regions(deck)) {
      const key = baseKey(region.owner);
      roomsDrawn.set(key, (roomsDrawn.get(key) ?? 0) + 1);
    }
  }

  const known = new Set(manifest.components.map((c) => c.key));
  // Components not started are listed together, so a new plan opens on one
  // line of what is left rather than a warning for every part of the ship.
  const untouched: string[] = [];
  const tallies: Tally[] = manifest.components.map((component) => {
    const count = placed.get(component.key) ?? 0;
    const status = statusOf(component, count);
    if (status === "short" && count === 0) {
      untouched.push(component.label);
    } else if (status === "short") {
      warn(`${component.label} has ${squares(count)} of ${component.target}.`, "5.2");
    } else if (status === "over") {
      warn(`${component.label} has ${squares(count)}, ${formatSquares(count - component.target)} more than its ${component.target}.`, "5.2");
    }
    let rooms: Tally["rooms"];
    if (component.key === "staterooms") {
      rooms = { wanted: component.rooms, drawn: count === 0 ? 0 : (roomsDrawn.get(component.key) ?? 0) };
      // Too many rooms is wrong at once; too few only once all the squares are down,
      // since until then the rest are simply not drawn yet.
      const tooMany = rooms.drawn > rooms.wanted;
      const tooFew = rooms.drawn < rooms.wanted && count >= component.target;
      if (tooMany || tooFew) {
        warn(
          `${rooms.wanted} staterooms are drawn as ${rooms.drawn} ${rooms.drawn === 1 ? "room" : "rooms"}.`,
          "5.4",
        );
      }
    }
    const its = instances.get(component.key);
    return {
      key: component.key,
      label: component.label,
      group: component.group,
      target: component.target,
      placed: count,
      required: component.required,
      status,
      ...(rooms === undefined ? {} : { rooms }),
      ...(its === undefined ? {} : { instances: its }),
    };
  });

  if (untouched.length > 0) {
    problems.unshift({
      severity: "warning",
      message: `Not placed yet: ${untouched.join(", ")}.`,
      clause: "5.2",
    });
  }

  // Squares whose component the design no longer has. FP 5.5 and 9.2.
  const orphans: Orphan[] = [];
  for (const [key, count] of placed) {
    if (known.has(key)) continue;
    const label = plan.remembered[key]?.label ?? key;
    orphans.push({ key, label, squares: count });
    warn(`${squares(count)} belong to ${label}, which the design no longer has.`, "9.2");
  }

  // Components whose tonnage moved since the plan was saved. FP 9.3.
  for (const component of manifest.components) {
    const was = plan.remembered[component.key];
    if (was !== undefined && was.tons !== component.tons) {
      note(`${component.label} was ${was.tons} tons when the plan was drawn and is ${component.tons} now.`, "9.3");
    }
  }

  // The whole ship, ten per cent either way. FP 5.3.
  const target = manifest.usableTons * SQUARES_PER_TON;
  const low = Math.ceil(target * (1 - SHIP_TOLERANCE));
  const high = Math.floor(target * (1 + SHIP_TOLERANCE));
  // Only once every required component is started: until then the total is
  // short because the plan is unfinished, which the list above already says.
  if (total > 0 && untouched.length === 0 && (total < low || total > high)) {
    warn(`The plan covers ${squares(total)}, outside the ${low} to ${high} a ${manifest.usableTons}-ton ship allows.`, "5.3");
  }

  // Every deck joined to the first, through lifts, hatches and stairs that line up. FP 6.1, 6.2.
  const cutOff = unreachableDecks(plan);
  for (const deck of cutOff) {
    warn(`${plan.decks[deck]?.name ?? `Deck ${deck + 1}`} has no lift, hatch or stairs to the rest of the ship.`, "6.2");
  }

  return {
    tallies,
    orphans,
    corridor,
    total,
    ship: { target, low, high },
    cutOff,
    problems,
  };
}

/**
 * Decks that cannot be reached from the first. Two decks are joined where
 * each has an access fixture on the same square (FP 4.3.1). An empty deck is
 * not counted as cut off; there is nothing on it to reach.
 */
export function unreachableDecks(plan: FloorPlan): number[] {
  if (plan.decks.length < 2) return [];
  const shafts = new Map<string, Set<number>>();
  for (const fixture of plan.fixtures) {
    if ("edge" in fixture || !(ACCESS_KINDS as readonly string[]).includes(fixture.kind)) continue;
    const at = `${fixture.x},${fixture.y}`;
    const decks = shafts.get(at) ?? new Set<number>();
    decks.add(fixture.deck);
    shafts.set(at, decks);
  }
  const reached = new Set<number>([0]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const decks of shafts.values()) {
      if (decks.size < 2) continue;
      const touches = [...decks].some((d) => reached.has(d));
      if (!touches) continue;
      for (const d of decks) {
        if (!reached.has(d)) {
          reached.add(d);
          grew = true;
        }
      }
    }
  }
  return plan.decks
    .map((deck, at) => ({ deck, at }))
    .filter(({ deck, at }) => !reached.has(at) && Object.keys(deck.cells).length > 0)
    .map(({ at }) => at);
}
