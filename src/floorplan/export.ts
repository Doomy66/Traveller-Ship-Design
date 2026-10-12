/**
 * Getting a plan out: a deck as SVG or PNG, and every deck to the printer.
 * FloorPlanSpec 10.6.
 *
 * Exports are drawn on paper colours. Every deck is framed by the bounds of
 * all of them, so the exported decks of one ship line up when laid over each
 * other, as they do on screen (FP 4.3.1). A numbered plan carries its key
 * beside it (FP 8.4).
 */

import type { Bounds } from "./geometry";
import { bounds } from "./geometry";
import type { Manifest } from "./manifest";
import type { FloorPlan } from "./plan";
import { CELL, openings, tiledSquares, tileFootprint } from "./plan";
import type { LabelMode, Palette } from "./render";
import {
  fixturesMarkup,
  floorsMarkup,
  gridMarkup,
  labelsMarkup,
  legendMarkup,
  looksFor,
  PAPER,
  roomGridMarkup,
  tilesMarkup,
  wallsMarkup,
} from "./render";
import { ACCESS_SYMBOLS, PIXELS_PER_SQUARE, symbolById } from "./symbols";
import { readFolderImage, tileHref } from "./tiles";

/** Room for the key to the right of a numbered plan, in squares. */
const KEY_WIDTH = 11;

/** The frame every deck of a plan is drawn in: all decks' squares and tiles, and a margin. */
export function frame(plan: FloorPlan): Bounds {
  // Cells are named by their corner, so the far edge of the plan is a cell further on.
  const cells = bounds(plan.decks);
  let b =
    cells === undefined
      ? undefined
      : { minX: Math.floor(cells.minX), minY: Math.floor(cells.minY), maxX: Math.ceil(cells.maxX + CELL) - 1, maxY: Math.ceil(cells.maxY + CELL) - 1 };
  for (const t of plan.tiles) {
    // A tile half a square off the grid widens the frame to the next whole square.
    const [w, h] = tileFootprint(t);
    const x0 = Math.floor(t.x);
    const y0 = Math.floor(t.y);
    const x1 = Math.ceil(t.x + w) - 1;
    const y1 = Math.ceil(t.y + h) - 1;
    b = {
      minX: Math.min(b?.minX ?? x0, x0),
      minY: Math.min(b?.minY ?? y0, y0),
      maxX: Math.max(b?.maxX ?? x1, x1),
      maxY: Math.max(b?.maxY ?? y1, y1),
    };
  }
  const area = b ?? { minX: 0, minY: 0, maxX: 9, maxY: 5 };
  return { minX: area.minX - 1, minY: area.minY - 2, maxX: area.maxX + 1, maxY: area.maxY + 1 };
}

const esc = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export interface Sources {
  /** A symbol's file to the address the document should use. */
  readonly symbol: (file: string) => string;
  /** A tile's id to its image, or undefined to draw its outline. */
  readonly tile: (id: string) => string | undefined;
}

/**
 * One deck as a complete SVG document. The sources say where images are: a
 * path for printing, a data URI for an export that has to stand on its own.
 */
export function deckDocument(
  manifest: Manifest,
  plan: FloorPlan,
  deck: number,
  sources: Sources,
  options: { palette?: Palette; pixelsPerSquare?: number; grid?: boolean; labels?: LabelMode } = {},
): string {
  const palette = options.palette ?? PAPER;
  const scale = options.pixelsPerSquare ?? 24;
  const labels = options.labels ?? "names";
  const d = plan.decks[deck];
  if (d === undefined) return "";
  const area = frame(plan);
  const keyed = labels === "numbers";
  const w = area.maxX - area.minX + 1 + (keyed ? KEY_WIDTH : 0);
  const h = area.maxY - area.minY + 1;
  const look = looksFor(manifest.components, plan, labels);
  const title = `${manifest.shipName}, ${d.name}`;
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${area.minX} ${area.minY} ${w} ${h}" width="${w * scale}" height="${h * scale}" font-family="Segoe UI, Helvetica, Arial, sans-serif">`,
    `<title>${esc(title)}</title>`,
    `<rect x="${area.minX}" y="${area.minY}" width="${w}" height="${h}" fill="${palette.background}"/>`,
    options.grid === false ? "" : gridMarkup(area, palette),
    floorsMarkup(d, look, palette),
    options.grid === false ? "" : roomGridMarkup(d, palette),
    tilesMarkup(plan, deck, palette, sources.tile),
    wallsMarkup(d, palette, 0.1, "", tiledSquares(plan, deck), openings(plan, deck)),
    fixturesMarkup(plan, deck, palette, sources.symbol),
    labelsMarkup(d, look, palette),
    `<text x="${area.minX + 0.5}" y="${area.minY + 1}" font-size="0.6" font-weight="600" fill="${palette.label}">${esc(title)}</text>`,
    keyed ? legendMarkup(manifest.components, plan, area.maxX + 2, area.minY + 1, palette) : "",
    `</svg>`,
  ].join("");
}

async function asDataUri(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

/** Every image the plan uses, read in as data URIs so an exported file needs nothing beside it. */
async function embedded(plan: FloorPlan): Promise<Sources> {
  const files = new Set<string>();
  for (const f of plan.fixtures) {
    if ("edge" in f) continue;
    const id = f.symbol ?? (f.kind === "symbol" ? undefined : ACCESS_SYMBOLS[f.kind]);
    const symbol = symbolById(id);
    if (symbol !== undefined) files.add(symbol.file);
  }
  const symbols = new Map<string, string>();
  await Promise.all(
    [...files].map(async (file) => {
      try {
        symbols.set(file, await asDataUri(await (await fetch(`./${file}`)).blob()));
      } catch {
        // A symbol that will not load is drawn as its dashed outline instead.
      }
    }),
  );
  const tiles = new Map<string, string>();
  await Promise.all(
    [...new Set(plan.tiles.map((t) => t.tile))].map(async (id) => {
      try {
        // Tiles only ever come from the geomorph folder, already as data URIs.
        const read = await readFolderImage(id);
        if (read !== undefined) tiles.set(id, read.uri);
      } catch {
        // A tile that will not load is drawn as its outline.
      }
    }),
  );
  return { symbol: (file) => symbols.get(file) ?? `./${file}`, tile: (id) => tiles.get(id) };
}

function download(name: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** A name for the file, safe on every platform. */
export function exportName(manifest: Manifest, plan: FloorPlan, deck: number, extension: string): string {
  const stem = `${manifest.shipName} ${plan.decks[deck]?.name ?? ""}`.replace(/[^A-Za-z0-9 _-]/g, "").trim();
  return `${stem === "" ? "deck" : stem}.${extension}`;
}

export async function exportSvg(manifest: Manifest, plan: FloorPlan, deck: number, labels: LabelMode = "names"): Promise<void> {
  const text = deckDocument(manifest, plan, deck, await embedded(plan), { labels });
  download(exportName(manifest, plan, deck, "svg"), new Blob([text], { type: "image/svg+xml" }));
}

/** The largest side a PNG is drawn at, which keeps a big ship inside what a browser's canvas allows. */
const MAX_PNG_SIDE = 8000;

export async function exportPng(manifest: Manifest, plan: FloorPlan, deck: number, labels: LabelMode = "names"): Promise<void> {
  const area = frame(plan);
  const squares = Math.max(area.maxX - area.minX + 1 + (labels === "numbers" ? KEY_WIDTH : 0), area.maxY - area.minY + 1);
  // The art's own scale where it fits, smaller where it would not.
  const scale = Math.min(PIXELS_PER_SQUARE, Math.floor(MAX_PNG_SIDE / squares));
  const text = deckDocument(manifest, plan, deck, await embedded(plan), { pixelsPerSquare: scale, labels });
  // A data URI rather than a blob URL: the page's Content Security Policy
  // allows images from the site itself and from data, and nothing else.
  const image = new Image();
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error("The deck could not be drawn."));
    image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(text)}`;
  });
  const canvas = document.createElement("canvas");
  canvas.width = image.width;
  canvas.height = image.height;
  canvas.getContext("2d")?.drawImage(image, 0, 0);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (blob !== null) download(exportName(manifest, plan, deck, "png"), blob);
}

/**
 * The plan's printed pages: every deck that has anything on it, one to a
 * page, on paper colours. The caller puts them in the document for as long
 * as the print dialog is up, after the design's own sheet. Undefined for a
 * plan with nothing drawn on it.
 */
export function printPages(manifest: Manifest, plan: FloorPlan, labels: LabelMode = "names"): HTMLElement | undefined {
  const used = plan.decks
    .map((d, at) => ({ d, at }))
    .filter(({ d, at }) => Object.keys(d.cells).length > 0 || plan.tiles.some((t) => t.deck === at) || plan.fixtures.some((f) => f.deck === at));
  if (used.length === 0) return undefined;
  const holder = document.createElement("div");
  holder.className = "fp-print";
  for (const { at } of used) {
    const page = document.createElement("section");
    page.className = "fp-print-page";
    page.innerHTML = deckDocument(manifest, plan, at, { symbol: (file) => `./${file}`, tile: tileHref }, { labels });
    holder.append(page);
  }
  return holder;
}
