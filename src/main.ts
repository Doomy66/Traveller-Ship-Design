/**
 * The application: one design, a form that edits it, a sheet that reads it.
 *
 * There is no state beyond the design itself and the file handle it was last
 * written to. Everything on screen is `sheet(design)` drawn out, so nothing can
 * drift from what the rules say.
 */

import { sheet } from "./engine/sheet";
import type { Design } from "./engine/design";
import { DESTROYER_ESCORT } from "./fixtures/destroyerEscort";
import { FREE_TRADER } from "./fixtures/freeTrader";
import { PATROL_CORVETTE } from "./fixtures/patrolCorvette";
import { SCOUT_COURIER } from "./fixtures/scoutCourier";
import { canRewrite, fileNameFor, open as openDesign, save, type FileHandle } from "./io/save";
import { find } from "./ui/dom";
import { anyOpen, renderForm, setAllOpen } from "./ui/form";
import type { FormHost } from "./ui/form";
import { renderSheet } from "./ui/sheetview";
import { APP_VERSION, RELEASE_NOTES, suggestionLink } from "./version";

/** A bare hull to start from: the smallest thing the rules will price. */
const EMPTY: Design = {
  name: "New Ship",
  tl: 12,
  hull: { tons: 100, configuration: "standard" },
  powerPlant: { type: "fusion12", tons: 4, weeks: 4 },
  bridge: { kind: "standard" },
  sensors: "basic",
  software: [{ software: "manoeuvre" }],
};

/** The book's own ships, to open and pull apart. */
const EXAMPLES: readonly { readonly label: string; readonly design: Design }[] = [
  { label: "Scout/Courier", design: SCOUT_COURIER },
  { label: "Free Trader", design: FREE_TRADER },
  { label: "Patrol Corvette", design: PATROL_CORVETTE },
  { label: "Destroyer Escort", design: DESTROYER_ESCORT },
];

let design: Design = EMPTY;
let handle: FileHandle | undefined;
let dirty = false;

/**
 * The form reads the live design through this rather than a copy, so a handler
 * drawn ten edits ago still writes back against what is there now.
 */
const host: FormHost = {
  get design() {
    return design;
  },
  update(patch) {
    apply(patch);
    drawSheet();
    showState();
  },
  rebuild(patch) {
    apply(patch);
    render();
  },
};

/**
 * The sheet, with the notes wired back to the design. A note commits on leaving
 * the box, and redrawing then would only replace the box the cursor has already
 * left, so the state is marked and nothing is thrown away.
 */
function drawSheet(): void {
  renderSheet(find("#sheet"), sheet(design), (notes) => {
    apply({ notes });
    showState();
  });
}

function apply(patch: Partial<Design>): void {
  design = { ...design, ...patch };
  dirty = true;
}

function showState(): void {
  find("#fold").textContent = anyOpen(find("#form")) ? "Collapse all" : "Expand all";
  find("#where").textContent = handle === undefined ? (dirty ? "Unsaved" : "") : handle.name;
  document.title = `${design.name} — Traveller Ship Design`;
  find("#filename").textContent = fileNameFor(design);
}

/**
 * Draw both halves. The form is thrown away and rebuilt, which loses the scroll
 * position, so it is put back: a designer half way down the weapons should not
 * be returned to the top for having added a turret.
 */
function render(): void {
  const panel = find(".panel-form");
  const scroll = panel.scrollTop;
  renderForm(find("#form"), host);
  panel.scrollTop = scroll;
  drawSheet();
  showState();
}

function load(next: Design, from?: FileHandle): void {
  design = next;
  handle = from;
  dirty = false;
  render();
}

function wire(): void {
  find("#new").addEventListener("click", () => {
    if (dirty && !confirm("Start a new ship and lose the changes to this one?")) return;
    load({ ...EMPTY });
  });

  find("#open").addEventListener("click", async () => {
    if (dirty && !confirm("Open another ship and lose the changes to this one?")) return;
    try {
      const opened = await openDesign();
      if (opened === null) {
        alert("That file is not a ship design.");
        return;
      }
      load(opened.design, opened.handle);
    } catch {
      // The picker was dismissed. Nothing to report.
    }
  });

  const write = async (asNew: boolean) => {
    try {
      handle = await save(design, asNew ? undefined : handle);
      dirty = false;
      render();
    } catch {
      // Dismissed, as above.
    }
  };
  find("#save").addEventListener("click", () => void write(false));
  find("#save-as").addEventListener("click", () => void write(true));
  if (!canRewrite()) find("#save-as").remove();

  find("#print").addEventListener("click", () => window.print());

  // One control for all fifteen steps, which is quicker than fifteen clicks
  // whichever way the designer wants them.
  find("#fold").addEventListener("click", () => {
    setAllOpen(!anyOpen(find("#form")));
    render();
  });

  // Folding a step by hand changes what the button should offer next.
  find("#form").addEventListener("click", (event) => {
    if ((event.target as Element).closest("summary") === null) return;
    queueMicrotask(showState);
  });

  const examples = find<HTMLSelectElement>("#examples");
  for (const [at, example] of EXAMPLES.entries()) {
    examples.append(new Option(example.label, String(at)));
  }
  examples.addEventListener("change", () => {
    const chosen = EXAMPLES[Number(examples.value)];
    examples.value = "";
    if (chosen === undefined) return;
    if (dirty && !confirm("Open an example and lose the changes to this ship?")) return;
    load(structuredClone(chosen.design));
  });

  find("#version").textContent = APP_VERSION;
  find<HTMLAnchorElement>("#notes").href = RELEASE_NOTES;
  find<HTMLAnchorElement>("#suggest").href = suggestionLink({ ship: design.name });

  window.addEventListener("beforeunload", (event) => {
    if (!dirty) return;
    event.preventDefault();
  });

}

wire();
render();
