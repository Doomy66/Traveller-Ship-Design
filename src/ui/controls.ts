/**
 * Form controls, built from the rules data rather than written out by hand.
 *
 * A select of armour types is the armour table's own keys and labels, so a
 * transcription corrected in src/rules reaches the interface without anyone
 * remembering to change it here.
 *
 * Layout is two ideas and no more. A **field** is a name and its control, and
 * it renders as `display: contents` so both land directly in the grid its
 * section owns: the names line up in one column, the controls in the next, and
 * each column is exactly as wide as its widest member. A **row** is a break
 * that pushes whatever follows onto a fresh line of that grid, so fields that
 * belong together stay together.
 */

import { el } from "./dom";

export interface Option {
  readonly value: string;
  readonly label: string;
}

/** The options for a record of rules keyed by name, each with a label. */
export function optionsOf(table: Readonly<Record<string, { label: string }>>): Option[] {
  return Object.entries(table).map(([value, rule]) => ({ value, label: rule.label }));
}

/**
 * A name and its control. The hint is the tooltip: a screen with forty fields
 * cannot afford a sentence beneath each of them.
 */
export function labelled(text: string, control: Element, hint?: string): Element {
  return el("label", { class: "field", title: hint }, [
    el("span", { class: "field-name" }, [text]),
    control,
  ]);
}

/** Pushes what follows onto a new line of the section's grid. */
export function rowBreak(): Element {
  return el("i", { class: "row-break", "aria-hidden": "true" });
}

export function select(
  value: string | undefined,
  options: readonly Option[],
  onChange: (value: string) => void,
  blank?: string,
): HTMLSelectElement {
  const node = el("select");
  if (blank !== undefined) node.append(el("option", { value: "" }, [blank]));
  for (const option of options) {
    node.append(el("option", { value: option.value, selected: option.value === value }, [option.label]));
  }
  node.value = value ?? "";
  node.addEventListener("change", () => onChange(node.value));
  return node;
}

/** A select whose options are gathered under headings. */
export function grouped(
  value: string | undefined,
  options: readonly (Option & { group: string })[],
  onChange: (value: string) => void,
): HTMLSelectElement {
  const node = el("select");
  let current: string | undefined;
  let into: HTMLElement = node;
  for (const option of options) {
    if (option.group !== current) {
      current = option.group;
      into = el("optgroup", { label: current });
      node.append(into);
    }
    into.append(el("option", { value: option.value, selected: option.value === value }, [option.label]));
  }
  node.value = value ?? "";
  node.addEventListener("change", () => onChange(node.value));
  return node;
}

export function number(
  value: number | undefined,
  onChange: (value: number | undefined) => void,
  attrs: { min?: number; max?: number; step?: number; placeholder?: string } = {},
): HTMLInputElement {
  const node = el("input", {
    type: "number",
    class: "num",
    value: value === undefined ? "" : String(value),
    min: attrs.min,
    max: attrs.max,
    step: attrs.step ?? "any",
    placeholder: attrs.placeholder,
  });
  node.addEventListener("change", () => {
    onChange(node.value === "" ? undefined : Number(node.value));
  });
  return node;
}

export function text(value: string, onChange: (value: string) => void): HTMLInputElement {
  const node = el("input", { type: "text", class: "text", value });
  node.addEventListener("change", () => onChange(node.value));
  return node;
}

/** A checkbox. In a section grid it takes a whole name-and-control pair. */
export function check(value: boolean, label: string, onChange: (value: boolean) => void, hint?: string): Element {
  const box = el("input", { type: "checkbox", checked: value });
  box.addEventListener("change", () => onChange(box.checked));
  return el("label", { class: "check", title: hint }, [box, el("span", {}, [label])]);
}

/** Several checkboxes over one set of keys, for things a ship may have many of. */
export function checkSet<T extends string>(
  chosen: readonly T[],
  options: readonly Option[],
  onChange: (chosen: T[]) => void,
): Element[] {
  return options.map((option) =>
    check(chosen.includes(option.value as T), option.label, (on) => {
      const next = chosen.filter((key) => key !== option.value);
      if (on) next.push(option.value as T);
      onChange(next);
    }),
  );
}

export function button(label: string, onClick: () => void, className = ""): HTMLButtonElement {
  const node = el("button", { type: "button", class: className }, [label]);
  node.addEventListener("click", onClick);
  return node;
}

/**
 * A list the designer adds to and removes from: weapons, systems, craft and the
 * rest. Each row is whatever the caller draws, with a remove beside it.
 */
export function listEditor(
  rows: readonly Element[],
  onRemove: (at: number) => void,
  addLabel: string,
  onAdd: () => void,
  /** Other ways to add a row, set beside the usual one. */
  otherAdds: readonly Element[] = [],
): Element {
  const add = button(`+ ${addLabel}`, onAdd, "add");
  return el("div", { class: "list-editor" }, [
    ...rows.map((row, at) =>
      el("div", { class: "list-row" }, [row, button("×", () => onRemove(at), "remove")]),
    ),
    otherAdds.length === 0 ? add : el("div", { class: "list-adds" }, [add, ...otherAdds]),
  ]);
}
