/**
 * The floor plan screen. FloorPlanSpec section 10.
 *
 * The ship's components down the left, numbered as the plan's key numbers
 * them; the deck in the middle; the tools, the geomorph tiles and the
 * furniture down the right. The screen holds the editing state (which deck,
 * which tool, what is selected, where the view is, the undo history) and
 * nothing about the ship. The ship arrives as a manifest and a plan through
 * the host, every change goes back through `setPlan`, and what the panels
 * show is `check`'s report drawn out.
 */

import "./floorplan.css";
import type { Report, Tally } from "./check";
import { check, formatSquares } from "./check";
import { exportPng, exportSvg, printPlan } from "./export";
import type { Bounds } from "./geometry";
import { bounds, regions, storedEdge } from "./geometry";
import type { Component, ComponentGroup, Manifest } from "./manifest";
import { SQUARES_PER_STATEROOM } from "./manifest";
import type { AccessKind, EdgeFixture, EdgeKind, Fixture, FloorPlan, Owner, PlacedTile, Rotation, SquareFixture } from "./plan";
import {
  addDeck,
  CORRIDOR,
  cellKey,
  edgesOf,
  instanceOwner,
  moveDeck,
  moveSquares,
  paint,
  placeFixture,
  placeTile,
  removeDeck,
  removeFixture,
  removeTile,
  renameDeck,
  replaceFixture,
  replaceTile,
  shiftDeck,
  tiledSquares,
  tileFootprint,
  area,
  CELL,
  cellOf,
  toHalf,
} from "./plan";
import type { LabelMode } from "./render";
import {
  fittedSquares,
  fixturesMarkup,
  floorsMarkup,
  gridMarkup,
  GROUP_ORDER,
  numbered,
  labelsMarkup,
  looksFor,
  overlayMarkup,
  SCREEN,
  shortLabel,
  symbolMarkup,
  tileMarkup,
  tilesMarkup,
  unmatchedAccessMarkup,
  wallsMarkup,
} from "./render";
import type { SymbolCategory } from "./symbols";
import { ACCESS_SYMBOLS, CATEGORY_LABELS, footprint, symbolById, SYMBOLS } from "./symbols";
import type { TileEntry } from "./tiles";
import {
  canLoadFolder,
  chooseFolder,
  folderTiles,
  inFolder,
  loadedFolder,
  readFolderImage,
  readTile,
  reconnectFolder,
  rememberedFolder,
  tileById,
  tileHref,
} from "./tiles";

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
  | { readonly kind: "move" }
  | { readonly kind: "paint"; readonly owner: Owner }
  | { readonly kind: "corridor" }
  | { readonly kind: "erase" }
  | { readonly kind: "edge"; readonly edge: EdgeKind }
  | { readonly kind: "access"; readonly access: AccessKind; readonly symbol?: string }
  | { readonly kind: "symbol"; readonly id: string }
  | { readonly kind: "tile"; readonly id: string };

type Selection =
  | { readonly type: "fixture"; readonly index: number }
  | { readonly type: "tile"; readonly index: number }
  | { readonly type: "region"; readonly squares: readonly (readonly [number, number])[] };

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

/** The most tiles the browser lists at once; a search narrows the rest. */
const TILE_LIST_LIMIT = 120;

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
  let tool: Tool = { kind: "move" };
  let rotation: Rotation = 0;
  let labels: LabelMode = "names";
  /** Whether the next piece placed is mirrored. FP 7.1.2. */
  let flipped = false;
  let tileCategory = "";
  let tileSearch = "";
  let selection: Selection | undefined;
  let view = { x: -2, y: -2, scale: 28 };
  const undo: FloorPlan[] = [];
  const redo: FloorPlan[] = [];
  let report: Report = check(host.manifest, host.plan);
  let hover: Point | undefined;
  let fitted = false;
  let folderNote: { name: string; allowed: boolean } | undefined;

  // ------------------------------------------------------------------ layout

  const left = el("aside", { class: "fp-left", "aria-label": "The ship's components" });
  const right = el("aside", { class: "fp-right", "aria-label": "Tools, tiles and furniture" });
  const problems = el("div", { class: "fp-problems", role: "status" });
  const deckBar = el("div", { class: "fp-deckbar" });
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("class", "fp-svg");
  const layers = {
    grid: document.createElementNS(SVG_NS, "g"),
    overlay: document.createElementNS(SVG_NS, "g"),
    floors: document.createElementNS(SVG_NS, "g"),
    tiles: document.createElementNS(SVG_NS, "g"),
    walls: document.createElementNS(SVG_NS, "g"),
    fixtures: document.createElementNS(SVG_NS, "g"),
    labels: document.createElementNS(SVG_NS, "g"),
    marks: document.createElementNS(SVG_NS, "g"),
    selection: document.createElementNS(SVG_NS, "g"),
    preview: document.createElementNS(SVG_NS, "g"),
  };
  for (const layer of Object.values(layers)) svg.append(layer);
  layers.labels.setAttribute("pointer-events", "none");
  const canvas = el("div", { class: "fp-canvas" });
  canvas.append(svg);
  const status = el("div", { class: "fp-status" });
  const main = el("section", { class: "fp-main", "aria-label": "Decks" }, [problems, deckBar, canvas, status]);
  root.replaceChildren(el("div", { class: "fp" }, [left, main, right]));

  // ----------------------------------------------------------------- helpers

  const plan = () => host.plan;
  const components = () => host.manifest.components;
  const look = () => looksFor(components(), plan(), labels);

  function overlayDeck(): number | undefined {
    if (overlay === null) return undefined;
    const at = overlay === "above" ? deck - 1 : overlay;
    return at >= 0 && at < plan().decks.length && at !== deck ? at : undefined;
  }

  function commit(next: FloorPlan, keep?: Selection): void {
    if (next === plan()) return;
    undo.push(plan());
    if (undo.length > HISTORY) undo.shift();
    redo.length = 0;
    selection = keep;
    host.setPlan(next);
    draw();
  }

  function undoOnce(): void {
    const last = undo.pop();
    if (last === undefined) return;
    redo.push(plan());
    selection = undefined;
    host.setPlan(last);
    draw();
  }

  function redoOnce(): void {
    const next = redo.pop();
    if (next === undefined) return;
    undo.push(plan());
    selection = undefined;
    host.setPlan(next);
    draw();
  }

  /** The colour a brush paints, for the stroke preview. */
  function floorColour(owner: Owner | undefined): string {
    if (owner === undefined) return SCREEN.warn;
    return SCREEN.floor[looksFor(components(), plan())(owner).floor];
  }

  function selectTool(next: Tool): void {
    tool = next;
    if (next.kind !== "move") selection = undefined;
    drawLeft();
    drawRight();
    drawSelection();
    drawPreview();
    canvas.dataset["tool"] = next.kind;
    if (next.kind === "tile" && inFolder(next.id)) void readFolderImage(next.id).then(drawPreview);
  }

  // ------------------------------------------------------- the left: components

  function stateroomChips(component: Component, tally: Tally): HTMLElement {
    const chips = el("div", { class: "fp-chips" });
    for (let i = 1; i <= component.count; i++) {
      const placed = tally.instances?.[i] ?? 0;
      const state = placed === 0 ? "empty" : placed === SQUARES_PER_STATEROOM ? "met" : placed < SQUARES_PER_STATEROOM ? "short" : "over";
      const owner = instanceOwner(component.key, i);
      const chosen = tool.kind === "paint" && tool.owner === owner;
      chips.append(
        button(String(i), () => selectTool({ kind: "paint", owner }), {
          class: `fp-chip fp-${state}${chosen ? " on" : ""}`,
          title: `Stateroom ${i}: ${formatSquares(placed)} of ${SQUARES_PER_STATEROOM} squares`,
        }),
      );
    }
    return chips;
  }

  /** The first stateroom not yet drawn, or the first if all are. */
  function nextStateroom(component: Component, tally: Tally | undefined, after = 0): Owner {
    for (let step = 1; step <= component.count; step++) {
      const i = ((after + step - 1) % component.count) + 1;
      if ((tally?.instances?.[i] ?? 0) < SQUARES_PER_STATEROOM) return instanceOwner(component.key, i);
    }
    return instanceOwner(component.key, 1);
  }

  function componentRow(component: Component, number: number, tally: Tally): HTMLElement {
    const several = component.key === "staterooms" && component.count > 1;
    const chosen = tool.kind === "paint" && (tool.owner === component.key || tool.owner.startsWith(`${component.key}#`));
    const row = el("div", { class: `fp-row fp-${tally.status}${chosen ? " on" : ""}` });
    const pick = button(
      "",
      () => selectTool({ kind: "paint", owner: several ? nextStateroom(component, tally) : component.key }),
      { class: "fp-pick", title: `${number}. ${component.label}. Pick to paint its squares.` },
    );
    pick.append(
      el("span", { class: "fp-number" }, [String(number)]),
      el("span", { class: "fp-swatch", style: `background:${SCREEN.floor[component.group]}` }),
      el("span", { class: "fp-name" }, [shortLabel(component)]),
      el("span", { class: "fp-count" }, [`${formatSquares(tally.placed)} / ${tally.target}${tally.required ? "" : " opt"}`]),
    );
    row.append(pick);
    if (several) row.append(stateroomChips(component, tally));
    return row;
  }

  function drawLeft(): void {
    const scroll = left.querySelector(".fp-list")?.scrollTop ?? 0;
    const tallies = new Map(report.tallies.map((t) => [t.key, t]));
    const list = el("div", { class: "fp-list" });
    const all = numbered(components()).map(({ component, number }) => ({ c: component, number }));
    for (const group of GROUP_ORDER) {
      const members = all.filter(({ c }) => c.group === group);
      if (members.length === 0) continue;
      list.append(el("h3", { class: "fp-group" }, [GROUP_NAMES[group]]));
      for (const { c, number } of members) {
        const tally = tallies.get(c.key);
        if (tally !== undefined) list.append(componentRow(c, number, tally));
      }
    }
    if (report.orphans.length > 0) {
      list.append(el("h3", { class: "fp-group" }, ["No longer in the design"]));
      for (const orphan of report.orphans) {
        list.append(
          el("div", { class: "fp-row fp-orphaned" }, [
            el("span", { class: "fp-name" }, [orphan.label]),
            el("span", { class: "fp-count" }, [formatSquares(orphan.squares)]),
            button("Clear", () => clearOrphan(orphan.key), { class: "fp-clear", title: "Clear these squares on every deck" }),
          ]),
        );
      }
    }
    const ship = report.ship;
    const inBand = report.total >= ship.low && report.total <= ship.high;
    left.replaceChildren(
      el("h2", { class: "fp-heading" }, [host.manifest.shipName]),
      el("p", { class: "fp-hint" }, ["Pick a component, then paint its squares on the deck."]),
      list,
      el("div", { class: "fp-totals" }, [
        el("div", {}, [`Corridors ${formatSquares(report.corridor)}`]),
        el("div", { class: report.total === 0 ? "" : inBand ? "fp-met" : "fp-short" }, [
          `Plan ${formatSquares(report.total)} of ${ship.target} squares (${ship.low} to ${ship.high})`,
        ]),
      ]),
    );
    const restored = left.querySelector(".fp-list");
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

  // ------------------------------------------------- the right: tools, tiles, furniture

  function toolButton(label: string, next: Tool, title: string, active: boolean): HTMLButtonElement {
    return button(label, () => selectTool(next), { class: `fp-tool${active ? " on" : ""}`, title });
  }

  function drawRight(): void {
    const scroll = right.querySelector(".fp-browse")?.scrollTop ?? 0;
    const isAccess = (access: AccessKind, symbol?: string) =>
      tool.kind === "access" && tool.access === access && (tool.symbol ?? ACCESS_SYMBOLS[access]) === (symbol ?? ACCESS_SYMBOLS[access]);
    const tools = el("div", { class: "fp-tools" }, [
      el("div", { class: "fp-toolrow" }, [
        toolButton("Move", { kind: "move" }, "Select and drag tiles, fittings, doors and rooms. R turns, Delete removes, the arrow keys nudge.", tool.kind === "move"),
        toolButton("Corridor", { kind: "corridor" }, "Paint corridor and access space, which belongs to no component", tool.kind === "corridor"),
        toolButton("Erase", { kind: "erase" }, "Clear squares", tool.kind === "erase"),
      ]),
      el("div", { class: "fp-toolrow" }, [
        button("Undo", undoOnce, { class: "fp-tool", title: "Undo (Ctrl+Z)", ...(undo.length === 0 ? { disabled: "" } : {}) }),
        button("Redo", redoOnce, { class: "fp-tool", title: "Redo (Ctrl+Y)", ...(redo.length === 0 ? { disabled: "" } : {}) }),
      ]),
      el("h3", { class: "fp-group" }, ["In walls"]),
      el("div", { class: "fp-toolrow" }, [
        toolButton("Door", { kind: "edge", edge: "door" }, "Click a wall for a door; drag along it for a wider one. Doors on neighbouring squares stay separate.", tool.kind === "edge" && tool.edge === "door"),
        toolButton("Iris valve", { kind: "edge", edge: "iris" }, "Click a wall for an iris valve in it", tool.kind === "edge" && tool.edge === "iris"),
      ]),
      el("h3", { class: "fp-group" }, ["Between decks"]),
      el("div", { class: "fp-toolrow" }, [
        toolButton("Lift", { kind: "access", access: "lift" }, "A lift joins every deck with one on the same square", isAccess("lift")),
        toolButton("Iris, floor", { kind: "access", access: "hatch", symbol: "iris-floor" }, "An iris valve in the floor, to the deck below", isAccess("hatch", "iris-floor")),
        toolButton("Iris, ceiling", { kind: "access", access: "hatch", symbol: "iris-ceiling" }, "An iris valve in the ceiling, to the deck above", isAccess("hatch", "iris-ceiling")),
        toolButton("Stairs", { kind: "access", access: "stairs" }, "Stairs join decks where they line up", isAccess("stairs")),
      ]),
      el("h3", { class: "fp-group" }, ["Turn and flip"]),
      el("div", { class: "fp-toolrow" }, [
        button("Turn", turn, { class: "fp-tool", title: "Turn the selected piece, or the next one placed, a quarter (R)" }),
        button("Flip", flip, { class: `fp-tool${flipped && tool.kind !== "move" ? " on" : ""}`, title: "Mirror the selected piece, or the next one placed (F)" }),
      ]),
      el("h3", { class: "fp-group" }, ["Room labels"]),
      el("div", { class: "fp-toolrow fp-seg" }, [
        button("Names", () => setLabels("names"), { class: `fp-tool${labels === "names" ? " on" : ""}`, title: "Label rooms by name while designing" }),
        button("Numbers", () => setLabels("numbers"), { class: `fp-tool${labels === "numbers" ? " on" : ""}`, title: "Number rooms, as a finished plan is, with a key on export" }),
      ]),
    ]);
    const browse = el("div", { class: "fp-browse" });
    fillLibrary(browse);
    fillTiles(browse);
    right.replaceChildren(tools, browse);
    browse.scrollTop = scroll;
  }

  function setLabels(mode: LabelMode): void {
    labels = mode;
    drawRight();
    drawCanvas();
  }

  /** The library: furniture, fittings and the few geomorph pieces most ships want, in one list. FP 7.7. */
  function fillLibrary(into: HTMLElement): void {
    const categories = (Object.keys(CATEGORY_LABELS) as SymbolCategory[]).filter((c) => SYMBOLS.some((s) => s.category === c));
    for (const category of categories) {
      into.append(el("h3", { class: "fp-group" }, [CATEGORY_LABELS[category]]));
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
      into.append(grid);
    }
    into.append(credit("Robert Pearce's Traveller Starship Symbols and Adventure Class Geomorphs"));
  }

  /** The licence asks for this wherever the art appears. FP 7.3, 12.1. */
  function credit(what: string): HTMLElement {
    return el("p", { class: "fp-credit" }, [
      `${what}, rendered by Eric B. Smith, under `,
      el("a", { href: "https://creativecommons.org/licenses/by-nc/4.0/", target: "_blank", rel: "noopener" }, ["CC BY-NC 4.0"]),
      ".",
    ]);
  }

  /** Thumbnails of folder tiles are read when they scroll into view, not all at once. */
  const thumbnails = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      const img = entry.target as HTMLImageElement;
      const id = img.dataset["tile"];
      thumbnails.unobserve(img);
      if (id !== undefined) void readFolderImage(id).then((read) => read !== undefined && (img.src = read.uri));
    }
  });

  /** Geomorph tiles from the designer's own folder, for larger ships. FP 12. */
  function fillTiles(into: HTMLElement): void {
    into.append(el("h3", { class: "fp-group" }, ["Geomorph folder"]));
    const folder = loadedFolder();
    const source = el("div", { class: "fp-source" });
    if (folder !== undefined) {
      source.append(el("span", {}, [`${folder.name}: ${folder.tiles} tiles.`]), " ", button("Change", () => void pickFolder(), { class: "fp-small" }));
    } else if (folderNote !== undefined && !folderNote.allowed) {
      source.append(
        button(`Reconnect ${folderNote.name}`, () => void reconnect(), { class: "fp-small", title: "Allow the geomorph folder chosen last time" }),
        " ",
        button("Choose another", () => void pickFolder(), { class: "fp-small" }),
      );
    } else if (canLoadFolder()) {
      source.append(
        el("span", {}, ["For larger ships, the whole geomorph archive from your own disk. "]),
        button("Load geomorph folder…", () => void pickFolder(), { class: "fp-small", title: "Point at your copy of the Adventure Class geomorphs" }),
      );
    } else {
      source.append(el("span", {}, ["Loading a geomorph folder needs Edge or Chrome."]));
    }
    into.append(source);

    const all = folderTiles();
    if (all.length === 0) return;
    const categories = [...new Set(all.map((t) => t.category))].sort();
    const pick = el("select", { class: "fp-tilecat", "aria-label": "Tile category" });
    for (const c of categories) pick.append(new Option(c, c));
    pick.value = categories.includes(tileCategory) ? tileCategory : categories[0]!;
    pick.addEventListener("change", () => {
      tileCategory = pick.value;
      drawRight();
    });
    const search = el("input", { class: "fp-tilesearch", type: "search", placeholder: "Search all tiles", value: tileSearch, "aria-label": "Search tiles" });
    search.addEventListener("input", () => {
      tileSearch = search.value;
      const at = search.selectionStart;
      drawRight();
      const again = right.querySelector<HTMLInputElement>(".fp-tilesearch");
      again?.focus();
      if (at !== null) again?.setSelectionRange(at, at);
    });
    into.append(el("div", { class: "fp-tilefilter" }, [pick, search]));

    const words = tileSearch.toLowerCase().split(/\s+/).filter((w) => w !== "");
    const matches = all.filter((t) =>
      words.length > 0
        ? words.every((w) => `${t.code} ${t.name} ${t.category} ${t.side ?? ""}`.toLowerCase().includes(w))
        : t.category === pick.value,
    );
    matches.sort((a, b) => a.code.localeCompare(b.code) || a.name.localeCompare(b.name));
    const grid = el("div", { class: "fp-tiles" });
    for (const t of matches.slice(0, TILE_LIST_LIMIT)) grid.append(tileItem(t));
    into.append(grid);
    if (matches.length > TILE_LIST_LIMIT) into.append(el("p", { class: "fp-hint" }, [`${matches.length - TILE_LIST_LIMIT} more; search to narrow them.`]));
    if (matches.length === 0) into.append(el("p", { class: "fp-hint" }, ["No tiles match."]));
  }

  function tileItem(t: TileEntry): HTMLElement {
    const chosen = tool.kind === "tile" && tool.id === t.id;
    const size = `${t.squares[0]}×${t.squares[1]}`;
    const item = button("", () => selectTool({ kind: "tile", id: t.id }), {
      class: `fp-tileitem${chosen ? " on" : ""}`,
      title: `${t.code}${t.side === null ? "" : ` (${t.side})`}: ${t.name}. ${size} squares${t.tons === null ? "" : `, ${t.tons} tons`}${t.overlay ? ", overlay" : ""}.`,
    });
    const img = el("img", { alt: "", loading: "lazy" });
    const href = tileHref(t.id);
    if (href !== undefined) img.src = href;
    else {
      img.dataset["tile"] = t.id;
      thumbnails.observe(img);
    }
    item.append(
      img,
      el("span", { class: "fp-tilecode" }, [`${t.code}${t.side === null ? "" : ` ${t.side[0]}`}`]),
      el("span", { class: "fp-tilemeta" }, [`${size}${t.tons === null ? (t.overlay ? " overlay" : "") : ` · ${t.tons}t`}`]),
    );
    return item;
  }

  async function pickFolder(): Promise<void> {
    if (await chooseFolder()) {
      folderNote = undefined;
      drawRight();
      drawCanvas();
    }
  }

  async function reconnect(): Promise<void> {
    if (await reconnectFolder()) {
      folderNote = undefined;
      drawRight();
      drawCanvas();
    }
  }

  // ---------------------------------------------------------------- problems

  function drawProblems(): void {
    const list = report.problems;
    if (list.length === 0) {
      problems.replaceChildren(
        el("p", { class: "fp-ok" }, [
          report.total === 0 ? "Lay geomorph tiles from the right, then pick components on the left and paint their squares." : "Every component has its squares.",
        ]),
      );
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
        button(
          d.name,
          () => {
            deck = at;
            selection = undefined;
            draw();
          },
          {
            class: `fp-tab${at === deck ? " on" : ""}${cut ? " fp-cut" : ""}`,
            role: "tab",
            "aria-selected": String(at === deck),
            title: cut ? "No way to the rest of the ship" : undefined,
          },
        ),
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

    deckBar.replaceChildren(
      tabs,
      el("div", { class: "fp-decktools" }, [
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
          const used = d !== undefined && (Object.keys(d.cells).length > 0 || plan().tiles.some((t) => t.deck === deck));
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
        button("SVG", () => void exportSvg(host.manifest, plan(), deck, labels), { class: "fp-small", title: "Save this deck as an SVG drawing" }),
        button("PNG", () => void exportPng(host.manifest, plan(), deck, labels), { class: "fp-small", title: "Save this deck as a PNG image" }),
      ]),
    );
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

  let pendingImages = false;
  /** Tiles from the folder are read once and drawn when they arrive. */
  function readMissingTiles(): void {
    if (pendingImages) return;
    const wanted = [...new Set(plan().tiles.filter((t) => t.deck === deck && tileHref(t.tile) === undefined && inFolder(t.tile)).map((t) => t.tile))];
    if (wanted.length === 0) return;
    pendingImages = true;
    void Promise.all(wanted.map(readFolderImage)).then(() => {
      pendingImages = false;
      drawCanvas();
    });
  }

  function drawCanvas(): void {
    const d = plan().decks[deck];
    if (d === undefined) return;
    const looks = look();
    placeViewBox();
    const under = overlayDeck();
    const below = under === undefined ? undefined : plan().decks[under];
    const tiled = tiledSquares(plan(), deck);
    layers.overlay.innerHTML = below === undefined ? "" : overlayMarkup(below, SCREEN);
    layers.floors.innerHTML = floorsMarkup(d, looks, SCREEN);
    layers.tiles.innerHTML = tilesMarkup(plan(), deck, SCREEN, tileHref);
    layers.walls.innerHTML = wallsMarkup(d, SCREEN, 0.1, "", tiled);
    layers.fixtures.innerHTML = fixturesMarkup(plan(), deck, SCREEN, symbolHref);
    layers.labels.innerHTML = labelsMarkup(d, looks, SCREEN, fittedSquares(plan(), deck));
    layers.marks.innerHTML = under === undefined ? "" : unmatchedAccessMarkup(plan(), deck, under, SCREEN);
    readMissingTiles();
    drawSelection();
    drawPreview();
  }

  // ------------------------------------------------------------ hit testing

  /**
   * Where a pointer is: exactly, in squares, and the half-square cell it is
   * in, with how far across that cell it is. Everything sits on the half
   * square. FP 4.2.1.
   */
  interface Point {
    readonly px: number;
    readonly py: number;
    readonly x: number;
    readonly y: number;
    readonly fx: number;
    readonly fy: number;
  }

  function at(event: PointerEvent | WheelEvent): Point {
    const box = svg.getBoundingClientRect();
    const px = view.x + (event.clientX - box.left) / view.scale;
    const py = view.y + (event.clientY - box.top) / view.scale;
    const x = cellOf(px);
    const y = cellOf(py);
    return { px, py, x, y, fx: (px - x) / CELL, fy: (py - y) / CELL };
  }

  /** The half-square stretch of wall nearest the pointer, in the stored north-or-west form, and how far away it is in squares. */
  function nearestEdge(p: Point) {
    const choices = [
      { side: "n" as const, d: p.fy },
      { side: "s" as const, d: 1 - p.fy },
      { side: "w" as const, d: p.fx },
      { side: "e" as const, d: 1 - p.fx },
    ].sort((a, b) => a.d - b.d);
    return { ...storedEdge({ x: p.x, y: p.y, side: choices[0]!.side }), distance: choices[0]!.d * CELL };
  }

  /**
   * Where something of a size goes so the pointer is in its middle. Editing
   * puts things on whole squares; only Move goes in half squares. FP 4.2.2.
   */
  function centredOrigin(p: Point, w: number, h: number): [number, number] {
    return [Math.round(p.px - w / 2), Math.round(p.py - h / 2)];
  }

  /** The whole-square wall nearest the pointer, in the stored north-or-west form, for putting a door in. */
  function nearestWall(p: Point): { x: number; y: number; edge: "n" | "w" } {
    const sx = Math.floor(p.px);
    const sy = Math.floor(p.py);
    const fx = p.px - sx;
    const fy = p.py - sy;
    const choices = [
      { x: sx, y: sy, edge: "n" as const, d: fy },
      { x: sx, y: sy + 1, edge: "n" as const, d: 1 - fy },
      { x: sx, y: sy, edge: "w" as const, d: fx },
      { x: sx + 1, y: sy, edge: "w" as const, d: 1 - fx },
    ].sort((a, b) => a.d - b.d);
    const best = choices[0]!;
    return { x: best.x, y: best.y, edge: best.edge };
  }

  function fixtureSize(f: Pick<SquareFixture, "kind" | "symbol" | "rotation">): readonly [number, number] {
    const id = f.symbol ?? (f.kind === "symbol" ? undefined : ACCESS_SYMBOLS[f.kind]);
    const symbol = symbolById(id);
    return symbol === undefined ? [1, 1] : footprint(symbol, f.rotation);
  }

  /** The square fixture on this deck under a point, if any, with its index. */
  function fixtureAt(x: number, y: number): number | undefined {
    const fixtures = plan().fixtures;
    for (let i = fixtures.length - 1; i >= 0; i--) {
      const f = fixtures[i]!;
      if (f.deck !== deck || "edge" in f) continue;
      const [w, h] = fixtureSize(f);
      if (x >= f.x && x < f.x + w && y >= f.y && y < f.y + h) return i;
    }
    return undefined;
  }

  /** The door or iris valve in the wall nearest the pointer, if the pointer is close to it. */
  function edgeFixtureAt(p: Point): number | undefined {
    const edge = nearestEdge(p);
    if (edge.distance > 0.2) return undefined;
    const key = `${edge.x},${edge.y},${edge.edge}`;
    const fixtures = plan().fixtures;
    for (let i = fixtures.length - 1; i >= 0; i--) {
      const f = fixtures[i]!;
      if (f.deck === deck && "edge" in f && edgesOf(f).includes(key)) return i;
    }
    return undefined;
  }

  /** The topmost tile on this deck under a point, if any. */
  function tileAt(x: number, y: number): number | undefined {
    const tiles = plan().tiles;
    for (let i = tiles.length - 1; i >= 0; i--) {
      const t = tiles[i]!;
      if (t.deck !== deck) continue;
      const [w, h] = tileFootprint(t);
      if (x >= t.x && x < t.x + w && y >= t.y && y < t.y + h) return i;
    }
    return undefined;
  }

  /** What the Move tool would pick up at a point: a fitting, a door, a room, a tile, in that order. */
  function pickAt(p: Point): Selection | undefined {
    const fixture = fixtureAt(p.px, p.py);
    if (fixture !== undefined) return { type: "fixture", index: fixture };
    const edge = edgeFixtureAt(p);
    if (edge !== undefined) return { type: "fixture", index: edge };
    const d = plan().decks[deck];
    if (d?.cells[cellKey(p.x, p.y)] !== undefined) {
      const region = regions(d).find((r) => r.squares.some(([x, y]) => x === p.x && y === p.y));
      if (region !== undefined) return { type: "region", squares: region.squares };
    }
    const tile = tileAt(p.px, p.py);
    if (tile !== undefined) return { type: "tile", index: tile };
    return undefined;
  }

  // ------------------------------------------------------- selection and preview

  /** The outline of a selection, moved by an offset while it is being dragged. */
  function selectionMarkup(sel: Selection, dx: number, dy: number, colour: string): string {
    const outline = (x: number, y: number, w: number, h: number) =>
      `<rect x="${x + dx - 0.05}" y="${y + dy - 0.05}" width="${w + 0.1}" height="${h + 0.1}" fill="none" stroke="${colour}" stroke-width="0.08" stroke-dasharray="0.25 0.15"/>`;
    if (sel.type === "tile") {
      const t = plan().tiles[sel.index];
      if (t === undefined) return "";
      const [w, h] = tileFootprint(t);
      const ghost = dx === 0 && dy === 0 ? "" : tileMarkup({ ...t, x: t.x + dx, y: t.y + dy }, SCREEN, tileHref(t.tile), 0.6);
      return ghost + outline(t.x, t.y, w, h);
    }
    if (sel.type === "fixture") {
      const f = plan().fixtures[sel.index];
      if (f === undefined) return "";
      if ("edge" in f) {
        const len = f.length ?? 1;
        return f.edge === "n" ? outline(f.x, f.y - 0.2, len, 0.4) : outline(f.x - 0.2, f.y, 0.4, len);
      }
      const [w, h] = fixtureSize(f);
      const ghost =
        dx === 0 && dy === 0
          ? ""
          : symbolMarkup({ ...f, x: f.x + dx, y: f.y + dy, symbol: f.symbol ?? (f.kind === "symbol" ? undefined : ACCESS_SYMBOLS[f.kind]) }, SCREEN, symbolHref, 0.6);
      return ghost + outline(f.x, f.y, w, h);
    }
    return sel.squares
      .map(([x, y]) => `<rect x="${x + dx}" y="${y + dy}" width="${CELL}" height="${CELL}" fill="${SCREEN.fixture}" fill-opacity="${dx === 0 && dy === 0 ? 0.18 : 0.4}"/>`)
      .join("");
  }

  function drawSelection(): void {
    layers.selection.innerHTML = selection === undefined ? "" : selectionMarkup(selection, drag?.dx ?? 0, drag?.dy ?? 0, SCREEN.fixture);
  }

  /**
   * A stroke of the brush: the cells painted so far, and the corner of the
   * brush where it last was. With Shift it is a rectangle from where it began.
   */
  let stroke:
    | { readonly owner: Owner | undefined; cells: Map<string, [number, number]>; last: [number, number]; anchor?: [number, number] }
    | undefined;
  /** A door being dragged along a wall: the wall, where along it the drag began and where it is now. */
  let doorDrag: { edge: "n" | "w"; fixed: number; start: number; end: number } | undefined;
  let drag: { from: [number, number]; dx: number; dy: number } | undefined;
  let pan: { x: number; y: number; vx: number; vy: number } | undefined;
  let spaceHeld = false;

  function strokeOwner(): Owner | undefined | null {
    if (tool.kind === "paint") return tool.owner;
    if (tool.kind === "corridor") return CORRIDOR;
    if (tool.kind === "erase") return undefined;
    return null;
  }

  /** The square under the pointer, which is where the brush paints: editing is in whole squares. FP 4.2.2. */
  function brushAt(p: Point): [number, number] {
    return [Math.floor(p.px), Math.floor(p.py)];
  }

  /** The cells a stroke covers: everywhere the brush went, or the rectangle from where it began to where it is. */
  function strokeCells(s: NonNullable<typeof stroke>): [number, number][] {
    if (s.anchor === undefined) return [...s.cells.values()];
    const x0 = Math.min(s.anchor[0], s.last[0]);
    const y0 = Math.min(s.anchor[1], s.last[1]);
    const x1 = Math.max(s.anchor[0], s.last[0]);
    const y1 = Math.max(s.anchor[1], s.last[1]);
    return area(x0, y0, x1 - x0 + 1, y1 - y0 + 1);
  }

  /** Lay the brush everywhere between its last corner and this one, so a fast drag leaves no gaps. */
  function sweep(s: NonNullable<typeof stroke>, to: [number, number]): void {
    for (const [sx, sy] of line(s.last, to)) for (const c of area(sx, sy, 1, 1)) s.cells.set(cellKey(c[0], c[1]), c);
  }

  /**
   * The door or valve being placed, on whole squares: a click puts one in the
   * square of wall under the pointer, a drag along the wall makes a door as
   * many squares long as the drag. An iris valve is always a square. Move can
   * slide either half a square afterwards. FP 7.1.1.
   */
  function doorSpan(): EdgeFixture | undefined {
    if (doorDrag === undefined || tool.kind !== "edge") return undefined;
    const { edge, fixed, start, end } = doorDrag;
    const a = Math.floor(start);
    const b = tool.edge === "iris" ? a : Math.floor(end);
    const from = Math.min(a, b);
    const length = Math.abs(b - a) + 1;
    const at = edge === "n" ? { x: from, y: fixed } : { x: fixed, y: from };
    return { kind: tool.edge, deck, ...at, edge, ...(length !== 1 ? { length } : {}) };
  }

  function drawPreview(): void {
    const parts: string[] = [];
    if (stroke !== undefined) {
      const colour = floorColour(stroke.owner);
      for (const [x, y] of strokeCells(stroke)) {
        parts.push(
          stroke.owner === undefined
            ? `<rect x="${x + 0.08}" y="${y + 0.08}" width="0.34" height="0.34" fill="none" stroke="${colour}" stroke-width="0.05"/>`
            : `<rect x="${x}" y="${y}" width="${CELL}" height="${CELL}" fill="${colour}" opacity="0.85"/>`,
        );
      }
    } else if (doorDrag !== undefined) {
      const span = doorSpan();
      if (span !== undefined) {
        const len = span.length ?? 1;
        parts.push(
          span.edge === "n"
            ? `<rect x="${span.x}" y="${span.y - 0.15}" width="${len}" height="0.3" fill="${SCREEN.fixture}" fill-opacity="0.5"/>`
            : `<rect x="${span.x - 0.15}" y="${span.y}" width="0.3" height="${len}" fill="${SCREEN.fixture}" fill-opacity="0.5"/>`,
        );
      }
    } else if (hover !== undefined && drag === undefined) {
      if (tool.kind === "symbol") {
        const symbol = symbolById(tool.id);
        if (symbol !== undefined) {
          const [w, h] = footprint(symbol, rotation);
          const [ox, oy] = centredOrigin(hover, w, h);
          parts.push(`<rect x="${ox}" y="${oy}" width="${w}" height="${h}" fill="${SCREEN.fixture}" fill-opacity="0.12" stroke="${SCREEN.fixture}" stroke-width="0.04"/>`);
          parts.push(symbolMarkup({ x: ox, y: oy, rotation, flip: flipped, symbol: tool.id }, SCREEN, symbolHref, 0.7));
        }
      } else if (tool.kind === "tile") {
        const entry = tileById(tool.id);
        if (entry !== undefined) {
          const ghost = ghostTile(entry, hover);
          const [w, h] = tileFootprint(ghost);
          parts.push(`<rect x="${ghost.x}" y="${ghost.y}" width="${w}" height="${h}" fill="${SCREEN.fixture}" fill-opacity="0.08" stroke="${SCREEN.fixture}" stroke-width="0.05"/>`);
          parts.push(tileMarkup(ghost, SCREEN, tileHref(entry.id), 0.65));
        }
      } else if (tool.kind === "access") {
        const [ox, oy] = centredOrigin(hover, 1, 1);
        parts.push(symbolMarkup({ x: ox, y: oy, rotation, flip: flipped, symbol: tool.symbol ?? ACCESS_SYMBOLS[tool.access] }, SCREEN, symbolHref, 0.6));
      } else if (tool.kind === "edge") {
        const edge = nearestWall(hover);
        const from = Math.floor(edge.edge === "n" ? hover.px : hover.py);
        parts.push(
          edge.edge === "n"
            ? `<rect x="${from}" y="${edge.y - 0.12}" width="1" height="0.24" fill="${SCREEN.fixture}" fill-opacity="0.35"/>`
            : `<rect x="${edge.x - 0.12}" y="${from}" width="0.24" height="1" fill="${SCREEN.fixture}" fill-opacity="0.35"/>`,
        );
      } else if (tool.kind !== "move") {
        const [bx, by] = brushAt(hover);
        parts.push(`<rect x="${bx}" y="${by}" width="1" height="1" fill="none" stroke="${floorColour(strokeOwner() ?? undefined)}" stroke-width="0.06"/>`);
      }
    }
    layers.preview.innerHTML = parts.join("");
  }

  function ghostTile(entry: TileEntry, p: Point): PlacedTile {
    const footprintOf = rotation === 90 || rotation === 270 ? [entry.squares[1], entry.squares[0]] : [entry.squares[0], entry.squares[1]];
    const [ox, oy] = centredOrigin(p, footprintOf[0]!, footprintOf[1]!);
    // Adventure Class images carry two squares of margin all round; the real size replaces this once the image is read.
    const pixels = readTile(entry.id)?.pixels ?? ([(entry.squares[0] + 4) * 60, (entry.squares[1] + 4) * 60] as const);
    return { deck, x: ox, y: oy, rotation, ...(flipped ? { flip: true } : {}), tile: entry.id, squares: entry.squares, pixels, code: entry.code };
  }

  function describe(p: Point): string {
    const owner = plan().decks[deck]?.cells[cellKey(p.x, p.y)];
    const what = owner === undefined ? "empty" : owner === CORRIDOR ? "corridor" : looksFor(components(), plan())(owner).label;
    const hint =
      tool.kind === "move"
        ? "Drag a tile, fitting, door or room to move it by half squares; R turns, F flips, Delete removes, the arrows nudge."
        : tool.kind === "paint" || tool.kind === "corridor" || tool.kind === "erase"
          ? "Drag to paint, Shift+drag for a rectangle."
          : tool.kind === "edge"
            ? tool.edge === "door"
              ? "Click a wall for a door, drag along it for a wide one."
              : "Click a wall for an iris valve."
            : tool.kind === "tile" || tool.kind === "symbol"
              ? "Click to place; R turns, F flips. Use Move to take one away."
              : "Click to place. Use Move to take one away.";
    return `${p.px.toFixed(1)}, ${p.py.toFixed(1)}: ${what}. ${hint} Wheel zooms; right-drag or Space-drag moves the view.`;
  }

  // ------------------------------------------------------------ interaction

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
    svg.setPointerCapture(event.pointerId);

    if (tool.kind === "move") {
      selection = pickAt(p);
      drag = selection === undefined ? undefined : { from: [p.px, p.py], dx: 0, dy: 0 };
      drawSelection();
      return;
    }
    const owner = strokeOwner();
    if (owner !== null) {
      const start = brushAt(p);
      stroke = { owner, cells: new Map(), last: start, ...(event.shiftKey ? { anchor: start } : {}) };
      sweep(stroke, start);
      drawPreview();
      return;
    }
    if (tool.kind === "edge") {
      const edge = nearestWall(p);
      const along = edge.edge === "n" ? p.px : p.py;
      doorDrag = { edge: edge.edge, fixed: edge.edge === "n" ? edge.y : edge.x, start: along, end: along };
      drawPreview();
      return;
    }
    if (tool.kind === "tile") {
      const entry = tileById(tool.id);
      if (entry === undefined) return;
      // The image is read first, so the tile is placed knowing its true size.
      void readFolderImage(entry.id).then(() => commit(placeTile(plan(), ghostTile(entry, p))));
      return;
    }
    // Placing always places, even over another piece: a chair goes on a
    // fitted room's floor. Taking a piece away is Move and Delete.
    if (tool.kind === "access") {
      const [ox, oy] = centredOrigin(p, 1, 1);
      const fixture: Fixture = {
        kind: tool.access,
        deck,
        x: ox,
        y: oy,
        rotation,
        ...(flipped ? { flip: true } : {}),
        ...(tool.symbol === undefined ? {} : { symbol: tool.symbol }),
      };
      commit(placeFixture(plan(), fixture));
      return;
    }
    if (tool.kind === "symbol") {
      const symbol = symbolById(tool.id);
      if (symbol === undefined) return;
      const [w, h] = footprint(symbol, rotation);
      const [ox, oy] = centredOrigin(p, w, h);
      commit(placeFixture(plan(), { kind: "symbol", deck, x: ox, y: oy, rotation, ...(flipped ? { flip: true } : {}), symbol: symbol.id }));
    }
  });

  svg.addEventListener("pointermove", (event) => {
    if (pan !== undefined) {
      view = { ...view, x: pan.vx - (event.clientX - pan.x) / view.scale, y: pan.vy - (event.clientY - pan.y) / view.scale };
      placeViewBox();
      return;
    }
    const p = at(event);
    if (drag !== undefined) {
      const dx = toHalf(p.px - drag.from[0]);
      const dy = toHalf(p.py - drag.from[1]);
      if (dx !== drag.dx || dy !== drag.dy) {
        drag = { ...drag, dx, dy };
        drawSelection();
      }
      return;
    }
    if (stroke !== undefined) {
      const next = brushAt(p);
      if (next[0] !== stroke.last[0] || next[1] !== stroke.last[1]) {
        if (stroke.anchor === undefined) sweep(stroke, next);
        stroke.last = next;
        drawPreview();
      }
      return;
    }
    if (doorDrag !== undefined) {
      const end = doorDrag.edge === "n" ? p.px : p.py;
      if (Math.floor(end) !== Math.floor(doorDrag.end)) {
        doorDrag = { ...doorDrag, end };
        drawPreview();
      }
      return;
    }
    if (hover === undefined || hover.x !== p.x || hover.y !== p.y || tool.kind === "edge" || tool.kind === "symbol" || tool.kind === "tile") {
      hover = p;
      status.textContent = describe(p);
      drawPreview();
    }
  });

  function endStroke(): void {
    if (stroke === undefined) return;
    const done = stroke;
    stroke = undefined;
    commit(paint(plan(), deck, strokeCells(done), done.owner));
    advanceStateroom();
  }

  function endDoor(): void {
    const span = doorSpan();
    doorDrag = undefined;
    if (span === undefined) return;
    // Clicking a wall that already has exactly this door or valve takes it out.
    const same = plan().fixtures.find(
      (f) => "edge" in f && f.deck === deck && f.kind === span.kind && f.x === span.x && f.y === span.y && f.edge === span.edge && (f.length ?? 1) === (span.length ?? 1),
    );
    commit(same !== undefined ? removeFixture(plan(), same) : placeFixture(plan(), span));
  }

  function endDrag(): void {
    const done = drag;
    drag = undefined;
    if (done === undefined || selection === undefined || (done.dx === 0 && done.dy === 0)) {
      drawSelection();
      return;
    }
    moveSelection(done.dx, done.dy);
  }

  /** Move the selection by whole or half squares. FP 10.9. */
  function moveSelection(dx: number, dy: number): void {
    const sel = selection;
    if (sel === undefined) return;
    if (sel.type === "fixture") {
      const f = plan().fixtures[sel.index];
      if (f !== undefined) commit(replaceFixture(plan(), sel.index, { ...f, x: toHalf(f.x + dx), y: toHalf(f.y + dy) }), sel);
    } else if (sel.type === "tile") {
      const t = plan().tiles[sel.index];
      if (t !== undefined) commit(replaceTile(plan(), sel.index, { ...t, x: toHalf(t.x + dx), y: toHalf(t.y + dy) }), sel);
    } else {
      commit(moveSquares(plan(), deck, sel.squares, dx, dy), {
        type: "region",
        squares: sel.squares.map(([x, y]) => [toHalf(x + dx), toHalf(y + dy)] as const),
      });
    }
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
    if (drag !== undefined) endDrag();
    else if (doorDrag !== undefined) endDoor();
    else endStroke();
  });
  svg.addEventListener("pointercancel", () => {
    pan = undefined;
    stroke = undefined;
    doorDrag = undefined;
    drag = undefined;
    drawSelection();
    drawPreview();
  });
  svg.addEventListener("pointerleave", () => {
    if (stroke === undefined && drag === undefined && doorDrag === undefined) {
      hover = undefined;
      drawPreview();
    }
  });

  function zoom(factor: number, around?: { clientX: number; clientY: number }): void {
    const box = svg.getBoundingClientRect();
    const cx = around === undefined ? box.width / 2 : around.clientX - box.left;
    const cy = around === undefined ? box.height / 2 : around.clientY - box.top;
    const scale = Math.max(4, Math.min(160, view.scale * factor));
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
    const cells = bounds(plan().decks);
    let area = cells ?? { minX: 0, minY: 0, maxX: 24, maxY: 14 };
    for (const t of plan().tiles) {
      const [w, h] = tileFootprint(t);
      area = {
        minX: Math.min(area.minX, t.x),
        minY: Math.min(area.minY, t.y),
        maxX: Math.max(area.maxX, t.x + w - 1),
        maxY: Math.max(area.maxY, t.y + h - 1),
      };
    }
    const w = canvas.clientWidth || 800;
    const h = canvas.clientHeight || 600;
    const spanX = area.maxX - area.minX + 5;
    const spanY = area.maxY - area.minY + 5;
    const scale = Math.max(4, Math.min(60, Math.min(w / spanX, h / spanY)));
    view = { scale, x: area.minX - 2.5 - (w / scale - spanX) / 2, y: area.minY - 2.5 - (h / scale - spanY) / 2 };
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

  // ------------------------------------------------------ the selection's keys

  function removeSelection(): void {
    const sel = selection;
    if (sel === undefined) return;
    if (sel.type === "fixture") {
      const f = plan().fixtures[sel.index];
      if (f !== undefined) commit(removeFixture(plan(), f));
    } else if (sel.type === "tile") commit(removeTile(plan(), sel.index));
    else commit(paint(plan(), deck, sel.squares, undefined));
  }

  function turnSelection(): boolean {
    const sel = selection;
    if (sel === undefined || sel.type === "region") return false;
    const next = (r: Rotation) => ((r + 90) % 360) as Rotation;
    if (sel.type === "tile") {
      const t = plan().tiles[sel.index];
      if (t !== undefined) commit(replaceTile(plan(), sel.index, { ...t, rotation: next(t.rotation) }), sel);
      return true;
    }
    const f = plan().fixtures[sel.index];
    if (f === undefined || "edge" in f) return false;
    commit(replaceFixture(plan(), sel.index, { ...f, rotation: next(f.rotation) }), sel);
    return true;
  }

  /** Mirror the selected tile or piece, if it is one. */
  function flipSelection(): boolean {
    const sel = selection;
    if (sel === undefined || sel.type === "region") return false;
    if (sel.type === "tile") {
      const t = plan().tiles[sel.index];
      if (t !== undefined) commit(replaceTile(plan(), sel.index, { ...t, flip: t.flip !== true }), sel);
      return true;
    }
    const f = plan().fixtures[sel.index];
    if (f === undefined || "edge" in f) return false;
    commit(replaceFixture(plan(), sel.index, { ...f, flip: f.flip !== true }), sel);
    return true;
  }

  /** Turn the selection with Move, or whatever is about to be placed with any other tool. */
  function turn(): void {
    if (tool.kind === "move" && turnSelection()) return;
    rotation = ((rotation + 90) % 360) as Rotation;
    drawPreview();
  }

  function flip(): void {
    if (tool.kind === "move" && flipSelection()) return;
    flipped = !flipped;
    drawRight();
    drawPreview();
  }

  function nudgeSelection(dx: number, dy: number): void {
    moveSelection(dx, dy);
  }


  // -------------------------------------------------------------------- draw

  function draw(): void {
    report = check(host.manifest, plan());
    deck = Math.min(deck, plan().decks.length - 1);
    // A brush for a component the design no longer has goes back to Move.
    if (tool.kind === "paint") {
      const key = tool.owner.split("#")[0]!;
      if (!components().some((c) => c.key === key)) tool = { kind: "move" };
    }
    drawLeft();
    drawRight();
    drawProblems();
    drawDeckBar();
    drawCanvas();
    canvas.dataset["tool"] = tool.kind;
  }

  draw();
  void rememberedFolder().then((found) => {
    folderNote = found;
    drawRight();
    drawCanvas();
  });

  return {
    refresh: draw,
    fit,
    print: () => printPlan(host.manifest, plan(), labels),
    key(event) {
      const target = event.target as HTMLElement | null;
      if (target !== null && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT")) return false;
      const mod = event.ctrlKey || event.metaKey;
      const down = event.type === "keydown";
      if (down && mod && event.key.toLowerCase() === "z") {
        if (event.shiftKey) redoOnce();
        else undoOnce();
        return true;
      }
      if (down && mod && event.key.toLowerCase() === "y") {
        redoOnce();
        return true;
      }
      if (down && !mod && event.key.toLowerCase() === "r") {
        turn();
        return true;
      }
      if (down && !mod && event.key.toLowerCase() === "f") {
        flip();
        return true;
      }
      if (down && tool.kind === "move" && selection !== undefined) {
        if (event.key === "Delete" || event.key === "Backspace") {
          removeSelection();
          return true;
        }
        const arrows: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
        const step = arrows[event.key];
        if (step !== undefined) {
          // Half a square, or a whole one with Shift.
          const unit = event.shiftKey ? 1 : CELL;
          nudgeSelection(step[0] * unit, step[1] * unit);
          return true;
        }
      }
      if (event.key === " ") {
        spaceHeld = down;
        canvas.classList.toggle("fp-grab", down);
        return true;
      }
      if (down && event.key === "Escape") {
        stroke = undefined;
        doorDrag = undefined;
        drag = undefined;
        selection = undefined;
        selectTool({ kind: "move" });
        return true;
      }
      return false;
    },
  };
}
