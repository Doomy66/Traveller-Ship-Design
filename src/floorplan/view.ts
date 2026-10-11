/**
 * The floor plan screen. FloorPlanSpec section 10.
 *
 * The screen holds the editing state (which deck, which tool, where the view
 * is, the undo history) and nothing about the ship. The ship arrives as a
 * manifest and a plan through the host, every change goes back through
 * `setPlan`, and what the panel shows is `check`'s report drawn out.
 */

import "./floorplan.css";
import type { Report, Tally } from "./check";
import { check } from "./check";
import { exportPng, exportSvg, printPlan } from "./export";
import type { Bounds } from "./geometry";
import { bounds, storedEdge } from "./geometry";
import type { Component, ComponentGroup, Manifest } from "./manifest";
import { SQUARES_PER_STATEROOM } from "./manifest";
import type { AccessKind, EdgeKind, FloorPlan, Fixture, Owner, Rotation, SquareFixture } from "./plan";
import {
  addDeck,
  CORRIDOR,
  cellKey,
  instanceOwner,
  moveDeck,
  paint,
  placeFixture,
  rectangle,
  removeDeck,
  removeFixture,
  renameDeck,
  shiftDeck,
} from "./plan";
import {
  fittedSquares,
  fixturesMarkup,
  floorsMarkup,
  gridMarkup,
  labelsMarkup,
  looksFor,
  overlayMarkup,
  SCREEN,
  shortLabel,
  symbolMarkup,
  unmatchedAccessMarkup,
  wallsMarkup,
} from "./render";
import type { SymbolCategory } from "./symbols";
import { ACCESS_SYMBOLS, CATEGORY_LABELS, footprint, symbolById, SYMBOLS } from "./symbols";

export interface FloorPlanHost {
  /** Read afresh whenever the screen draws. */
  readonly manifest: Manifest;
  readonly plan: FloorPlan;
  setPlan(plan: FloorPlan): void;
}

export interface FloorPlanView {
  /** Draw everything again, after the design or the plan changed outside the screen. */
  refresh(): void;
  /** Fit the whole plan into view. */
  fit(): void;
  /** Keys pressed while the screen is showing. Returns true if it used the key. */
  key(event: KeyboardEvent): boolean;
  /** Every deck to the printer. */
  print(): void;
}

type Tool =
  | { readonly kind: "paint"; readonly owner: Owner }
  | { readonly kind: "corridor" }
  | { readonly kind: "erase" }
  | { readonly kind: "edge"; readonly edge: EdgeKind }
  | { readonly kind: "access"; readonly access: AccessKind }
  | { readonly kind: "symbol"; readonly id: string };

const GROUP_ORDER: readonly ComponentGroup[] = [
  "engineering",
  "fuel",
  "command",
  "weapons",
  "craft",
  "accommodation",
  "systems",
  "cargo",
];

const GROUP_NAMES: Readonly<Record<ComponentGroup, string>> = {
  engineering: "Engineering",
  fuel: "Fuel",
  command: "Command",
  weapons: "Weapons",
  craft: "Craft",
  accommodation: "Accommodation",
  systems: "Systems",
  cargo: "Cargo",
};

/** How much history Undo keeps. Plans are small and shared, so this is cheap. */
const HISTORY = 200;

const SVG_NS = "http://www.w3.org/2000/svg";

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string | undefined> = {},
  children: (Node | string)[] = [],
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [name, value] of Object.entries(attrs)) if (value !== undefined) node.setAttribute(name, value);
  for (const child of children) node.append(child);
  return node;
}

function button(label: string, onClick: () => void, attrs: Record<string, string | undefined> = {}): HTMLButtonElement {
  const node = el("button", { type: "button", ...attrs }, [label]);
  node.addEventListener("click", onClick);
  return node;
}

const symbolHref = (file: string) => `./${file}`;

/** Every square on the straight line between two, so a fast drag leaves no gaps. */
function line(a: readonly [number, number], b: readonly [number, number]): [number, number][] {
  const out: [number, number][] = [];
  let [x, y] = a;
  const [x1, y1] = b;
  const dx = Math.abs(x1 - x);
  const dy = -Math.abs(y1 - y);
  const sx = x < x1 ? 1 : -1;
  const sy = y < y1 ? 1 : -1;
  let err = dx + dy;
  for (;;) {
    out.push([x, y]);
    if (x === x1 && y === y1) return out;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y += sy;
    }
  }
}

export function renderFloorPlan(root: HTMLElement, host: FloorPlanHost): FloorPlanView {
  let deck = 0;
  /** "above" follows the current deck; a number pins one deck; null shows none. */
  let overlay: "above" | number | null = "above";
  let tool: Tool = { kind: "corridor" };
  let rotation: Rotation = 0;
  let view = { x: -2, y: -2, scale: 28 };
  const undo: FloorPlan[] = [];
  const redo: FloorPlan[] = [];
  let report: Report = check(host.manifest, host.plan);
  let hover: [number, number] | undefined;
  let fitted = false;

  // ------------------------------------------------------------------ layout

  const side = el("aside", { class: "fp-side", "aria-label": "Components and tools" });
  const problems = el("div", { class: "fp-problems", role: "status" });
  const deckBar = el("div", { class: "fp-deckbar" });
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("class", "fp-svg");
  const layers = {
    grid: document.createElementNS(SVG_NS, "g"),
    overlay: document.createElementNS(SVG_NS, "g"),
    floors: document.createElementNS(SVG_NS, "g"),
    walls: document.createElementNS(SVG_NS, "g"),
    fixtures: document.createElementNS(SVG_NS, "g"),
    labels: document.createElementNS(SVG_NS, "g"),
    marks: document.createElementNS(SVG_NS, "g"),
    preview: document.createElementNS(SVG_NS, "g"),
  };
  for (const layer of Object.values(layers)) svg.append(layer);
  layers.labels.setAttribute("pointer-events", "none");
  const canvas = el("div", { class: "fp-canvas" });
  canvas.append(svg);
  const status = el("div", { class: "fp-status" });
  const main = el("section", { class: "fp-main", "aria-label": "Decks" }, [problems, deckBar, canvas, status]);
  root.replaceChildren(el("div", { class: "fp" }, [side, main]));

  // ----------------------------------------------------------------- helpers

  const plan = () => host.plan;
  const components = () => host.manifest.components;
  const look = () => looksFor(components(), plan());

  function overlayDeck(): number | undefined {
    if (overlay === null) return undefined;
    const at = overlay === "above" ? deck - 1 : overlay;
    return at >= 0 && at < plan().decks.length && at !== deck ? at : undefined;
  }

  function commit(next: FloorPlan): void {
    if (next === plan()) return;
    undo.push(plan());
    if (undo.length > HISTORY) undo.shift();
    redo.length = 0;
    host.setPlan(next);
    draw();
  }

  function undoOnce(): void {
    const last = undo.pop();
    if (last === undefined) return;
    redo.push(plan());
    host.setPlan(last);
    deck = Math.min(deck, last.decks.length - 1);
    draw();
  }

  function redoOnce(): void {
    const next = redo.pop();
    if (next === undefined) return;
    undo.push(plan());
    host.setPlan(next);
    deck = Math.min(deck, next.decks.length - 1);
    draw();
  }

  /** The colour a brush paints, for the panel's swatches and the stroke preview. */
  function floorColour(owner: Owner | undefined): string {
    if (owner === undefined) return SCREEN.warn;
    return SCREEN.floor[look()(owner).floor];
  }

  // ------------------------------------------------------------------- panel

  function selectTool(next: Tool): void {
    tool = next;
    drawSide();
    drawPreview();
    canvas.dataset["tool"] = next.kind;
  }

  function statusClass(t: Pick<Tally, "status">): string {
    return `fp-${t.status}`;
  }

  function stateroomChips(component: Component, tally: Tally): HTMLElement {
    const chips = el("div", { class: "fp-chips" });
    for (let i = 1; i <= component.count; i++) {
      const placed = tally.instances?.[i] ?? 0;
      const state = placed === 0 ? "short" : placed === SQUARES_PER_STATEROOM ? "met" : placed < SQUARES_PER_STATEROOM ? "short" : "over";
      const owner = instanceOwner(component.key, i);
      const chosen = tool.kind === "paint" && tool.owner === owner;
      const chip = button(String(i), () => selectTool({ kind: "paint", owner }), {
        class: `fp-chip fp-${placed === 0 ? "empty" : state}${chosen ? " on" : ""}`,
        title: `Stateroom ${i}: ${placed} of ${SQUARES_PER_STATEROOM} squares`,
      });
      chips.append(chip);
    }
    return chips;
  }

  function componentRow(component: Component, tally: Tally): HTMLElement {
    const owner = component.key === "staterooms" && component.count > 1 ? undefined : component.key;
    const chosen =
      tool.kind === "paint" && (tool.owner === component.key || tool.owner.startsWith(`${component.key}#`));
    const row = el("div", { class: `fp-row ${statusClass(tally)}${chosen ? " on" : ""}` });
    const pick = button("", () => {
      if (owner !== undefined) selectTool({ kind: "paint", owner });
      else selectTool({ kind: "paint", owner: nextStateroom(component, tally) });
    }, { class: "fp-pick", title: component.label });
    pick.append(
      el("span", { class: "fp-swatch", style: `background:${SCREEN.floor[component.group]}` }),
      el("span", { class: "fp-name" }, [shortLabel(component)]),
      el("span", { class: "fp-count" }, [
        `${tally.placed} / ${tally.target}${tally.required ? "" : " optional"}`,
      ]),
    );
    row.append(pick);
    if (component.key === "staterooms" && component.count > 1) row.append(stateroomChips(component, tally));
    return row;
  }

  /** The first stateroom not yet drawn, or the first if all are. */
  function nextStateroom(component: Component, tally: Tally | undefined, after = 0): Owner {
    for (let step = 1; step <= component.count; step++) {
      const i = ((after + step - 1) % component.count) + 1;
      if ((tally?.instances?.[i] ?? 0) < SQUARES_PER_STATEROOM) return instanceOwner(component.key, i);
    }
    return instanceOwner(component.key, 1);
  }

  function toolButton(label: string, next: Tool, title: string, active: boolean): HTMLButtonElement {
    return button(label, () => selectTool(next), { class: `fp-tool${active ? " on" : ""}`, title });
  }

  function drawSide(): void {
    const scroll = side.querySelector(".fp-list")?.scrollTop ?? 0;
    const tallies = new Map(report.tallies.map((t) => [t.key, t]));
    const tools = el("div", { class: "fp-tools" }, [
      el("div", { class: "fp-toolrow" }, [
        toolButton("Corridor", { kind: "corridor" }, "Paint corridor and access space, which belongs to no component", tool.kind === "corridor"),
        toolButton("Erase", { kind: "erase" }, "Clear squares", tool.kind === "erase"),
        button("Undo", undoOnce, { class: "fp-tool", title: "Undo (Ctrl+Z)", ...(undo.length === 0 ? { disabled: "" } : {}) }),
        button("Redo", redoOnce, { class: "fp-tool", title: "Redo (Ctrl+Y)", ...(redo.length === 0 ? { disabled: "" } : {}) }),
      ]),
      el("div", { class: "fp-toolrow" }, [
        toolButton("Door", { kind: "edge", edge: "door" }, "Click a wall to put a door in it, or take one out", tool.kind === "edge" && tool.edge === "door"),
        toolButton("Iris valve", { kind: "edge", edge: "iris" }, "Click a wall to put an iris valve in it, or take one out", tool.kind === "edge" && tool.edge === "iris"),
      ]),
      el("div", { class: "fp-toolrow" }, [
        toolButton("Lift", { kind: "access", access: "lift" }, "A lift joins every deck that has one on the same square", tool.kind === "access" && tool.access === "lift"),
        toolButton("Hatch", { kind: "access", access: "hatch" }, "A floor hatch joins the decks above and below where they line up", tool.kind === "access" && tool.access === "hatch"),
        toolButton("Stairs", { kind: "access", access: "stairs" }, "Stairs join decks where they line up", tool.kind === "access" && tool.access === "stairs"),
      ]),
    ]);

    const list = el("div", { class: "fp-list" });
    for (const group of GROUP_ORDER) {
      const members = components().filter((c) => c.group === group);
      if (members.length === 0) continue;
      list.append(el("h3", { class: "fp-group" }, [GROUP_NAMES[group]]));
      for (const component of members) {
        const tally = tallies.get(component.key);
        if (tally !== undefined) list.append(componentRow(component, tally));
      }
    }
    if (report.orphans.length > 0) {
      list.append(el("h3", { class: "fp-group" }, ["No longer in the design"]));
      for (const orphan of report.orphans) {
        const row = el("div", { class: "fp-row fp-orphaned" }, [
          el("span", { class: "fp-name" }, [orphan.label]),
          el("span", { class: "fp-count" }, [`${orphan.squares}`]),
          button("Clear", () => clearOrphan(orphan.key), { class: "fp-clear", title: "Clear these squares on every deck" }),
        ]);
        list.append(row);
      }
    }

    const ship = report.ship;
    const inBand = report.total >= ship.low && report.total <= ship.high;
    const totals = el("div", { class: "fp-totals" }, [
      el("div", {}, [`Corridors ${report.corridor}`]),
      el("div", { class: report.total === 0 ? "" : inBand ? "fp-met" : "fp-short" }, [
        `Plan ${report.total} squares of ${ship.target} (${ship.low} to ${ship.high})`,
      ]),
    ]);

    const library = el("div", { class: "fp-library" });
    const categories = [...new Set(SYMBOLS.map((s) => s.category))] as SymbolCategory[];
    for (const category of categories) {
      library.append(el("h3", { class: "fp-group" }, [CATEGORY_LABELS[category]]));
      const grid = el("div", { class: "fp-symbols" });
      for (const symbol of SYMBOLS.filter((s) => s.category === category)) {
        const chosen = tool.kind === "symbol" && tool.id === symbol.id;
        const item = button("", () => selectTool({ kind: "symbol", id: symbol.id }), {
          class: `fp-symbol${chosen ? " on" : ""}`,
          title: `${symbol.name}, ${symbol.squares[0]} by ${symbol.squares[1]} squares`,
        });
        item.append(el("img", { src: symbolHref(symbol.file), alt: "", loading: "lazy" }), el("span", {}, [symbol.name]));
        grid.append(item);
      }
      library.append(grid);
    }
    // The licence asks for this wherever the symbols appear. FP 7.3.
    library.append(
      el("p", { class: "fp-credit" }, [
        "Symbols from Robert Pearce's Traveller Starship Symbols, rendered by Eric B. Smith, under ",
        el("a", { href: "https://creativecommons.org/licenses/by-nc/4.0/", target: "_blank", rel: "noopener" }, ["CC BY-NC 4.0"]),
        ".",
      ]),
    );

    side.replaceChildren(
      tools,
      el("h2", { class: "fp-heading" }, [`${host.manifest.shipName}`]),
      list,
      totals,
      el("details", { class: "fp-furniture", ...(tool.kind === "symbol" ? { open: "" } : {}) }, [
        el("summary", {}, ["Furniture and fittings"]),
        library,
      ]),
    );
    const restored = side.querySelector(".fp-list");
    if (restored !== null) restored.scrollTop = scroll;
  }

  function clearOrphan(key: string): void {
    let next = plan();
    for (const [at, d] of next.decks.entries()) {
      const squares = Object.entries(d.cells)
        .filter(([, owner]) => owner === key || owner.startsWith(`${key}#`))
        .map(([k]) => k.split(",").map(Number) as [number, number]);
      next = paint(next, at, squares, undefined);
    }
    commit(next);
  }

  // ---------------------------------------------------------------- problems

  function drawProblems(): void {
    const list = report.problems;
    if (list.length === 0) {
      problems.replaceChildren(el("p", { class: "fp-ok" }, [report.total === 0 ? "Pick a component on the left and paint its squares." : "Every component has its squares."]));
      return;
    }
    const items = list.map((p) =>
      el("li", { class: `fp-problem fp-${p.severity}` }, [p.message, el("span", { class: "fp-clause" }, [` FP ${p.clause}`])]),
    );
    problems.replaceChildren(el("ul", {}, items));
  }

  // ------------------------------------------------------------------- decks

  function drawDeckBar(): void {
    const tabs = el("div", { class: "fp-tabs", role: "tablist" });
    for (const [at, d] of plan().decks.entries()) {
      const cut = report.cutOff.includes(at);
      tabs.append(
        button(d.name, () => {
          deck = at;
          draw();
        }, { class: `fp-tab${at === deck ? " on" : ""}${cut ? " fp-cut" : ""}`, role: "tab", "aria-selected": String(at === deck), title: cut ? "No way to the rest of the ship" : undefined }),
      );
    }
    tabs.append(
      button("+ Deck", () => {
        const next = addDeck(plan());
        deck = next.decks.length - 1;
        commit(next);
      }, { class: "fp-tab fp-add", title: "Add a deck below the others" }),
    );

    const name = el("input", { class: "fp-deckname", type: "text", value: plan().decks[deck]?.name ?? "", "aria-label": "Deck name" });
    name.addEventListener("change", () => commit(renameDeck(plan(), deck, name.value.trim() || `Deck ${deck + 1}`)));

    const overlayPick = el("select", { class: "fp-overlay", "aria-label": "Overlay", title: "Show another deck faintly underneath, to line them up" });
    overlayPick.append(new Option("No overlay", "none"), new Option("Deck above", "above"));
    for (const [at, d] of plan().decks.entries()) if (at !== deck) overlayPick.append(new Option(`Over ${d.name}`, String(at)));
    overlayPick.value = overlay === null ? "none" : overlay === "above" ? "above" : String(overlay);
    overlayPick.addEventListener("change", () => {
      const v = overlayPick.value;
      overlay = v === "none" ? null : v === "above" ? "above" : Number(v);
      drawCanvas();
    });

    const shift = (dx: number, dy: number, label: string, title: string) =>
      button(label, () => commit(shiftDeck(plan(), deck, dx, dy)), { class: "fp-small", title });

    const deckTools = el("div", { class: "fp-decktools" }, [
      name,
      button("Up", () => {
        if (deck === 0) return;
        const next = moveDeck(plan(), deck, -1);
        deck -= 1;
        commit(next);
      }, { class: "fp-small", title: "Move this deck up the order", ...(deck === 0 ? { disabled: "" } : {}) }),
      button("Down", () => {
        if (deck >= plan().decks.length - 1) return;
        const next = moveDeck(plan(), deck, 1);
        deck += 1;
        commit(next);
      }, { class: "fp-small", title: "Move this deck down the order", ...(deck >= plan().decks.length - 1 ? { disabled: "" } : {}) }),
      el("span", { class: "fp-shift", title: "Move everything on this deck by a square" }, [
        shift(-1, 0, "←", "Shift this deck one square left"),
        shift(0, -1, "↑", "Shift this deck one square up"),
        shift(0, 1, "↓", "Shift this deck one square down"),
        shift(1, 0, "→", "Shift this deck one square right"),
      ]),
      button("Delete deck", () => {
        if (plan().decks.length <= 1) return;
        const d = plan().decks[deck];
        const used = d !== undefined && Object.keys(d.cells).length > 0;
        if (used && !confirm(`Delete ${d.name} and everything on it?`)) return;
        const next = removeDeck(plan(), deck);
        deck = Math.max(0, deck - 1);
        commit(next);
      }, { class: "fp-small", ...(plan().decks.length <= 1 ? { disabled: "" } : {}) }),
      overlayPick,
      el("span", { class: "spacer" }),
      button("−", () => zoom(1 / 1.25), { class: "fp-small", title: "Zoom out" }),
      button("+", () => zoom(1.25), { class: "fp-small", title: "Zoom in" }),
      button("Fit", fit, { class: "fp-small", title: "Fit the plan to the window" }),
      button("SVG", () => void exportSvg(host.manifest, plan(), deck), { class: "fp-small", title: "Save this deck as an SVG drawing" }),
      button("PNG", () => void exportPng(host.manifest, plan(), deck), { class: "fp-small", title: "Save this deck as a PNG image" }),
    ]);
    deckBar.replaceChildren(tabs, deckTools);
  }

  // ------------------------------------------------------------------ canvas

  function visibleArea(): Bounds {
    const w = canvas.clientWidth || 800;
    const h = canvas.clientHeight || 600;
    return {
      minX: Math.floor(view.x) - 1,
      minY: Math.floor(view.y) - 1,
      maxX: Math.ceil(view.x + w / view.scale) + 1,
      maxY: Math.ceil(view.y + h / view.scale) + 1,
    };
  }

  function placeViewBox(): void {
    const w = canvas.clientWidth || 800;
    const h = canvas.clientHeight || 600;
    svg.setAttribute("viewBox", `${view.x} ${view.y} ${w / view.scale} ${h / view.scale}`);
    layers.grid.innerHTML = gridMarkup(visibleArea(), SCREEN);
  }

  function drawCanvas(): void {
    const d = plan().decks[deck];
    if (d === undefined) return;
    const looks = look();
    placeViewBox();
    const under = overlayDeck();
    const below = under === undefined ? undefined : plan().decks[under];
    layers.overlay.innerHTML = below === undefined ? "" : overlayMarkup(below, SCREEN);
    layers.floors.innerHTML = floorsMarkup(d, looks, SCREEN);
    layers.walls.innerHTML = wallsMarkup(d, SCREEN);
    layers.fixtures.innerHTML = fixturesMarkup(plan(), deck, SCREEN, symbolHref);
    layers.labels.innerHTML = labelsMarkup(d, looks, SCREEN, fittedSquares(plan(), deck));
    layers.marks.innerHTML = under === undefined ? "" : unmatchedAccessMarkup(plan(), deck, under, SCREEN);
    drawPreview();
  }

  // ------------------------------------------------------------ interaction

  /** The square under a pointer, and where in it the pointer is. */
  function at(event: PointerEvent | WheelEvent): { x: number; y: number; fx: number; fy: number } {
    const box = svg.getBoundingClientRect();
    const px = view.x + (event.clientX - box.left) / view.scale;
    const py = view.y + (event.clientY - box.top) / view.scale;
    return { x: Math.floor(px), y: Math.floor(py), fx: px - Math.floor(px), fy: py - Math.floor(py) };
  }

  /** The wall nearest the pointer, in the stored north-or-west form. */
  function nearestEdge(p: { x: number; y: number; fx: number; fy: number }) {
    const choices = [
      { side: "n" as const, d: p.fy },
      { side: "s" as const, d: 1 - p.fy },
      { side: "w" as const, d: p.fx },
      { side: "e" as const, d: 1 - p.fx },
    ].sort((a, b) => a.d - b.d);
    return storedEdge({ x: p.x, y: p.y, side: choices[0]!.side });
  }

  /** Where a square fixture goes so that the pointer is in the middle of its footprint. */
  function fixtureOrigin(p: { x: number; y: number }, w: number, h: number): [number, number] {
    return [p.x - Math.floor((w - 1) / 2), p.y - Math.floor((h - 1) / 2)];
  }

  function fixtureSize(f: Pick<SquareFixture, "kind" | "symbol" | "rotation">): readonly [number, number] {
    const id = f.symbol ?? (f.kind === "lift" || f.kind === "stairs" ? ACCESS_SYMBOLS[f.kind] : undefined);
    const symbol = symbolById(id);
    return symbol === undefined ? [1, 1] : footprint(symbol, f.rotation);
  }

  /** The square fixture on this deck covering a square, if any. */
  function fixtureAt(x: number, y: number): SquareFixture | undefined {
    for (const f of plan().fixtures) {
      if (f.deck !== deck || "edge" in f) continue;
      const [w, h] = fixtureSize(f);
      if (x >= f.x && x < f.x + w && y >= f.y && y < f.y + h) return f;
    }
    return undefined;
  }

  let stroke:
    | { readonly owner: Owner | undefined; squares: Map<string, [number, number]>; last: [number, number]; anchor?: [number, number] }
    | undefined;
  let pan: { x: number; y: number; vx: number; vy: number } | undefined;
  let spaceHeld = false;

  function strokeOwner(): Owner | undefined | null {
    if (tool.kind === "paint") return tool.owner;
    if (tool.kind === "corridor") return CORRIDOR;
    if (tool.kind === "erase") return undefined;
    return null;
  }

  function drawPreview(): void {
    const parts: string[] = [];
    if (stroke !== undefined) {
      const colour = floorColour(stroke.owner);
      const squares = stroke.anchor !== undefined ? rectangle(stroke.anchor, stroke.last) : [...stroke.squares.values()];
      for (const [x, y] of squares) {
        parts.push(
          stroke.owner === undefined
            ? `<rect x="${x + 0.15}" y="${y + 0.15}" width="0.7" height="0.7" fill="none" stroke="${colour}" stroke-width="0.08"/>`
            : `<rect x="${x}" y="${y}" width="1" height="1" fill="${colour}" opacity="0.85"/>`,
        );
      }
    } else if (hover !== undefined) {
      const [x, y] = hover;
      if (tool.kind === "symbol") {
        const symbol = symbolById(tool.id);
        if (symbol !== undefined) {
          const [w, h] = footprint(symbol, rotation);
          const [ox, oy] = fixtureOrigin({ x, y }, w, h);
          parts.push(`<rect x="${ox}" y="${oy}" width="${w}" height="${h}" fill="${SCREEN.fixture}" fill-opacity="0.12" stroke="${SCREEN.fixture}" stroke-width="0.04"/>`);
          parts.push(symbolMarkup({ x: ox, y: oy, rotation, symbol: tool.id }, SCREEN, symbolHref, 0.7));
        }
      } else if (tool.kind === "access") {
        parts.push(`<rect x="${x}" y="${y}" width="1" height="1" fill="${SCREEN.fixture}" fill-opacity="0.18" stroke="${SCREEN.fixture}" stroke-width="0.04"/>`);
      } else if (tool.kind !== "edge") {
        parts.push(`<rect x="${x}" y="${y}" width="1" height="1" fill="none" stroke="${floorColour(strokeOwner() ?? undefined)}" stroke-width="0.06"/>`);
      }
    }
    layers.preview.innerHTML = parts.join("");
  }

  function describe(x: number, y: number): string {
    const owner = plan().decks[deck]?.cells[cellKey(x, y)];
    const what = owner === undefined ? "empty" : owner === CORRIDOR ? "corridor" : look()(owner).label;
    const hint =
      tool.kind === "paint" || tool.kind === "corridor" || tool.kind === "erase"
        ? "Drag to paint, Shift+drag for a rectangle."
        : tool.kind === "edge"
          ? "Click near a wall."
          : tool.kind === "symbol"
            ? "Click to place, R to turn, click a fitting to remove it."
            : "Click to place or remove.";
    return `${x}, ${y}: ${what}. ${hint} Wheel zooms; drag with the right button or Space to move.`;
  }

  svg.addEventListener("contextmenu", (event) => event.preventDefault());

  svg.addEventListener("pointerdown", (event) => {
    if (event.button === 1 || event.button === 2 || spaceHeld) {
      pan = { x: event.clientX, y: event.clientY, vx: view.x, vy: view.y };
      svg.setPointerCapture(event.pointerId);
      canvas.classList.add("fp-panning");
      return;
    }
    if (event.button !== 0) return;
    const p = at(event);
    const owner = strokeOwner();
    if (owner !== null) {
      const start: [number, number] = [p.x, p.y];
      stroke = { owner, squares: new Map([[cellKey(p.x, p.y), start]]), last: start, ...(event.shiftKey ? { anchor: start } : {}) };
      svg.setPointerCapture(event.pointerId);
      drawPreview();
      return;
    }
    if (tool.kind === "edge") {
      const edge = nearestEdge(p);
      const existing = plan().fixtures.find((f) => "edge" in f && f.deck === deck && f.x === edge.x && f.y === edge.y && f.edge === edge.edge);
      if (existing !== undefined && existing.kind === tool.edge) commit(removeFixture(plan(), existing));
      else commit(placeFixture(plan(), { kind: tool.edge, deck, ...edge }));
      return;
    }
    const existing = fixtureAt(p.x, p.y);
    if (existing !== undefined) {
      commit(removeFixture(plan(), existing));
      return;
    }
    if (tool.kind === "access") {
      const fixture: Fixture = { kind: tool.access, deck, x: p.x, y: p.y, rotation };
      commit(placeFixture(plan(), fixture));
      return;
    }
    if (tool.kind === "symbol") {
      const symbol = symbolById(tool.id);
      if (symbol === undefined) return;
      const [w, h] = footprint(symbol, rotation);
      const [ox, oy] = fixtureOrigin(p, w, h);
      commit(placeFixture(plan(), { kind: "symbol", deck, x: ox, y: oy, rotation, symbol: symbol.id }));
    }
  });

  svg.addEventListener("pointermove", (event) => {
    if (pan !== undefined) {
      view = { ...view, x: pan.vx - (event.clientX - pan.x) / view.scale, y: pan.vy - (event.clientY - pan.y) / view.scale };
      placeViewBox();
      return;
    }
    const p = at(event);
    if (stroke !== undefined) {
      const next: [number, number] = [p.x, p.y];
      if (next[0] !== stroke.last[0] || next[1] !== stroke.last[1]) {
        if (stroke.anchor === undefined) for (const sq of line(stroke.last, next)) stroke.squares.set(cellKey(sq[0], sq[1]), sq);
        stroke.last = next;
        drawPreview();
      }
      return;
    }
    if (hover === undefined || hover[0] !== p.x || hover[1] !== p.y) {
      hover = [p.x, p.y];
      status.textContent = describe(p.x, p.y);
      drawPreview();
    }
  });

  function endStroke(): void {
    if (stroke === undefined) return;
    const done = stroke;
    stroke = undefined;
    const squares = done.anchor !== undefined ? rectangle(done.anchor, done.last) : [...done.squares.values()];
    commit(paint(plan(), deck, squares, done.owner));
    advanceStateroom();
  }

  /** After drawing a stateroom, move the brush on to the next one not yet drawn. */
  function advanceStateroom(): void {
    if (tool.kind !== "paint" || !tool.owner.startsWith("staterooms#")) return;
    const component = components().find((c) => c.key === "staterooms");
    const tally = report.tallies.find((t) => t.key === "staterooms");
    if (component === undefined || tally === undefined) return;
    const n = Number(tool.owner.slice("staterooms#".length));
    if ((tally.instances?.[n] ?? 0) < SQUARES_PER_STATEROOM) return;
    selectTool({ kind: "paint", owner: nextStateroom(component, tally, n) });
  }

  svg.addEventListener("pointerup", () => {
    if (pan !== undefined) {
      pan = undefined;
      canvas.classList.remove("fp-panning");
      return;
    }
    endStroke();
  });
  svg.addEventListener("pointercancel", () => {
    pan = undefined;
    stroke = undefined;
    drawPreview();
  });
  svg.addEventListener("pointerleave", () => {
    if (stroke === undefined) {
      hover = undefined;
      drawPreview();
    }
  });

  function zoom(factor: number, around?: { clientX: number; clientY: number }): void {
    const box = svg.getBoundingClientRect();
    const cx = around === undefined ? box.width / 2 : around.clientX - box.left;
    const cy = around === undefined ? box.height / 2 : around.clientY - box.top;
    const scale = Math.max(6, Math.min(160, view.scale * factor));
    const wx = view.x + cx / view.scale;
    const wy = view.y + cy / view.scale;
    view = { scale, x: wx - cx / scale, y: wy - cy / scale };
    placeViewBox();
  }

  svg.addEventListener(
    "wheel",
    (event) => {
      event.preventDefault();
      zoom(event.deltaY < 0 ? 1.15 : 1 / 1.15, event);
    },
    { passive: false },
  );

  function fit(): void {
    const area = bounds(plan().decks) ?? { minX: 0, minY: 0, maxX: 24, maxY: 14 };
    const w = canvas.clientWidth || 800;
    const h = canvas.clientHeight || 600;
    const spanX = area.maxX - area.minX + 5;
    const spanY = area.maxY - area.minY + 5;
    const scale = Math.max(6, Math.min(60, Math.min(w / spanX, h / spanY)));
    view = {
      scale,
      x: area.minX - 2.5 - (w / scale - spanX) / 2,
      y: area.minY - 2.5 - (h / scale - spanY) / 2,
    };
    placeViewBox();
  }

  new ResizeObserver(() => {
    if (!fitted && canvas.clientWidth > 0) {
      fitted = true;
      fit();
    } else {
      placeViewBox();
    }
  }).observe(canvas);

  // -------------------------------------------------------------------- draw

  function draw(): void {
    report = check(host.manifest, plan());
    deck = Math.min(deck, plan().decks.length - 1);
    // A brush for a component the design no longer has, or a stateroom past the count, goes back to the corridor.
    if (tool.kind === "paint") {
      const key = tool.owner.split("#")[0]!;
      if (!components().some((c) => c.key === key)) tool = { kind: "corridor" };
    }
    drawSide();
    drawProblems();
    drawDeckBar();
    drawCanvas();
    canvas.dataset["tool"] = tool.kind;
  }

  draw();

  return {
    refresh: draw,
    fit,
    print: () => printPlan(host.manifest, plan()),
    key(event) {
      const target = event.target as HTMLElement | null;
      if (target !== null && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT")) return false;
      const mod = event.ctrlKey || event.metaKey;
      if (mod && event.key.toLowerCase() === "z") {
        if (event.shiftKey) redoOnce();
        else undoOnce();
        return true;
      }
      if (mod && event.key.toLowerCase() === "y") {
        redoOnce();
        return true;
      }
      if (!mod && event.key.toLowerCase() === "r") {
        rotation = ((rotation + 90) % 360) as Rotation;
        drawPreview();
        return true;
      }
      if (event.key === " " && event.type === "keydown") {
        spaceHeld = true;
        canvas.classList.add("fp-grab");
        return true;
      }
      if (event.key === " " && event.type === "keyup") {
        spaceHeld = false;
        canvas.classList.remove("fp-grab");
        return true;
      }
      if (event.key === "Escape") {
        stroke = undefined;
        selectTool({ kind: "corridor" });
        return true;
      }
      return false;
    },
  };
}
