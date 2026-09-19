/**
 * The design, as the steps of the checklist on page 10. ShipSpec 4 and 10.
 *
 * **Every step folds, and says what is in it when folded.** A ship has fifteen
 * sections and most sessions touch three of them; left open they were eleven
 * screens of scrolling. Shut, the whole design is one screen and each heading
 * carries its own précis, so the shape of the ship can be read without opening
 * anything.
 *
 * **A step is a grid and its fields are `display: contents`.** The names land in
 * one column and the controls in the next, each column as wide as its widest
 * member and no wider. That is what makes the thing line up without also making
 * a Tech Level as wide as a ship's name.
 *
 * **Two ways to change the design, and the difference matters.** `update` alters
 * a value: the sheet redraws and the form is left alone, so the scroll position
 * and whatever has focus survive. `rebuild` is for a change that adds or removes
 * a control, or one the précis must show, and only then is the form drawn again.
 *
 * Because the form outlives most changes, no handler may close over the design
 * it was drawn from: one that did would write back a snapshot taken before the
 * last few edits and silently undo them. Every handler reads `host.design` at
 * the moment it fires.
 */

import {
  ARMOUR_TYPES,
  BARBETTES,
  BAY_SIZES,
  BAY_WEAPONS,
  CANISTERS,
  COMPUTERS,
  FLAT_SYSTEMS,
  GRADES,
  HULL_CONFIGURATIONS,
  HULL_OPTIONS,
  MISSILES,
  MOUNTS,
  PER_HULL_TON_SYSTEMS,
  PER_TON_SYSTEMS,
  POINT_DEFENCE,
  POWER_PLANTS,
  SCREENS,
  SENSORS,
  SOFTWARE,
  SOLAR_SYSTEMS,
  SPECIALISED_HULLS,
  SPINAL_WEAPONS,
  STEALTH_TYPES,
  TORPEDOES,
  TRAITS,
  TURRET_WEAPONS,
} from "../rules/index";
import type { Trait, TraitCategory, TurretWeapon } from "../rules/index";
import type {
  CraftChoice,
  Customisation,
  Design,
  JumpChoice,
  ManoeuvreChoice,
  OrdnanceChoice,
  ReactionChoice,
  SoftwareChoice,
  SystemChoice,
  WeaponChoice,
} from "../engine/design";
import { clear, el } from "./dom";
import {
  button,
  check,
  checkSet,
  labelled,
  listEditor,
  number,
  optionsOf,
  rowBreak,
  select,
  text,
} from "./controls";
import type { Option } from "./controls";

export interface FormHost {
  /** Read afresh by every handler. Never captured. */
  readonly design: Design;
  /** A value changed. Redraw the sheet and leave the form standing. */
  update(patch: Partial<Design>): void;
  /** A control appeared or vanished, or a précis moved. Draw the form again. */
  rebuild(patch: Partial<Design>): void;
}

export const STEP_IDS = [
  "ship", "hull", "armour", "drives", "power", "fuel", "bridge", "computer",
  "sensors", "weapons", "ordnance", "craft", "systems", "quarters", "software",
] as const;

/**
 * Which steps are open, held out here so a rebuild does not shut what the
 * designer opened. A new session starts on the hull.
 */
const opened = new Set<string>(["hull"]);

/** Open or shut every step at once. */
export function setAllOpen(open: boolean): void {
  opened.clear();
  if (open) for (const id of STEP_IDS) opened.add(id);
}

export function anyOpen(root?: Element): boolean {
  if (root === undefined) return opened.size > 0;
  return root.querySelector(".step[open]") !== null;
}

/**
 * Take the open steps from the page before it is torn down.
 *
 * A `<details>` fires its toggle asynchronously, so a rebuild that happens in
 * the same tick as a click would rebuild from a set that had not heard about it
 * yet, and shut the step the designer had just opened. The DOM knows straight
 * away, so the DOM is what is read.
 */
function readOpenState(into: Element): void {
  const steps = into.querySelectorAll<HTMLDetailsElement>("details.step[data-step]");
  if (steps.length === 0) return;
  opened.clear();
  for (const node of steps) {
    const id = node.dataset["step"];
    if (id !== undefined && node.open) opened.add(id);
  }
}

export function renderForm(into: Element, host: FormHost): void {
  readOpenState(into);
  clear(into);
  for (const section of [
    ship, hull, armour, drives, powerPlant, fuel, bridge, computer, sensors,
    weapons, ordnance, craft, systems, accommodation, software,
  ]) {
    into.append(section(host));
  }
}

/**
 * One step: a heading that folds, carrying its number, its name and a précis of
 * what is inside, then a grid of fields. Each inner array is one line of that
 * grid, so fields that belong together stay together.
 */
function step(
  id: string,
  index: string,
  heading: string,
  precis: string,
  rows: readonly (readonly (Element | null)[])[],
): Element {
  const body = el("div", { class: "step-body" });
  let first = true;
  for (const row of rows) {
    const items = row.filter((item): item is Element => item !== null);
    if (items.length === 0) continue;
    if (!first) body.append(rowBreak());
    first = false;
    body.append(...items);
  }

  const details = el("details", { class: "step", "data-step": id, open: opened.has(id) }, [
    el("summary", {}, [
      el("span", { class: "step-no" }, [index]),
      el("span", { class: "step-name" }, [heading]),
      el("span", { class: "step-precis" }, [precis]),
    ]),
    body,
  ]);
  return details;
}

/** Merge into one of the design's object fields, reading the live design. */
function into<K extends keyof Design>(host: FormHost, key: K) {
  return (patch: Partial<NonNullable<Design[K]>>, redraw: "update" | "rebuild" = "rebuild"): void => {
    const current = (host.design[key] ?? {}) as object;
    host[redraw]({ [key]: { ...current, ...patch } } as Partial<Design>);
  };
}

/** One of the design's list fields, read live. */
function list<T>(host: FormHost, key: keyof Design): readonly T[] {
  return (host.design[key] as readonly T[] | undefined) ?? [];
}

function count(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

function joined(parts: readonly (string | undefined)[], ifEmpty: string): string {
  const kept = parts.filter((x): x is string => x !== undefined && x !== "");
  return kept.length === 0 ? ifEmpty : kept.join(", ");
}

// ------------------------------------------------------------------ the ship

function ship(host: FormHost): Element {
  const d = host.design;
  const precis = joined([
    `TL${d.tl}`,
    d.standardDesign === true ? "standard design" : "new design",
    d.military === true ? "military" : "commercial",
  ], "");
  return step("ship", "", "The ship", precis, [[
    labelled("Name", text(d.name, (name) => host.rebuild({ name }))),
    labelled("Tech Level", number(d.tl, (tl) => host.rebuild({ tl: tl ?? 12 }), { min: 1, max: 21, step: 1 }),
      "The shipyard's Tech Level, which caps every component."),
  ], [
    check(d.standardDesign === true, "Standard design", (standardDesign) => host.rebuild({ standardDesign }),
      "A design already in production: a tenth off everything but fuel and ammunition."),
    check(d.military === true, "Military crewing", (military) => host.rebuild({ military }),
      "Read the military column of the Crew Requirements table."),
  ]]);
}

// ------------------------------------------------------------------ the hull

function hull(host: FormHost): Element {
  const h = host.design.hull;
  const set = into(host, "hull");
  const precis = joined([
    `${h.tons.toLocaleString()} tons`,
    HULL_CONFIGURATIONS[h.configuration].label,
    ...(h.specialised ?? []).map((k) => SPECIALISED_HULLS[k].label),
    ...(h.options ?? []).map((k) => HULL_OPTIONS[k].label),
    h.stealth === undefined ? undefined : STEALTH_TYPES[h.stealth].label,
    h.pressureHull === true ? "Pressure Hull" : undefined,
  ], "");

  return step("hull", "1", "Create a hull", precis, [
    [
      labelled("Tons", number(h.tons, (tons) => set({ tons: tons ?? 100 }), { min: 5, step: 1 })),
      labelled("Configuration", select(h.configuration, optionsOf(HULL_CONFIGURATIONS), (v) =>
        set({ configuration: v as typeof h.configuration }))),
    ],
    checkSet(h.specialised ?? [], optionsOf(SPECIALISED_HULLS), (specialised) => set({ specialised })),
    [
      ...checkSet(h.options ?? [], optionsOf(HULL_OPTIONS), (options) => set({ options })),
      check(h.pressureHull === true, "Pressure hull", (pressureHull) => set({ pressureHull }),
        "For the deeps of a gas giant. A quarter of the ship, ten times the hull price, and Protection 4."),
    ],
    [
      labelled("Stealth", select(h.stealth, optionsOf(STEALTH_TYPES), (v) =>
        set({ stealth: v === "" ? undefined : (v as typeof h.stealth) }), "None")),
      labelled("Adjustable", select(h.adjustable, [
        { value: "tl12", label: "TL12, 5% of the ship" },
        { value: "tl15", label: "TL15, 1% of the ship" },
      ], (v) => set({ adjustable: v === "" ? undefined : (v as typeof h.adjustable) }), "None"),
        "Bands that let the ship take the outline of any other of its size."),
      labelled("Modular", number(h.modularFraction, (modularFraction) => set({ modularFraction }),
        { min: 0, max: 0.75, step: 0.05, placeholder: "0" }), "The share that can be swapped out, up to 0.75."),
    ],
  ]);
}

// ---------------------------------------------------------------- the armour

function armour(host: FormHost): Element {
  const a = host.design.armour;
  return step("armour", "1b", "Install armour",
    a === undefined ? "none" : `${ARMOUR_TYPES[a.type].label} ${a.protection}`, [[
      labelled("Type", select(a?.type, optionsOf(ARMOUR_TYPES), (v) =>
        host.rebuild({
          armour: v === ""
            ? undefined
            : { type: v as NonNullable<typeof a>["type"], protection: host.design.armour?.protection ?? 1 },
        }), "None")),
      a === undefined ? null : labelled("Protection", number(a.protection, (protection) =>
        into(host, "armour")({ protection: protection ?? 1 }), { min: 1, step: 1 })),
    ]]);
}

// ----------------------------------------------------- customising a component

/** A grade and the traits it allows, for a component built off its own TL. */
function customisation(
  value: Customisation | undefined,
  category: TraitCategory,
  onGrade: (value: Customisation | undefined) => void,
  onTraits: (traits: Trait[]) => void,
): Element[] {
  const allowed = Object.entries(TRAITS)
    .filter(([, rule]) => rule.category === category)
    .filter(([, rule]) => value === undefined || rule.kind === GRADES[value.grade].kind)
    .map(([key, rule]) => ({ value: key, label: rule.slots > 1 ? `${rule.label} (2)` : rule.label }));
  const grade = labelled("Built as", select(value?.grade, optionsOf(GRADES), (v) =>
    onGrade(v === "" ? undefined : { grade: v as Customisation["grade"], traits: [] }), "Standard"),
    "Above or below the component's own Tech Level, which grants advantages or forces disadvantages.");
  return value === undefined
    ? [grade]
    : [grade, ...checkSet(value.traits ?? [], allowed, (chosen) => onTraits(chosen as Trait[]))];
}

// ---------------------------------------------------------------- the drives

function drives(host: FormHost): Element {
  const d = host.design;
  const m: ManoeuvreChoice | undefined = typeof d.manoeuvre === "number" ? { thrust: d.manoeuvre } : d.manoeuvre;
  const j: JumpChoice | undefined = typeof d.jump === "number" ? { rating: d.jump } : d.jump;
  const r = d.reaction;
  const b = d.highBurnThruster;

  const liveM = (): ManoeuvreChoice | undefined =>
    typeof host.design.manoeuvre === "number" ? { thrust: host.design.manoeuvre } : host.design.manoeuvre;
  const liveJ = (): JumpChoice | undefined =>
    typeof host.design.jump === "number" ? { rating: host.design.jump } : host.design.jump;
  const setM = (patch: Partial<ManoeuvreChoice>, how: "update" | "rebuild" = "rebuild") =>
    host[how]({ manoeuvre: { thrust: 0, ...liveM(), ...patch } });
  const setJ = (patch: Partial<JumpChoice>, how: "update" | "rebuild" = "rebuild") =>
    host[how]({ jump: { rating: 1, ...liveJ(), ...patch } });
  const setR = (patch: Partial<ReactionChoice>, how: "update" | "rebuild" = "rebuild") =>
    host[how]({ reaction: { thrust: 0, hours: 1, ...host.design.reaction, ...patch } });
  const setB = (patch: Partial<ReactionChoice>, how: "update" | "rebuild" = "rebuild") =>
    host[how]({ highBurnThruster: { thrust: 0, hours: 1, ...host.design.highBurnThruster, ...patch } });

  const precis = joined([
    m === undefined ? undefined : `Thrust ${m.thrust}`,
    j === undefined ? undefined : `Jump ${j.rating}`,
    r === undefined ? undefined : `Reaction ${r.thrust}`,
    b === undefined ? undefined : `high-burn ${b.thrust}`,
  ], "none");

  return step("drives", "2", "Install drives", precis, [
    [
      labelled("Thrust", number(m?.thrust, (thrust) =>
        thrust === undefined ? host.rebuild({ manoeuvre: undefined }) : setM({ thrust }),
        { min: 0, max: 11, step: 1 }), "The manoeuvre drive. Leave it empty for none."),
      m === undefined ? null : labelled("Sized for", number(m.sizedForTons, (sizedForTons) =>
        setM({ sizedForTons }, "update"), { min: 5, step: 1, placeholder: "hull" }),
        "Tons the drive is built to move, where that is not the hull's own."),
      m === undefined ? null : check(m.concealed === true, "Concealed plates", (concealed) => setM({ concealed }),
        "Hidden behind bulkheads. A quarter more tonnage and price, and half the Thrust."),
    ],
    m === undefined ? [] : customisation(m.customisation, "manoeuvre",
      (c) => setM({ customisation: c }),
      (traits) => setM({ customisation: { grade: liveM()!.customisation!.grade, traits } }, "update")),
    [
      labelled("Jump", number(j?.rating, (rating) =>
        rating === undefined ? host.rebuild({ jump: undefined }) : setJ({ rating }),
        { min: 1, max: 9, step: 1 })),
      j === undefined ? null : labelled("Sized for", number(j.sizedForTons, (sizedForTons) =>
        setJ({ sizedForTons }, "update"), { min: 100, step: 1, placeholder: "hull" })),
    ],
    j === undefined ? [] : customisation(j.customisation, "jump",
      (c) => setJ({ customisation: c }),
      (traits) => setJ({ customisation: { grade: liveJ()!.customisation!.grade, traits } }, "update")),
    [
      labelled("Reaction", number(r?.thrust, (thrust) =>
        thrust === undefined ? host.rebuild({ reaction: undefined }) : setR({ thrust }),
        { min: 0, max: 16, step: 1 }), "A reaction drive, which burns fuel by the hour."),
      r === undefined ? null : labelled("Hours", number(r.hours, (hours) =>
        setR({ hours: hours ?? 1 }, "update"), { min: 0, step: 1 })),
      labelled("High-burn", number(b?.thrust, (thrust) =>
        thrust === undefined ? host.rebuild({ highBurnThruster: undefined }) : setB({ thrust }),
        { min: 0, max: 16, step: 1 }), "A booster whose Thrust adds to the manoeuvre drive's."),
      b === undefined ? null : labelled("Hours", number(b.hours, (hours) =>
        setB({ hours: hours ?? 1 }, "update"), { min: 0, step: 1 })),
    ],
  ]);
}

// ----------------------------------------------------------- the power plant

function powerPlant(host: FormHost): Element {
  const p = host.design.powerPlant;
  const set = into(host, "powerPlant");
  return step("power", "3", "Install power plant",
    `${POWER_PLANTS[p.type].label}, ${p.tons} tons, ${p.weeks} weeks`, [
      [
        labelled("Type", select(p.type, optionsOf(POWER_PLANTS), (v) => set({ type: v as typeof p.type }))),
        labelled("Tons", number(p.tons, (tons) => set({ tons: tons ?? 1 }), { min: 0, step: 1 }),
          "Before any customisation. The plant's output follows this figure."),
        labelled("Weeks", number(p.weeks, (weeks) => set({ weeks: weeks ?? 4 }), { min: 0, step: 1 }),
          "Weeks of fuel carried for the plant."),
      ],
      customisation(p.customisation, "powerPlant",
        (c) => set({ customisation: c }),
        (traits) => set({ customisation: { grade: host.design.powerPlant.customisation!.grade, traits } }, "update")),
    ]);
}

// ------------------------------------------------------------------ the fuel

function fuel(host: FormHost): Element {
  const d = host.design;
  const precis = joined([
    d.fuelForJump === undefined ? undefined : `tanked for jump ${d.fuelForJump}`,
    d.extraFuelTons === undefined || d.extraFuelTons === 0 ? undefined : `${d.extraFuelTons} tons spare`,
  ], "as the drives need");
  return step("fuel", "4", "Install fuel tanks", precis, [[
    labelled("Tank for jump", number(d.fuelForJump, (fuelForJump) => host.rebuild({ fuelForJump }),
      { min: 0, step: 1, placeholder: "drive" }),
      "Lower than the drive where the long jumps ride on drop tanks."),
    labelled("Extra tons", number(d.extraFuelTons, (extraFuelTons) => host.rebuild({ extraFuelTons }),
      { min: 0, step: 1, placeholder: "0" })),
  ]]);
}

// ---------------------------------------------------------------- the bridge

const BRIDGE_KINDS: Record<string, string> = {
  standard: "Standard", smaller: "Smaller", cockpit: "Cockpit", dualCockpit: "Dual cockpit",
};

function bridge(host: FormHost): Element {
  const b = host.design.bridge;
  const set = into(host, "bridge");
  const precis = joined([
    BRIDGE_KINDS[b.kind],
    b.command === true ? "command" : undefined,
    b.holographic === true ? "holographic" : undefined,
    b.detachable === true ? "detachable" : undefined,
  ], "");
  return step("bridge", "5", "Install bridge", precis, [
    [
      labelled("Kind", select(b.kind, [
        { value: "standard", label: "Standard" },
        { value: "smaller", label: "Smaller, DM-1 and half price" },
        { value: "cockpit", label: "Cockpit" },
        { value: "dualCockpit", label: "Dual cockpit" },
      ], (v) => set({ kind: v as typeof b.kind }))),
    ],
    [
      check(b.command === true, "Command", (command) => set({ command }),
        "For a ship leading a squadron. Forty tons and MCr30, over 5,000 tons only."),
      check(b.holographic === true, "Holographic", (holographic) => set({ holographic }),
        "A quarter again on the bridge, and DM+2 on initiative."),
      check(b.detachable === true, "Detachable", (detachable) => set({ detachable }),
        "Ejects as a lifeboat. Half again in cost, a fifth more room."),
    ],
  ]);
}

// -------------------------------------------------------------- the computer

function computer(host: FormHost): Element {
  const c = host.design.computer;
  const options: Option[] = COMPUTERS.map((rule) => ({
    value: `${rule.processing}${rule.core ? "c" : ""}`,
    label: rule.label,
  }));
  const current = c === undefined ? undefined : `${c.processing}${c.core === true ? "c" : ""}`;
  const set = into(host, "computer");
  const precis = c === undefined
    ? "none"
    : `${c.core === true ? "Core" : "Computer"}/${c.processing}${c.bis === true ? "bis" : ""}${c.fib === true ? "fib" : ""}`;
  return step("computer", "6", "Install computer", precis, [
    [
      labelled("Model", select(current, options, (v) => host.rebuild({
        computer: v === ""
          ? undefined
          : { ...host.design.computer, processing: Number.parseInt(v, 10), core: v.endsWith("c") },
      }), "None")),
    ],
    [
      c === undefined ? null : check(c.bis === true, "/bis", (bis) => set({ bis }),
        "Jump Control specialisation: five more Processing for that alone, and half again on the price."),
      c === undefined ? null : check(c.fib === true, "/fib", (fib) => set({ fib }),
        "Hardened against ion weapons, and half again on the price."),
    ],
  ]);
}

// --------------------------------------------------------------- the sensors

function sensors(host: FormHost): Element {
  const grade = host.design.sensors ?? "basic";
  return step("sensors", "7", "Install sensors", SENSORS[grade].label, [[
    labelled("Suite", select(grade, optionsOf(SENSORS), (v) =>
      host.rebuild({ sensors: v as Design["sensors"] }))),
  ]]);
}

// --------------------------------------------------------------- the weapons

/**
 * A mount holds one, two or three weapons, so it gets that many selects and no
 * more. Nine number boxes to say "three pulse lasers" was the wrong shape.
 */
function weaponSlots(
  carried: readonly TurretWeapon[],
  capacity: number,
  onSlot: (slot: number, weapon: TurretWeapon | undefined) => void,
): Element[] {
  const options = optionsOf(TURRET_WEAPONS);
  return Array.from({ length: capacity }, (_, slot) =>
    labelled(
      capacity === 1 ? "Weapon" : `Weapon ${slot + 1}`,
      select(carried[slot] ?? "", options, (v) =>
        onSlot(slot, v === "" ? undefined : (v as TurretWeapon)), "Empty"),
    ),
  );
}

function weapons(host: FormHost): Element {
  const live = () => list<WeaponChoice>(host, "weapons");
  const set = (weapons: WeaponChoice[], how: "update" | "rebuild" = "rebuild") => host[how]({ weapons });
  const replace = (at: number, choice: WeaponChoice, how: "update" | "rebuild" = "rebuild") =>
    set(live().map((entry, i) => (i === at ? choice : entry)), how);
  const at = (index: number) => live()[index] as WeaponChoice;

  const rows = live().map((choice, i) => {
    const parts: (Element | null)[] = [
      labelled("Mounting", select(choice.kind, [
        { value: "turret", label: "Turret or fixed mount" },
        { value: "barbette", label: "Barbette" },
        { value: "bay", label: "Bay" },
        { value: "spinal", label: "Spinal mount" },
        { value: "pointDefence", label: "Point defence battery" },
        { value: "screen", label: "Screen" },
        { value: "blackGlobe", label: "Black globe" },
      ], (v) => replace(i, defaultWeapon(v as WeaponChoice["kind"])))),
    ];

    if (choice.kind === "turret") {
      parts.push(labelled("Mount", select(choice.mount, optionsOf(MOUNTS), (v) => {
        const now = at(i);
        if (now.kind !== "turret") return;
        const mount = v as typeof now.mount;
        // A smaller mount cannot keep everything a larger one held.
        replace(i, { ...now, mount, weapons: (now.weapons ?? []).slice(0, MOUNTS[mount].weapons) });
      })));
      parts.push(...weaponSlots(choice.weapons ?? [], MOUNTS[choice.mount].weapons, (slot, weapon) => {
        const now = at(i);
        if (now.kind !== "turret") return;
        const room = MOUNTS[now.mount].weapons;
        const slots: (TurretWeapon | undefined)[] = Array.from({ length: room }, (_, k) => (now.weapons ?? [])[k]);
        slots[slot] = weapon;
        replace(i, { ...now, weapons: slots.filter((w): w is TurretWeapon => w !== undefined) });
      }));
      parts.push(check(choice.popUp === true, "Pop-up", (popUp) => {
        const now = at(i);
        if (now.kind === "turret") replace(i, { ...now, popUp });
      }, "Concealed in the hull until it fires. A ton and MCr1 more."));
    } else if (choice.kind === "barbette") {
      parts.push(labelled("Weapon", select(choice.weapon, optionsOf(BARBETTES), (v) => {
        const now = at(i);
        if (now.kind === "barbette") replace(i, { ...now, weapon: v as typeof now.weapon });
      })));
    } else if (choice.kind === "bay") {
      parts.push(labelled("Size", select(choice.size, optionsOf(BAY_SIZES), (v) => {
        const now = at(i);
        if (now.kind === "bay") replace(i, { ...now, size: v as typeof now.size });
      })));
      parts.push(labelled("Weapon", select(choice.weapon, optionsOf(BAY_WEAPONS.small), (v) => {
        const now = at(i);
        if (now.kind === "bay") replace(i, { ...now, weapon: v as typeof now.weapon });
      })));
    } else if (choice.kind === "spinal") {
      parts.push(labelled("Weapon", select(choice.weapon, optionsOf(SPINAL_WEAPONS), (v) => {
        const now = at(i);
        if (now.kind === "spinal") replace(i, { ...now, weapon: v as typeof now.weapon });
      })));
      parts.push(labelled("Multiple", number(choice.multiple, (multiple) => {
        const now = at(i);
        if (now.kind === "spinal") replace(i, { ...now, multiple: multiple ?? 1 });
      }, { min: 1, step: 1 }), "Multiples of the weapon's base size. Everything scales together."));
      parts.push(labelled("TLs above", number(choice.levelsAboveBase, (levelsAboveBase) => {
        const now = at(i);
        if (now.kind === "spinal") replace(i, { ...now, levelsAboveBase });
      }, { min: 0, max: 3, step: 1, placeholder: "0" }), "Built above its own Tech Level: smaller, and dearer."));
    } else if (choice.kind === "pointDefence") {
      parts.push(labelled("Battery", select(choice.battery, [
        { value: "laser", label: "Laser" },
        { value: "gauss", label: "Gauss" },
      ], (v) => {
        const now = at(i);
        if (now.kind === "pointDefence") replace(i, { ...now, battery: v as typeof now.battery });
      })));
      parts.push(labelled("Type", select(choice.type, optionsOf(POINT_DEFENCE.laser), (v) => {
        const now = at(i);
        if (now.kind === "pointDefence") replace(i, { ...now, type: v as typeof now.type });
      })));
    } else if (choice.kind === "screen") {
      parts.push(labelled("Screen", select(choice.screen, optionsOf(SCREENS), (v) => {
        const now = at(i);
        if (now.kind === "screen") replace(i, { ...now, screen: v as typeof now.screen });
      })));
    }

    if (choice.kind !== "spinal" && choice.kind !== "blackGlobe") {
      parts.push(labelled("How many", number(choice.quantity ?? 1, (q) => {
        const now = at(i);
        if (now.kind !== "spinal" && now.kind !== "blackGlobe") replace(i, { ...now, quantity: q ?? 1 });
      }, { min: 1, step: 1 })));
    }
    return el("div", { class: "row-fields" }, parts);
  });

  const mounts = live().reduce((sum, c) => sum + ("quantity" in c ? (c.quantity ?? 1) : 1), 0);
  return step("weapons", "8", "Install weapons", mounts === 0 ? "unarmed" : count(mounts, "mounting"), [[
    listEditor(rows, (i) => set(live().filter((_, k) => k !== i)), "Add a mounting", () =>
      set([...live(), { kind: "turret", mount: "single" }])),
  ]]);
}

function defaultWeapon(kind: WeaponChoice["kind"]): WeaponChoice {
  switch (kind) {
    case "barbette": return { kind: "barbette", weapon: "pulseLaser" };
    case "bay": return { kind: "bay", size: "small", weapon: "missile" };
    case "spinal": return { kind: "spinal", weapon: "particle", multiple: 1 };
    case "pointDefence": return { kind: "pointDefence", battery: "laser", type: "typeI" };
    case "screen": return { kind: "screen", screen: "nuclearDamper" };
    case "blackGlobe": return { kind: "blackGlobe" };
    default: return { kind: "turret", mount: "single" };
  }
}

// -------------------------------------------------------------- the ordnance

function ordnance(host: FormHost): Element {
  const live = () => list<OrdnanceChoice>(host, "ordnance");
  const set = (ordnance: OrdnanceChoice[], how: "update" | "rebuild" = "rebuild") => host[how]({ ordnance });
  const replace = (i: number, entry: OrdnanceChoice, how: "update" | "rebuild" = "rebuild") =>
    set(live().map((e, k) => (k === i ? entry : e)), how);

  const rows = live().map((choice, i) => {
    const kind = "missile" in choice ? "missile" : "torpedo" in choice ? "torpedo" : "canister";
    const table = kind === "missile" ? MISSILES : kind === "torpedo" ? TORPEDOES : CANISTERS;
    const current = "missile" in choice ? choice.missile : "torpedo" in choice ? choice.torpedo : choice.canister;
    const rewrite = (type: string, n: number) => ({ [kind]: type, count: n }) as OrdnanceChoice;
    const now = () => {
      const e = live()[i] as OrdnanceChoice;
      const t = "missile" in e ? e.missile : "torpedo" in e ? e.torpedo : e.canister;
      return { type: t, count: e.count };
    };
    return el("div", { class: "row-fields" }, [
      labelled("Kind", select(kind, [
        { value: "missile", label: "Missiles" },
        { value: "torpedo", label: "Torpedoes" },
        { value: "canister", label: "Canisters" },
      ], (v) => replace(i, defaultOrdnance(v)))),
      labelled("Warhead", select(current, optionsOf(table), (v) => replace(i, rewrite(v, now().count)))),
      labelled("How many", number(choice.count, (n) => replace(i, rewrite(now().type, n ?? 0)),
        { min: 0, step: 1 })),
    ]);
  });

  const loads = live().reduce((sum, c) => sum + c.count, 0);
  return step("ordnance", "8b", "Load ordnance", loads === 0 ? "none" : count(loads, "round"), [
    [el("p", { class: "note-line" }, ["Takes room in the ship. Its cost is reported apart, as the book does."])],
    [listEditor(rows, (i) => set(live().filter((_, k) => k !== i)), "Add ordnance", () =>
      set([...live(), { missile: "standard", count: 12 }]))],
  ]);
}

function defaultOrdnance(kind: string): OrdnanceChoice {
  if (kind === "torpedo") return { torpedo: "standard", count: 3 };
  if (kind === "canister") return { canister: "sand", count: 20 };
  return { missile: "standard", count: 12 };
}

// ----------------------------------------------------------- the craft aboard

function craft(host: FormHost): Element {
  const live = () => list<CraftChoice>(host, "craft");
  const set = (craft: CraftChoice[], how: "update" | "rebuild" = "rebuild") => host[how]({ craft });
  const merge = (i: number, patch: Partial<CraftChoice>, how: "update" | "rebuild" = "rebuild") =>
    set(live().map((e, k) => (k === i ? { ...e, ...patch } : e)), how);

  const rows = live().map((entry, i) =>
    el("div", { class: "row-fields" }, [
      labelled("Name", text(entry.label, (label) => merge(i, { label }))),
      labelled("Tons", number(entry.tons, (tons) => merge(i, { tons: tons ?? 0 }), { min: 0, step: 1 })),
      labelled("Cost MCr", number(entry.cost, (cost) => merge(i, { cost: cost ?? 0 }), { min: 0 })),
      labelled("Kind", select(entry.kind, [
        { value: "smallCraft", label: "Small craft" },
        { value: "vehicle", label: "Vehicle" },
      ], (v) => merge(i, { kind: v as CraftChoice["kind"] })), "A small craft adds a pilot; a vehicle does not."),
      labelled("Berth", select(entry.berth, [
        { value: "dockingSpace", label: "Docking space" },
        { value: "fullHangar", label: "Full hangar" },
        { value: "none", label: "None" },
      ], (v) => merge(i, { berth: v as CraftChoice["berth"] }))),
      labelled("Its engines", number(entry.driveAndPlantTons, (driveAndPlantTons) =>
        merge(i, { driveAndPlantTons }), { min: 0, placeholder: "0" }),
        "Its own drives and plant, which count towards the mother ship's engineers."),
    ]),
  );

  return step("craft", "9b", "Carry craft",
    live().length === 0 ? "none" : count(live().length, "craft", "craft"), [[
      listEditor(rows, (i) => set(live().filter((_, k) => k !== i)), "Add a craft", () =>
        set([...live(), { label: "Air/Raft", tons: 4, cost: 0.25, kind: "vehicle", berth: "dockingSpace" }])),
    ]]);
}

// ------------------------------------------------------------ optional systems

function systems(host: FormHost): Element {
  const live = () => list<SystemChoice>(host, "systems");
  const set = (systems: SystemChoice[], how: "update" | "rebuild" = "rebuild") => host[how]({ systems });
  const replace = (i: number, entry: SystemChoice, how: "update" | "rebuild" = "rebuild") =>
    set(live().map((e, k) => (k === i ? entry : e)), how);
  const at = (i: number) => live()[i] as SystemChoice;

  const kindOf = (choice: SystemChoice): string =>
    "flat" in choice ? "flat"
      : "perTon" in choice ? "perTon"
        : "perHullTon" in choice ? "perHullTon"
          : "fuelScoops" in choice ? "fuelScoops"
            : "solar" in choice ? "solar" : "custom";

  const rows = live().map((choice, i) => {
    const parts: (Element | null)[] = [
      labelled("Sold by", select(kindOf(choice), [
        { value: "flat", label: "The unit" },
        { value: "perTon", label: "The ton" },
        { value: "perHullTon", label: "The whole ship" },
        { value: "fuelScoops", label: "Fuel scoops" },
        { value: "solar", label: "Solar" },
        { value: "custom", label: "Something else" },
      ], (v) => replace(i, defaultSystem(v)))),
    ];

    if ("flat" in choice) {
      parts.push(labelled("System", select(choice.flat, optionsOf(FLAT_SYSTEMS), (v) => {
        const now = at(i);
        if ("flat" in now) replace(i, { ...now, flat: v as typeof now.flat });
      })));
      parts.push(labelled("How many", number(choice.quantity ?? 1, (quantity) => {
        const now = at(i);
        if ("flat" in now) replace(i, { ...now, quantity: quantity ?? 1 });
      }, { min: 1, step: 1 })));
    } else if ("perTon" in choice) {
      parts.push(labelled("System", select(choice.perTon, optionsOf(PER_TON_SYSTEMS), (v) => {
        const now = at(i);
        if ("perTon" in now) replace(i, { ...now, perTon: v as typeof now.perTon });
      })));
      parts.push(labelled("Tons", number(choice.tons, (tons) => {
        const now = at(i);
        if ("perTon" in now) replace(i, { ...now, tons });
      }, { min: 0, placeholder: "rule" }), "Left empty, the rules size it themselves where they can."));
    } else if ("perHullTon" in choice) {
      parts.push(labelled("System", select(choice.perHullTon, optionsOf(PER_HULL_TON_SYSTEMS), (v) =>
        replace(i, { perHullTon: v as typeof choice.perHullTon }))));
    } else if ("solar" in choice) {
      parts.push(labelled("Grade", select(choice.solar, optionsOf(SOLAR_SYSTEMS), (v) => {
        const now = at(i);
        if ("solar" in now) replace(i, { ...now, solar: v as typeof now.solar });
      })));
      parts.push(labelled("Coating", number(choice.coatingUnits, (coatingUnits) => {
        const now = at(i);
        if ("solar" in now) replace(i, { ...now, coatingUnits });
      }, { min: 0, step: 1, placeholder: "0" }), "Units are percentage points of the hull, at most forty."));
      parts.push(labelled("Panels", number(choice.panelUnits, (panelUnits) => {
        const now = at(i);
        if ("solar" in now) replace(i, { ...now, panelUnits });
      }, { min: 0, step: 1, placeholder: "0" }), "Units are tons."));
    } else if ("custom" in choice) {
      const mergeCustom = (patch: Partial<typeof choice.custom>) => {
        const now = at(i);
        if ("custom" in now) replace(i, { custom: { ...now.custom, ...patch } });
      };
      parts.push(labelled("Name", text(choice.custom.label, (label) => mergeCustom({ label }))));
      parts.push(labelled("Tons", number(choice.custom.tons, (tons) => mergeCustom({ tons }), { min: 0 })));
      parts.push(labelled("Cost MCr", number(choice.custom.cost, (cost) => mergeCustom({ cost }), { min: 0 })));
      parts.push(labelled("Power", number(choice.custom.power, (power) => mergeCustom({ power }), { min: 0 })));
    }
    return el("div", { class: "row-fields" }, parts);
  });

  return step("systems", "9", "Install optional systems",
    live().length === 0 ? "none" : count(live().length, "system"), [[
      listEditor(rows, (i) => set(live().filter((_, k) => k !== i)), "Add a system", () =>
        set([...live(), { flat: "workshop" }])),
    ]]);
}

function defaultSystem(kind: string): SystemChoice {
  switch (kind) {
    case "perTon": return { perTon: "fuelProcessor", tons: 1 };
    case "perHullTon": return { perHullTon: "holographicHull" };
    case "fuelScoops": return { fuelScoops: true };
    case "solar": return { solar: "enhanced", panelUnits: 10 };
    case "custom": return { custom: { label: "Something", tons: 1, cost: 0.1 } };
    default: return { flat: "workshop" };
  }
}

// --------------------------------------------------------------- the quarters

function accommodation(host: FormHost): Element {
  const d = host.design;
  const p = d.passengers ?? { high: 0, middle: 0, low: 0 };
  const setPassengers = (patch: Partial<typeof p>) =>
    host.rebuild({ passengers: { high: 0, middle: 0, low: 0, ...host.design.passengers, ...patch } });
  const precis = joined([
    d.staterooms === undefined || d.staterooms === 0 ? undefined : count(d.staterooms, "stateroom"),
    d.lowBerths === undefined || d.lowBerths === 0 ? undefined : count(d.lowBerths, "low berth"),
    d.commonAreaTons === undefined || d.commonAreaTons === 0 ? undefined : `${d.commonAreaTons} tons common`,
  ], "none");

  return step("quarters", "11", "Install staterooms", precis, [
    [
      labelled("Staterooms", number(d.staterooms, (staterooms) => host.rebuild({ staterooms }), { min: 0, step: 1 })),
      labelled("Low berths", number(d.lowBerths, (lowBerths) => host.rebuild({ lowBerths }), { min: 0, step: 1 })),
      labelled("Emergency", number(d.emergencyLowBerths, (emergencyLowBerths) =>
        host.rebuild({ emergencyLowBerths }), { min: 0, step: 1 }), "Emergency low berths, four to a berth."),
      labelled("Common areas", number(d.commonAreaTons, (commonAreaTons) =>
        host.rebuild({ commonAreaTons }), { min: 0 }), "Tons. The book suggests a quarter of the staterooms."),
    ],
    [
      check(d.doubleOccupancy === true, "Two to a room", (doubleOccupancy) =>
        host.rebuild({ doubleOccupancy }), "Free, and common on a military ship."),
    ],
    [
      labelled("High passengers", number(p.high, (high) => setPassengers({ high: high ?? 0 }), { min: 0, step: 1 })),
      labelled("Middle", number(p.middle, (middle) => setPassengers({ middle: middle ?? 0 }), { min: 0, step: 1 })),
      labelled("Low", number(p.low, (low) => setPassengers({ low: low ?? 0 }), { min: 0, step: 1 })),
    ],
  ]);
}

// --------------------------------------------------------------- the software

function software(host: FormHost): Element {
  const live = () => list<SoftwareChoice>(host, "software");
  const set = (software: SoftwareChoice[], how: "update" | "rebuild" = "rebuild") => host[how]({ software });

  const rows = live().map((choice, i) => {
    const family = SOFTWARE[choice.software];
    const levels = family.levels.map((rule, k) => ({ value: String(family.firstLevel + k), label: rule.label }));
    return el("div", { class: "row-fields" }, [
      labelled("Package", select(choice.software, optionsOf(SOFTWARE), (v) => {
        const next = SOFTWARE[v as SoftwareChoice["software"]];
        set(live().map((e, k) => (k === i
          ? { software: v as SoftwareChoice["software"], level: next.firstLevel }
          : e)));
      })),
      levels.length < 2 ? null : labelled("Level", select(String(choice.level ?? family.firstLevel), levels, (v) =>
        set(live().map((e, k) => (k === i ? { ...e, level: Number(v) } : e))))),
    ]);
  });

  return step("software", "6b", "Load software",
    live().length === 0 ? "none" : count(live().length, "package"), [[
      listEditor(rows, (i) => set(live().filter((_, k) => k !== i)), "Add a package", () =>
        set([...live(), { software: "manoeuvre", level: 0 }])),
    ]]);
}

export { button };
