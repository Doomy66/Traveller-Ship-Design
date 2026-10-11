# Floor plan art

`symbols.py` builds the library: it copies the chosen pieces in from a local
copy of the geomorph archives, which is not in the repo, cuts the Symbols &
Abbreviations sheet into pieces with `sheet.py`, and writes
`src/floorplan/symbols.json`. The archive's location and the repo's are at the
top of each script; change them to suit, then run `symbols.py` with Python 3.

- Add a line to `PICKS` in `symbols.py` to bring in another piece from the
  archive.
- Add a line to `ITEMS` in `sheet.py` to cut another piece from the sheet. Its
  box is in the coordinates of the sheet shown 1200 pixels wide, and is
  tightened to the drawing. `python sheet.py contact.png` draws every cut on
  one page to check by eye.
- `pngtools.py` reads and writes PNG with nothing but the standard library.

The art is Robert Pearce's Starship Symbols, Adventure Class Geomorphs and
Symbols & Abbreviations sheet, rendered by Eric B. Smith, under CC BY-NC 4.0.

Geomorph tiles beyond the library are not copied in at all. The floor plan
screen reads them from the designer's own folder (FloorPlanSpec section 12).
