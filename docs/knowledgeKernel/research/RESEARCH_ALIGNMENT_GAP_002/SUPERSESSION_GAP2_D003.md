# GAP2-D003 Supersession Notice

## Status

`binding Research correction by Uwe Falz`

Recorded: 2026-07-26

## Superseded statement

All earlier GAP-002 wording that made the lower, typically curve-inner rail the
ufAIM/AIM-Core vertical reference is superseded.

This includes every Core-contract formulation that treats a lower-, inner-,
outer-, left-, or right-rail trajectory as ufAIM’s authoritative working
reference.

## Corrected statement

The binding Research input is:

1. **ufAIM/AIM-Core working reference:** the midpoint trajectory between the
   governing rail edges;
2. **source/rule reference:** may be the lower, typically curve-inner rail and
   is retained as explicit provenance;
3. **authoritative state:** both rail positions and their governing separation
   remain preserved;
4. **adapter behavior:** source reference and midpoint working reference are
   transformed explicitly, deterministically, and reversibly;
5. **roundtrip:** restores original reference, direction, side, amount,
   validity domain, and provenance;
6. **known source/engineering exception:** undertiefung at curved switches,
   explicitly typed and never inferred;
7. **incomplete evidence:** remains `Unknown` or `Ambiguous`.

## Trace instruction

Trace shall classify the earlier lower/inner-rail-as-Core-reference formulation
as:

```text
superseded-by: GAP2-D003-CORRECTION
```

It shall not report the earlier formulation as current Research direction.

## Governance boundary

This correction is binding professional input for later Alignment Aggregate,
Cant Core, adapter, import, and roundtrip packages. It is not active Knowledge
Kernel approval.
