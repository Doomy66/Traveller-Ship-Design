/**
 * Saving and loading a design. ShipSpec 8.
 *
 * A design saves as its own JSON and nothing else: what the designer chose, not
 * what the rules make of it. A sheet is always one call away from the design,
 * so storing one would only create something that could disagree with the book.
 *
 * It is written under .ship rather than .json, so a folder of ships reads as a
 * folder of ships. The contents are still JSON, and .json files saved before
 * the change still open.
 *
 * The File System Access API is used where the browser has it, because it lets
 * a second Save rewrite the file the first one wrote. Where it is missing, the
 * same JSON goes out as an ordinary download and comes back through an ordinary
 * file input; that path cannot rewrite anything, so every save is a new file.
 */

import { DESIGN_VERSION, type Design } from "../engine/design";

export interface FileHandle {
  readonly name: string;
  getFile(): Promise<File>;
  createWritable(): Promise<{ write(data: string): Promise<void>; close(): Promise<void> }>;
}

interface PickerWindow {
  showSaveFilePicker?: (options: unknown) => Promise<FileHandle>;
  showOpenFilePicker?: (options: unknown) => Promise<FileHandle[]>;
}

/** Whether the browser can rewrite a file it saved earlier. */
export function canRewrite(): boolean {
  return typeof (window as unknown as PickerWindow).showSaveFilePicker === "function";
}

export function serialise(design: Design): string {
  return `${JSON.stringify({ ...design, version: DESIGN_VERSION }, null, 2)}\n`;
}

/**
 * Read a design back. Anything that is not an object with a hull and a power
 * plant is refused, because those two are the only fields every design has.
 */
export function parse(text: string): Design | null {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return null;
  }
  if (typeof value !== "object" || value === null) return null;
  const candidate = value as Partial<Design>;
  if (typeof candidate.hull !== "object" || candidate.hull === null) return null;
  if (typeof candidate.powerPlant !== "object" || candidate.powerPlant === null) return null;
  return { name: "Untitled", tl: 12, ...candidate } as Design;
}

/** What a saved design is called. The contents are JSON; the name says what of. */
export const EXTENSION = ".ship";

/** A filename for a ship, safe on every platform this runs on. */
export function fileNameFor(design: Design): string {
  const stem = design.name.replace(/[^A-Za-z0-9 _-]/g, "").trim();
  return `${stem === "" ? "ship" : stem}${EXTENSION}`;
}

const SAVE_TYPES = [{ description: "Ship design", accept: { "application/json": [EXTENSION] } }];

/** Designs saved before the extension changed are still designs. ShipSpec 8.5. */
const OPEN_TYPES = [{ description: "Ship design", accept: { "application/json": [EXTENSION, ".json"] } }];

/**
 * Write the design out. Returns the handle where the browser gave one, so the
 * caller can keep it and rewrite the same file next time.
 */
export async function save(design: Design, existing?: FileHandle): Promise<FileHandle | undefined> {
  const text = serialise(design);
  const picker = window as unknown as PickerWindow;
  if (existing !== undefined) {
    const writable = await existing.createWritable();
    await writable.write(text);
    await writable.close();
    return existing;
  }
  if (typeof picker.showSaveFilePicker === "function") {
    const handle = await picker.showSaveFilePicker({ suggestedName: fileNameFor(design), types: SAVE_TYPES });
    const writable = await handle.createWritable();
    await writable.write(text);
    await writable.close();
    return handle;
  }
  download(fileNameFor(design), text);
  return undefined;
}

/** Read a design in, through the picker where there is one and a file input where there is not. */
export async function open(): Promise<{ design: Design; handle?: FileHandle } | null> {
  const picker = window as unknown as PickerWindow;
  if (typeof picker.showOpenFilePicker === "function") {
    const [handle] = await picker.showOpenFilePicker({ types: OPEN_TYPES, multiple: false });
    if (handle === undefined) return null;
    const design = parse(await (await handle.getFile()).text());
    return design === null ? null : { design, handle };
  }
  const file = await chooseFile();
  if (file === null) return null;
  const design = parse(await file.text());
  return design === null ? null : { design };
}

function download(name: string, text: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}

function chooseFile(): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = `${EXTENSION},.json,application/json`;
    input.addEventListener("change", () => resolve(input.files?.[0] ?? null), { once: true });
    input.addEventListener("cancel", () => resolve(null), { once: true });
    input.click();
  });
}
