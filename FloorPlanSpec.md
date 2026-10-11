# Floor Plan Specification

A floor plan for one ship, laid out on the standard Traveller deck square, with every component that takes up room put somewhere.

Clauses are numbered so code and tests can cite them, as ShipSpec does. A clause here is cited as FP and its number, so FP 3.2. Page numbers are PDF pages of *High Guard Update 2022*. This document carries no Mongoose text. Where the book gives guidance, the clause says what it means in its own words.

This is a draft. Section 11 lists what is still open.

## Contents

1. [Purpose and boundary](#1-purpose-and-boundary)
2. [Terms](#2-terms)
3. [The manifest](#3-the-manifest)
4. [The plan](#4-the-plan)
5. [Accounting](#5-accounting)
6. [Access](#6-access)
7. [Fixtures and symbols](#7-fixtures-and-symbols)
8. [Drawing](#8-drawing)
9. [When the ship changes](#9-when-the-ship-changes)
10. [The interface](#10-the-interface)
11. [Open questions](#11-open-questions)

---

## 1. Purpose and boundary

1.1 A **floor plan** says where each part of a ship is. It starts from a saved design and lays the design's components out on decks of squares. It never changes the design.

1.2 The floor plan is a screen in the ship designer, but its code is kept apart so it could become an application of its own. Everything it needs lives under `src/floorplan/`. It reaches the ship designer through exactly one file, `src/floorplan/manifest.ts`, which turns a design into the list of things to place (section 3). Nothing else in `src/floorplan/` imports from `src/engine/` or `src/rules/`, and nothing in the engine knows the floor plan exists.

1.3 Rules about plans are pure functions, as the sheet is. `check(manifest, plan)` returns what is placed, what is missing and what is wrong, with no state and no interface. The screen draws what `check` says.

## 2. Terms

2.1 A **square** is the Traveller deck square, 1.5 metres on a side. Two squares make a ton, so a square is half a ton. The book does not give a deck height; two squares to the ton puts it at about three metres.

2.2 A **deck** is one level of the ship: a grid of squares, numbered from the top down as the book's sample plans are. A ship has one deck or more.

2.3 A **component** is one thing from the design that takes up room: the jump drive, the bridge, a turret, a stateroom, cargo. Each has a **key** that stays the same when the design changes, and a **target**: the number of squares it should cover.

2.4 A **region** is a set of squares on one deck that all belong to the same component and touch edge to edge. One component may have many regions on many decks: engineering split between two nacelles, a jump drive with its main bulk aft and the rest amidships.

2.5 A **corridor** is a square that belongs to no component. Corridors, lifts and access space are real but have no line on the design sheet, which is why the book allows the ship as a whole some slack (FP 5.3).

2.6 A **fixture** is something drawn on top of the squares: a door, an iris valve, a lift, a hatch, stairs, a bed, a chair, a console. Fixtures take no squares of their own. Section 7 covers them.

## 3. The manifest

3.1 The **manifest** is the list of components a plan has to place. `manifest.ts` builds it from the design's sheet, so it always matches what the ship designer shows.

3.2 Each manifest entry has a key, a label, a group for colouring, its tons, its target in squares, how many separate rooms it stands for, and whether placing it is required or optional.

3.3 Keys come from the structure of the design, not from labels, because labels change with the figures in them: "Thrust 6" becomes "Thrust 5" when the drive changes. The jump drive is `jump`. The third weapon line is `weapon:2`, the first craft's berth is `craft:0:berth`, and so on. The sheet gives every line its key and, where a line stands for several things, its count. Those are the only changes the floor plan asks of the engine, and ShipSpec 5.2.2 and 5.2.3 define them.

3.4 **Left off the plan.** The hull, armour, and hull options take no squares here, as the book says. Stealth is a hull option, so a stealth coating that takes tonnage is left off with the rest of the hull. Software has nothing to place. Neither do lines with no tonnage, such as fuel scoops and fixed mounts on firmpoints.

3.5 **Optional.** Fuel is listed with everything else but may be placed or left off, because the book allows a deck of nothing but fuel to be left off. Unplaced fuel is not a shortfall. Fuel that is placed is counted like anything else.

3.6 **Quantity.** A sheet line with a count stands for that many things: "Standard x10" is ten staterooms and "Full Hangar (40 tons) x24" is twenty-four hangars. The target is the whole line's. Only staterooms must be drawn as that many separate rooms (FP 5.4). Twenty-four hangars may be one great hangar deck, and twenty low berths one freezer room.

3.7 **Staterooms** take six squares each rather than eight. The book takes the other two tons' worth to be corridor and access space, so those squares go to corridors and still count towards the ship's total.

3.8 **Targets.** Everything else is two squares per ton, rounded up to the whole square. A turret of one ton is two squares. A 0.5-ton re-entry capsule is one.

## 4. The plan

4.1 A plan holds the ship's decks, which component owns each square, the fixtures, and the key and tonnage of each component at the time the plan was last saved, so a later change to the design can be detected (section 9).

4.2 Each square is empty, a corridor, or owned by exactly one component. A square never belongs to two.

4.3 A deck grows to fit whatever is painted on it. There is no fixed hull outline in the first version: the outline of the ship is the outline of its squares.

4.3.1 **Every deck shares one grid.** Square (12, 4) on deck 1 is directly above square (12, 4) on deck 2. That is what lets a lift shaft, a hatch or a stairwell join two decks (FP 6.1), and what lets one deck be drawn over another to line them up (FP 10.7).

4.3.2 A whole deck can be shifted by whole squares, to line it up with the others after it was drawn. Its fixtures move with it.

4.4 The plan is saved inside the `.ship` file, as an optional `floorPlan` field the engine does not read. One file is one ship, plan and all. The engine treats the field as opaque, and `src/floorplan/` owns its shape and checks it on loading. ShipSpec 8 gains a clause for the field when FP2 adds it.

## 5. Accounting

5.1 For each component, `check` compares the squares placed against the target.

5.2 A component short of its target, or over it, is a **warning**, not an error. Plans are drawn by hand and the book's own plans are not exact. The amount by which it is out is shown beside the component.

5.3 **The whole ship.** Every non-empty square on every deck, corridors included, is counted against two squares per hull ton. The book allows ten per cent either way. Outside that band is a warning.

5.4 **Rooms.** Staterooms should be drawn as that many separate regions. Ten staterooms painted as one block of sixty squares is a warning that says so. A region counts as a room once walls enclose it, which FP 8.2 draws. No other component is counted room by room.

5.5 Squares owned by a key the design no longer has are **orphaned** (FP 9.2). They count towards the whole ship but belong to nothing.

## 6. Access

6.1 A ship with more than one deck needs a way between them. A lift, a hatch or stairs placed on two decks at the same square joins them.

6.2 Every deck must be joined to the others. A deck with no way in is a warning.

6.3 Later, not in the first version: every room reachable from a corridor through a door or iris valve, airlocks on the outside edge, and ammunition near the weapon it feeds, all as the book advises.

## 7. Fixtures and symbols

7.1 A **fixture** has a kind, a position on a deck, and a rotation of 0, 90, 180 or 270 degrees. Doors and iris valves sit on the edge between two squares. Everything else sits on squares.

7.2 The first version has the kinds asked for: door, iris valve, lift, hatch, stairs, airlock, chair, bed, table, console and stateroom furniture. More come later from the same library.

7.3 Fixtures are drawn with symbols from Robert Pearce's Traveller Starship Symbols, as rendered to PNG by Eric B. Smith. They are under Creative Commons Attribution Non-Commercial 4.0. A small chosen set is copied into the repository under `public/floorplan/symbols/`, and both men are credited in the colophon and in a licence file beside the symbols.

7.4 The symbols are 60 pixels to the square. A symbol's footprint comes from its filename, where `[10x10]` means ten feet by ten, two squares by two. Most images carry a square of empty margin all round, so the image size is not the footprint.

7.5 A fixture with no symbol is drawn as a plain outline with its name, so a missing image never breaks a plan.

## 8. Drawing

8.1 Each component group has its own floor colour: drives and power, fuel, command, accommodation, weapons, craft, cargo, systems. Corridors are neutral.

8.2 A wall is drawn wherever a square meets a square of another owner or empty space. A door or iris valve on that edge opens it.

8.3 Each region carries its component's label, as the book recommends labelling each part. A component with several regions labels each one.

8.4 Plans are drawn in SVG, so they stay sharp at any zoom and print cleanly.

## 9. When the ship changes

9.1 A plan belongs to a design that may change after the plan was drawn. On loading, `check` compares the plan's saved keys and tonnages with the manifest.

9.2 A component the design no longer has leaves its squares orphaned, shown hatched with the old label, until the designer reassigns or clears them.

9.3 A component whose tonnage changed keeps its squares, and its target moves. FP 5.2 then reports it short or over.

9.4 A new component starts unplaced.

## 10. The interface

10.1 The floor plan is a second screen beside the design form, reached from the bar. The ship's sheet is not shown on it, since the components list does that job here.

10.2 The left panel lists the manifest by group. Each line shows placed against target and goes green when it is met. Choosing a line makes it the brush.

10.3 The middle is the deck, with the deck tabs above it. Dragging paints squares for the brush. Dragging with the eraser clears them. Dragging with the corridor brush makes corridors.

10.4 A fixture palette offers the kinds in FP 7.2. A fixture is placed with a click and turned with a key or a button.

10.5 Problems from `check` sit above the deck, as the sheet's do on the design screen.

10.6 Export to PNG and SVG, and printing, come after the editor works.

10.7 **The overlay.** Another deck can be shown faintly beneath the one being edited, on the shared grid of FP 4.3.1, so lifts, shafts, stairwells and the edges of the hull can be lined up by eye. It is the deck above by default; any deck can be chosen, and the overlay turned off. The overlay is drawn only, never edited: painting always goes to the current deck.

10.8 A lift, hatch or stairwell on the overlay deck that has no partner on the current deck is marked, so a shaft that stops short is easy to see.

## 11. Open questions

11.1 How large a ship the first version must handle. A 5,000-ton carrier is 10,000 squares; the Azhanti is 120,000. The book allows a coarser scale for very large ships. The proposal is to make ships up to about 5,000 tons work well first.

11.2 Whether the exterior hull outline is drawn by hand as a separate layer, as the book's first step suggests, or stays the outline of the squares.

11.3 Whether a component may be placed by stamping a symbol whose footprint covers its target, a stateroom symbol for a stateroom, rather than painting squares and adding furniture separately.
