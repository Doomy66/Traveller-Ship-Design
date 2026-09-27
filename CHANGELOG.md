# Version history

The version in [package.json](package.json) is the one number that reaches a
user. Dates are the day the release was tagged.

## Unreleased

- **A way in.** A landing screen in the style PlanetHex and MainLine share: a
  new design, a file, one of the book's ships, or back to the one open. The name
  in the bar returns to it without losing anything.
- **A standard footer.** Help, release notes, suggestions and the version; links
  to PlanetHex and MainLine; and Mongoose Publishing's fair use notice in full.

## 0.1.0 — 2026-09-20

The first thing that runs. A ship goes in through the book's own thirteen steps
and its sheet comes out beside it, redrawn on every change.

- **The design chapters, whole.** Ship Design, Weapons and Screens, Spacecraft
  Options and Customising Ships, transcribed table by table under `src/rules/`
  with every entry citing the page it came from.
- **Four of the book's ships reproduce exactly**, to the ton and to the credit:
  the Scout/Courier, the Free Trader, the Patrol Corvette and the Chrysanthemum
  Destroyer Escort. All four are in the application to open and pull apart, and
  all four are tests.
- **Problems are reported at the top of the sheet**, as errors, warnings or
  notes, each naming the clause of `ShipSpec.md` it comes from. A designer who
  has just broken something should not have to scroll past a correct-looking
  sheet to be told.
- **The sheet carries power and bandwidth** beside tonnage and cost, so what a
  component draws is read off the same row as what it costs.
- **A place to say what the ship is for**, under its name on the sheet, where the
  book puts its own prose. It saves with the design and prints with the sheet.
- **Save and load** through the File System Access API where the browser has it,
  and as a download where it does not. A design is written as `.ship`, so a
  folder of them reads as a folder of ships; the contents are JSON. A save that
  works says so, which the download path has no other way to tell you. Print
  gives the sheet the page.

Three things the book gets wrong or leaves unsaid, found by making its own ships
add up, are recorded in the spec rather than quietly accommodated: the Free
Trader's missing ton, the engineer rule that does not round the way it reads,
and ammunition that takes room in a ship without adding to its price.

Space stations and exotic technology are not in yet, and neither are deck
plans.
