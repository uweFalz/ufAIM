# The TRA round-trip contract, and what it found (2026-10-30)

Agreed with Rock on 2026-10-30 as the bounded follow-up in the AIM
timeline: a fitted TRA leaves AXTRAN2 through the adapter's writer and
comes back into alignmentOS through the app's import. Two readers turn a
Verm.esn TRA into an axis, and nobody had checked that they agree:

- the app's: `parseTraGraAuto` → `buildSparseFromLandFAT` →
  `makeAlignment2DFromSparse` (`src/import`, `src/aim-core`);
- the solver's: `traAlignmentFromBytes` → `buildProductionAlignment`
  (`src/import/parsers/technet/vermEsn/traAlignment.js`,
  `src/domain/optimization/alignment/ProductionAlignment.js`).

`test/axtran2/tra-roundtrip-contract.test.mjs` measures them against each
other on every trusted corpus file (the solver's chain reaches the file's
recorded end to a millimetre: 248 files), on the original and on the copy
the adapter's writer makes of it. Nothing in `app/` or `src/import` was
changed; the test only reads.

## The contract holds on 236 files

| | at worst |
|---|---|
| the two readers, on the original | 9.6e-9 m apart, lengths equal |
| the written copy, imported by the app, against the solver's axis | 9.2e-9 m |
| the written copy, both readers | 9.2e-9 m |

So what the adapter hands back is what alignmentOS will import, to ten
nanometres, kinks and station equations included.

## Twelve files diverge, and the app's import is the side that is off

The twelve trusted files with a transition pair meeting at a curvature -
two Spirals in a row whose shared end radius is not zero - miss their own
recorded end point through the app's import:

| file | junctions | app's import misses the recorded end by | solver's reader |
|---|---|---|---|
| Landshut/5500L074-082 | 5 | 556 m | 4e-9 m |
| Landshut/5500R074-082 | 5 | 674 m | 4e-9 m |
| 1151_228-230_DBREF_GL | 2 | 0.82 m | 7e-8 m |
| eifel/2631K139_Bestand_VR | 1 | 661 m | 2e-6 m |
| eifel/2631R139_Bestand_VR_A | 1 | 661 m | 2e-5 m |
| eifel/2631R139_Philippsheimer+Friedrich-Wilhelm | 1 | 129 m | 4e-6 m |
| metroB/5904_R (three copies) | 1 | 85 m | 1e-7 m |
| metroB/AIT_5904L_c_mitW207 | 2 | 155 m | 2e-9 m |
| metroB/AIT_5904R_b | 2 | 125 m | 3e-9 m |
| metroB/Ka_5800R_km45-66 | 4 | 569 m | 6e-9 m |

The mechanism, read in the bridge: a Spiral becomes
`sw.transition({ poseA, arcLength, transType })` with no curvature of its
own; the kernel's factory reads a transition's end curvatures from the
fixed elements beside it; between two transitions `enforceAlternation`
puts a fixed stub of zero length and zero curvature; the junction
curvature the file carries in R2 is lost, and the second transition starts
from zero. The solver's reader met the same case on 2026-09-10 and
inserts a held arc of zero length carrying R2 between the two
(`traAlignment.js`, "a transition pair meeting at a curvature"); the
corpus validation checks it against every file's recorded end.

## What follows, and who owns it

The fix is one rule in `buildSparseFromLandFAT`: where a Spiral is
followed by a Spiral and its end radius is finite and not zero, emit a
zero-length fixed element of that curvature between them, as the solver's
reader does. It is not applied here: `src/import` is the app's, under the
App gate (Codex), and Rock's note of 2026-10-30 orders no implementation.
The second test of the file pins the divergence to exactly these twelve
files; once the bridge carries the junction curvature that test fails by
design, and the files join the contract test.

Until then, alignmentOS imports a wrong axis for an alignment with two
transitions meeting at a curvature - a Bestand file of the Eifel line by
661 m - and anything built on that import (projection, curvature band,
receipts, the evidence service's samples) inherits it. That is a D1
finding for the import journey, stated here for its owners.
