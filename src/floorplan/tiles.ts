/**
 * Geomorph tiles from the designer's own disk: Robert Pearce's geomorphs, as
 * rendered to PNG by Eric B. Smith. FloorPlanSpec section 12.
 *
 * Nothing here ships with the site. The library holds the few geomorph
 * pieces most ships want (FP 7.7); a designer drawing something larger points
 * the screen at their copy of the archive, and every tile in it is listed
 * from its filename. The folder is read through the File System Access API,
 * and images are kept as data URIs because the page's Content Security
 * Policy allows images from the site and from data and nothing else.
 */

export interface TileEntry {
  /** The filename made into an id; stable, and the same whichever folder the file came from. */
  readonly id: string;
  /** The folder it was found in, without its number. */
  readonly category: string;
  readonly code: string;
  readonly side: "Fore" | "Aft" | "Port" | "Starboard" | null;
  readonly feet: readonly [number, number];
  /** Squares at rotation 0, wide and high. */
  readonly squares: readonly [number, number];
  /** Tonnage as the filename gives it, which can be a sum such as "10+14". */
  readonly tons: string | null;
  /** A transparent layer meant to sit over another tile. */
  readonly overlay: boolean;
  readonly name: string;
}

/** A tile's id: the filename without extension, lower case, everything else a hyphen. */
export function tileId(filename: string): string {
  const stem = filename.replace(/\.[^.]*$/, "").toLowerCase();
  return stem.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

/**
 * What a geomorph filename says about its tile: a code (SC-001), sometimes a
 * side, the size in feet as [width x height], the tonnage or [Overlay], and a
 * description. A file without a size in brackets is not a tile.
 */
export function parseTileName(filename: string, folder: string): TileEntry | undefined {
  if (!/\.png$/i.test(filename)) return undefined;
  const stem = filename.replace(/\.[^.]*$/, "");
  const dims = /\[(\d+)x(\d+)\]/.exec(stem);
  if (dims === null) return undefined;
  const wide = Number(dims[1]);
  const high = Number(dims[2]);
  if (wide <= 0 || high <= 0) return undefined;
  const code = stem.split(" ")[0] ?? stem;
  const sides = ["Fore", "Aft", "Port", "Starboard"] as const;
  const side = sides.find((s) => stem.includes(`[${s}]`)) ?? null;
  const tons = /\[([\d+.]+)-dTons\]/.exec(stem);
  return {
    id: tileId(filename),
    category: folder.replace(/^[\d.]+\s+/, ""),
    code,
    side,
    feet: [wide, high],
    squares: [Math.max(1, Math.ceil(wide / 5)), Math.max(1, Math.ceil(high / 5))],
    tons: tons === null ? null : (tons[1] ?? null),
    overlay: stem.includes("[Overlay]"),
    name: stem.slice(code.length).replace(/\[[^\]]*\]/g, "").replace(/^[\s-]+|[\s-]+$/g, ""),
  };
}

interface DirectoryHandle {
  readonly kind: "directory";
  readonly name: string;
  values(): AsyncIterable<DirectoryHandle | FileHandleLike>;
  queryPermission?(options: { mode: "read" }): Promise<PermissionState>;
  requestPermission?(options: { mode: "read" }): Promise<PermissionState>;
}

interface FileHandleLike {
  readonly kind: "file";
  readonly name: string;
  getFile(): Promise<File>;
}

/** Tiles in the loaded folder, and the files they come from, by id. */
const entries = new Map<string, TileEntry>();
const files = new Map<string, FileHandleLike>();
/** Images read so far, with their size in pixels. */
const images = new Map<string, { uri: string; pixels: readonly [number, number] }>();
let folderName: string | undefined;

/** Whether this browser can read a folder from disk at all. */
export function canLoadFolder(): boolean {
  return typeof (window as unknown as { showDirectoryPicker?: unknown }).showDirectoryPicker === "function";
}

export function loadedFolder(): { name: string; tiles: number } | undefined {
  return folderName === undefined ? undefined : { name: folderName, tiles: entries.size };
}

export function folderTiles(): readonly TileEntry[] {
  return [...entries.values()];
}

export function tileById(id: string): TileEntry | undefined {
  return entries.get(id);
}

export function inFolder(id: string): boolean {
  return files.has(id);
}

async function index(directory: DirectoryHandle, depth = 0): Promise<void> {
  for await (const entry of directory.values()) {
    if (entry.kind === "directory") {
      // The tile folders sit a level or two below wherever the designer points.
      if (depth < 3) await index(entry, depth + 1);
      continue;
    }
    const tile = parseTileName(entry.name, directory.name);
    if (tile === undefined) continue;
    entries.set(tile.id, tile);
    files.set(tile.id, entry);
  }
}

async function use(directory: DirectoryHandle): Promise<void> {
  entries.clear();
  files.clear();
  images.clear();
  await index(directory);
  folderName = directory.name;
}

// The folder is remembered between visits. The browser still asks the
// designer to allow it again, once a visit, which is why reconnecting is a
// button rather than automatic.
const DB = "traveller-floorplan";
const STORE = "handles";

function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function remembered(): Promise<DirectoryHandle | undefined> {
  try {
    const db = await database();
    return await new Promise((resolve) => {
      const request = db.transaction(STORE).objectStore(STORE).get("tiles");
      request.onsuccess = () => resolve(request.result as DirectoryHandle | undefined);
      request.onerror = () => resolve(undefined);
    });
  } catch {
    return undefined;
  }
}

async function rememberFolder(handle: DirectoryHandle): Promise<void> {
  try {
    const db = await database();
    db.transaction(STORE, "readwrite").objectStore(STORE).put(handle, "tiles");
  } catch {
    // Not remembering it only means choosing it again next time.
  }
}

/** Ask the designer for the geomorph folder. Returns false if they thought better of it. */
export async function chooseFolder(): Promise<boolean> {
  const picker = (window as unknown as { showDirectoryPicker?: (options?: unknown) => Promise<DirectoryHandle> }).showDirectoryPicker;
  if (picker === undefined) return false;
  try {
    const handle = await picker({ id: "geomorphs", mode: "read" });
    await use(handle);
    await rememberFolder(handle);
    return true;
  } catch {
    return false;
  }
}

/** The folder chosen on an earlier visit, if there was one: its name, and whether it is already allowed. */
export async function rememberedFolder(): Promise<{ name: string; allowed: boolean } | undefined> {
  const handle = await remembered();
  if (handle === undefined) return undefined;
  const state = (await handle.queryPermission?.({ mode: "read" })) ?? "prompt";
  if (state === "granted") await use(handle);
  return { name: handle.name, allowed: state === "granted" };
}

/** Allow the remembered folder again. Must be called from a click. */
export async function reconnectFolder(): Promise<boolean> {
  const handle = await remembered();
  if (handle === undefined) return false;
  const state = (await handle.requestPermission?.({ mode: "read" })) ?? "denied";
  if (state !== "granted") return false;
  await use(handle);
  return true;
}

/** Read a tile's image and its size, once. */
export async function readFolderImage(id: string): Promise<{ uri: string; pixels: readonly [number, number] } | undefined> {
  const cached = images.get(id);
  if (cached !== undefined) return cached;
  const handle = files.get(id);
  if (handle === undefined) return undefined;
  const uri = await new Promise<string>((resolve, reject) => {
    void handle.getFile().then((file) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    }, reject);
  });
  const image = new Image();
  image.src = uri;
  await image.decode();
  const read = { uri, pixels: [image.naturalWidth, image.naturalHeight] as const };
  images.set(id, read);
  return read;
}

/** A tile's image and size if it has been read already. */
export function readTile(id: string): { uri: string; pixels: readonly [number, number] } | undefined {
  return images.get(id);
}

/** A tile's image if it has been read, or undefined to draw its outline. */
export function tileHref(id: string): string | undefined {
  return images.get(id)?.uri;
}
