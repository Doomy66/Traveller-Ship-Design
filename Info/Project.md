# Project

## Purpose

A ship design tool for Mongoose Traveller 2e working to High Guard Update 2022: build a ship through the book's design sequence and get the design sheet the book would print. Deck plans from the geomorph tiles in the Resources folder are the likely second thread. See [Rules-Source.md](Rules-Source.md), [Resources.md](Resources.md) and [Plan.md](Plan.md).

## Decisions

Taken 2026-09-19:

- Stack: Vite + TypeScript + vitest, browser-first, Electron later, as PlanetHex.
- First deliverable: phases 0 to 2 of the plan, the two fixture ships green in tests, no real UI.
- Rules source: High Guard alone. Where High Guard itself defers to the Core Rulebook (the basic software packages, page 74) the Core table is transcribed and the spec says so (ShipSpec 4.7.4).
- The spec is `ShipSpec.md` at the repo root, numbered like PlanetHex's specs. Code and tests cite its clauses.

## Conventions to carry over from PlanetHex

`D:\GitHub\PlanetHex` is the sibling project by the same author, Claude-generated to spec. Unless told otherwise, follow it:

- Vite + TypeScript, no UI framework, `vitest` for tests, Electron shell for desktop, `npm run build` is `tsc --noEmit && vite build`.
- Spec first. Numbered specs (`AppSpec.md`, `PlanetSpec.md`) with clause numbers like 6.4.1, a contents list, and an Open Questions section at the end. Code is written to the spec and the spec is the contract.
- `CHANGELOG.md` kept, version in `package.json` and `src/version.ts`.
- **Licence differs from PlanetHex.** PlanetHex is MIT; this project is PolyForm Noncommercial 1.0.0, chosen 2026-09-19. Anyone may use and modify it for any non-commercial purpose, and nobody may sell it. That fits a fan tool for a ruleset Mongoose declares is not Open Game Content, and it matches the CC BY-NC terms on the geomorph tiles; see Resources.md.
- README has a short "Claude" section stating the code is Claude-generated to the author's requirements.

## Things learned while reading the rules

- Air/Raft is priced at MCr0.25 on every ship sheet in both books, though the Core vehicle entry says Cr155000. Carried vehicles take a designer-entered cost for this reason.
- Intellect and Library are free in the 2022 books; every fixture sheet shows them at no cost.
- `pdftotext -raw` is the mode that reads tables correctly. `-layout` interleaves columns.

- Standard designs get a 10% discount on everything except fuel and ammunition; the sheets show both the pre-discount total and the discounted purchase cost. Maintenance is the discounted cost / 12,000 per month.
- Computers take no tonnage. Software has cost but no tonnage.
- A cockpit replaces the bridge on craft of 50 t or less and gives no free airlock. Small craft never get a free airlock; starships get one per full 100 t.
- Hull points: hull tonnage / 2.5, before configuration modifiers. Scout 40, Free Trader 80.
- Power plant fuel is 10% of plant tonnage per month; the Scout carries 12 weeks, the Free Trader 4.
- Small hulls pay an armour tonnage multiplier (x4 under 16 t, x3 to 25, x2 to 99), applied after the configuration's armour volume modifier.

## Open questions

Moved to [Plan.md](Plan.md) under "Decisions needed before phase 0".
