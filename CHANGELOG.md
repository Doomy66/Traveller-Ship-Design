# Version history

The version in [package.json](package.json) is the one number that reaches a
user. Dates are the day the release was tagged.

## 0.1.0 — 2026-09-19

The first thing that runs. A ship goes in through the book's own thirteen steps
and its sheet comes out beside it, redrawn on every change.

- **The design chapters, whole.** Ship Design, Weapons and Screens, Spacecraft
  Options and Customising Ships, transcribed table by table under `src/rules/`
  with every entry citing the page it came from.
- **Four of the book's ships reproduce exactly**, to the ton and to the credit:
  the Scout/Courier, the Free Trader, the Patrol Corvette and the Chrysanthemum
  Destroyer Escort. All four are in the application to open and pull apart, and
  all four are tests.
- **Problems are reported where they happen**, as errors, warnings or notes,
  each naming the clause of `ShipSpec.md` it comes from.
- **Save and load** as JSON through the File System Access API where the browser
  has it, and as a download where it does not. Print gives the sheet the page.

Three things the book gets wrong or leaves unsaid, found by making its own ships
add up, are recorded in the spec rather than quietly accommodated: the Free
Trader's missing ton, the engineer rule that does not round the way it reads,
and ammunition that takes room in a ship without adding to its price.

Space stations and exotic technology are not in yet, and neither are deck
plans.
