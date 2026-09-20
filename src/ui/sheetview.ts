/**
 * The sheet, drawn the way the book prints it. ShipSpec 5.1.
 *
 * Section down the left, the component and what it is, then tons and cost. A
 * reader should be able to lay this beside a page of Spacecraft of the Third
 * Imperium and read across.
 */

import type { Sheet } from "../engine/sheet";
import { clear, el, exactly, figure, mcr, millions, monthly, tons } from "./dom";

export function renderSheet(into: Element, sheet: Sheet): void {
  clear(into);

  into.append(
    el("header", { class: "sheet-head" }, [
      el("h2", {}, [sheet.name === "" ? "Untitled" : sheet.name]),
      el("p", { class: "sheet-sub" }, [`TL${sheet.tl}, ${figure(sheet.hullTons, 0)} tons`]),
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
  let softwareBandwidth = 0;

  /**
   * The software's bandwidth added up, under the last of it. A plain sum of the
   * column and nothing more: Jump Control is weighed against the computer on
   * its own (ShipSpec 4.7.5), so it is the Totals panel, not this row, that
   * says whether the computer can run any of it.
   */
  const softwareTotal = (): Element =>
    el("tr", { class: "subtotal" }, [
      el("th", { scope: "row" }, [""]),
      el("td", {}, ["Total"]),
      el("td", { class: "num" }, [""]),
      el("td", { class: "num" }, [""]),
      el("td", { class: "num" }, [""]),
      el("td", { class: "num" }, [String(softwareBandwidth)]),
    ]);

  for (const line of sheet.lines) {
    const first = line.section !== previous;
    if (first && previous === "Software" && anyBandwidth) body.append(softwareTotal());
    previous = line.section;
    if (line.section === "Software") softwareBandwidth += line.bandwidth ?? 0;
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
  if (previous === "Software" && anyBandwidth) body.append(softwareTotal());
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
  const rows: [string, string, string?][] = [
    ["Tons used", `${figure(sheet.tonsUsed)} of ${figure(sheet.usableTons)}`],
    ["Cargo", figure(sheet.cargoTons)],
    ["Hull points", figure(sheet.hullPoints, 0)],
    ["Armour", figure(sheet.armourProtection, 0)],
    ["Airlocks", figure(sheet.airlocks, 0)],
    [
      sheet.hardpoints.firmpoints ? "Firmpoints" : "Hardpoints",
      `${sheet.hardpoints.used} of ${sheet.hardpoints.available}`,
    ],
    ["Fuel", figure(sheet.fuel.total)],
    ["Total", millions(sheet.totalCost), exactly(sheet.totalCost)],
    ["Purchase", millions(sheet.purchaseCost), exactly(sheet.purchaseCost)],
    ["Maintenance", monthly(sheet.maintenanceCost)],
    ["Wages", monthly(sheet.wageBill)],
    ["Construction", `${figure(sheet.constructionDays, 0)} days`],
  ];
  if (sheet.ordnanceCost > 0) {
    rows.push(["Ammunition", `${millions(sheet.ordnanceCost)}, bought apart`, exactly(sheet.ordnanceCost)]);
  }
  if (sheet.software.processing > 0) {
    rows.push(["Bandwidth", `${sheet.software.bandwidth} of ${sheet.software.processing}`]);
    if (sheet.software.jumpControl > 0) {
      rows.push(["Jump Control", `${sheet.software.jumpControl} of ${sheet.software.jumpProcessing}`]);
    }
  }
  return panel("Totals", el("dl", { class: "figures" }, rows.flatMap(([term, value, exact]) => [
    el("dt", { title: exact }, [term]),
    el("dd", { title: exact, class: exact === undefined ? undefined : "rounded" }, [value]),
  ])));
}

function powerPanel(sheet: Sheet): Element {
  const draws = sheet.powerRequirements.filter((entry) => entry.whenJumping !== true);
  const running = draws.reduce((sum, entry) => sum + entry.power, 0);
  const jumping = sheet.powerRequirements.reduce((sum, entry) => sum + entry.power, 0);
  return panel(
    `Power: ${figure(sheet.powerAvailable)} available`,
    el("dl", { class: "figures" }, [
      ...sheet.powerRequirements.flatMap((entry) => [
        el("dt", {}, [entry.whenJumping === true ? `${entry.label} (jumping)` : entry.label]),
        el("dd", {}, [entry.power < 0 ? `+ ${figure(-entry.power)}` : figure(entry.power)]),
      ]),
      el("dt", { class: "sum" }, ["Running"]),
      el("dd", { class: "sum" }, [figure(running)]),
      el("dt", { class: "sum" }, ["With a jump"]),
      el("dd", { class: "sum" }, [figure(jumping)]),
    ]),
  );
}

function crewPanel(sheet: Sheet): Element {
  const { high, middle, low } = sheet.passengers;
  const carried = high + middle + low;
  const rows = sheet.crew.flatMap((entry) => [
    el("dt", {}, [entry.count > 1 ? `${entry.label} x${entry.count}` : entry.label]),
    el("dd", {}, [monthly(entry.count * entry.salary)]),
  ]);
  // Passengers are not crew, but they are why some of the crew is there, so
  // they are named under it rather than left to be inferred from a steward.
  if (carried > 0) {
    for (const [label, count] of [["High", high], ["Middle", middle], ["Low", low]] as const) {
      if (count === 0) continue;
      rows.push(el("dt", { class: "aside" }, [`${label} passengers`]), el("dd", { class: "aside" }, [figure(count, 0)]));
    }
  }
  if (rows.length === 0) return panel("Crew", el("p", { class: "muted" }, ["None."]));
  return panel(
    carried === 0 ? `Crew: ${sheet.crewTotal}` : `Crew: ${sheet.crewTotal}, carrying ${carried}`,
    el("dl", { class: "figures" }, rows),
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
