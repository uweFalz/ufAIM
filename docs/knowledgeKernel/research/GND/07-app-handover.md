# Prioritized App Handover

Status: Implementation-oriented Research candidate; no implementation authorization.

## Proposed normalized import result

The importer should first produce a source-faithful, loss-aware result before constructing App objects:

```js
{
  sourceDocument: {
    fingerprint, fileName, byteSize, containerType,
    sheetInventory, importedAt, parserId, parserVersion, schemaVariant
  },
  records: [{
    sourceId, family, sourceOrdinal, sheet, row,
    raw, normalized, provenance, diagnostics
  }],
  observations: {
    points: [{ pad, roles, stationClaims, coordinates, elevations, quality, provenance }]
  },
  constructiveClaims: [{
    family, directedEndpoints, systemContext, typeCode, parameters,
    valueOrigins, sourceRefs, validation
  }],
  candidateSequences: [{
    family, routeContext, systemContext, orderedClaimIds,
    topology, continuity, stationingEvidence, usability, diagnostics
  }],
  conflicts: [],
  unsupported: []
}
```

The raw source record need not be copied wholesale into SPOT. It belongs to import/session provenance storage with compact projections admitted where valuable.

## Proposed SPOT admission payload

```js
{
  candidateObject: { kind, constructiveGeometry, profile, cant, representation },
  sourceAssertions: [{ sourceDocumentId, sourceRecordIds, sourceObjectSignature }],
  identityEvidence: { route, directionCode, endpoints, geometrySignature, confidence },
  referenceEvidence: { lsys, hsys, resolverVersion, usability, transformationProvenance },
  stationingEvidence: { domain, rawClaims, decodedClaims, jumpEvents, decodingRule },
  qualityEvidence: [{ kind, value, unit, sourceRef }],
  relations: [{ kind, targetCandidateId, evidence, confidence }],
  conflicts: [],
  admission: { state: "safe|proposal|evidence-only|rejected", reasons: [] }
}
```

## Provenance worth retaining

Content fingerprint; original filename and byte size; sheet inventory; parser/schema version; source family; table/sheet and row/cell locator; raw PAD/PAD1/PAD2; source ordinal; raw route/direction/system identifiers; record date, producer program/version, work order and comment; coordinate/elevation status and accuracy components; raw type/parameters; normalized value; value origin; validation rule/version; warning/conflict IDs.

## Ordered implementation packages

### APP-GND-01 — Truthfulness safety gate (highest value, low/medium effort)

- Remove zero-cant fabrication.
- Fix or forbid radian-as-gon direction fallback.
- Mark every fallback/derivation with value origin.
- Reject unknown constructive types instead of generic Spiral coercion.
- Emit explicit warnings for ignored nonzero fields.

Done when no output claims source-declared cant/profile/direction that was not decoded from source evidence, with synthetic tests for each case.

### APP-GND-02 — Lossless normalized source layer (high value, medium effort)

- Normalize sheet/header aliases and classify workbook variant.
- Retain source document fingerprint and record locators/provenance.
- Return rejected/unsupported records as evidence with reasons.
- Preserve all PL/PH/PP observations; detect duplicate equality/conflict.

Done when every relevant input row is either represented in normalized output or has an explicit exclusion diagnostic, and every constructed value traces to source cells or a named derivation.

### APP-GND-03 — Stationing separation and EK events (high value, medium/high effort)

- Stop treating PP station as internal `s` without a decoding/domain rule.
- Decode validated EK type-6 events and retain raw `EKAKM/EKEKM` regardless.
- Keep EK reference-line identity distinct from track EL geometry.
- Require an explicit profile domain.

Done when a kilometre jump fixture round-trips as source evidence/event and internal geometry length is not altered by external km discontinuity.

### APP-GND-04 — Complete EH/EU decoding (high value, high effort)

- Decode all supported profile and cant types/parameters edge-by-edge.
- Validate continuity, length, gradient/cant endpoint agreement, and units.
- Emit unresolved source attachment for unsupported special forms.

Done when multi-edge profile/cant fixtures preserve every supported interior transition and no placeholder value is emitted.

### APP-GND-05 — Re-import identity evidence (medium/high value, medium effort)

- Add deterministic source-object signatures and delivery identity.
- Produce match candidates and conflicts; no automatic canonical merge.
- Preserve prior delivery assertions.

Done when exact repeat, revised parameters, resegmented equivalent geometry, changed PAD, and different Alignment fixtures receive distinct expected match outcomes.

### APP-GND-06 — Container/exporter expansion (bounded later package)

- Improve unsupported MDB/ASCII diagnostics first.
- Add MDB or standalone table ingestion only with authoritative schema tests and provenance of conversion.

Done when a supported new container produces the same normalized record model as its verified XLSX counterpart.

## Synthetic regression fixtures

1. Leading blank columns; reordered columns; `LSYST/HSYST` aliases; missing/renamed sheet.
2. Numeric strings with comma/dot, whitespace blanks, zero values, Excel dates, formula/cached values.
3. Duplicate-equal and duplicate-conflicting PP/PL/PH rows, including accuracy-based tolerance.
4. EL types 0–8, unknown code, signed radii, zero/infinite transition endpoint, equal radii, missing direction and direction closure.
5. Declared length vs station delta vs chord contradictions.
6. Ordered chain, reversed edge, branch, loop, gap, repeated PAD and mixed LSYS.
7. EK type-6 positive/negative jump and packed external station values.
8. Multi-edge EH with every supported type and explicit domain.
9. EU constant/transition/special forms with nonzero cant endpoints—assert no fabricated zero.
10. Re-import exact bytes, metadata-only revision, parameter revision, row reorder, changed PAD, resegmentation, and different route.
11. Graphical-only, local, malformed, missing and conflicting LSYS; unresolved HSYS.
12. Nonzero reserve parameter and unknown extra sheet/column retained as warning/evidence.

## Explicit non-goals

No Kernel promotion; no SPOT schema approval; no complete synchronization system; no automatic canonical identity merge; no unvalidated CRS equivalence; no assumption that newest row wins; no copying private corpus into tests; no MDB implementation in the first package; no retention of workbook cosmetics as engineering knowledge.

## Priority rationale

APP-GND-01 prevents false engineering claims immediately. APP-GND-02 prevents silent information loss and enables every later package. APP-GND-03 fixes the deepest conceptual conflation. APP-GND-04 recovers valuable engineering content. Re-import matching follows only after provenance and normalization are stable.
