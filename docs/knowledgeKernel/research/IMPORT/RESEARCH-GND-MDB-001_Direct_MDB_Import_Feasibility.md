# MISSION REPORT

## 1. Mission

- Mission: `RESEARCH-GND-MDB-001 — Direct MDB Import Feasibility`
- Responsible stream: `research`
- Requested objective: determine how alignmentOS can accept a GND Microsoft Access `.mdb` directly, without manual XLSX/CSV conversion, while preserving the current GND truthfulness boundary.
- Package identifier: `RESEARCH-GND-MDB-001`

## 2. Status

`complete`

Research outcome: **survives with reformulation**.

Required disposition: **browser-native feasible**.

Confidence: **medium-high for the supplied Jet-class GND corpus; medium for unrestricted MDB/ACE support**.

Prerequisites: a disposable App spike must pin and license-review `mdb-reader`, execute it in a Web Worker against provenance-cleared or generated fixtures, prove typed table parity against corresponding XLSX evidence, define deterministic row ordinals, and demonstrate visible rejection of encrypted, corrupt, oversized, or unsupported inputs. Until those checks pass, `.mdb` must remain unsupported in production.

## 3. Baseline and Scope

- Repository root: `/Users/uwefalz/Documents/developer/ufAIM`
- Branch: `main`
- Baseline commit: `b4ad4d57a3f9a5e3df224e0e483eb0928d0015a6`
- Investigation date: 2026-07-20
- Authorized change: this Research document only under `docs/knowledgeKernel/research/IMPORT/`.
- Read-only evidence: current GND parser/import pipeline, GND convergence Research, relevant current and `_legacy/` MDB/XLSX fixtures, bundled GND field reference, and public primary documentation for candidate readers/drivers.
- Explicit exclusions: production parser/UI changes, active Kernel promotion, private/corpus modification, retained extraction output, and interpretation of unresolved GND semantics.
- Pre-existing working-tree changes: substantial independent App/SPOT and Thesis work was present at baseline. No pre-existing change was in this mission-owned file. Final overlap checking is required before handover.

## 4. Work Performed

### Research question, result, and counterexample

Question: can the user drop a GND MDB into alignmentOS and receive the same source-faithful, truth-gated result as the supported GND path?

Finding: yes for the supplied class, by reading the MDB `ArrayBuffer` locally in a browser Worker and converting database tables into a typed, provenance-bearing neutral envelope consumed by the same GND interpretation layer as XLSX. “Direct” describes the user flow; extraction remains a separately identified stage.

Counterexample to “just convert MDB to CSV/XLSX”: CSV loses database types, null distinctions can collapse into empty text, binary/memo behavior becomes converter-dependent, numeric precision may be reformatted, and row/table provenance is weakened. Generated XLSX would also be a new representation and must never masquerade as the original MDB.

Counterexample to “a native sidecar is required”: the maintained JavaScript `mdb-reader` project explicitly documents browser operation and support for Jet 3/4 plus ACE14–ACE17, exposes ordered column definitions and nullable/type/precision/scale metadata, returns null as `null`, returns `numeric` and `currency` as strings, and supports memo/binary/complex values. This covers the source boundary needed by GND without an OS database driver. Source: <https://github.com/andipaetzold/mdb-reader>.

### Repository findings

- The GND parser advertises only `xlsx`, `xlsm`, and `xls`; a `.mdb` therefore has no parser candidate. The synthetic regression suite explicitly expects fake MDB input to remain unsupported.
- `readGndXlsxTables.js` combines two responsibilities: workbook extraction and GND row normalization. It reads only the seven configured core sheets and converts them immediately to formatted cell values. MDB support should split extraction from interpretation rather than imitate the SheetJS workbook object.
- The current truth-preserving GND path has evolved beyond drawable geometry: regression tests retain rejected EH/EU evidence, explicit zero parameters, ambiguity reasons, source elements, and diagnostics; unsupported constructive types remain unresolved instead of entering geometry. The MDB path must feed exactly these gates.
- Existing GND Research already requires a normalized source layer with document fingerprint, table/row locators, raw and normalized records, value origin, conflicts, and unsupported evidence. MDB extraction is a new source adapter for that boundary, not a new interpretation model.
- Current and legacy holdings contain paired MDB/XLSX deliveries. The inspected MDB exposes the seven core names `X_ASC11_PP`, `X_ASC12_PL`, `X_ASC13_PH`, `X_ASC21_EL`, `X_ASC22_EH`, `X_ASC23_EU`, and `X_ASC24_EK`, plus additional GND database tables also visible in the corresponding XLSX manifest. No repository code using `mdbtools`, ODBC, JDBC, Access drivers, or a conversion utility was found.
- GND construction currently relies on table records and PAD/PAD1/PAD2 relations computed in application code. It does not require Access relationship metadata or saved-query execution for the seven-sheet path. Index/relationship metadata is still valuable for diagnostics and future extra-table support, but is not a blocker for parity with the present core path.

### MDB format boundary

Three available files—a current paired GND sample, a current delivery sample, and a legacy GND sample—were inspected without extracting row values. Each begins with the `Standard Jet DB` signature and carries version marker bytes `01 00 00 00` at offset `0x14`. This is consistent with the Jet 4 class supported by both `mdb-reader` and MDB Tools; format classification must nevertheless be performed by the chosen library, not by a hand-coded four-byte assumption.

Observed sizes were approximately 2.6 MB, 18.6 MB, and 2.9 MB, so whole-file browser loading is realistic for this sample set. Production limits must be configurable and tested on the largest provenance-cleared delivery.

The MDB alone contains the core GND table-name evidence required by the current path, and it contains additional GND structures not used by that path. This supports direct extraction. It does not yet prove value-for-value parity with every paired XLSX, because no approved third-party extractor was available locally for row decoding.

Format risks:

- Jet 3/4 and ACE have different page/database formats; extension alone is insufficient.
- Basic database passwords and actual encryption are distinct failure classes. `mdb-reader` documents Jet and Office encryption support; password acquisition must be explicit and secrets must not be logged or persisted. Jackcess separately documents that encrypted files require a codec provider. Sources: <https://github.com/andipaetzold/mdb-reader>, <https://jackcess.sourceforge.io/faq.html>.
- Database `numeric`/`currency` must remain decimal text until the GND field contract chooses a numeric representation; conversion to JavaScript `number` can lose precision.
- Null must remain `null`; zero, empty string, and null are distinct.
- Memo, binary/OLE, complex, datetime, and extended datetime values require explicit typed handling even if the seven current tables rarely use all of them.
- Access physical/table iteration order is extraction evidence, not an implicit primary key. Store `sourceOrdinal`, but do not claim it is stable across database rewrites. Where GND geometric ordering matters, validate PAD topology and documented order at interpretation time.
- Table and column names are case-sensitive in the candidate API. Preserve exact names and use a separately versioned alias/canonicalization layer.
- Relationships, indexes, defaults, and constraints should be captured when the chosen reader exposes them; absence must be explicit. The current seven-table interpretation must not invent them.

### Focused read-only experiment

Method:

1. Used the platform file classifier on three MDB files.
2. Inspected only the fixed header region and file sizes.
3. Searched the representative binary for structural UTF-16LE identifiers only.
4. Compared the discovered core table-name set with the sheet manifest of the paired XLSX.
5. Checked whether `mdb-tables`, `mdb-schema`, `mdb-export`, ODBC, or bundled MDB Python/Node readers were already installed.

Results:

- Classification: all three identified as Microsoft Access databases with the same `Standard Jet DB`/version-marker structure.
- Structural accessibility: the representative binary exposed every core GND table name and additional GND tables; paired XLSX manifest names corroborate the core and many extra names.
- Local extractor availability: none. MDB Tools, ODBC helpers, and MDB Python/Node modules were absent.
- Full schema/value extraction: **not run**. A temporary third-party package execution request was rejected as an avoidable code-execution risk; no workaround was attempted.
- Retained output: none. No table rows, private values, converted dataset, or temporary extraction artifact was committed.

Limitations: the experiment proves container identity and structural correspondence, not row counts, column types, null fidelity, numeric parity, encryption support, or deterministic output on this corpus. Those are mandatory App-spike acceptance tests.

### Evaluated strategies

| Strategy | Platforms / browser / offline | Fidelity and determinism | Burden, licensing, maintenance | Static/local fit | Decision |
|---|---|---|---|---|---|
| Browser-native `mdb-reader` in Worker | Any supported modern browser on macOS/Windows/Linux; offline when bundled | Strong typed API: exact column names, nullable/type/size/precision/scale; null preserved; decimal types returned as strings; row ordinal must be added; parity still to prove | MIT; small JS supply-chain surface; active v3.2.0 release in 2026; pin/SBOM/audit required | Excellent | **Recommended** |
| Browser WebAssembly port of MDB Tools | Potentially cross-platform/offline | Read capability likely strong, but JS/WASM boundary and type envelope need custom work | No mature project was evidenced; C/WASM toolchain; MDB Tools libraries LGPL, utilities GPL | Possible but high maintenance | Reject for first implementation |
| Installed local `mdbtools` CLI | macOS/Linux strong; Windows packaging less uniform; offline after install; not browser-native | Schema/data extraction available; CSV route is lossy unless a typed protocol is built | User installation or bundled binaries; LGPL library/GPL utilities; subprocess security and version drift | Poor for current static App | Fallback/spike comparator only |
| Bundled native helper/sidecar using MDB Tools | Can be built per OS/architecture | Can be deterministic with pinned builds and typed protocol | Signing/notarization, updates, GPL/LGPL boundary, architecture matrix, process sandbox | Requires deployment architecture change | Not required for supplied class |
| Pure-Java Jackcess/UCanAccess sidecar | macOS/Windows/Linux with Java 11+; offline; not browser-native | Broad Access support; data types, sizes, indexes, referential integrity; encryption extension available | Jackcess/UCanAccess Apache 2.0; JVM/runtime and dependency bundle; larger attack/update surface. Sources: <https://jackcess.sourceforge.io/faq.html>, <https://github.com/spannm/ucanaccess> | Technically strong but architecturally heavy | Reserve fallback if browser parity fails |
| Platform ODBC / Microsoft Access Runtime | Windows only; offline after installation | Microsoft engine fidelity; bitness/install/runtime state creates nondeterministic availability | Proprietary runtime/EULA, Office compatibility issues, Windows administration. Microsoft documents ODBC/OLEDB access and installation constraints: <https://support.microsoft.com/en-us/access/download-and-install-microsoft-365-access-runtime> | Poor and non-portable | Reject |
| Server-side conversion | Any browser; not offline | Centralizable, but upload changes custody and adds converter/version provenance | Infrastructure, data protection, breach surface, network dependency; Microsoft runtime is not intended as a server replacement for Jet | Conflicts with local/static and privacy goals | Reject |
| Automatic MDB → CSV/XLSX → current parser | Depends on converter | Weak: types/null/precision/row provenance can be lost; intermediate can be confused with source | Easy demo, high truthfulness risk | Superficially compatible | Reject |
| MDB → typed neutral envelope → shared GND interpreter | Browser-native with recommended reader | Strong if raw types, ordinals, names, diagnostics, and source refs are retained | Moderate refactor; no duplicate semantics | Excellent | **Recommended architecture** |
| Dedicated MDB geometry parser | Platform depends on reader | Risks semantic divergence from XLSX and duplicated truth gates | High long-term maintenance | Avoids useful shared boundary | Reject |

MDB Tools remains useful as an independent parity oracle in CI/spike environments. Its official documentation describes read-only Jet 3/4 support and schema/data utilities; its FAQ states that libraries are LGPL and utilities GPL: <https://mdbtools.github.io/>, <https://mdbtools.github.io/faq/>.

### Truthfulness contract

The MDB adapter must emit an extraction result before any GND interpretation:

```js
{
  sourceDocument: {
    originalFileName,
    byteLength,
    sha256,
    container: "Microsoft Access MDB",
    detectedFormat,
    encrypted,
    extractor: { id, version, buildHash },
    extractionRunId
  },
  tables: [{
    sourceTableName,
    sourceTableOrdinal,
    columns: [{
      sourceName, sourceOrdinal, sourceType, nullable,
      size, precision, scale
    }],
    rows: [{
      sourceOrdinal,
      values: [{ state: "null|value|unreadable", typedValue, rawType }]
    }]
  }],
  schemaEvidence: { indexes, relationships, defaults, availability },
  extractionDiagnostics: []
}
```

Contract rules:

1. SHA-256 is calculated over the original MDB bytes before extraction. The intermediate is identified as derived extraction, never as the source file.
2. Original table/column names and extraction ordinals are immutable provenance. Normalized aliases are additional fields.
3. `null`, empty text, zero, false, unreadable, and absent column are distinct states.
4. Decimal/currency/numeric values remain lossless strings plus declared precision/scale until field-aware normalization; binary values remain bytes and are never coerced to text.
5. EHTYP/EUTYP and every parameter stay under their original field identity. Unknown/ambiguous EH/EU evidence reaches the existing unresolved-evidence gates unchanged.
6. LSYS/HSYS remain source claims; extraction does not resolve CRS.
7. Extraction diagnostics, interpretation diagnostics, and construction diagnostics are separate namespaces and stages.
8. No geometry is created if extraction is partial, a required table/field is unreadable, or the truthfulness gate rejects the evidence.
9. Row order is recorded but never used as the only identity or correctness proof.
10. Extractor/version changes invalidate cached derived envelopes and trigger parity regression.

### Security, privacy, and licensing assessment

- Parse untrusted MDB bytes in a dedicated Worker with no DOM access, network access, dynamic code loading, or filesystem write capability.
- Enforce file-size, table-count, column-count, row-count, memo/binary-size, recursion/complex-value, time, and memory limits. Abort visibly on limit breach.
- Compute the source hash locally. Do not upload by default, do not place source values in logs/telemetry, and do not persist the password.
- Treat malformed page structures, decompression/allocation abuse, and parser exceptions as untrusted-input failures; keep the main UI responsive and terminate the Worker on timeout.
- Pin exact package and transitive versions, retain license notices, generate an SBOM, review release provenance, and run dependency/security review before shipping. `mdb-reader` is MIT; its browser encryption path declares additional dependencies.
- Do not silently fall through from browser extraction to cloud conversion. Capability failure must state the supported alternatives.
- MDB Tools CLI redistribution requires a deliberate GPL/LGPL review; Microsoft Access Runtime is governed by Microsoft’s EULA and has Windows/Office deployment constraints; Jackcess/UCanAccess use Apache 2.0 but add JVM dependencies.

### Intended user experience

1. User drops/selects `.mdb`.
2. Sniffer checks extension plus signature and reports `GND MDB candidate`, not `GND accepted`.
3. Capability check loads the pinned Worker extractor locally. If unavailable, the App states that this build cannot read MDB and offers selection of the supported original XLSX path; it does not request manual CSV conversion as if equivalent.
4. UI shows hashing, format detection, table inventory, extraction, GND interpretation, and truthfulness validation as distinct progress stages.
5. Preview identifies the original MDB fingerprint, extractor/version, tables used, omitted/unsupported tables, warnings, and whether evidence is calculation-capable, unresolved, or rejected.
6. Password/encryption is handled through an explicit secret prompt. Unsupported encryption, wrong password, corruption, resource limit, or missing required table fails visibly with no geometry.
7. Existing GND admission behavior remains identical because both XLSX and MDB feed the same normalized table/evidence interface.

### Recommended architecture

```text
MDB File/ArrayBuffer
  -> source hash + signature/capability check
  -> sandboxed MDB extraction Worker (`mdb-reader`, pinned)
  -> typed GND table envelope + extraction diagnostics
  -> shared GND row normalization/evidence model
  -> existing sequence, ambiguity, CRS, EH/EU, and construction gates
  -> normal import preview/admission

XLSX File/ArrayBuffer
  -> XLSX extraction adapter
  -> the same typed GND table envelope
  -> the same downstream path
```

The Worker may transfer the original `ArrayBuffer` and stream or batch normalized rows back to limit peak memory. The adapter reads only selected core tables for the first package but records the complete table inventory. Extra tables remain named unsupported evidence, not silently discarded.

### Rejected alternatives and reasons

- **CSV/XLSX conversion:** loses or obscures source types, nulls, precision, and provenance.
- **Server-assisted import:** violates offline/local expectations and increases private-data custody and operations burden.
- **ODBC/ACE as primary:** Windows-only, installation/bitness dependent, and incompatible with uniform static-browser behavior.
- **Native sidecar as first choice:** solves a problem the browser reader appears able to solve while adding release, signing, process, and platform complexity.
- **WASM MDB Tools first:** no sufficiently mature, maintained browser distribution was evidenced; building and maintaining one is disproportionate.
- **Dedicated MDB interpretation:** would duplicate and eventually diverge from GND truthfulness logic.

### Remaining unknowns

- `MDB-U01`: value-for-value parity of each core table against paired XLSX, including row counts, nulls, dates, decimal precision, memo text, and order.
- `MDB-U02`: whether every supported delivery is Jet 4 or whether Jet 3/ACE/encrypted variants occur operationally.
- `MDB-U03`: browser memory/time on the largest realistic delivery and hostile/corrupt inputs.
- `MDB-U04`: stability of `mdb-reader` physical row iteration and behavior for deleted rows, linked tables, complex fields, and damaged indexes.
- `MDB-U05`: whether extra GND tables/relationships later become required evidence; the first package guarantees parity only with the current seven-table path.
- `MDB-U06`: acceptable password UX and whether encrypted MDB is in initial support scope.
- `MDB-U07`: final legal/security approval of the pinned dependency set and browser encryption dependencies.

### Proposed App spike boundary

Package: `APP-GND-MDB-SPIKE-001 — Browser MDB Extraction Parity`.

In scope:

- Add a disposable, non-production Worker spike using an exact pinned `mdb-reader` version.
- Define the typed GND table-envelope contract and adapt a test-only XLSX extractor to the same shape.
- Use one provenance-cleared MDB/XLSX pair locally, plus generated public/synthetic Jet fixtures committed without private data.
- Compare database format, table/column names and order, declared types/nullability/precision/scale, row counts, null/zero/empty distinctions, lossless decimal text, core-field values, and deterministic repeat hashes of the normalized envelope.
- Exercise current truthfulness fixtures through both extraction adapters, especially EHTYP/EUTYP, explicit zero, unresolved attachments, LSYS conflicts, and unknown types.
- Measure time and peak memory on representative size; fuzz/truncate headers/pages and enforce limits/timeouts.
- Produce a licensing/SBOM record and browser-bundle/CSP review.

Out of scope: production UI, SPOT changes, new GND semantics, extra-table interpretation, cloud upload, native helper, MDB writing, or private fixture commit.

Platform claim after spike: macOS, Windows, and Linux wherever the supported browser and Worker APIs run. No Office, ODBC, Java, or user-installed converter required. Offline after the application bundle is installed/cached.

Fallback: if capability loading fails, state “MDB extraction unavailable in this build” and keep the source unimported. If the spike disproves parity for required GND types, stop browser rollout and open a separate Jackcess-sidecar feasibility package; do not silently convert through CSV.

Exact spike done criterion: two repeat runs produce identical typed-envelope digests; all selected MDB/XLSX core records compare equal under documented source-representation rules; null/zero/precision and provenance tests pass; truthfulness outcomes match; limits and malformed/encrypted failures are visible; and license/security review accepts the pinned browser bundle.

## 5. Changed Files

Added:

- `docs/knowledgeKernel/research/IMPORT/RESEARCH-GND-MDB-001_Direct_MDB_Import_Feasibility.md`

Modified: None.

Moved or renamed: None.

Deleted: None.

## 6. Evidence and Validation

- Repository/importer trace — method: inspected GND parser metadata, sniffer, XLSX table reader, truthfulness regressions, and prior GND handover; result: `passed`; limitation: no production code executed or changed.
- Corpus identity/format check — method: platform file classification, fixed-header byte inspection, size/hash inspection, and UTF-16LE structural-name scan on current/legacy files; result: `passed`; limitation: the scan was structural only and is not a database parser.
- MDB/XLSX structural comparison — method: compared representative MDB structural table names with paired XLSX workbook manifest; result: `passed` for core-name correspondence; limitation: row/schema/value parity was not tested.
- Local extractor availability — method: checked MDB Tools, ODBC helper, and bundled Python/Node module availability; result: `passed` (none present); limitation: absence on this machine says nothing about other deployments.
- Browser-reader runtime experiment — result: `not run`; limitation: temporary third-party package execution was not approved, so feasibility relies on primary API/compatibility evidence pending the App spike.
- Strategy/license/platform review — method: primary project/Microsoft documentation cited in this document; result: `passed`; limitation: this is an engineering assessment, not legal advice.
- Documentation and scope validation — method: strict mission-heading scan, trailing-whitespace scan, `git diff --check`, mission-file existence check, and scoped/full working-tree status comparison; result: `passed`; limitation: Markdown rendering was not browser-tested.

No App, importer, Kernel, Thesis, corpus, or `_legacy/` file was changed by this mission.

## 7. Kernel and Architecture Impact

Kernel impact: none

Architecture impact: candidate

The browser Worker, typed extraction envelope, and shared extractor/interpreter boundary are Research architecture candidates only.

RefImpl impact: follow-up-required

The App needs the narrowly scoped parity spike before production MDB support is defensible.

Thesis impact: none

## 8. Conflicts, Risks, and Open Decisions

- `MDB-D01`: initial encryption scope. Options: reject all encrypted files, support documented `mdb-reader` password/encryption modes, or defer encryption after plain Jet parity. Recommendation: plain Jet first; visible encrypted-file classification; add passwords only after dedicated security tests.
- `MDB-D02`: extra-table scope. Options: seven-table parity only or decode additional GND database structures. Recommendation: seven-table parity plus complete table inventory; extra semantics remain later Research.
- `MDB-D03`: fallback after a failed browser spike. Options: abandon MDB, Jackcess/UCanAccess local sidecar, MDB Tools sidecar, or server. Recommendation: separate Jackcess-sidecar feasibility package because it is portable and Apache-licensed; no automatic server fallback.
- Risk: a browser parser vulnerability processes untrusted binary input inside the App; Worker isolation and resource limits are mandatory.
- Risk: physical row order may differ from XLSX export order; topology/order validation and explicit ordinal provenance are mandatory.
- Risk: presenting an internal export as the original source would violate provenance; the extraction stage and source hash must remain visible.
- Parallel-work conflict: none; final status comparison confirmed that this mission owns one new Research file and does not overlap the independent App/SPOT or Thesis changes.

## 9. Handover

Next safe step: authorize `APP-GND-MDB-SPIKE-001 — Browser MDB Extraction Parity`.

Prerequisites: provenance-cleared local paired sample access; approval to add the pinned test dependency in a disposable/non-production path; acceptance of the typed-envelope test boundary; security/license review ownership.

May touch: parser registry/sniffer in a test-only branch, a new MDB extraction Worker/adapter, a shared GND table-envelope contract, synthetic fixtures, and focused import regression tests. It must not change SPOT/Kernel semantics or ship production UI.

Independent work: legal/security review and creation of synthetic Jet fixtures can proceed independently of GND semantic work.

Exact done criterion: the spike proves deterministic typed-envelope parity and identical truthfulness outcomes across MDB/XLSX for the core GND path on supported browsers, or returns a reproducible failure that triggers `MDB-D03` without weakening provenance or geometry gates.
