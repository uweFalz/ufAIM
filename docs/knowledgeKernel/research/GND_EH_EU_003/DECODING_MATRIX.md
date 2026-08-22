# Constructive Decoding Matrix

Status: implementation-ready Research matrix; non-canonical.

## Common notation

For one directed source segment, let:

```text
L     = PAR1 [m]
xi    = local source distance in [0,L]
u     = xi/L
g0,g1 = EHPAR2/1000, EHPAR3/1000 [m/m]
D0,D1 = EUPAR2, EUPAR3 [m]
```

`xi` is deliberately local. It becomes intrinsic `sigma` only through an
explicit relation `sigma = f(xi)`; source order or matching numeric values do
not prove that relation.

## EH type matrix

| Type | Source label | Result | Source-local law | Mandatory gates | Withhold when |
|---|---|---|---|---|---|
| 0 | Gerade | `constructive-safe` conditionally | `g(xi)=g0`; relative height `Delta z=g0*xi` | finite `L>0`, finite `g0,g1`, `g0≈g1`, zero/blank distinguished, `EHPAR4` blank or explicit zero, explicit domain relation before Alignment attachment | gradients disagree beyond declared tolerance; domain relation absent for attachment; non-zero reserve; missing/contradictory endpoints |
| 1 | quadratische Parabel | `constructive-safe` conditionally | `q=(g1-g0)/L`; `g(xi)=g0+q*xi`; `Delta z=g0*xi+0.5*q*xi^2` | finite `L>0`, finite gradients, family retained as constant `dg/dxi`, reserve safe, explicit domain relation | any gate missing; implementation substitutes circular vertical arc; source/target length equivalence merely assumed |
| 2 | überhöhter Weichenabzweig | `evidence-only` | none established | preserve exact type, parameters, endpoints, `EHSYS`, provenance; require explicit switch/branch context for later research | always withhold constructive conversion under present evidence |

For types 0 and 1, an absolute source-height law additionally requires a
qualified starting elevation `z0` in the same `EHSYS`. Without `z0`, the
relative gradient law is known while absolute height remains unknown.

## EU type matrix

| Type | Source label | Result | Source-local scalar law | Mandatory gates | Withhold when |
|---|---|---|---|---|---|
| 0 | gleichbleibende Überhöhung | `constructive-safe` conditionally, scalar only | `D(xi)=D0` | finite `L>0`, finite `D0,D1`, `D0≈D1`, reserve safe; retain scalar/source status; explicit domain relation | endpoint values disagree; missing convention is presented as paired rails; non-zero reserve |
| 2 | Klotoide | `decision-required` | no GND interpolation formula established | preserve endpoint values and type; a future decision may bind an evidenced normalized law | do not infer `D=D0+(D1-D0)u` merely from the name |
| 3 | S-Förmige Rampe | `decision-required` | no GND S-form law established | preserve endpoint values and type; require authoritative formula/version | do not reuse horizontal S-form or TransitionDB half-wave by name |
| 4 | Bloss-Rampe | `decision-required` | no GND Bloss law established | preserve endpoint values and type; require authoritative formula/version | do not choose a cubic/quintic polynomial without source evidence |
| 7 | Gleisschere S-Form | `evidence-only` | none established | preserve exact source claim; require switch/scissor identity, branches, direction, side/reference and formula | always withhold constructive conversion under present evidence |
| 8 | Gleisschere Bloss | `evidence-only` | none established | same as type 7 plus evidenced Bloss law | always withhold constructive conversion under present evidence |

### Two-layer interpretation of EU type 0

`constructive-safe` above means only that the source-local **scalar difference
law** is uniquely determined. GAP2-D003 still forbids promoting it to the
authoritative paired law `(cL,cR)` without a complete source convention and a
reversible midpoint transformation. The admitted state therefore remains:

```text
KnownScalarSourceCant(D, family=constant, domain=source-local, provenance)
pairedRailLaw = Unknown(missingGndRailReferenceConvention)
```

It is not `Known(cL=0,cR=D)` or `Known(cL=-D/2,cR=D/2)`.

## Outcome summary

```text
constructive-safe: EH 0, EH 1, EU 0 (all conditional and locally scoped)
decision-required: EU 2, EU 3, EU 4
evidence-only: EH 2, EU 7, EU 8
```

Unknown numeric type codes are always `evidence-only` with an
`unsupported-type` diagnostic.
