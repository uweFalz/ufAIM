# TransEd playground

A page of its own for the transitionDB, independent of the app shell.

- `transed/index.html`, `transed/app.js`: presentation and workflow only.
- Everything shown is computed by `src/services/transition-library/` on
  `src/domain/transition/transitionLookup.json`.
- Built-in records stay unchanged; the user's own records form a library that
  the browser remembers on this device and that travels as a JSON file of the
  same shape as the transitionDB.

## Modes

- Mode 0, function with argument interval: a polynomial or sin/cos, shown with
  f′ and f″; the argument interval is typed or dragged open in the picture and
  cuts the frame out of the function. Stored as `simpleFcn`, as the plain piece
  `PROTO_<id>` and, if wanted, as halfWave `HW_<id>`.
- Mode 1, halfWave: a sum or product of terms, each
  `factor · function(interval) ^ power` with its own interval; the result is
  declared as κ, κ′ or κ″ and as curvature or cant. Stored as `PROTO_<id>` and
  `HW_<id>`. The Klauder family is offered as a generator: two whole numbers
  m and n fill the composer with κ″ ∼ (1+x)^m · x^n · (1−x)^m on [−1, 0]
  (`src/services/transition-library/klauderFamily.js`); the terms stay editable.
- Mode 2, transition: halfWave in and out from all halfWaves, w1 and w2 by
  slider, number or dragging the cut lines; stored as a transition.
  "Die Halbwellen lesen als" switches both halfWaves between curvature and
  cant. Built-in entries stay unchanged: the other reading is a user halfWave
  `<id>_CANT` on the same prototype (`declareHalfWaveAs` of the service). This
  is how the built-in `vienna` entries, which are Hasslinger's cant functions
  (AT 412 975 B), show their swerving curvature.
  The verdict on the ramp reads f′, f″ and f‴ at both ends; "Verlangte Glattheit"
  picks the required order (default 2: f″ = 0 is enough, decided by Uwe on
  2026-11-13 and the minimum of AT 412 975 B; order 3 stays selectable).
  The pictures of modes 1 and 2 name their curves after the reading: κ, κ′, κ″
  for curvature, ψ, ψ′, ψ″ for cant (`plotSeries`).

The coupling of curvature and cant shown in mode 2 is a reference-point model,
confirmed by Uwe on 2026-11-13. The page computes the exact expression
κ_ref = (κ + d″)/(1 − κd) with d = h·sin ψ and sin ψ_E = cant / rail base
(`couplingGeometry`); only the square of the offset slope d′ is left out. The
small-angle form k = f − ε²·f″ remains in the module for a bare ε. Reference
height h defaults to 1.8 m and is editable. It is no vehicle model.

## Served and single file

Served: open `transed/index.html` through a local web server started in the
repository root.

Single file: `node tools/transed/bundle.mjs` (or `npm run bundle:transed`)
writes repository-root `transed.html`, which runs from a double-click. Build
from the common repository, not from a separate worktree followed by copying
its output. `npm run bundle:transed:check` rebuilds in memory and rejects any
difference from the root artifact without modifying it. The HTML records
SHA-256 hashes of its source modules, page and both bundler files.
`--out dist/transed.html` remains available for an explicit alternate output.
Edit the modular sources; never hand-edit the generated HTML.
