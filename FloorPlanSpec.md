# Floor Plan Specification

A floor plan for one ship, laid out on the standard Traveller deck square, with every component that takes up room put somewhere.

Clauses are numbered so code and tests can cite them, as ShipSpec does. A clause here is cited as FP and its number, so FP 3.2. Page numbers are PDF pages of *High Guard Update 2022*. This document carries no Mongoose text. Where the book gives guidance, the clause says what it means in its own words.

Built through FP6 on 2026-10-11. Section 11 lists what was settled by default and can still be revisited.

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
12. [Geomorph tiles](#12-geomorph-tiles)

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

3.4 **Left off the plan.** The hull, armour, and hull options take no squares here, as the book says. Stealth is a hull option, so a stealth coating that takes tonnage is left off with the rest of the hull. Software has nothing to place. Neither do most lines with no tonnage, such as carried craft, whose room is their docking space or hangar.

3.4.1 **0t items.** Fixed mounts, the computer and fuel scoops take no tonnage, but a plan may want to show where they are, so they are listed in their groups as 0t items. They need no squares, are never short or over, and are left out of the suggested layout (FP 7.9). Squares painted for one mark where it is and count towards the whole ship like any other.

3.5 **Optional.** Fuel is listed with everything else but may be placed or left off, because the book allows a deck of nothing but fuel to be left off. Unplaced fuel is not a shortfall. Fuel that is placed is counted like anything else.

3.6 **Quantity.** A sheet line with a count stands for that many things: "Standard x10" is ten staterooms and "Full Hangar (40 tons) x24" is twenty-four hangars. The target is the whole line's. Only staterooms must be drawn as that many separate rooms (FP 5.4). Twenty-four hangars may be one great hangar deck, and twenty low berths one freezer room.

3.7 **Staterooms** take six squares each rather than eight. The book takes the other two tons' worth to be corridor and access space, so those squares go to corridors and still count towards the ship's total.

3.8 **Targets.** Everything else is two squares per ton, rounded up to the whole square. A turret of one ton is two squares. A 0.5-ton re-entry capsule is one.

## 4. The plan

4.1 A plan holds the ship's decks, which component owns each square, the fixtures, and the key and tonnage of each component at the time the plan was last saved, so a later change to the design can be detected (section 9).

4.2 Each part of a deck is empty, a corridor, or owned by exactly one component. Nothing belongs to two.

4.2.1 **The half square.** Everything can sit on a grid of half squares: rooms, doors, fittings and tiles alike. A room is made of cells half a square on a side, four to the square, each named by its top left corner in squares, so "2.5,3". Counting is still in squares: a cell is a quarter of one. A plan saved in the first version, whose cells were whole squares, is read with each square split into four.

4.2.2 **Editing is in whole squares; moving is in half squares.** The brush paints the square under the pointer, a door goes in the square of wall under it, and a fitting or tile is placed on whole squares. Only the Move tool goes in half squares, to slide something that is already drawn half a square to line it up.

4.3 A deck grows to fit whatever is painted on it. There is no fixed hull outline in the first version: the outline of the ship is the outline of its squares.

4.3.1 **Every deck shares one grid.** Square (12, 4) on deck 1 is directly above square (12, 4) on deck 2. That is what lets a lift shaft, a hatch or a stairwell join two decks (FP 6.1), and what lets one deck be drawn over another to line them up (FP 10.7).

4.3.2 A whole deck can be shifted by whole squares, to line it up with the others after it was drawn. Its fixtures move with it.

4.3.3 A room selected with Move can be sent to another deck, or to a new one, from **Room to deck** in the deck bar, or with Page Up and Page Down for the deck above or below. It keeps its place on the shared grid if that is clear there; otherwise it goes to the nearest place, by whole squares, where it lands on no painted square and no tile. It never goes on top of another room. The screen follows it to its new deck, still selected. Its doors stay behind, as they do when a room is moved on its deck.

4.4 The plan is saved inside the `.ship` file, as an optional `floorPlan` field the engine does not read. One file is one ship, plan and all. The engine treats the field as opaque, and `src/floorplan/` owns its shape and checks it on loading. ShipSpec 8 gains a clause for the field when FP2 adds it.

## 5. Accounting

5.1 For each component, `check` compares the squares placed against the target.

5.2 A component short of its target, or over it, is a **warning**, not an error. Plans are drawn by hand and the book's own plans are not exact. The amount by which it is out is shown beside the component.

5.2.1 Required components not yet started are one warning that names them all, not a warning each. A new plan then opens on a single line of what is left to place.

5.3 **The whole ship.** Every non-empty square on every deck, corridors included, is counted against two squares per hull ton. The book allows ten per cent either way. Fuel the plan leaves off comes off the target first, since fuel is optional (FP 3.5): the squares of fuel not drawn, all of them or what is left after some is drawn. Outside that band is a warning, once every required component has been started; before then the plan is short because it is unfinished, which FP 5.2.1 already says. The panel shows the total against the band throughout.

5.4 **Rooms.** Staterooms should be drawn as that many separate regions. Ten staterooms painted as one block of sixty squares is a warning that says so. A region counts as a room once walls enclose it, which FP 8.2 draws. No other component is counted room by room.

5.4.1 Each stateroom is painted as itself: the owner of its squares is `staterooms#3` for the third. Two staterooms side by side are then two owners with a wall between them, which is what makes them two rooms. Too many rooms is a warning at once; too few only once all the stateroom squares are down.

5.5 Squares owned by a key the design no longer has are **orphaned** (FP 9.2). They count towards the whole ship but belong to nothing.

## 6. Access

6.1 A ship with more than one deck needs a way between them. A lift, a hatch or stairs on two decks joins them where the two overlap on the shared grid, by the squares each covers as turned. That counts the Lift, Iris, Hatch and Stairs tools, the library's access pieces (its elevators, stairwells, hatches and iris valves, but not its airlock), and a geomorph tile whose name says it has a lift, stairs, an elevator, a hatch or vertical access, over the whole of its footprint.

6.2 Every deck must be joined to the others. A deck with no way in is a warning.

6.3 Later, not in the first version: every room reachable from a corridor through a door or iris valve, airlocks on the outside edge, and ammunition near the weapon it feeds, all as the book advises.

## 7. Fixtures and symbols

7.1 A **fixture** has a kind, a position on a deck, and a rotation of 0, 90, 180 or 270 degrees. Doors and iris valves in walls sit on the edge between two squares. Everything else sits on squares.

7.1.1 A door may be wider than one square: dragging along a wall makes one door the length of the drag, drawn with two leaves meeting in the middle. Clicking makes a door one square wide in the square of wall under the pointer, and doors clicked side by side stay separate doors, each with its own jambs. A dragged door is as many squares long as the drag. Move can then slide a door half a square along its wall. A new door or valve replaces any it overlaps. An iris valve in a wall is always one square.

7.1.4 **An opening** is a stretch of wall left out, so two rooms run into one another: a lounge open to a galley, a bridge open to its sensor stations. It is placed like a door, a square for a click or as many as a drag, and moved like one. Nothing is drawn for it in use, on paper or in an export; on screen a faint dotted line shows where it is, so it can be found and moved.

7.1.5 **A wall** can be put in where there is none, to split a room up: a store partitioned off a cargo hold, a cabin partitioned in two. It is clicked or dragged like a door, a square at a time along a grid line, and drawn as the walls round rooms are. It only draws; the squares either side still belong to the same component and count as before. A drag runs the way the pointer goes, across or down, along the grid line nearest where it began, which holds for doors and openings too.

7.1.2 Every piece on squares, from the library or a geomorph tile, can be **turned** a quarter at a time and **flipped**, mirrored left to right, which is how a port-side layout becomes a starboard one. A flipped piece is mirrored about its own middle before it is turned, so it keeps its footprint. R turns and F flips the selected piece, or the next one to be placed. A painted room selected with Move turns and flips too, about the middle of the box around it, kept to the half square so that four turns or two flips put it back exactly; like a moved room, it replaces what it lands on, and its doors stay where they are.

7.2 The kinds: door, iris valve and opening in walls; lift, iris valve in the floor, iris valve in the ceiling, and stairs between decks; and furniture and fitted rooms from the library. An iris valve can be a door in a wall or a way up or down, which is why it appears in both places.

7.3 Fixtures are drawn with Robert Pearce's Traveller Starship Symbols, and a few pieces of his Adventure Class Geomorphs, as rendered to PNG by Eric B. Smith. They are under Creative Commons Attribution Non-Commercial 4.0. A small chosen set is copied into the repository under `public/floorplan/symbols/`, and both men are credited in the colophon and in a licence file beside the symbols.

7.4 The symbols are 60 pixels to the square. A symbol's footprint comes from its filename, where `[10x10]` means ten feet by ten, two squares by two. Most images carry a square of empty margin all round, so the image size is not the footprint.

7.5 A fixture with no symbol is drawn as a dashed outline, so a missing image never breaks a plan.

7.6 Doors and iris valves in walls are drawn as lines, because they sit on edges and the library's door images are whole assemblies. A door is a gap in the wall with its leaf across it. An iris valve in a wall is the bowtie the geomorph tiles draw for one: two triangles pointing at the middle of the gap. An iris valve between decks is the library's own: Starship Symbols iris valve 005, solid, for one in the floor, and 013, dashed, for one in the ceiling, dashed being the symbols' way of showing something overhead. Lifts and stairs use the library's lift and stairs.

7.7 **The library** is one list, in sections: access; turrets, launchers and barbettes; engineering; standard rooms; empty rooms; staterooms and beds; freshers; common areas; medical; furniture; consoles; cargo; craft and vehicles; and an arboretum. It draws on three sources. Robert Pearce's Starship Symbols give the fitted rooms, engineering sections of 4 to 63 tons, lounges and galleys, and furniture. His Adventure Class Geomorphs give the turrets and barbettes DV-001 to DV-009, a luxury stateroom and a luxury lounge. His Symbols & Abbreviations sheet gives 69 pieces cut out one by one: beds and bunks, freshers and sinks, medical beds and an autodoc, lockers, tables and gaming tables, machinery, batteries and computers, elevators, stairwells and hatches, launch tubes and a manned turret, cargo, and trees, boulders and a fountain. The standard rooms are his complete rooms for the book's fittings at its sizes where it gives one, a 6-ton workshop and a 4-ton medical bay, laboratory, briefing room and brig, with an armoury, classroom, computer room, office and storage; the empty rooms are his plain walls and door in ten sizes from 5 by 5 feet to 20 by 40. An air/raft, cut out of one of his air/raft bays, is the craft alone at its 4 tons. 155 pieces in all, about 760 KB. A piece the size of its drawing would misstate is given its footprint, drawn to fit it, and set against an edge where it stands against a wall: the lockers are a square each, the small one against the top of its square, and the small bed and medical bed have their heads against the left of their footprints, to go against a wall. `src/floorplan/symbols.json` lists each with where it came from; `scripts/floorplan/symbols.py` copies them in and `scripts/floorplan/sheet.py` cuts the sheet. Every piece has its white made clear, so the floor's colour shows through it and nothing draws as a solid block. They are drawn as they are on paper and inverted on screen, with the hue turned back so the arboretum stays green and the fountain blue.

7.8 **Placing always places.** A piece put down over another stands on it, as a chair stands on a fitted room's floor; only a lift, hatch or stairs replaces another on the same square. Taking a piece away is the Move tool and Delete.

7.9 **A suggested layout.** Suggest a layout, under the components, lays every component down as a room of exactly its target along one corridor a square wide, from the bow: command and weapons, accommodation, systems, craft, cargo and, aft, the drives. Fuel is left off, for the designer to draw or not (FP 3.5). Each stateroom is its own room, two squares along the corridor and three deep; any other room is about twice as long as it is deep, with what does not make a whole column in a last column against the corridor. Rooms go on whichever side of the corridor is shorter so far, and every room has a door onto it. A ship whose corridor would run more than about two and a half times the side of a square holding the whole plan is split over decks of about equal length, every corridor on the same row, with a lift at the bow end of each. Where a component is plainly one of the library's standard or fitted rooms at the library room's size, or a whole number of them, the room is drawn that shape and the library room laid over it, turned so its own door opens onto the corridor, with the plan's door where the drawing's is: every stateroom as a fitted stateroom, a workshop, medical bay, laboratory, briefing room or brig as its standard room, and common areas as lounges when they come to 8, 12 or 16 squares, or a multiple. Low berths get a berth on every square, and an air/raft in a docking space is drawn in a bay two squares wide and five deep, its 5 tons, with the craft's own 4 tons at the back and a row for the door. Nothing is guessed: engineering, bridges, cargo and anything not at a library size are left as painted rooms. It replaces what is drawn, after asking, and Undo brings that back. It is a start to move about from, not a design.

## 8. Drawing

8.1 Each component group has its own floor colour: drives and power, fuel, command, accommodation, weapons, craft, cargo, systems. Corridors are neutral.

8.2 A wall is drawn wherever a square meets a square of another owner or empty space. A door or iris valve on that edge opens it.

8.3 Each region carries its component's label, as the book recommends labelling each part. The label is centred on the middle of the room, on the half square, or in a cell of the room where its middle falls outside it, as in an L. A component with several regions labels each one. Labels are drawn over everything in the room, geomorph pieces and fitted rooms included, with a halo of the background colour so they read over the pieces' lines.

8.4 **Numbers or names.** Every component has a number, and the panel shows it beside the name. Components are numbered by group, in the panel's order, then by the sheet's order within the group, so the numbers read straight down the list. Rooms are labelled by name while a plan is being designed, or by number, as a finished plan is used. A switch on the right chooses which. A numbered plan exports and prints with a key beside it, listing the number and name of every component it shows. Every stateroom carries the stateroom number.

8.5 Plans are drawn in SVG, so they stay sharp at any zoom and print cleanly.

## 9. When the ship changes

9.1 A plan belongs to a design that may change after the plan was drawn. On loading, `check` compares the plan's saved keys and tonnages with the manifest.

9.2 A component the design no longer has leaves its squares orphaned, shown hatched with the old label, until the designer reassigns or clears them.

9.3 A component whose tonnage changed keeps its squares, and its target moves. FP 5.2 then reports it short or over.

9.4 A new component starts unplaced.

## 10. The interface

10.1 The floor plan is a second screen beside the design form, reached from the bar. The ship's sheet is not shown on it, since the components list does that job here.

10.2 **The left** lists the ship's components by group, numbered (FP 8.4). Each line shows placed against target and goes green when it is met. Choosing a line makes it the brush.

10.3 **The middle** is the deck, with the deck tabs above it. Dragging paints with the brush, a whole square at a time (FP 4.2.2). Dragging with the eraser clears. Dragging with the corridor brush makes corridors.

10.4 **The right** holds everything else: the Move tool, Corridor and Erase, Undo and Redo; doors, iris valves, openings and walls for walls; lifts, iris valves, hatches and stairs between decks; Turn and Flip; the names-or-numbers switch; and below them the library (FP 7.7) and, at its foot, the geomorph folder (FP 12). A piece is placed with a click, and turned with R or flipped with F before or after.

10.5 Problems from `check` sit above the deck, as the sheet's do on the design screen.

10.6 **Getting it out.** Each deck exports as SVG, with the symbols it uses embedded so the file stands alone, or as PNG at the symbols' own 60 pixels to the square, smaller for a ship that would pass 8,000 pixels a side. Exports use paper colours. Every deck of a ship is framed by the bounds of all of them, so exported decks line up laid over each other. Print, from either screen, gives the design's sheet the first page and every deck that has anything on it a page after, labelled by name or number as the switch is set.

10.6.1 Undo and Redo keep the last two hundred changes. Ctrl+Z, Ctrl+Y and Ctrl+Shift+Z work as expected, R turns the fitting about to be placed, Space held with a drag moves the view, as does dragging with the right button, and the wheel zooms about the pointer.

10.7 **The overlay.** Another deck can be shown faintly beneath the one being edited, on the shared grid of FP 4.3.1, so lifts, shafts, stairwells and the edges of the hull can be lined up by eye. It is the deck above by default; any deck can be chosen, and the overlay turned off. The overlay is drawn only, never edited: painting always goes to the current deck.

10.8 A lift, hatch or stairwell on the overlay deck that has no partner on the current deck is marked, so a shaft that stops short is easy to see.

10.9 **Move.** The Move tool picks up whatever is under the pointer, in this order: a fitting, a door or valve in a wall, a painted room, a tile. Dragging moves it by half squares, and it stays selected. R turns and F flips a selected tile, fitting or room in place (FP 7.1.2), Page Up and Page Down send a selected room to the deck above or below (FP 4.3.3), Delete removes the selection, and the arrow keys nudge it half a square, or a whole one with Shift. A room moved onto other squares replaces what was there. Move is the tool the screen opens with.

## 11. Open questions

These were settled by default when the first version was built, and any of them can be revisited.

11.1 **Size.** Ships up to about 5,000 tons, 10,000 squares, are what the first version is built for. Larger plans work but are drawn square by square, and the Azhanti's 120,000 squares will be slow. The book's coarser scale for very large ships is not yet offered.

11.2 **Hull outline.** The outline of the ship is the outline of its squares. There is no separately drawn exterior.

11.3 **Stamping.** A component is placed by painting its squares. A fitted room from the library is furniture placed on top, not a way to place the component.

## 12. Geomorph tiles

12.1 The **geomorph tiles** are Robert Pearce's Adventure Class Geomorphs, rendered to PNG by Eric B. Smith, under Creative Commons Attribution Non-Commercial 4.0: pre-drawn sections of ship, cores, ends, sides, add-ons and transitions. The few pieces most ships want are in the library (FP 7.7). For larger ships the whole archive can be laid tile by tile.

12.2 None of the archive ships with the site. A designer points the screen at their own copy with **Load geomorph folder**, through the browser's folder picker. The folder is remembered, though the browser asks again each visit before letting the page read it, which is what the Reconnect button is for. Reading a folder needs the File System Access API, which Edge and Chrome have and Firefox and Safari do not; without it the library is all there is, and the screen says so.

12.2.1 Every tile is listed from its filename: a code (SC-001), a side where it has one ([Fore], [Aft], [Port], [Starboard]), its size in feet as [width x height], its tonnage as [N-dTons] or [Overlay], and a description. A file without a size in brackets, such as the archive's animals, is not a tile. A tile's id is its filename made lower case with every run of other characters as a hyphen, so it is the same whichever folder it came from. The list is by the folder each tile was found in, with a search across all of them.

12.3 A tile's footprint is its size in feet over five: SC-001 at 30 by 100 feet is 6 squares by 20. The image is read before the tile is placed, and drawn centred on its footprint, which puts the drawing in place whatever margin the image carries; the Adventure Class images carry two squares of it all round. A placed tile records its id, footprint, image size and code, so a plan opened on a machine without the folder draws each tile's outline and code in the right place.

12.4 Tiles are artwork, not ownership. A tile's squares still have to be painted with the component they hold, which tints the floor under the tile's lines and counts towards the component's target. Squares under a tile get no drawn walls, since the tile draws its own. An overlay tile, a transparent layer of cargo or vehicles meant to sit on another tile, covers no squares.

12.5 Tiles are drawn above the floors and below the walls, fittings and labels, inverted on screen like the library and drawn as they are on paper. Later tiles draw over earlier ones. A tile can be moved, turned, flipped and removed with the Move tool, and goes with its deck when the deck is shifted, reordered or deleted.
