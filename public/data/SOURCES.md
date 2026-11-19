# Sources

Complex G3 in Helbersdorf, Chemnitz, at Haydnstraße and Stollberger Straße.

Put this line on every page that uses the data:

> Map data © OpenStreetMap contributors (ODbL).

`site.json` is copied from the `helbersdorf-garages` project (built from OpenStreetMap, 17 October 2026). Coordinates are local metres (x east, y north) from UTM 33N 352115 / 5631440. Building heights are mapped floors × 3 m + 1 m, or estimates (16 m flats, 7 m other, 2.8 m garages). Trees are not included.

The 3 × 6 × 3 m garage module is the project brief; the map suggests about 2.6–2.9 m per garage, so a few rows are slid along to fit (see `src/geometry.js`).

## Heights

`terrain.json`: ground heights from AWS Terrain Tiles (Terrarium; EU-DEM and SRTM, about 25–30 m detail), 1400 × 1400 m around UTM 33N 352115 / 5631440, a height every 5 m, in decimetres above the lowest point (`low`, metres above sea level). Made by `scripts/terrain.mjs`.
