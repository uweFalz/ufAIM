# AXTRAN2 adapter: TRA and lists in, TRA and residuals out

The command the original AXTRAN's user ran by hand, as one call:

```bash
node tools/axtran2/fitTra.mjs --tra strecke.TRA --points aufmass.csv --zwang zwangspunkte.csv \
     --out strecke_axtran2.TRA --report report.json --csv residuen.csv
```

## Inputs

- `--tra` a Verm.esn TRA file. It is the start alignment and the end pose:
  the first element's length is held, every other length and every arc
  curvature is free, the file's own end is the end pose. Kinks keep their
  station; zero-length junction arcs between two transitions are held.
- `--points` the survey points, one per line: `[name] easting northing
  [tolerance]`, separated by semicolon, comma, tab or spaces, decimal comma
  allowed. A header line names the columns; `Nr;Y;X` is read the Verm.esn
  way (Y the Rechtswert). Without a header, `--axes ne` swaps the order.
  `--tolerance` (default 0.15 m) applies where a line gives none.
- `--zwang` the Zwangspunkte: `[name] easting northing distance
  [tolerance]`. The distance is the lateral offset the axis has to keep from
  the point, left of the direction of travel positive, right negative; it is
  an equality of the fit. `--zwang-tolerance` (default 0.01 m) scales its
  residual.
- `--speed` the design speed in km/h for the Hauptbahn profile (minimum
  radius, transition floors, ramp rule). Without it the fastest profile the
  file admits is taken; where the file falls short of the profile, its own
  radii and lengths are inherited as exceptions, as the corpus does.
- `--end-pose E,N,T` the end pose to hold instead of the TRA's own end: the
  connecting alignment's, as the original AXTRAN took it from the
  Anschlusstrasse. E and N in metres, T the direction clockwise from north
  in gon, as a TRA states it. Without it the TRA's own end is held, which
  is right only when the plan already ends where the track does.
- `--iterations` (default 1000), `--hold-last` holds the last element's
  length as well.

## Outputs

- the fitted TRA (`--out`, default `<name>_axtran2.TRA`): the same records
  with fitted lengths and radii, directions and stations recomputed, cants
  copied from the source records, station equations (Kilometersprünge) put
  back at their distance along the alignment with the chainage they carry;
  an element a jump falls inside is written as two records again.
- `--report` JSON: input summary, verdict (status, reason, iterations,
  seconds), rms in tolerance units, points outside tolerance, end-pose
  closure, Zwangspunkt residuals, every element before and after, every
  point with station, offset before and after, residual and whether it is
  within tolerance.
- `--csv` the residual list, one line per point.

Everything is computed in a local frame at the file's start and translated
back, so the solver never sees a 5 000 km coordinate.

A survey point beyond an end of the start alignment has no foot point on
it and is excluded, as is a point within one and a half times the
distance by which the plan's end misses the given end pose; the report
lists them under `input.excludedPoints` and the residual list marks them
`excluded`. A Zwangspunkt in that position is refused.

## What the verdict means

`stationary/within_tolerance`: every point lies within its tolerance and
what is left is not determined by the points; the fit is done.
`stationary`: an optimum of the points' residuals. `objective_settled`,
`infeasible_stationary`, `max_iterations`: the fit stopped short and the
reason says why; the output TRA is still written and the report says how
far off it is.

Modules: the calculation lives in `src/services/axtran2/` (`fitTraCore.js`,
`pointLists.js` for the lists, `traWriter.js` for the file, the inverse of
`src/import/parsers/technet/vermEsn/traAlignment.js`) and is shared with the
browser app in `axtran2/`; `fitTra.mjs` here only reads and writes files,
`nodeAliases.mjs` is the Node hook for the parsers' import-map aliases.
Tests: `test/axtran2/adapter.test.mjs`, `test/axtran2/demo.test.mjs`.

## The Vorführung

`tools/axtran2/demo.mjs --tra <strecke.TRA> [--out <folder>]` runs the whole
story on one file: an Aufmaß derived from the track (and it says so), one
Zwangspunkt, a plan deliberately off by ±2 % in length and ±3 % in
curvature, the end pose from the track, the adapter, and a `summary.md`
with the numbers. Nothing in the repository changes; the TRA is only read.

## The single file

`node tools/axtran2/bundle.mjs` (or `npm run bundle`) folds `axtran2/` and
every module it reaches under `src/` into `dist/axtran2.html`: one file of
about a megabyte that runs from a double-click, `file://` included, with the
fit in a worker built from an embedded script. No bundler is installed or
wanted; the script walks the static imports, turns each module into a
function of a small registry, and refuses what it cannot carry (a dynamic
import, top-level await, `import.meta`, a cycle). `test/axtran2/bundle.test.mjs`
builds it and lets the embedded worker compute a fit in Node: the same
iterations, rms and TRA bytes as the served modules. `dist/` is not under
git; build the file and hand it over.
