/**
 * The design, as the steps of the checklist on page 10. ShipSpec 4.
 *
 * The sections follow the book's order, so a designer working from the book and
 * a designer working from this screen are doing the same thing in the same
 * order.
 *
 * **Two ways to change the design, and the difference matters.** `update` alters
 * a value: the sheet redraws and the form is left alone, so the scroll position
 * and whatever has focus survive. `rebuild` is for a change that adds or
 * removes a control, such as choosing an armour type where there was none, and
 * only then is the form thrown away and drawn again.
 *
 * Because the form outlives most changes, no handler may close over the design
 * it was drawn from. A handler that did would write back a snapshot taken
 * before the last few edits and silently undo them. Every handler reads
 * `host.design` at the moment it fires; the values used to populate a control
 * are the only thing read at draw time.
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
  ReactionChoice,
  SoftwareChoice,
  SystemChoice,
  WeaponChoice,
} from "../engine/design";
import { clear, el } from "./dom";
import { button, check, checkSet, labelled, line, listEditor, number, optionsOf, select, tag, text } from "./controls";
import type { Option } from "./controls";

export interface FormHost {
  /** Read afresh by every handler. Never captured. */
  readonly design: Design;
  /** A value changed. Redraw the sheet and leave the form standing. */
  update(patch: Partial<Design>): void;
  /** A control appeared or vanished. Draw the form again. */
  rebuild(patch: Partial<Design>): void;
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



/** Merge into one of the design's object fields, reading the live design. */
function into<K extends keyof Design>(host: FormHost, key: K) {
  return (patch: Partial<NonNullable<Design[K]>>, redraw: "update" | "rebuild" = "update"): void => {
    const current = (host.design[key] ?? {}) as object;
    host[redraw]({ [key]: { ...current, ...patch } } as Partial<Design>);
  };
}

/** Replace one of the design's list fields, reading the live design. */
function list<T>(host: FormHost, key: keyof Design): readonly T[] {
  return (host.design[key] as readonly T[] | undefined) ?? [];
}

function ship(host: FormHost): Element {
  const d = host.design;
  return step("", "The ship", [
    line(
      labelled("Name", text(d.name, (name) => host.update({ name }))),
      labelled("TL", number(d.tl, (tl) => host.update({ tl: tl ?? 12 }), { min: 1, max: 21, step: 1 }),
        "The shipyard's Tech Level, which caps every component."),
      check(d.standardDesign === true, "Standard design", (standardDesign) =>
        host.update({ standardDesign })),
      check(d.military === true, "Military crewing", (military) => host.update({ military })),
    ),
  ]);
}

function hull(host: FormHost): Element {
  const h = host.design.hull;
  const set = into(host, "hull");
  return step("1", "Create a hull", [
    line(
      labelled("Tons", number(h.tons, (tons) => set({ tons: tons ?? 100 }), { min: 5, step: 1 })),
      labelled("Configuration", select(h.configuration, optionsOf(HULL_CONFIGURATIONS), (v) =>
        set({ configuration: v as typeof h.configuration }))),
      labelled("Stealth", select(h.stealth, optionsOf(STEALTH_TYPES), (v) =>
        set({ stealth: v === "" ? undefined : (v as typeof h.stealth) }), "None")),
    ),
    line(
      tag("Specialised"),
      checkSet(h.specialised ?? [], optionsOf(SPECIALISED_HULLS), (specialised) => set({ specialised })),
    ),
    line(
      tag("Options"),
      checkSet(h.options ?? [], optionsOf(HULL_OPTIONS), (options) => set({ options })),
      check(h.pressureHull === true, "Pressure hull", (pressureHull) => set({ pressureHull })),
    ),
    line(
      labelled("Adjustable", select(h.adjustable, [
        { value: "tl12", label: "TL12, 5% of the ship" },
        { value: "tl15", label: "TL15, 1% of the ship" },
      ], (v) => set({ adjustable: v === "" ? undefined : (v as typeof h.adjustable) }), "None")),
      labelled("Modular", number(h.modularFraction, (modularFraction) => set({ modularFraction }),
        { min: 0, max: 0.75, step: 0.05, placeholder: "0" }), "The share that can be swapped out, up to 0.75."),
    ),
  ]);
}

function armour(host: FormHost): Element {
  const a = host.design.armour;
  return step("1b", "Install armour", [
    line(
    labelled("Type", select(a?.type, optionsOf(ARMOUR_TYPES), (v) =>
      host.rebuild({
        armour: v === ""
          ? undefined
          : { type: v as NonNullable<typeof a>["type"], protection: host.design.armour?.protection ?? 1 },
      }), "None")),
    a === undefined ? null : labelled("Protection", number(a.protection, (protection) =>
      into(host, "armour")({ protection: protection ?? 1 }), { min: 1, step: 1 })),
    ),
  ]);
}

/** A grade and the traits it allows, for a component built off its own TL. */
function customisation(
  value: Customisation | undefined,
  category: TraitCategory,
  onGrade: (value: Customisation | undefined) => void,
  onTraits: (traits: Trait[]) => void,
): Element {
  const allowed = Object.entries(TRAITS)
    .filter(([, rule]) => rule.category === category)
    .filter(([, rule]) => value === undefined || rule.kind === GRADES[value.grade].kind)
    .map(([key, rule]) => ({ value: key, label: rule.slots > 1 ? `${rule.label} (2)` : rule.label }));
  return el("div", { class: "line customise" }, [
    labelled("Grade", select(value?.grade, optionsOf(GRADES), (v) =>
      onGrade(v === "" ? undefined : { grade: v as Customisation["grade"], traits: [] }), "Standard")),
    value === undefined ? null : checkSet(value.traits ?? [], allowed, (chosen) => onTraits(chosen as Trait[])),
  ]);
}

function drives(host: FormHost): Element {
  const d = host.design;
  const m: ManoeuvreChoice | undefined = typeof d.manoeuvre === "number" ? { thrust: d.manoeuvre } : d.manoeuvre;
  const j: JumpChoice | undefined = typeof d.jump === "number" ? { rating: d.jump } : d.jump;
  const r = d.reaction;
  const b = d.highBurnThruster;

  /** The live manoeuvre and jump choices, whichever shape they were saved in. */
  const liveM = (): ManoeuvreChoice | undefined =>
    typeof host.design.manoeuvre === "number" ? { thrust: host.design.manoeuvre } : host.design.manoeuvre;
  const liveJ = (): JumpChoice | undefined =>
    typeof host.design.jump === "number" ? { rating: host.design.jump } : host.design.jump;
  const setM = (patch: Partial<ManoeuvreChoice>, how: "update" | "rebuild" = "update") =>
    host[how]({ manoeuvre: { thrust: 0, ...liveM(), ...patch } });
  const setJ = (patch: Partial<JumpChoice>, how: "update" | "rebuild" = "update") =>
    host[how]({ jump: { rating: 1, ...liveJ(), ...patch } });
  const setR = (patch: Partial<ReactionChoice>, how: "update" | "rebuild" = "update") =>
    host[how]({ reaction: { thrust: 0, hours: 1, ...host.design.reaction, ...patch } });
  const setB = (patch: Partial<ReactionChoice>, how: "update" | "rebuild" = "update") =>
    host[how]({ highBurnThruster: { thrust: 0, hours: 1, ...host.design.highBurnThruster, ...patch } });

  return step("2", "Install drives", [
    line(
      labelled("Thrust", number(m?.thrust, (thrust) =>
        thrust === undefined ? host.rebuild({ manoeuvre: undefined }) : setM({ thrust }, "rebuild"),
        { min: 0, max: 11, step: 1 }), "Leave empty for no manoeuvre drive."),
      m === undefined ? null : labelled("Sized for", number(m.sizedForTons, (sizedForTons) =>
        setM({ sizedForTons }), { min: 5, step: 1, placeholder: "hull" }),
        "Tons the drive is built to move, where that is not the hull's own."),
      m === undefined ? null : check(m.concealed === true, "Concealed plates", (concealed) => setM({ concealed })),
    ),
    m === undefined ? null : customisation(m.customisation, "manoeuvre",
      (c) => setM({ customisation: c }, "rebuild"),
      (traits) => setM({ customisation: { ...liveM()?.customisation, grade: liveM()!.customisation!.grade, traits } })),

    line(
      labelled("Jump", number(j?.rating, (rating) =>
        rating === undefined ? host.rebuild({ jump: undefined }) : setJ({ rating }, "rebuild"),
        { min: 1, max: 9, step: 1 })),
      j === undefined ? null : labelled("Sized for", number(j.sizedForTons, (sizedForTons) =>
        setJ({ sizedForTons }), { min: 100, step: 1, placeholder: "hull" })),
    ),
    j === undefined ? null : customisation(j.customisation, "jump",
      (c) => setJ({ customisation: c }, "rebuild"),
      (traits) => setJ({ customisation: { ...liveJ()?.customisation, grade: liveJ()!.customisation!.grade, traits } })),

    line(
      labelled("Reaction", number(r?.thrust, (thrust) =>
        thrust === undefined ? host.rebuild({ reaction: undefined }) : setR({ thrust }, "rebuild"),
        { min: 0, max: 16, step: 1 }), "Reaction drive thrust."),
      r === undefined ? null : labelled("Hours", number(r.hours, (hours) =>
        setR({ hours: hours ?? 1 }), { min: 0, step: 1 })),
      labelled("High-burn", number(b?.thrust, (thrust) =>
        thrust === undefined ? host.rebuild({ highBurnThruster: undefined }) : setB({ thrust }, "rebuild"),
        { min: 0, max: 16, step: 1 }), "A booster whose Thrust adds to the manoeuvre drive's."),
      b === undefined ? null : labelled("Hours", number(b.hours, (hours) =>
        setB({ hours: hours ?? 1 }), { min: 0, step: 1 })),
    ),
  ]);
}

function powerPlant(host: FormHost): Element {
  const p = host.design.powerPlant;
  const set = into(host, "powerPlant");
  return step("3", "Install power plant", [
    line(
      labelled("Type", select(p.type, optionsOf(POWER_PLANTS), (v) => set({ type: v as typeof p.type }))),
      labelled("Tons", number(p.tons, (tons) => set({ tons: tons ?? 1 }), { min: 0, step: 1 }),
        "Before any customisation. The plant's output follows this figure."),
      labelled("Weeks", number(p.weeks, (weeks) => set({ weeks: weeks ?? 4 }), { min: 0, step: 1 }),
        "Weeks of fuel carried for the plant."),
    ),
    customisation(p.customisation, "powerPlant",
      (c) => set({ customisation: c }, "rebuild"),
      (traits) => set({
        customisation: { grade: host.design.powerPlant.customisation!.grade, traits },
      })),
  ]);
}

function fuel(host: FormHost): Element {
  const d = host.design;
  return step("4", "Install fuel tanks", [
    line(
      labelled("Tank for jump", number(d.fuelForJump, (fuelForJump) => host.update({ fuelForJump }),
        { min: 0, step: 1, placeholder: "drive" }),
        "Lower than the drive where the long jumps ride on drop tanks."),
      labelled("Extra tons", number(d.extraFuelTons, (extraFuelTons) => host.update({ extraFuelTons }),
        { min: 0, step: 1, placeholder: "0" })),
    ),
  ]);
}

function bridge(host: FormHost): Element {
  const b = host.design.bridge;
  const set = into(host, "bridge");
  return step("5", "Install bridge", [
    line(
      labelled("Kind", select(b.kind, [
        { value: "standard", label: "Standard" },
        { value: "smaller", label: "Smaller (DM-1, half price)" },
        { value: "cockpit", label: "Cockpit" },
        { value: "dualCockpit", label: "Dual cockpit" },
      ], (v) => set({ kind: v as typeof b.kind }))),
      check(b.command === true, "Command", (command) => set({ command })),
      check(b.holographic === true, "Holographic", (holographic) => set({ holographic })),
      check(b.detachable === true, "Detachable", (detachable) => set({ detachable })),
    ),
  ]);
}

function computer(host: FormHost): Element {
  const c = host.design.computer;
  const options: Option[] = COMPUTERS.map((rule) => ({
    value: `${rule.processing}${rule.core ? "c" : ""}`,
    label: rule.label,
  }));
  const current = c === undefined ? undefined : `${c.processing}${c.core === true ? "c" : ""}`;
  const set = into(host, "computer");
  return step("6", "Install computer", [
    line(
      labelled("Model", select(current, options, (v) => host.rebuild({
        computer: v === ""
          ? undefined
          : { ...host.design.computer, processing: Number.parseInt(v, 10), core: v.endsWith("c") },
      }), "None")),
      c === undefined ? null : check(c.bis === true, "/bis", (bis) => set({ bis })),
      c === undefined ? null : check(c.fib === true, "/fib", (fib) => set({ fib })),
    ),
  ]);
}

function sensors(host: FormHost): Element {
  return step("7", "Install sensors", [
    line(labelled("Suite", select(host.design.sensors ?? "basic", optionsOf(SENSORS), (v) =>
      host.update({ sensors: v as Design["sensors"] })))),
  ]);
}

function weapons(host: FormHost): Element {
  const live = () => list<WeaponChoice>(host, "weapons");
  const set = (weapons: WeaponChoice[], how: "update" | "rebuild" = "update") => host[how]({ weapons });
  const replace = (at: number, choice: WeaponChoice, how: "update" | "rebuild" = "update") =>
    set(live().map((entry, i) => (i === at ? choice : entry)), how);
  /** The row's own choice, read live so earlier edits are never written back. */
  const at = (index: number) => live()[index] as WeaponChoice;

  const rows = live().map((choice, i) => {
    const parts: (Element | null)[] = [
      select(choice.kind, [
        { value: "turret", label: "Turret" },
        { value: "barbette", label: "Barbette" },
        { value: "bay", label: "Bay" },
        { value: "spinal", label: "Spinal mount" },
        { value: "pointDefence", label: "Point defence" },
        { value: "screen", label: "Screen" },
        { value: "blackGlobe", label: "Black globe" },
      ], (v) => replace(i, defaultWeapon(v as WeaponChoice["kind"]), "rebuild")),
    ];

    if (choice.kind === "turret") {
      parts.push(select(choice.mount, optionsOf(MOUNTS), (v) => {
        const now = at(i);
        if (now.kind === "turret") replace(i, { ...now, mount: v as typeof now.mount });
      }));
      parts.push(el("div", { class: "check-set" }, Object.entries(TURRET_WEAPONS).map(([key, rule]) => {
        const count = (choice.weapons ?? []).filter((w) => w === key).length;
        return labelled(rule.label, number(count, (n) => {
          const now = at(i);
          if (now.kind !== "turret") return;
          const others = (now.weapons ?? []).filter((w) => w !== key);
          const mine = Array.from({ length: n ?? 0 }, () => key as keyof typeof TURRET_WEAPONS);
          replace(i, { ...now, weapons: [...others, ...mine] });
        }, { min: 0, max: 3, step: 1 }));
      })));
      parts.push(check(choice.popUp === true, "Pop-up", (popUp) => {
        const now = at(i);
        if (now.kind === "turret") replace(i, { ...now, popUp });
      }));
    } else if (choice.kind === "barbette") {
      parts.push(select(choice.weapon, optionsOf(BARBETTES), (v) => {
        const now = at(i);
        if (now.kind === "barbette") replace(i, { ...now, weapon: v as typeof now.weapon });
      }));
    } else if (choice.kind === "bay") {
      parts.push(select(choice.size, optionsOf(BAY_SIZES), (v) => {
        const now = at(i);
        if (now.kind === "bay") replace(i, { ...now, size: v as typeof now.size });
      }));
      parts.push(select(choice.weapon, optionsOf(BAY_WEAPONS.small), (v) => {
        const now = at(i);
        if (now.kind === "bay") replace(i, { ...now, weapon: v as typeof now.weapon });
      }));
    } else if (choice.kind === "spinal") {
      parts.push(select(choice.weapon, optionsOf(SPINAL_WEAPONS), (v) => {
        const now = at(i);
        if (now.kind === "spinal") replace(i, { ...now, weapon: v as typeof now.weapon });
      }));
      parts.push(labelled("Multiple", number(choice.multiple, (multiple) => {
        const now = at(i);
        if (now.kind === "spinal") replace(i, { ...now, multiple: multiple ?? 1 });
      }, { min: 1, step: 1 })));
      parts.push(labelled("TLs above", number(choice.levelsAboveBase, (levelsAboveBase) => {
        const now = at(i);
        if (now.kind === "spinal") replace(i, { ...now, levelsAboveBase });
      }, { min: 0, max: 3, step: 1, placeholder: "0" })));
    } else if (choice.kind === "pointDefence") {
      parts.push(select(choice.battery, [
        { value: "laser", label: "Laser" },
        { value: "gauss", label: "Gauss" },
      ], (v) => {
        const now = at(i);
        if (now.kind === "pointDefence") replace(i, { ...now, battery: v as typeof now.battery });
      }));
      parts.push(select(choice.type, optionsOf(POINT_DEFENCE.laser), (v) => {
        const now = at(i);
        if (now.kind === "pointDefence") replace(i, { ...now, type: v as typeof now.type });
      }));
    } else if (choice.kind === "screen") {
      parts.push(select(choice.screen, optionsOf(SCREENS), (v) => {
        const now = at(i);
        if (now.kind === "screen") replace(i, { ...now, screen: v as typeof now.screen });
      }));
    }

    if (choice.kind !== "spinal" && choice.kind !== "blackGlobe") {
      parts.push(labelled("How many", number(choice.quantity ?? 1, (quantity) => {
        const now = at(i);
        if (now.kind !== "spinal" && now.kind !== "blackGlobe") {
          replace(i, { ...now, quantity: quantity ?? 1 });
        }
      }, { min: 1, step: 1 })));
    }
    return el("div", { class: "weapon-row" }, parts);
  });

  return step("8", "Install weapons", [
    listEditor(rows, (i) => set(live().filter((_, k) => k !== i), "rebuild"), "Add a mount", () =>
      set([...live(), { kind: "turret", mount: "single" }], "rebuild")),
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

function ordnance(host: FormHost): Element {
  const live = () => list<OrdnanceChoice>(host, "ordnance");
  const set = (ordnance: OrdnanceChoice[], how: "update" | "rebuild" = "update") => host[how]({ ordnance });
  const replace = (i: number, entry: OrdnanceChoice, how: "update" | "rebuild" = "update") =>
    set(live().map((e, k) => (k === i ? entry : e)), how);

  const rows = live().map((choice, i) => {
    const kind = "missile" in choice ? "missile" : "torpedo" in choice ? "torpedo" : "canister";
    const table = kind === "missile" ? MISSILES : kind === "torpedo" ? TORPEDOES : CANISTERS;
    const current = "missile" in choice ? choice.missile : "torpedo" in choice ? choice.torpedo : choice.canister;
    const rewrite = (type: string, count: number) => ({ [kind]: type, count }) as OrdnanceChoice;
    const now = () => {
      const e = live()[i] as OrdnanceChoice;
      const t = "missile" in e ? e.missile : "torpedo" in e ? e.torpedo : e.canister;
      return { type: t, count: e.count };
    };
    return el("div", { class: "weapon-row" }, [
      select(kind, [
        { value: "missile", label: "Missiles" },
        { value: "torpedo", label: "Torpedoes" },
        { value: "canister", label: "Canisters" },
      ], (v) => replace(i, defaultOrdnance(v), "rebuild")),
      select(current, optionsOf(table), (v) => replace(i, rewrite(v, now().count))),
      labelled("How many", number(choice.count, (count) => replace(i, rewrite(now().type, count ?? 0)),
        { min: 0, step: 1 })),
    ]);
  });

  return step("8b", "Load ordnance", [
    el("p", { class: "muted" }, ["Takes room in the ship. Its cost is reported apart, as the book does."]),
    listEditor(rows, (i) => set(live().filter((_, k) => k !== i), "rebuild"), "Add ordnance", () =>
      set([...live(), { missile: "standard", count: 12 }], "rebuild")),
  ]);
}

function defaultOrdnance(kind: string): OrdnanceChoice {
  if (kind === "torpedo") return { torpedo: "standard", count: 3 };
  if (kind === "canister") return { canister: "sand", count: 20 };
  return { missile: "standard", count: 12 };
}

function craft(host: FormHost): Element {
  const live = () => list<CraftChoice>(host, "craft");
  const set = (craft: CraftChoice[], how: "update" | "rebuild" = "update") => host[how]({ craft });
  const merge = (i: number, patch: Partial<CraftChoice>) =>
    set(live().map((e, k) => (k === i ? { ...e, ...patch } : e)));

  const rows = live().map((entry, i) =>
    el("div", { class: "weapon-row" }, [
      labelled("Name", text(entry.label, (label) => merge(i, { label }))),
      labelled("Tons", number(entry.tons, (tons) => merge(i, { tons: tons ?? 0 }), { min: 0, step: 1 })),
      labelled("MCr", number(entry.cost, (cost) => merge(i, { cost: cost ?? 0 }), { min: 0 })),
      labelled("Kind", select(entry.kind, [
        { value: "smallCraft", label: "Small craft" },
        { value: "vehicle", label: "Vehicle" },
      ], (v) => merge(i, { kind: v as CraftChoice["kind"] }))),
      labelled("Berth", select(entry.berth, [
        { value: "dockingSpace", label: "Docking space" },
        { value: "fullHangar", label: "Full hangar" },
        { value: "none", label: "None" },
      ], (v) => merge(i, { berth: v as CraftChoice["berth"] }))),
      labelled("Its drives", number(entry.driveAndPlantTons, (driveAndPlantTons) =>
        merge(i, { driveAndPlantTons }), { min: 0, placeholder: "0" })),
    ]),
  );

  return step("9b", "Carry craft", [
    listEditor(rows, (i) => set(live().filter((_, k) => k !== i), "rebuild"), "Add a craft", () =>
      set([...live(), { label: "Air/Raft", tons: 4, cost: 0.25, kind: "vehicle", berth: "dockingSpace" }], "rebuild")),
  ]);
}

function systems(host: FormHost): Element {
  const live = () => list<SystemChoice>(host, "systems");
  const set = (systems: SystemChoice[], how: "update" | "rebuild" = "update") => host[how]({ systems });
  const replace = (i: number, entry: SystemChoice, how: "update" | "rebuild" = "update") =>
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
      select(kindOf(choice), [
        { value: "flat", label: "Fixed size" },
        { value: "perTon", label: "By the ton" },
        { value: "perHullTon", label: "Whole ship" },
        { value: "fuelScoops", label: "Fuel scoops" },
        { value: "solar", label: "Solar" },
        { value: "custom", label: "Something else" },
      ], (v) => replace(i, defaultSystem(v), "rebuild")),
    ];

    if ("flat" in choice) {
      parts.push(select(choice.flat, optionsOf(FLAT_SYSTEMS), (v) => {
        const now = at(i);
        if ("flat" in now) replace(i, { ...now, flat: v as typeof now.flat });
      }));
      parts.push(labelled("How many", number(choice.quantity ?? 1, (quantity) => {
        const now = at(i);
        if ("flat" in now) replace(i, { ...now, quantity: quantity ?? 1 });
      }, { min: 1, step: 1 })));
    } else if ("perTon" in choice) {
      parts.push(select(choice.perTon, optionsOf(PER_TON_SYSTEMS), (v) => {
        const now = at(i);
        if ("perTon" in now) replace(i, { ...now, perTon: v as typeof now.perTon });
      }));
      parts.push(labelled("Tons", number(choice.tons, (tons) => {
        const now = at(i);
        if ("perTon" in now) replace(i, { ...now, tons });
      }, { min: 0, placeholder: "by the rule" })));
    } else if ("perHullTon" in choice) {
      parts.push(select(choice.perHullTon, optionsOf(PER_HULL_TON_SYSTEMS), (v) =>
        replace(i, { perHullTon: v as typeof choice.perHullTon })));
    } else if ("solar" in choice) {
      parts.push(select(choice.solar, optionsOf(SOLAR_SYSTEMS), (v) => {
        const now = at(i);
        if ("solar" in now) replace(i, { ...now, solar: v as typeof now.solar });
      }));
      parts.push(labelled("Coating", number(choice.coatingUnits, (coatingUnits) => {
        const now = at(i);
        if ("solar" in now) replace(i, { ...now, coatingUnits });
      }, { min: 0, step: 1, placeholder: "0" })));
      parts.push(labelled("Panels", number(choice.panelUnits, (panelUnits) => {
        const now = at(i);
        if ("solar" in now) replace(i, { ...now, panelUnits });
      }, { min: 0, step: 1, placeholder: "0" })));
    } else if ("custom" in choice) {
      const mergeCustom = (patch: Partial<typeof choice.custom>) => {
        const now = at(i);
        if ("custom" in now) replace(i, { custom: { ...now.custom, ...patch } });
      };
      parts.push(labelled("Name", text(choice.custom.label, (label) => mergeCustom({ label }))));
      parts.push(labelled("Tons", number(choice.custom.tons, (tons) => mergeCustom({ tons }), { min: 0 })));
      parts.push(labelled("MCr", number(choice.custom.cost, (cost) => mergeCustom({ cost }), { min: 0 })));
      parts.push(labelled("Power", number(choice.custom.power, (power) => mergeCustom({ power }), { min: 0 })));
    }
    return el("div", { class: "weapon-row" }, parts);
  });

  return step("9", "Install optional systems", [
    listEditor(rows, (i) => set(live().filter((_, k) => k !== i), "rebuild"), "Add a system", () =>
      set([...live(), { flat: "workshop" }], "rebuild")),
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

function accommodation(host: FormHost): Element {
  const d = host.design;
  const p = d.passengers ?? { high: 0, middle: 0, low: 0 };
  const setPassengers = (patch: Partial<typeof p>) =>
    host.update({ passengers: { high: 0, middle: 0, low: 0, ...host.design.passengers, ...patch } });
  return step("11", "Install staterooms", [
    line(
      labelled("Staterooms", number(d.staterooms, (staterooms) => host.update({ staterooms }), { min: 0, step: 1 })),
      check(d.doubleOccupancy === true, "Two to a room", (doubleOccupancy) =>
        host.update({ doubleOccupancy })),
      labelled("Low berths", number(d.lowBerths, (lowBerths) => host.update({ lowBerths }), { min: 0, step: 1 })),
      labelled("Emergency", number(d.emergencyLowBerths, (emergencyLowBerths) =>
        host.update({ emergencyLowBerths }), { min: 0, step: 1 }), "Emergency low berths, four to a berth."),
      labelled("Common areas", number(d.commonAreaTons, (commonAreaTons) =>
        host.update({ commonAreaTons }), { min: 0 }), "Tons of common area."),
    ),
    line(
      tag("Passengers"),
      labelled("High", number(p.high, (high) => setPassengers({ high: high ?? 0 }), { min: 0, step: 1 })),
      labelled("Middle", number(p.middle, (middle) => setPassengers({ middle: middle ?? 0 }), { min: 0, step: 1 })),
      labelled("Low", number(p.low, (low) => setPassengers({ low: low ?? 0 }), { min: 0, step: 1 })),
    ),
  ]);
}

function software(host: FormHost): Element {
  const live = () => list<SoftwareChoice>(host, "software");
  const set = (software: SoftwareChoice[], how: "update" | "rebuild" = "update") => host[how]({ software });

  const rows = live().map((choice, i) => {
    const family = SOFTWARE[choice.software];
    const levels = family.levels.map((rule, k) => ({ value: String(family.firstLevel + k), label: rule.label }));
    return el("div", { class: "weapon-row" }, [
      select(choice.software, optionsOf(SOFTWARE), (v) => {
        const next = SOFTWARE[v as SoftwareChoice["software"]];
        set(live().map((e, k) => (k === i
          ? { software: v as SoftwareChoice["software"], level: next.firstLevel }
          : e)), "rebuild");
      }),
      levels.length < 2 ? null : select(String(choice.level ?? family.firstLevel), levels, (v) =>
        set(live().map((e, k) => (k === i ? { ...e, level: Number(v) } : e)))),
    ]);
  });

  return step("6b", "Load software", [
    listEditor(rows, (i) => set(live().filter((_, k) => k !== i), "rebuild"), "Add a package", () =>
      set([...live(), { software: "manoeuvre", level: 0 }], "rebuild")),
  ]);
}

export { button };
