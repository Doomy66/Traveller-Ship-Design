# Resources folder

`C:\Users\sburrows\OneDrive\Games\Traveller\Resources\` holds six zips. All are deck-plan art, none are rules.

## Licence

The geomorph tiles are Robert Pearce's Traveller Geomorphs and Starship Symbols, rendered to PNG by Eric B. Smith (gurpsland.no-ip.org/geomorphs). Released under **Creative Commons Attribution Non-Commercial 4.0**. Attribution to both is required wherever the tiles appear. Non-commercial only. Do not commit the tiles to the public repo without deciding that this is acceptable; the app can load them from a folder the user points at instead.

## Scale

All tiles are **60 pixels per 1.5 m / 5 ft deck square**, so 1 pixel is roughly 1 inch. A 1-yard hex is 36 px across. A high-resolution set exists at 300 px per square but is not in these zips. Floors are transparent so a grid can be drawn under them or not.

## The zips

| Zip | Size | Files | Contents |
|---|---|---|---|
| `AdventureClass.zip` | 58 MB | 2,484 | Adventure Class Geomorphs v2.2. Ship-section tiles in numbered folders 01 to 09.x. Filenames carry the metadata (see below). Includes `Read Me v2.2.txt` |
| `Geomorphs.zip` | 505 MB | 1,370 | Original Geomorphs: `50x50`, `100x50`, `100x100`, `200x100` tile folders, `Baseplates` (pre-gridded), `Symbols`, `Starships` (finished deck plans of named ships as PNG), `Small`, `Misc`, `GURPSLand`, Paint.net plugins. Includes `Read Me.txt` |
| `CustomTiles.zip` | 15 MB | 2,521 | `Custom Tiles/100x100 Core/E1xx` tiles plus a `Symbols/` tree with one folder per room type: Battery, Bridge, Briefing Room, Brig and Security, Cargo, Classroom, Computer, Dock, Drop Capsule, Empty Room, Engineering, Fresher, Fuel, Furniture, Galley and Mess, Lab, Lounge, Low Berth, Machinery, Medical, Misc, Offices, Retail, Sensors, Ship's Locker, Shop and Repair, Staterooms, Storage, Utility, Weaponry |
| `GeomorphsStarships2.zip` | 85 MB | 12 | Layered `.psd` sources of 11 finished ships (K'Kree Courier, Firebird XP4, Hammer-Class, Destiny and Prosperity Yachts, Sharptooth, Stardrake SDB, Yetsabl Courier, Nirvana Dropship, X-Boat Station, Saucer Launch) |
| `GeomorphsStarships3.zip` | 484 MB | 12 | More `.psd` sources: Apartment Complex, Armed Cargo Hauler, Bartizan Carrier, Courier-Scout III and IV, Delta Cargo Transport, Ground Base, Large Shuttle, Lightning Bug, Luxury Liner, Shuttle |
| `drive-download-20251218T153024Z-3-001.zip` | 71 MB | 6 | Starship Symbols as CAD: `.dwg`, `.dxf` (r2000), `.ctb`, plus `Starship Symbols.pdf` and a US-letter deck plan template PDF |

## Tile filename convention (Adventure Class)

```
HG-004 [100x50] [100-dTons] Cargo Bay with Launch.png
HG-004 [100x50] [Overlay] 20-dTon Launches and Cargo.png
SE-656 [Aft] [50x50] [39-dTons] Engineering, Fuel.png
```

- Prefix and number: `HG` = High Guard half geomorph, `SE` = small end, and so on per folder.
- `[WxH]` is the footprint in feet, so `100x50` is 20 by 10 squares (1200 by 600 px).
- `[N-dTons]` is the displacement the tile represents. This is the hook between a High Guard design and a deck plan: a design's component tonnages can be matched to tiles of that tonnage.
- `[Aft]`, `[Fore]` mark end pieces. `[Overlay]` marks a transparent layer that sits on another tile.
- The rest is a free-text description of the rooms.

Parsing these names gives a searchable tile library with no extra metadata file.

## Useful facts for the app

- `Geomorphs.zip/Starships/` has complete example plans as PNG, for example `100-dTon Firebird XP4 Advanced Scout Main Deck.png`. Good for eyeballing what a finished plan should look like at this scale.
- The `.dxf` symbols are vector, so they could be re-rendered at any scale if the 60 px tiles prove too coarse.
- The unzipped tile set is around 1.2 GB. Do not unzip into the repo.
