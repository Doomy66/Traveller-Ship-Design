/**
 * Form controls, built from the rules data rather than written out by hand.
 *
 * A select of armour types is the armour table's own keys and labels, so a
 * transcription corrected in src/rules reaches the interface without anyone
 * remembering to change it here.
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

export function labelled(text: string, control: Element, hint?: string): Element {
  return el("label", { class: "field" }, [
    el("span", { class: "field-name" }, [text]),
    control,
    hint === undefined ? null : el("span", { class: "field-hint" }, [hint]),
  ]);
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

export function number(
  value: number | undefined,
  onChange: (value: number | undefined) => void,
  attrs: { min?: number; max?: number; step?: number; placeholder?: string } = {},
): HTMLInputElement {
  const node = el("input", {
    type: "number",
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
  const node = el("input", { type: "text", value });
  node.addEventListener("change", () => onChange(node.value));
  return node;
}

export function check(value: boolean, label: string, onChange: (value: boolean) => void): Element {
  const box = el("input", { type: "checkbox", checked: value });
  box.addEventListener("change", () => onChange(box.checked));
  return el("label", { class: "check" }, [box, el("span", {}, [label])]);
}

/** A row of checkboxes over a set of keys, for things a ship may have several of. */
export function checkSet<T extends string>(
  chosen: readonly T[],
  options: readonly Option[],
  onChange: (chosen: T[]) => void,
): Element {
  return el(
    "div",
    { class: "check-set" },
    options.map((option) =>
      check(chosen.includes(option.value as T), option.label, (on) => {
        const next = chosen.filter((key) => key !== option.value);
        if (on) next.push(option.value as T);
        onChange(next);
      }),
    ),
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
): Element {
  return el("div", { class: "list-editor" }, [
    ...rows.map((row, at) =>
      el("div", { class: "list-row" }, [row, button("×", () => onRemove(at), "remove")]),
    ),
    button(addLabel, onAdd, "add"),
  ]);
}
