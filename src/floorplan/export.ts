/**
 * Getting a plan out: a deck as SVG or PNG, and every deck to the printer.
 * FloorPlanSpec 10.6.
 *
 * Exports are drawn on paper colours. Every deck is framed by the bounds of
 * all of them, so the exported decks of one ship line up when laid over each
 * other, as they do on screen (FP 4.3.1).
 */

import type { Bounds } from "./geometry";
import { bounds } from "./geometry";
import type { Manifest } from "./manifest";
import type { FloorPlan } from "./plan";
import type { Palette } from "./render";
import { fittedSquares, fixturesMarkup, floorsMarkup, gridMarkup, labelsMarkup, looksFor, PAPER, wallsMarkup } from "./render";
import { PIXELS_PER_SQUARE, SYMBOLS } from "./symbols";

/** The frame every deck of a plan is drawn in: all decks' squares and a margin. */
export function frame(plan: FloorPlan): Bounds {
  const b = bounds(plan.decks) ?? { minX: 0, minY: 0, maxX: 9, maxY: 5 };
  return { minX: b.minX - 1, minY: b.minY - 2, maxX: b.maxX + 1, maxY: b.maxY + 1 };
}

const esc = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/**
 * One deck as a complete SVG document. `href` turns a symbol's file into the
 * address the document should use: a path for printing, a data URI for an
 * export that has to stand on its own.
 */
export function deckDocument(
  manifest: Manifest,
  plan: FloorPlan,
  deck: number,
  href: (file: string) => string,
  options: { palette?: Palette; pixelsPerSquare?: number; grid?: boolean } = {},
): string {
  const palette = options.palette ?? PAPER;
  const scale = options.pixelsPerSquare ?? 24;
  const d = plan.decks[deck];
  if (d === undefined) return "";
  const area = frame(plan);
  const w = area.maxX - area.minX + 1;
  const h = area.maxY - area.minY + 1;
  const look = looksFor(manifest.components, plan);
  const title = `${manifest.shipName}, ${d.name}`;
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${area.minX} ${area.minY} ${w} ${h}" width="${w * scale}" height="${h * scale}" font-family="Segoe UI, Helvetica, Arial, sans-serif">`,
    `<title>${esc(title)}</title>`,
    `<rect x="${area.minX}" y="${area.minY}" width="${w}" height="${h}" fill="${palette.background}"/>`,
    options.grid === false ? "" : gridMarkup(area, palette),
    floorsMarkup(d, look, palette),
    wallsMarkup(d, palette),
    fixturesMarkup(plan, deck, palette, href),
    labelsMarkup(d, look, palette, fittedSquares(plan, deck)),
    `<text x="${area.minX + 0.5}" y="${area.minY + 1}" font-size="0.6" font-weight="600" fill="${palette.label}">${esc(title)}</text>`,
    `</svg>`,
  ].join("");
}

/** Every symbol the plan uses, read in as data URIs so an exported file needs nothing beside it. */
async function embeddedSymbols(plan: FloorPlan): Promise<Map<string, string>> {
  const files = new Set<string>();
  for (const f of plan.fixtures) {
    if ("edge" in f || f.kind === "hatch") continue;
    const id = f.symbol ?? (f.kind === "lift" ? "lift" : f.kind === "stairs" ? "stairs" : undefined);
    const symbol = SYMBOLS.find((s) => s.id === id);
    if (symbol !== undefined) files.add(symbol.file);
  }
  const out = new Map<string, string>();
  await Promise.all(
    [...files].map(async (file) => {
      try {
        const blob = await (await fetch(`./${file}`)).blob();
        out.set(file, await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result));
          reader.onerror = () => reject(reader.error);
          reader.readAsDataURL(blob);
        }));
      } catch {
        // A symbol that will not load is drawn as its dashed outline instead.
      }
    }),
  );
  return out;
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

export async function exportSvg(manifest: Manifest, plan: FloorPlan, deck: number): Promise<void> {
  const symbols = await embeddedSymbols(plan);
  const text = deckDocument(manifest, plan, deck, (file) => symbols.get(file) ?? `./${file}`);
  download(exportName(manifest, plan, deck, "svg"), new Blob([text], { type: "image/svg+xml" }));
}

/** The largest side a PNG is drawn at, which keeps a big ship inside what a browser's canvas allows. */
const MAX_PNG_SIDE = 8000;

export async function exportPng(manifest: Manifest, plan: FloorPlan, deck: number): Promise<void> {
  const symbols = await embeddedSymbols(plan);
  const area = frame(plan);
  const squares = Math.max(area.maxX - area.minX + 1, area.maxY - area.minY + 1);
  // The symbols' own scale where it fits, smaller where it would not.
  const scale = Math.min(PIXELS_PER_SQUARE, Math.floor(MAX_PNG_SIDE / squares));
  const text = deckDocument(manifest, plan, deck, (file) => symbols.get(file) ?? `./${file}`, { pixelsPerSquare: scale });
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
 * Every deck that has anything on it, one to a page, on paper colours. The
 * pages are put in the document only for as long as the print dialog is up.
 */
export function printPlan(manifest: Manifest, plan: FloorPlan): void {
  const holder = document.createElement("div");
  holder.className = "fp-print";
  const used = plan.decks.map((d, at) => ({ d, at })).filter(({ d }) => Object.keys(d.cells).length > 0);
  for (const { at } of used.length > 0 ? used : [{ at: 0 }]) {
    const page = document.createElement("section");
    page.className = "fp-print-page";
    page.innerHTML = deckDocument(manifest, plan, at, (file) => `./${file}`);
    holder.append(page);
  }
  document.body.append(holder);
  document.body.classList.add("printing-plan");
  const done = () => {
    holder.remove();
    document.body.classList.remove("printing-plan");
    window.removeEventListener("afterprint", done);
  };
  window.addEventListener("afterprint", done);
  window.print();
}
