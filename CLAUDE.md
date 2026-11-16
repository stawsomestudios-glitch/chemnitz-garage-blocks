# Project guidelines

I study architecture or design and don't write code. Explain each step in a sentence or two of plain words. After a change, say which files you changed and what I should check on the page.

## Stack

Vite, React in JavaScript, npm. Three.js / React Three Fiber for 3D. Don't add TypeScript or switch frameworks.

## Hosting

GitHub Pages publishes every push to `main` at `https://<user>.github.io/<repo>/`, through the workflow in `.github/workflows/`. Load every data file through `import.meta.env.BASE_URL`.

## What this is

All 115 garages of complex G3, Helbersdorf, Chemnitz (Haydnstraße / Stollberger Straße), each 3 × 6 × 3 m. Each garage gets a title; garages can be locked together into blocks. Titles and colours are in `src/titles.js`. The elements you can drag in (blocks, shade, trees, cars …) are in `src/elements.js`. Garage positions are in `src/geometry.js`. Site data is in `public/data/` — read `SOURCES.md` there first.

The cobalt ribbon (route, piece kinds, starting layout, street positions) is in `src/ribbon.js`; it is drawn by `src/Ribbon.jsx`. If you change `ROUTE`, re-measure where it crosses streets and update `STREETS` and the CROSSING pieces.

Garages the ribbon passes through are found automatically from `ROUTE` (`passages()` in `src/ribbon.js`) and drawn as cleared shells (roof see-through, inside walls removed) in `src/Scene.jsx`.

Download Rhino 8 model (Save section): `src/export3dm.js` turns the three.js scene into a .3dm with rhino3dm (loaded only on click). Meshes go on layers named by `userData.layer`; `userData.noExport` leaves helpers out.
