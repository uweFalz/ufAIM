# TransEd playground

A page of its own for the transitionDB, independent of the app shell.

- `transed/index.html`, `transed/app.js`: presentation and workflow only.
- Everything shown is computed by `src/services/transition-library/` on
  `src/domain/transition/transitionLookup.json`.
- Built-in records stay unchanged; the user's own records form a library that
  the browser remembers on this device and that travels as a JSON file of the
  same shape as the transitionDB.

Served: open `transed/index.html` through a local web server started in the
repository root.

Single file: `node tools/transed/bundle.mjs` (or `npm run bundle:transed`)
writes `dist/transed.html`, which runs from a double-click. `dist/` is not
under version control; rebuild after changing the sources. Do not edit the
generated file.

Present: mode 2 (choose halfWave in and out, adjust w1 and w2, save as an own
transition). Planned: mode 0 (function creator with frame picker) and mode 1
(halfWave composer).
