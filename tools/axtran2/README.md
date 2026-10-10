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

## What the verdict means

`stationary/within_tolerance`: every point lies within its tolerance and
what is left is not determined by the points; the fit is done.
`stationary`: an optimum of the points' residuals. `objective_settled`,
`infeasible_stationary`, `max_iterations`: the fit stopped short and the
reason says why; the output TRA is still written and the report says how
far off it is.

Modules: `pointLists.mjs` (the lists), `traWriter.mjs` (the file, the
inverse of `test/axtran2/corpus/loadTraAlignment.mjs`), `fitTra.mjs` (the
fit, the same problem the corpus runs with real points). Tests:
`test/axtran2/adapter.test.mjs`.
