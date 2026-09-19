# Rules source

We design to **Mongoose Traveller 2nd Edition, High Guard Update 2022**.

- File: `C:\Users\sburrows\OneDrive\Games\Traveller\High_Guard_Update_2022.PDF` (80 MB, 290 pages, text layer present, watermarked to the owner's order number).
- Copyright Mongoose Publishing. Extracted text and page images stay out of this repo. The repo is public.
- Also in that folder and likely to matter: `travellercorerulebookupdate2022.pdf` (Core Rulebook, has the basic spacecraft chapter and the common ships), `Central_Supply_Catalogue_Update_2023.PDF`, `High_Guard_Deployment_Shuttle.PDF`.

## Reading it

`pdftotext` (poppler, on PATH via mingw64) extracts the whole book cleanly in a few seconds:

```
pdftotext -layout "C:\Users\sburrows\OneDrive\Games\Traveller\High_Guard_Update_2022.PDF" hg.txt
```

Pages are separated by form feeds. `-f N -l M` extracts a page range. Two-column pages come out side by side under `-layout`; tables read better without it.

**Page numbering:** printed page = PDF page minus 1. The table of contents quotes printed pages. Everything below is PDF pages, which is what `-f`/`-l` want.

## Chapter map (PDF pages)

| PDF pages | Chapter | Notes |
|---|---|---|
| 4-8 | Introduction | Navies, definitions of small craft / starship / capital ship |
| 9-26 | **Ship Design** | The core algorithm. See breakdown below |
| 27-43 | Weapons and Screens | Turrets, barbettes, bays, spinal mounts, missiles, torpedoes, screens |
| 44-64 | Spacecraft Options | Hull, drive, fuel, accommodation, sensor, external and internal options |
| 65-70 | Space Stations | Station variant of the design sequence |
| 71-73 | Customising Ships | Tech level changes, drive/weapon advantages and disadvantages, refits |
| 74-76 | The Ship's Computer | Software packages |
| 77-79 | Sensors | Sensor packages and detection |
| 80-85 | Exotic Technology | Hop/warp drives etc, psionic tech |
| 86-100 | Crew Roles | Play rules, not design |
| 101-102 | Creating Deck Plans | Five-step method, matters for the geomorph side |
| 103-105 | Fighters | |
| 106-125 | Fleet Battles | Play rules |
| 126-135 | Boarding Actions | Play rules |
| 136-290 | Spacecraft of the Third Imperium | Worked examples: every standard ship with its design sheet and deck plans. Good test fixtures |

## Ship Design chapter breakdown (PDF pages)

| Page | Step |
|---|---|
| 9 | Standard designs, construction times |
| 10 | Ship design checklist |
| 11-12 | Create a hull: tonnage, configuration, massive ships |
| 13-14 | Install armour, additional hull types, armour tonnage and cost |
| 14-15 | Hull options: heat shielding, radiation shielding, reflec, solar coating, stealth |
| 16-17 | Install drives: manoeuvre, reaction, jump |
| 18 | Install power plant, power requirements |
| 19 | Install fuel tanks |
| 20 | Install bridge: command bridges, cockpits, smaller bridges |
| 21 | Install computer: cores, options, tech levels |
| 22 | Install sensors, weapons, optional systems |
| 23-24 | Determine crew: large ships, small craft, small starships |
| 25 | Staterooms, common areas, low berths, double occupancy |
| 26 | Cargo, airlocks, cargo hatches, finalise design |

A full page-by-page heading index was generated with a small Python script over the extracted text (split on form feed, keep ALL-CAPS lines). It is quick to regenerate; do so rather than committing it.

## Standard ships worth using as test fixtures

Small craft from page 137 (Ultralight Fighter, Launch, Ship's Boat, Pinnace, Modular Cutter, Shuttle). Starships from page 159: Express Boat, Scout/Courier (161), Seeker (163), Far Trader (168, 170), Free Trader (172), Safari Ship (174), Patrol Corvette (188), Subsidised Merchant (190), Mercenary Cruiser (202), up through capital ships to the Kokirrak Dreadnought (277-287). Each has a design table with tonnage, power and cost per component, which is exactly what a design engine must reproduce.
