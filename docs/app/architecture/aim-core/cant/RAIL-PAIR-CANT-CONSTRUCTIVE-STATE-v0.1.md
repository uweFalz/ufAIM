# Rail-Pair Cant Constructive State v0.1

This additive AIM Core contract corresponds to active Kernel candidate
`KC-REALIZATION-008`. It does not replace scalar `CantConstructiveState v0.1`
or claim that the Kernel candidate is approved.

The native sparse construction is:

```text
R(s) = (anchorRule(s), cL(s), cR(s), qualifiedSeparation(s))
```

Within complete admitted coverage, a missing rail-offset element evaluates to
zero. Within incomplete evidence coverage it evaluates to `Unknown`.

Elements may overlap when they address different persistent rails. Elements
on the same rail may not overlap and must meet continuously when touching.
Identically zero elements are rejected because zero is the sparse default.

The initial realization supports only separation qualified as
`horizontal-projection-between-governing-references`. Other gauge or
separation definitions fail closed until their spatial construction is
specified.

`realizeRailPairAt` consumes a qualified local non-canted profile reference
frame. It derives left and right points, the geometric midpoint, cross-level,
common offset, and roll. These outputs are runtime realization results, not
additional constructive persistence truth, SpotObject identity, Physical
Realization, observation, wheelset state, or vehicle response.

Both Core modules have zero UI, parser, SPOT, source-format, vehicle, or Node
runtime dependencies. The realization module depends only on the paired-rail
Cant contract.
