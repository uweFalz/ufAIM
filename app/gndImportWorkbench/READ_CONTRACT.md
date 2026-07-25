# GND Import Workbench: missing read contract

Status: integration boundary for `APP-GND-IMPORT-WORKBENCH-001`.

The Workbench must consume an existing import result. It must not reconstruct
GND interpretation from parser data. The current application exposes only
`Import.GetState`, whose accepted and rejected `ImportSessionItem` values are
insufficient for the required truthful decision surface.

## Observed information loss

The full result returned by `runImportPipeline` contains:

- `sourceEnvelope`, including SHA-256, container/format, extractor, inventory,
  typed source tables and extraction diagnostics;
- `meta.diagnostics`, including GND truthfulness classifications;
- `meta.gndSource`, including the safe source summary;
- `items`, `rejected`, and `relationCandidates`.

Before the result becomes readable through `Import.GetState`:

- `importItemFactories.makeSource` retains only file name, parser id,
  container id, object name and index;
- `importItemFactories.makeMeta` retains only generic comparison fields;
- the Import session stores items and rejected items, but not result-level
  source envelope, diagnostics, source summary or relation candidates.

Candidate payloads do retain `extended.unresolvedAttachments`, so some EH/EU
evidence survives. That does not replace the missing result-level evidence.
In particular, the Workbench cannot truthfully show or transfer the source
fingerprint, complete source-table inventory, missing-core evidence, or the
complete diagnostic set from `Import.GetState` alone.

## Smallest required interface

Extend the existing import session with one immutable result-evidence record per
processed source. No parser or interpretation change is required.

```js
{
  evidenceId: "stable source-result identifier",
  source: {
    fileName: "source file name",
    parserId: "gnd-edit-xlsx | gnd-edit-mdb",
    container: "ZIP/OOXML | Microsoft Access database",
    format: "XLSX | Jet 4 MDB",
    sha256: "lowercase hex or null when genuinely unavailable",
    extractor: { id: "...", version: "..." }
  },
  inventory: [
    { name: "exact table name", rowCount: 0, columnCount: 0, interpreted: true }
  ],
  diagnostics: [],
  relationCandidates: [],
  itemIds: [],
  rejectedItemIds: [],
  sourceEnvelope: {},
  status: "constructive | unresolved | rejected"
}
```

Required behavior:

1. `Import.BeginSession` clears the evidence records together with session
   items.
2. ImportController writes the already-produced result evidence exactly once;
   it performs no re-interpretation.
3. A read-only `Import.GetResultEvidence` command returns a structured clone of
   the current records, or `Import.GetState` adds an `evidence` collection.
4. Each import item carries only an `evidenceId` reference. Large typed envelopes
   are not duplicated per candidate.
5. SPOT promotion resolves the referenced evidence and copies source identity,
   fingerprint, resolution state and unresolved evidence into the created
   object's provenance.
6. The read interface preserves MDB and XLSX neutrally and exposes paired
   transformation equivalence only when it already exists in the result.
7. No raw source values are logged or placed in telemetry.

## Files requiring coordinated ownership

Implementing this interface requires coordinated changes in currently modified
integration files and contracts:

- `app/controllers/importController.js`
- `app/io/import/importPipelineClient.js`
- `src/shared/messaging/CommandContract_v1.js`
- `src/shared/messaging/SharedMessagingWorker.js`
- `src/shared/runtime/AppRuntimeLocal.js`
- `src/shared/messaging/service/ImportSessionService.js`

Workbench integration would subsequently require the currently owned shell,
initialization, UI, style, main and lifecycle files. Until those owners release
the files, an isolated Workbench must not be wired into the running app.

## Acceptance boundary

The Workbench mission can resume when a read call can recover, from one current
import session, the exact source fingerprint, inventory, diagnostics, candidate
item references, rejected-item references and retained unresolved evidence
without invoking a parser. Transfer acceptance must then prove that the same
fingerprint and evidence survive in the resulting SPOT object.
