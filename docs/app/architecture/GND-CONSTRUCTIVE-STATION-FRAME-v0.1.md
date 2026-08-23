# GND Constructive Station Frame Evidence v0.1

Status: App evidence contract. Knowledge Kernel authority is unchanged.

## Purpose

The GND Constructive Station Frame is a compact, source-scoped evidence frame
for GND `EK` records. It survives import-session clearing and keeps the
constructive contents of the kilometre-line source available for review.

It is not a `ChainageMapping`, a kilometre decoder, an Alignment, or an
identity aspect. The adjective *constructive* describes retained source
construction fields; it does not assert constructive admission.

## Contract

The schema and version are:

```text
ufAIM.gnd-constructive-station-frame-evidence
1
```

The frame retains:

- source fingerprint, filename, format, and evidence identity;
- every `X_ASC24_EK` row as an ordered claim with exact row and cell locators;
- raw cell state/value and normalized value for `PAD1`, `PAD2`, `EKSYS`,
  `EKTYP`, `EKPAR1..4`, `EKARIWI`, `EKAKM`, and `EKEKM`;
- all matching start- and end-PAD observations from `X_ASC11_PP`, without a
  first-row winner;
- type `6` as a `kilometre-jump-candidate`;
- explicit blockers and `evidence-only` admission.

The frame always declares:

```text
constructiveAdmission = not-performed
addressEncoding = gnd-opaque-until-decoder-profile
intrinsicBinding = not-established
```

## Truthfulness boundary

`STATION`, `EKAKM`, and `EKEKM` are retained as source values. This contract
does not infer their physical unit, scale, packed encoding, incoming/ahead
side, or relation to intrinsic `s`. `PSTRRIKZ` is retained as source context
and is not converted to ChainageMapping direction `+1|-1`.

Type `6` establishes that the row claims a kilometre jump. It does not by
itself establish a canonical jump equation. Non-type-6 EK claims remain
kilometre-reference-line elements and are not silently promoted to track `EL`
geometry.

## Admission seam

A future adapter may construct `aim-core/chainage-mapping/0.1` only after an
explicitly named and versioned decoder profile has established:

1. source-value encoding and unit;
2. unique route, direction-code, PAD, and reference-line context;
3. the EK-to-Alignment relation and intrinsic `s` binding;
4. type-6 boundary-side semantics;
5. continuity away from jumps and treatment of conflicts;
6. accountable review or automatic eligibility evidence.

That admission adapter is not part of this package. It must not mutate horizontal,
vertical, cant, topology, CRS, or Alignment identity.

The implemented decoder-profile contract
`ufAIM.gnd-station-decoder-profile` version `1` qualifies only whether one
source-address claim may be decoded. Profiles are delivery-specific and bind
an explicit profile identity and version, source fingerprint, reference
system, supported type codes, concrete encoding identifiers, and an evidence
reference. A matching profile removes only the encoding-profile blocker;
`INTRINSIC_S_BINDING_NOT_ESTABLISHED` remains.

`GndStationFrameChainageCandidateService` is a read-only App service. It takes
an injected delivery decoder, intrinsic-binding provider, and trusted profile
registry port. Callers provide only a receipt identifier; the service accepts
the resolved profile only when the catalogue module recognizes the exact
resolution object as one it issued in the current process. This `WeakSet`
issuance check prevents cloned or reconstructed registry results from crossing
the local service boundary. It is local in-process authenticity, not a digital
signature and not proof transferable across processes or persisted sessions.
The service
may prepare a deeply immutable, non-authoritative, unreviewed
`ChainageMapping` candidate after both collaborators return complete and
unambiguous results. It never persists or admits that candidate, and every
failure returns `mapping: null` rather than a partial mapping.

## Persistence and workspace projection

The full typed source envelope remains import-session evidence. The compact
frame is projected to the promoted item's exact route/direction context,
included in `ufAIM.spot-import-evidence`, and rehydrated by the promoted GND
workspace evidence builder. Unrelated EK claims and raw source tables are not
copied wholesale into each SPOT object.

## Rejection and counterexamples

- Blank and unreadable cells remain distinct from numeric zero.
- Multiple PP observations for one PAD remain multiple; contradictions block
  admission.
- A decimal-looking value does not prove kilometre or metre encoding.
- PAD identity does not prove cross-delivery identity.
- `EKPAR4 != 0` remains unknown source evidence and cannot support a
  completeness claim.

## Dependency direction

```text
GND typed source envelope
  -> import evidence station frame
  -> compact SPOT evidence
  -> workspace review
  -> delivery-specific decoder-profile eligibility
  -> read-only ChainageMapping candidate service
  -> explicit review and future admission command
  -> AIM Core ChainageMapping
```

The reverse dependency is forbidden. AIM Core has no GND dependency.
