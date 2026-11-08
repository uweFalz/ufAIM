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
  radius, transition floors, ramp rule). Without it the speed is an
  assumption, printed with its reason and with the speed the arcs
  themselves admit: what the slowest turnout the file shows allows in its
  branch (Ril 800.0120A01), and without a turnout the fastest profile the
  file admits. Where the file falls short of the profile, its own radii
  and lengths are inherited as exceptions, as the corpus does.
- `--end-pose E,N,T` the end pose to hold instead of the TRA's own end: the
  connecting alignment's, as the original AXTRAN took it from the
  Anschlusstrasse. E and N in metres, T the direction clockwise from north
  in gon, as a TRA states it. Without it the TRA's own end is held, which
  is right only when the plan already ends where the track does.
- `--iterations` (default 1000), `--hold-last` holds the last element's
  length as well.
- `--hold 1,2,13` holds records as they stand, length and radius, by the
  numbers of the TRA's listing; ranges (`3-5`) and the word `turnouts`
  work too. An L or R behind a number or a range holds one quantity only:
  `7L` the length, `7R` the radius (an arc's; a straight has none to hold). `turnouts` holds every record recognised as a Regelbauart of
  Ril 800.0120A01: an arc of the turnout's radius, `R * atan(1/n)` long,
  and the straight end piece beside it. A held record is not merged with
  a neighbour, so the written file keeps its boundaries. The turnouts the
  file shows are printed whether held or not.
- `--hold-radii` holds every radius; the fit changes lengths only.
- `--edit "7L=45.2 7R=-1250"` starts the fit from these values instead of
  the file's: the record number, L for its length or R for its radius (with
  the file's sign), `=` and the value; `9T=Bloss` changes the type of a
  transition (Klothoide, Bloss, S-Form: Kz 2, 4, 3); `-5` takes record 5
  out, `+3=G:20` puts a straight of 20 m in after record 3 (`B:-500:30` an
  arc with the file's sign, `U:40:Bloss` a transition). Not the first or
  the last record, not a turnout's, and no two transitions side by side.
  The file is not changed; an edited record keeps its own element. An edit
  holds nothing: `--hold 7L` with it keeps the value.

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

The report also carries, for the app's picture, every record of the file
with type, length, radius, the element it went into, why it is held and
which turnout it belongs to (`planRecords`), and every element's records
(`elements[].records`). `src/services/axtran2/alignmentPicture.js` draws
that as curvature, lock per record and points over the station; the app
turns a click on a lock into the hold field and fits again
(`formatHold`, the inverse of `parseHold`). `src/services/axtran2/recordList.js`
lists the same records as a table with a box per quantity and the plan's
values as fields (`src/services/axtran2/recordEdits.js`).

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

The served app (`axtran2/index.html` over a web server) loads the worker as
a module with 67 files behind it. A server that drops one of those requests
leaves a worker that never computed anything; the page starts it again, up
to four times, says so, and otherwise reports that the program did not load
(`src/services/axtran2/workerRun.js`). `python3 -m http.server` is such a
server: it queues five connections and closes each after its answer. The
single file loads nothing and is not affected.
