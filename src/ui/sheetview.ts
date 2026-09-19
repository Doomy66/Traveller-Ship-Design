/**
 * The sheet, drawn the way the book prints it. ShipSpec 5.1.
 *
 * Section down the left, the component and what it is, then tons and cost. A
 * reader should be able to lay this beside a page of Spacecraft of the Third
 * Imperium and read across.
 */

import type { Sheet } from "../engine/sheet";
import { clear, credits, el, mcr, tons } from "./dom";

export function renderSheet(into: Element, sheet: Sheet): void {
  clear(into);

  into.append(
    el("header", { class: "sheet-head" }, [
      el("h2", {}, [sheet.name === "" ? "Untitled" : sheet.name]),
      el("p", { class: "sheet-sub" }, [`TL${sheet.tl}, ${tons(sheet.hullTons)} tons`]),
    ]),
  );

  // Problems first. A designer who has just broken something should not have to
  // scroll past a correct-looking sheet to be told.
  if (sheet.problems.length > 0) into.append(problemPanel(sheet));
  into.append(componentTable(sheet));
  into.append(totals(sheet));
  into.append(powerPanel(sheet));
  into.append(crewPanel(sheet));
}

function componentTable(sheet: Sheet): Element {
  // Bandwidth gets a column only when something on the ship uses it, since on
  // most designs it would be an empty one.
  const anyBandwidth = sheet.lines.some((line) => line.bandwidth !== undefined);
  const dash = "—";
  const body = el("tbody");
  let previous = "";
  for (const line of sheet.lines) {
    const first = line.section !== previous;
    previous = line.section;
    body.append(
      el("tr", { class: first ? "section-start" : undefined }, [
        el("th", { scope: "row" }, [first ? line.section : ""]),
        el("td", {}, [line.label]),
        el("td", { class: "num" }, [line.tons === undefined ? dash : tons(line.tons)]),
        el("td", { class: "num" }, [line.cost === undefined ? dash : mcr(line.cost)]),
        el("td", { class: "num" }, [line.power === undefined ? dash : tons(line.power)]),
        anyBandwidth
          ? el("td", { class: "num" }, [line.bandwidth === undefined ? dash : String(line.bandwidth)])
          : null,
      ]),
    );
  }
  return el("table", { class: "components" }, [
    el("thead", {}, [
      el("tr", {}, [
        el("th", { scope: "col" }, [""]),
        el("th", { scope: "col" }, [""]),
        el("th", { scope: "col", class: "num" }, ["Tons"]),
        el("th", { scope: "col", class: "num" }, ["MCr"]),
        el("th", { scope: "col", class: "num" }, ["Power"]),
        anyBandwidth ? el("th", { scope: "col", class: "num" }, ["BW"]) : null,
      ]),
    ]),
    body,
  ]);
}

function totals(sheet: Sheet): Element {
  const rows: [string, string][] = [
    ["Tons used", `${tons(sheet.tonsUsed)} of ${tons(sheet.usableTons)}`],
    ["Cargo", tons(sheet.cargoTons)],
    ["Hull points", String(sheet.hullPoints)],
    ["Armour", String(sheet.armourProtection)],
    ["Airlocks", String(sheet.airlocks)],
    [
      sheet.hardpoints.firmpoints ? "Firmpoints" : "Hardpoints",
      `${sheet.hardpoints.used} of ${sheet.hardpoints.available}`,
    ],
    ["Fuel", tons(sheet.fuel.total)],
    ["Total", `MCr${mcr(sheet.totalCost)}`],
    ["Purchase", `MCr${mcr(sheet.purchaseCost)}`],
    ["Maintenance", `Cr${credits(sheet.maintenanceCost)}/month`],
    ["Wages", `Cr${credits(sheet.wageBill)}/month`],
    ["Construction", `${credits(sheet.constructionDays)} days`],
  ];
  if (sheet.ordnanceCost > 0) rows.push(["Ammunition", `MCr${mcr(sheet.ordnanceCost)}, bought apart`]);
  if (sheet.software.processing > 0) {
    rows.push(["Bandwidth", `${sheet.software.bandwidth} of ${sheet.software.processing}`]);
    if (sheet.software.jumpControl > 0) {
      rows.push(["Jump Control", `${sheet.software.jumpControl} of ${sheet.software.jumpProcessing}`]);
    }
  }
  return panel("Totals", el("dl", { class: "figures" }, rows.flatMap(([term, value]) => [
    el("dt", {}, [term]),
    el("dd", {}, [value]),
  ])));
}

function powerPanel(sheet: Sheet): Element {
  const draws = sheet.powerRequirements.filter((entry) => entry.whenJumping !== true);
  const running = draws.reduce((sum, entry) => sum + entry.power, 0);
  const jumping = sheet.powerRequirements.reduce((sum, entry) => sum + entry.power, 0);
  return panel(
    `Power: ${tons(sheet.powerAvailable)} available`,
    el("dl", { class: "figures" }, [
      ...sheet.powerRequirements.flatMap((entry) => [
        el("dt", {}, [entry.whenJumping === true ? `${entry.label} (jumping)` : entry.label]),
        el("dd", {}, [entry.power < 0 ? `+${tons(-entry.power)}` : tons(entry.power)]),
      ]),
      el("dt", { class: "sum" }, ["Running"]),
      el("dd", { class: "sum" }, [tons(running)]),
      el("dt", { class: "sum" }, ["With a jump"]),
      el("dd", { class: "sum" }, [tons(jumping)]),
    ]),
  );
}

function crewPanel(sheet: Sheet): Element {
  if (sheet.crew.length === 0) return panel("Crew", el("p", { class: "muted" }, ["None."]));
  return panel(
    `Crew: ${sheet.crewTotal}`,
    el("dl", { class: "figures" }, sheet.crew.flatMap((entry) => [
      el("dt", {}, [entry.count > 1 ? `${entry.label} x${entry.count}` : entry.label]),
      el("dd", {}, [`Cr${credits(entry.count * entry.salary)}/month`]),
    ])),
  );
}

function problemPanel(sheet: Sheet): Element {
  const order = { error: 0, warning: 1, note: 2 } as const;
  const sorted = [...sheet.problems].sort((a, b) => order[a.severity] - order[b.severity]);
  return panel(
    "Problems",
    el("ul", { class: "problems" }, sorted.map((problem) =>
      el("li", { class: problem.severity }, [
        el("span", { class: "tag" }, [problem.severity]),
        `${problem.message} `,
        el("span", { class: "clause" }, [problem.clause]),
      ]),
    )),
  );
}

function panel(heading: string, body: Element): Element {
  return el("section", { class: "sheet-panel" }, [el("h3", {}, [heading]), body]);
}
