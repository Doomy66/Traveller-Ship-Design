/**
 * The design, as thirteen steps to fill in. ShipSpec 4.
 *
 * The sections follow the checklist on page 10 in the order the book gives it,
 * so a designer working from the book and a designer working from this screen
 * are doing the same thing in the same order.
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
import type { Trait, TraitCategory } from "../rules/index";
import type {
  CraftChoice,
  Customisation,
  Design,
  JumpChoice,
  ManoeuvreChoice,
  OrdnanceChoice,
  SoftwareChoice,
  SystemChoice,
  WeaponChoice,
} from "../engine/design";
import { clear, el } from "./dom";
import { button, check, checkSet, labelled, listEditor, number, optionsOf, select, text } from "./controls";
import type { Option } from "./controls";

export interface FormHost {
  readonly design: Design;
  update(patch: Partial<Design>): void;
}

export function renderForm(into: Element, host: FormHost): void {
  clear(into);
  for (const section of [
    ship, hull, armour, drives, powerPlant, fuel, bridge, computer, sensors,
    weapons, ordnance, craft, systems, accommodation, software,
  ]) {
    into.append(section(host));
  }
}

function step(index: string, heading: string, body: readonly (Element | null)[]): Element {
  return el("section", { class: "step" }, [
    el("h3", {}, [el("span", { class: "step-no" }, [index]), heading]),
    ...body,
  ]);
}

function ship({ design, update }: FormHost): Element {
  return step("", "The ship", [
    labelled("Name", text(design.name, (name) => update({ name }))),
    labelled("Tech Level", number(design.tl, (tl) => update({ tl: tl ?? 12 }), { min: 1, max: 21, step: 1 }),
      "The shipyard's, which caps every component."),
    check(design.standardDesign === true, "Standard design (10% off)", (standardDesign) => update({ standardDesign })),
    check(design.military === true, "Military crewing", (military) => update({ military })),
  ]);
}

function hull({ design, update }: FormHost): Element {
  const h = design.hull;
  const set = (patch: Partial<typeof h>) => update({ hull: { ...h, ...patch } });
  return step("1", "Create a hull", [
    labelled("Tons", number(h.tons, (tons) => set({ tons: tons ?? 100 }), { min: 5, step: 1 })),
    labelled("Configuration", select(h.configuration, optionsOf(HULL_CONFIGURATIONS), (v) =>
      set({ configuration: v as typeof h.configuration }))),
    el("p", { class: "field-name" }, ["Specialised"]),
    checkSet(h.specialised ?? [], optionsOf(SPECIALISED_HULLS), (specialised) => set({ specialised })),
    el("p", { class: "field-name" }, ["Hull options"]),
    checkSet(h.options ?? [], optionsOf(HULL_OPTIONS), (options) => set({ options })),
    labelled("Stealth", select(h.stealth, optionsOf(STEALTH_TYPES), (v) =>
      set({ stealth: v === "" ? undefined : (v as typeof h.stealth) }), "None")),
    labelled("Adjustable hull", select(h.adjustable, [
      { value: "tl12", label: "TL12, 5% of the ship" },
      { value: "tl15", label: "TL15, 1% of the ship" },
    ], (v) => set({ adjustable: v === "" ? undefined : (v as typeof h.adjustable) }), "None")),
    check(h.pressureHull === true, "Pressure hull", (pressureHull) => set({ pressureHull })),
    labelled("Modular share", number(h.modularFraction, (modularFraction) => set({ modularFraction }),
      { min: 0, max: 0.75, step: 0.05, placeholder: "0" }), "Up to 0.75."),
  ]);
}

function armour({ design, update }: FormHost): Element {
  const a = design.armour;
  return step("1b", "Install armour", [
    labelled("Type", select(a?.type, optionsOf(ARMOUR_TYPES), (v) =>
      update({ armour: v === "" ? undefined : { type: v as NonNullable<typeof a>["type"], protection: a?.protection ?? 1 } }),
      "None")),
    a === undefined ? null : labelled("Protection", number(a.protection, (protection) =>
      update({ armour: { ...a, protection: protection ?? 1 } }), { min: 1, step: 1 })),
  ]);
}

/** A grade and its traits, for any component that can be built off its own TL. */
function customisation(
  value: Customisation | undefined,
  category: TraitCategory,
  onChange: (value: Customisation | undefined) => void,
): Element {
  const traits = Object.entries(TRAITS)
    .filter(([, rule]) => rule.category === category)
    .filter(([, rule]) => value === undefined || rule.kind === GRADES[value.grade].kind)
    .map(([key, rule]) => ({ value: key, label: `${rule.label} (${rule.slots})` }));
  return el("div", { class: "customise" }, [
    labelled("Grade", select(value?.grade, optionsOf(GRADES), (v) =>
      onChange(v === "" ? undefined : { grade: v as Customisation["grade"], traits: [] }), "Standard")),
    value === undefined ? null : checkSet(value.traits ?? [], traits, (chosen) =>
      onChange({ ...value, traits: chosen as Trait[] })),
  ]);
}

function drives({ design, update }: FormHost): Element {
  const m: ManoeuvreChoice | undefined =
    typeof design.manoeuvre === "number" ? { thrust: design.manoeuvre } : design.manoeuvre;
  const j: JumpChoice | undefined = typeof design.jump === "number" ? { rating: design.jump } : design.jump;
  const r = design.reaction;
  const b = design.highBurnThruster;
  return step("2", "Install drives", [
    labelled("Thrust", number(m?.thrust, (thrust) =>
      update({ manoeuvre: thrust === undefined ? undefined : { ...m, thrust } }), { min: 0, max: 11, step: 1 }), "None if empty."),
    m === undefined ? null : labelled("Drive sized for", number(m.sizedForTons, (sizedForTons) =>
      update({ manoeuvre: { ...m, sizedForTons } }), { min: 5, step: 1, placeholder: "the hull" })),
    m === undefined ? null : check(m.concealed === true, "Concealed thruster plates", (concealed) =>
      update({ manoeuvre: { ...m, concealed } })),
    m === undefined ? null : customisation(m.customisation, "manoeuvre", (c) =>
      update({ manoeuvre: { ...m, customisation: c } })),

    labelled("Jump", number(j?.rating, (rating) =>
      update({ jump: rating === undefined ? undefined : { ...j, rating } }), { min: 1, max: 9, step: 1 })),
    j === undefined ? null : customisation(j.customisation, "jump", (c) =>
      update({ jump: { ...j, customisation: c } })),

    labelled("Reaction thrust", number(r?.thrust, (thrust) =>
      update({ reaction: thrust === undefined ? undefined : { hours: r?.hours ?? 1, ...r, thrust } }),
      { min: 0, max: 16, step: 1 })),
    r === undefined ? null : labelled("Hours of burn", number(r.hours, (hours) =>
      update({ reaction: { ...r, hours: hours ?? 1 } }), { min: 0, step: 1 })),

    labelled("High-burn thruster", number(b?.thrust, (thrust) =>
      update({ highBurnThruster: thrust === undefined ? undefined : { hours: b?.hours ?? 1, ...b, thrust } }),
      { min: 0, max: 16, step: 1 }), "Thrust that adds to the manoeuvre drive's."),
    b === undefined ? null : labelled("Booster hours", number(b.hours, (hours) =>
      update({ highBurnThruster: { ...b, hours: hours ?? 1 } }), { min: 0, step: 1 })),
  ]);
}

function powerPlant({ design, update }: FormHost): Element {
  const p = design.powerPlant;
  const set = (patch: Partial<typeof p>) => update({ powerPlant: { ...p, ...patch } });
  return step("3", "Install power plant", [
    labelled("Type", select(p.type, optionsOf(POWER_PLANTS), (v) => set({ type: v as typeof p.type }))),
    labelled("Tons", number(p.tons, (tons) => set({ tons: tons ?? 1 }), { min: 0, step: 1 }),
      "Before any customisation. Output follows this figure."),
    labelled("Weeks of fuel", number(p.weeks, (weeks) => set({ weeks: weeks ?? 4 }), { min: 0, step: 1 })),
    customisation(p.customisation, "powerPlant", (c) => set({ customisation: c })),
  ]);
}

function fuel({ design, update }: FormHost): Element {
  return step("4", "Install fuel tanks", [
    labelled("Tank for jump", number(design.fuelForJump, (fuelForJump) => update({ fuelForJump }),
      { min: 0, step: 1, placeholder: "the drive's rating" }),
      "Lower than the drive where the longer jumps ride on drop tanks."),
    labelled("Extra tons", number(design.extraFuelTons, (extraFuelTons) => update({ extraFuelTons }),
      { min: 0, step: 1, placeholder: "0" })),
  ]);
}

function bridge({ design, update }: FormHost): Element {
  const b = design.bridge;
  const set = (patch: Partial<typeof b>) => update({ bridge: { ...b, ...patch } });
  return step("5", "Install bridge", [
    labelled("Kind", select(b.kind, [
      { value: "standard", label: "Standard" },
      { value: "smaller", label: "Smaller (DM-1, half price)" },
      { value: "cockpit", label: "Cockpit" },
      { value: "dualCockpit", label: "Dual cockpit" },
    ], (v) => set({ kind: v as typeof b.kind }))),
    check(b.command === true, "Command bridge", (command) => set({ command })),
    check(b.holographic === true, "Holographic controls", (holographic) => set({ holographic })),
    check(b.detachable === true, "Detachable", (detachable) => set({ detachable })),
  ]);
}

function computer({ design, update }: FormHost): Element {
  const c = design.computer;
  const options: Option[] = COMPUTERS.map((rule) => ({
    value: `${rule.processing}${rule.core ? "c" : ""}`,
    label: rule.label,
  }));
  const current = c === undefined ? undefined : `${c.processing}${c.core === true ? "c" : ""}`;
  return step("6", "Install computer", [
    labelled("Model", select(current, options, (v) => update({
      computer: v === "" ? undefined : { ...c, processing: Number.parseInt(v, 10), core: v.endsWith("c") },
    }), "None")),
    c === undefined ? null : check(c.bis === true, "/bis (Jump Control +5)", (bis) =>
      update({ computer: { ...c, bis } })),
    c === undefined ? null : check(c.fib === true, "/fib (hardened)", (fib) =>
      update({ computer: { ...c, fib } })),
  ]);
}

function sensors({ design, update }: FormHost): Element {
  return step("7", "Install sensors", [
    labelled("Suite", select(design.sensors ?? "basic", optionsOf(SENSORS), (v) =>
      update({ sensors: v as typeof design.sensors }))),
  ]);
}

function weapons({ design, update }: FormHost): Element {
  const list = design.weapons ?? [];
  const set = (weapons: WeaponChoice[]) => update({ weapons });
  const replace = (at: number, choice: WeaponChoice) =>
    set(list.map((entry, i) => (i === at ? choice : entry)));

  const rows = list.map((choice, at) => {
    const kind = select(choice.kind, [
      { value: "turret", label: "Turret" },
      { value: "barbette", label: "Barbette" },
      { value: "bay", label: "Bay" },
      { value: "spinal", label: "Spinal mount" },
      { value: "pointDefence", label: "Point defence" },
      { value: "screen", label: "Screen" },
      { value: "blackGlobe", label: "Black globe" },
    ], (v) => replace(at, defaultWeapon(v as WeaponChoice["kind"])));

    const parts: (Element | null)[] = [kind];
    if (choice.kind === "turret") {
      parts.push(select(choice.mount, optionsOf(MOUNTS), (v) =>
        replace(at, { ...choice, mount: v as typeof choice.mount })));
      parts.push(el("div", { class: "check-set" }, Object.entries(TURRET_WEAPONS).map(([key, rule]) => {
        const count = (choice.weapons ?? []).filter((w) => w === key).length;
        return labelled(rule.label, number(count, (n) => {
          const others = (choice.weapons ?? []).filter((w) => w !== key);
          const next = [...others, ...Array.from({ length: n ?? 0 }, () => key as keyof typeof TURRET_WEAPONS)];
          replace(at, { ...choice, weapons: next });
        }, { min: 0, max: 3, step: 1 }));
      })));
      parts.push(check(choice.popUp === true, "Pop-up", (popUp) => replace(at, { ...choice, popUp })));
    } else if (choice.kind === "barbette") {
      parts.push(select(choice.weapon, optionsOf(BARBETTES), (v) =>
        replace(at, { ...choice, weapon: v as typeof choice.weapon })));
    } else if (choice.kind === "bay") {
      parts.push(select(choice.size, optionsOf(BAY_SIZES), (v) =>
        replace(at, { ...choice, size: v as typeof choice.size })));
      parts.push(select(choice.weapon, optionsOf(BAY_WEAPONS.small), (v) =>
        replace(at, { ...choice, weapon: v as typeof choice.weapon })));
    } else if (choice.kind === "spinal") {
      parts.push(select(choice.weapon, optionsOf(SPINAL_WEAPONS), (v) =>
        replace(at, { ...choice, weapon: v as typeof choice.weapon })));
      parts.push(labelled("Multiple", number(choice.multiple, (multiple) =>
        replace(at, { ...choice, multiple: multiple ?? 1 }), { min: 1, step: 1 })));
      parts.push(labelled("TLs above", number(choice.levelsAboveBase, (levelsAboveBase) =>
        replace(at, { ...choice, levelsAboveBase }), { min: 0, max: 3, step: 1, placeholder: "0" })));
    } else if (choice.kind === "pointDefence") {
      parts.push(select(choice.battery, [
        { value: "laser", label: "Laser" },
        { value: "gauss", label: "Gauss" },
      ], (v) => replace(at, { ...choice, battery: v as typeof choice.battery })));
      parts.push(select(choice.type, optionsOf(POINT_DEFENCE.laser), (v) =>
        replace(at, { ...choice, type: v as typeof choice.type })));
    } else if (choice.kind === "screen") {
      parts.push(select(choice.screen, optionsOf(SCREENS), (v) =>
        replace(at, { ...choice, screen: v as typeof choice.screen })));
    }
    if (choice.kind !== "spinal" && choice.kind !== "blackGlobe") {
      parts.push(labelled("How many", number(choice.quantity ?? 1, (quantity) =>
        replace(at, { ...choice, quantity: quantity ?? 1 }), { min: 1, step: 1 })));
    }
    return el("div", { class: "weapon-row" }, parts);
  });

  return step("8", "Install weapons", [
    listEditor(rows, (at) => set(list.filter((_, i) => i !== at)), "Add a mount", () =>
      set([...list, { kind: "turret", mount: "single" }])),
  ]);
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

function ordnance({ design, update }: FormHost): Element {
  const list = design.ordnance ?? [];
  const set = (ordnance: OrdnanceChoice[]) => update({ ordnance });
  const rows = list.map((choice, at) => {
    const table = "missile" in choice ? MISSILES : "torpedo" in choice ? TORPEDOES : CANISTERS;
    const current = "missile" in choice ? choice.missile : "torpedo" in choice ? choice.torpedo : choice.canister;
    const kind = "missile" in choice ? "missile" : "torpedo" in choice ? "torpedo" : "canister";
    return el("div", { class: "weapon-row" }, [
      select(kind, [
        { value: "missile", label: "Missiles" },
        { value: "torpedo", label: "Torpedoes" },
        { value: "canister", label: "Canisters" },
      ], (v) => set(list.map((entry, i) => (i === at ? defaultOrdnance(v) : entry)))),
      select(current, optionsOf(table), (v) =>
        set(list.map((entry, i) => (i === at ? ({ [kind]: v, count: choice.count } as OrdnanceChoice) : entry)))),
      labelled("How many", number(choice.count, (count) =>
        set(list.map((entry, i) => (i === at ? ({ [kind]: current, count: count ?? 0 } as OrdnanceChoice) : entry))),
        { min: 0, step: 1 })),
    ]);
  });
  return step("8b", "Load ordnance", [
    el("p", { class: "muted" }, ["Takes room in the ship. Its cost is reported apart, as the book does."]),
    listEditor(rows, (at) => set(list.filter((_, i) => i !== at)), "Add ordnance", () =>
      set([...list, { missile: "standard", count: 12 }])),
  ]);
}

function defaultOrdnance(kind: string): OrdnanceChoice {
  if (kind === "torpedo") return { torpedo: "standard", count: 3 };
  if (kind === "canister") return { canister: "sand", count: 20 };
  return { missile: "standard", count: 12 };
}

function craft({ design, update }: FormHost): Element {
  const list = design.craft ?? [];
  const set = (craft: CraftChoice[]) => update({ craft });
  const replace = (at: number, entry: CraftChoice) => set(list.map((c, i) => (i === at ? entry : c)));
  const rows = list.map((entry, at) =>
    el("div", { class: "weapon-row" }, [
      labelled("Name", text(entry.label, (label) => replace(at, { ...entry, label }))),
      labelled("Tons", number(entry.tons, (tons) => replace(at, { ...entry, tons: tons ?? 0 }), { min: 0, step: 1 })),
      labelled("Cost MCr", number(entry.cost, (cost) => replace(at, { ...entry, cost: cost ?? 0 }), { min: 0 })),
      labelled("Kind", select(entry.kind, [
        { value: "smallCraft", label: "Small craft" },
        { value: "vehicle", label: "Vehicle" },
      ], (v) => replace(at, { ...entry, kind: v as CraftChoice["kind"] }))),
      labelled("Berth", select(entry.berth, [
        { value: "dockingSpace", label: "Docking space" },
        { value: "fullHangar", label: "Full hangar" },
        { value: "none", label: "None" },
      ], (v) => replace(at, { ...entry, berth: v as CraftChoice["berth"] }))),
      labelled("Its drives", number(entry.driveAndPlantTons, (driveAndPlantTons) =>
        replace(at, { ...entry, driveAndPlantTons }), { min: 0, placeholder: "0" })),
    ]),
  );
  return step("9b", "Carry craft", [
    listEditor(rows, (at) => set(list.filter((_, i) => i !== at)), "Add a craft", () =>
      set([...list, { label: "Air/Raft", tons: 4, cost: 0.25, kind: "vehicle", berth: "dockingSpace" }])),
  ]);
}

function systems({ design, update }: FormHost): Element {
  const list = design.systems ?? [];
  const set = (systems: SystemChoice[]) => update({ systems });
  const replace = (at: number, entry: SystemChoice) => set(list.map((c, i) => (i === at ? entry : c)));

  const kindOf = (choice: SystemChoice): string =>
    "flat" in choice ? "flat"
      : "perTon" in choice ? "perTon"
        : "perHullTon" in choice ? "perHullTon"
          : "fuelScoops" in choice ? "fuelScoops"
            : "solar" in choice ? "solar" : "custom";

  const rows = list.map((choice, at) => {
    const parts: (Element | null)[] = [
      select(kindOf(choice), [
        { value: "flat", label: "Fixed size" },
        { value: "perTon", label: "By the ton" },
        { value: "perHullTon", label: "Whole ship" },
        { value: "fuelScoops", label: "Fuel scoops" },
        { value: "solar", label: "Solar" },
        { value: "custom", label: "Something else" },
      ], (v) => replace(at, defaultSystem(v))),
    ];
    if ("flat" in choice) {
      parts.push(select(choice.flat, optionsOf(FLAT_SYSTEMS), (v) =>
        replace(at, { ...choice, flat: v as typeof choice.flat })));
      parts.push(labelled("How many", number(choice.quantity ?? 1, (quantity) =>
        replace(at, { ...choice, quantity: quantity ?? 1 }), { min: 1, step: 1 })));
    } else if ("perTon" in choice) {
      parts.push(select(choice.perTon, optionsOf(PER_TON_SYSTEMS), (v) =>
        replace(at, { ...choice, perTon: v as typeof choice.perTon })));
      parts.push(labelled("Tons", number(choice.tons, (tons) => replace(at, { ...choice, tons }),
        { min: 0, placeholder: "by the rule" })));
    } else if ("perHullTon" in choice) {
      parts.push(select(choice.perHullTon, optionsOf(PER_HULL_TON_SYSTEMS), (v) =>
        replace(at, { perHullTon: v as typeof choice.perHullTon })));
    } else if ("solar" in choice) {
      parts.push(select(choice.solar, optionsOf(SOLAR_SYSTEMS), (v) =>
        replace(at, { ...choice, solar: v as typeof choice.solar })));
      parts.push(labelled("Coating units", number(choice.coatingUnits, (coatingUnits) =>
        replace(at, { ...choice, coatingUnits }), { min: 0, step: 1, placeholder: "0" })));
      parts.push(labelled("Panel units", number(choice.panelUnits, (panelUnits) =>
        replace(at, { ...choice, panelUnits }), { min: 0, step: 1, placeholder: "0" })));
    } else if ("custom" in choice) {
      const c = choice.custom;
      parts.push(labelled("Name", text(c.label, (label) => replace(at, { custom: { ...c, label } }))));
      parts.push(labelled("Tons", number(c.tons, (tons) => replace(at, { custom: { ...c, tons } }), { min: 0 })));
      parts.push(labelled("Cost MCr", number(c.cost, (cost) => replace(at, { custom: { ...c, cost } }), { min: 0 })));
      parts.push(labelled("Power", number(c.power, (power) => replace(at, { custom: { ...c, power } }), { min: 0 })));
    }
    return el("div", { class: "weapon-row" }, parts);
  });

  return step("9", "Install optional systems", [
    listEditor(rows, (at) => set(list.filter((_, i) => i !== at)), "Add a system", () =>
      set([...list, { flat: "workshop" }])),
  ]);
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

function accommodation({ design, update }: FormHost): Element {
  const p = design.passengers ?? { high: 0, middle: 0, low: 0 };
  return step("11", "Install staterooms", [
    labelled("Staterooms", number(design.staterooms, (staterooms) => update({ staterooms }), { min: 0, step: 1 })),
    check(design.doubleOccupancy === true, "Double occupancy", (doubleOccupancy) => update({ doubleOccupancy })),
    labelled("Low berths", number(design.lowBerths, (lowBerths) => update({ lowBerths }), { min: 0, step: 1 })),
    labelled("Emergency low berths", number(design.emergencyLowBerths, (emergencyLowBerths) =>
      update({ emergencyLowBerths }), { min: 0, step: 1 })),
    labelled("Common areas, tons", number(design.commonAreaTons, (commonAreaTons) =>
      update({ commonAreaTons }), { min: 0 })),
    el("p", { class: "field-name" }, ["Passengers"]),
    el("div", { class: "row" }, [
      labelled("High", number(p.high, (high) => update({ passengers: { ...p, high: high ?? 0 } }), { min: 0, step: 1 })),
      labelled("Middle", number(p.middle, (middle) => update({ passengers: { ...p, middle: middle ?? 0 } }), { min: 0, step: 1 })),
      labelled("Low", number(p.low, (low) => update({ passengers: { ...p, low: low ?? 0 } }), { min: 0, step: 1 })),
    ]),
  ]);
}

function software({ design, update }: FormHost): Element {
  const list = design.software ?? [];
  const set = (software: SoftwareChoice[]) => update({ software });
  const rows = list.map((choice, at) => {
    const family = SOFTWARE[choice.software];
    const levels = family.levels.map((rule, i) => ({
      value: String(family.firstLevel + i),
      label: rule.label,
    }));
    return el("div", { class: "weapon-row" }, [
      select(choice.software, optionsOf(SOFTWARE), (v) => {
        const next = SOFTWARE[v as keyof typeof SOFTWARE];
        set(list.map((entry, i) => (i === at
          ? { software: v as SoftwareChoice["software"], level: next.firstLevel }
          : entry)));
      }),
      levels.length < 2 ? null : select(String(choice.level ?? family.firstLevel), levels, (v) =>
        set(list.map((entry, i) => (i === at ? { ...choice, level: Number(v) } : entry)))),
    ]);
  });
  return step("6b", "Load software", [
    listEditor(rows, (at) => set(list.filter((_, i) => i !== at)), "Add a package", () =>
      set([...list, { software: "manoeuvre", level: 0 }])),
  ]);
}

export { button };
