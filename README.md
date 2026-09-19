# Traveller Ship Design

Builds a spacecraft to Mongoose Traveller's *High Guard Update 2022* and gives
back the design sheet the book would print: every component with its tonnage,
cost and power draw, then hull points, crew, fuel, cargo, purchase price and
monthly maintenance.

The book's own ships are the proof. Four of them come out to the ton and the
credit, from the 100-ton Scout/Courier to the 1,000-ton Chrysanthemum
Destroyer Escort, and each is in the application to open and pull apart.

## Claude

I have 50 years of hand coding, I even reproduced the Spinward Marches on my
ZX-Spectrum, so I have earned the right and have the skills to use AI. At time
of writing, this is 100% Claude generated to my exacting requirements.

## What it does

- **The book's sequence, in the book's order.** The thirteen steps of the
  checklist on page 10, down the left of the screen, and the sheet on the right
  redrawn on every keystroke.
- **The whole of the design chapters.** Hulls and armour, drives, power, fuel,
  bridges, computers and software, sensors, every weapon from a fixed mount to
  a meson spinal mount, screens, ordnance, roughly ninety optional systems, and
  the Customising Ships rules for building a component off its own Tech Level.
- **It tells you what is wrong.** A design over its tonnage, a jump drive on too
  small a hull, armour above the Tech Level's cap, more mounts than hardpoints,
  software a computer cannot run: each is reported where it happens, as an
  error, a warning or a note, with the clause of the spec it comes from.
- **Nothing is hidden in code.** Every table in the book is transcribed once
  under `src/rules/`, each entry carrying the page it came from, and the engine
  reads those tables rather than restating them.
- **A design is a small piece of JSON** holding what you chose, never what the
  rules make of it, so it cannot drift from the book. Print gives you the sheet
  on its own.

## Where the numbers come from

[ShipSpec.md](ShipSpec.md) is the contract. Every rule is a numbered clause
citing its page, the code cites the clauses, and the tests cite them back.
Where the book is ambiguous, or wrong, the spec says so and argues it out. A
few of those are worth knowing about:

- The Free Trader on page 172 loses a ton. Its own components come to 119 of
  200, so cargo is 81 where the sheet prints 80.
- "1 per 35 tons of drives and power plant" does not round up, whatever it
  looks like. Six of the book's ships say it rounds to nearest.
- Ammunition takes room in a ship and costs it nothing. Put the Destroyer
  Escort's missiles into its price and the printed total stops working.

## Running it

```
npm install
npm run dev
```

`npm test` runs the suite, which is mostly the book's ships checked line by
line. `npm run build` typechecks and bundles.

## What it is not

An unofficial fan tool. *Traveller* is a trade mark of Mongoose Publishing and
the rules are their copyright; this repository contains none of their text and
reproduces none of it. You need your own copy of the book, and the application
is no use without one.

The code is under the [PolyForm Noncommercial License](LICENSE.md): use it and
change it freely for anything that is not commercial, and do not sell it.
