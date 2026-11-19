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

Undo / redo: every plan change goes through `setPlan` in `src/App.jsx` (`useHistory`, 100 steps); a drag counts as one step. Detach turns a ribbon piece into a single blue module (an element of kind `rmod`, with `rk`, `len`, `flip`, `bw`) and leaves a `gap` piece; the ribbon is not drawn over gaps. Reattach puts a module into the nearest gap, or carves it into the nearest path. Single modules are added from the Ribbon section and drawn by `Module` in `src/Elements.jsx`.

Sizes: a ribbon piece or module can carry its own width `w` and top height `h` (`pieceShape`, `pieceWidth`, `cleanSize` in `src/ribbon.js`); without them it keeps its usual size, so the starting ribbon stays exactly the same. Kinds with a `height` (ONE-WAY STAIRS, the three WALL kinds) draw themselves at that height; the others are stretched. Several pieces can be picked at once (Shift-click; `chosenList` in `src/App.jsx`).

Picture (top bar and Picture section): `capture()` in `ViewApi` (`src/Elements.jsx`) draws the view again at 1–4x the screen size and copies the HTML labels onto it; `takePicture` in `src/App.jsx` hides the selection, saves PNG or JPG.

Map styles: `src/mapStyles.js` (colours of every map layer, sky, light, shadows per style). Your own colours per style are kept in the plan (`plan.map`), and an element can carry its own colour `col`. Colour boxes (picker, code as #RRGGBB or R,G,B, palette, pipette) are `src/ColourField.jsx`. Elements are listed in groups (`ELEMENT_GROUPS` in `src/elements.js`).

Magic wand: `Wand` in `src/Scene.jsx` (click points on the ground, drag, Ctrl-click inserts, Shift-click removes); "Turn into ribbon" adds a drawn ribbon to `plan.drawn` ({ id, name, route, width, pieces }). The piece panels edit the ribbon in `cur` (main or drawn, `active` in `src/App.jsx`). Labels: switches in `show` (garages / ribbon / elements, kept in this browser); your own texts in `plan.glabel`, `piece.label`, `it.label`; double-click a label to change it. Page title and subtitle: `plan.heading`, click to edit.

Saved views: `plan.views` ({ id, name, pos, target }); the ★ Views menu in `src/App.jsx`, `cameraNow()` in `ViewApi` (`src/Elements.jsx`), and the glide back in `Camera` (`src/Scene.jsx`, view name `saved`). Keys 1–9 jump to the first nine.
