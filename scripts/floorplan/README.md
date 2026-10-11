# Floor plan art

`symbols.py` copies the library's art in from a local copy of the geomorph
archives, which is not in the repo, and writes `src/floorplan/symbols.json`.
The archive's location and the repo's are at the top; change them to suit,
then run it with Python 3. Add a line to `PICKS` to bring in another piece.

The art is Robert Pearce's Starship Symbols and Adventure Class Geomorphs,
rendered by Eric B. Smith, under CC BY-NC 4.0.

Geomorph tiles beyond the library are not copied in at all. The floor plan
screen reads them from the designer's own folder (FloorPlanSpec section 12).
