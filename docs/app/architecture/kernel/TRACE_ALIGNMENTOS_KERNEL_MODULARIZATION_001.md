# MISSION REPORT

## 1. Mission

Mission: `TRACE-ALIGNMENTOS-KERNEL-MODULARIZATION-001`

Responsible stream: `trace`

Requested objective: identify the implementation-level `alignmentOS Kernel` in the
current repository; name its parts, public interfaces, dependencies and existing
boundary violations; and produce an incremental modularization sequence — without
moving files or changing production code.

Package identifier: `TRACE-ALIGNMENTOS-KERNEL-MODULARIZATION-001`

## 2. Status

`complete`

All eight done-criteria are answered from evidence. The headline result is that the
kernel extraction is substantially **further along than the working thesis assumes**:

- `src/aim-core/` already **is** the alignmentOS Kernel. It is hermetically pure —
  every import inside it is relative and none escapes its own root — and that purity
  is *enforced by an existing test*, not accidental (`O1`, `O2`).
- The Alignment Kernel and the Transition Kernel are both already inside it and
  already carry a frozen 151-name public API plus 64 paired boundary and
  compatibility tests (`O3`, `O7`).
- The **AXTRAN2 Calculation Kernel is the one of the three that does not yet exist**
  as a kernel. Only its input *contract* is in `src/aim-core/`. The calculation
  itself lives outside, is 4 of 22 files non-empty, and has **zero production
  importers** (`O5`).
- `src/domain/alignment/**` and `src/domain/transition/**` are **not legacy**. 35 of
  their files are one-line facades over `src/aim-core/`, and two are genuine
  adapters that bind the transitionDB and inject the sparse builder into a
  deliberately data-free core (`O4`). Treating them as legacy would delete the
  composition layer.

Seven boundary violations are named with file and line evidence (`O8`). None of them
is inside `src/aim-core/`.

## 3. Baseline and Scope

- Repository root and inspected workspace: `/Users/uwefalz/Developer/ufAIM`
- Branch: `main`
- Baseline commit: `b230813543264c7031cfd15666a686257fcff6f6`
  ("fix(app): restore global TransEd entry")
- Pre-existing working-tree changes at inspection time, read only and not part of
  this analysis: `docs/thesis/AIM/**` (17 files, sources and build products),
  `technetViewer.html`, and untracked `.claude/`. `src/`, `app/` and `test/` were
  **clean**, so the static analysis below describes committed state.
- Scope of analysis: `src/**` and `app/**`, excluding `node_modules`, `_legacy` and
  `*_e2e*` harnesses where stated. 478 JavaScript modules were parsed.
- Excluded by mission rule and not analysed as alignmentOS progress:
  `technetViewer.html`, IVHW and viewer work.

This mission is read-only. It changed no file in the inspected workspace. The report
itself is written in a separate worktree (`/Users/uwefalz/Developer/ufAIM-trace-kernel`,
branch `trace/alignmentos-kernel-modularization`, based on `origin/main`) so that the
shared checkout is never switched or written to. The shared checkout was left on
`main` with all 19 of its dirty entries untouched.

Method: static extraction of every `import`, `export … from` and dynamic `import()`
specifier; alias resolution through `config/importmap.internal.json`; classification
of each file by resolved edges rather than by folder name. Findings are marked
**Observed** where they are direct measurements and **Inferred** where they are my
reading of those measurements.

## 4. Work Performed

### O1 — `src/aim-core/` is hermetically pure (Observed)

Every `from` specifier inside `src/aim-core/` is relative, and none resolves above
the `src/aim-core/` root. There are no alias imports, no bare package imports, no
`node:` imports and no JSON imports. Scanning 131 kernel-candidate files for DOM,
Worker, IndexedDB, network, SPOT, GND, import-layer, UI and rendering tokens
produced five signals, of which **four are false positives** (three are the English
word "three" or "SPOT" appearing in prose and comments; one is an `_e2e` harness).
Exactly one is real, and it is not in `src/aim-core/` — see `V1`.

### O2 — That purity is enforced, not accidental (Observed)

`test/aim-core/module-boundaries/aim-core-global-dependency-boundary.test.mjs`
asserts, over every `.js` file under `src/aim-core/`:

- no dynamic `import(`;
- every static specifier matches `^\.\.?/`;
- no `.json`, no `node:`/`http(s):`/`file:` specifiers;
- every resolved path starts with the Core root;
- every module imports cleanly in Node with no browser globals.

This is the strongest architectural guarantee currently in the repository, and it
already encodes most of dependency rule `R1` below.

### O3 — There is a deliberate, frozen public API — with no users (Observed)

`src/aim-core/index.js` is a root barrel over six area barrels, and
`src/aim-core/public-api-manifest.js` freezes it at exactly 151 names, verified by
`aim-core-public-api-freeze.test.mjs` (root key set, area/root identity, no
star-export collisions).

Measured usage of that API across the repository:

| entry path into `src/aim-core/` | edges |
|---|---|
| root barrel `src/aim-core/index.js` | **0** |
| area barrels `src/aim-core/*/index.js` | 16 |
| deep, bypassing all barrels | **188** |
| total | 204 |

**Inferred:** the public API is governance that nothing consumes. 92 % of access is
deep. The freeze therefore protects a surface that is not the surface in use, and
every internal file of `src/aim-core/` is *de facto* public.

### O4 — `src/domain/` is the binding layer, not legacy (Observed)

Classifying all 71 `src/domain/**` modules by content:

| class | count | meaning |
|---|---|---|
| one-line facade re-exporting `src/aim-core/` | **35** | aim-core is canonical; the path is kept for compatibility |
| genuine adapter over a core primitive | **2** | see below |
| domain-only, no aim-core twin | 33 | coordinates/CRS, metric, projection, optimization, three transition leftovers |
| identical copy | **0** | there is no true duplication between the two trees |

The two adapters matter and must not be read as facades:

- `src/domain/transition/registry/RegistryResolver.js` subclasses the core resolver
  and binds `transitionLookup.json` as the default database. **The transitionDB
  binding lives here, deliberately, because the core is data-free** (`O2` forbids
  JSON imports in Core).
- `src/domain/alignment/horizontal/HorizontalConstructiveState.js` injects
  `buildSparseFromEditModel` into the core function as a dependency.

**Inferred:** `src/domain/{alignment,transition}` is the composition root of the
kernel — where pure law meets concrete data. The mission's caution against equating
`src/domain/` with legacy is correct and load-bearing.

### O5 — The AXTRAN2 Calculation Kernel does not yet exist as a kernel (Observed)

What is in `src/aim-core/transition/axtran/`: `buildFutureAxtranInputContract.js`
and a barrel. That is the **input contract only**.

The calculation lives in `src/domain/optimization/alignment/` and
`src/lib/math/optim/`. Of 22 files there, **18 are zero bytes**:

```txt
src/domain/optimization/alignment/
    0  AlignmentConstraintBuilder.js        0  AlignmentOptimizationProblem.js
    0  AlignmentOptimizationDiagnostics.js  0  AlignmentResidualBuilder.js
    0  AlignmentSQPSolver.js                0  AlignmentVariableCodec.js
    0  AlignmentWorldToTrackMapper.js
  288  buildChangeTransitionTypeProblem.js
src/lib/math/optim/
    0  diff/finiteDiffJacobian.js           0  lsq/normalEquations.js
    0  lsq/solveDampedLeastSquares.js       0  qp/solveBoxQP.js
    0  scale/variableScaling.js             0  sqp/activeSet.js
    0  sqp/lineSearchArmijo.js              0  sqp/merit.js
    0  sqp/solveSQP.js                      0  sqp/sqpStep.js
   92  qp/solveEqualityQP.js               601  sqp/solveEqualitySqp.js
   48  sqp/solveOneEqualitySqpStep.js
```

Importers of any of these, anywhere in `src/` or `app/`:

```txt
src/domain/alignment/_e2eAlignmentTest.js        (test harness inside the src tree)
test/axtran/axtran-heritage-regression.test.mjs  (test)
```

**Observed: there are no production importers at all.**

This answers investigation questions I and J directly. Question I — which parts of
AXTRAN2 are already Calculation Kernel and which belong to Application Service,
Preview, Candidate Review, UI or persistence — has the answer *none of the latter*,
because nothing consumes AXTRAN2 yet. Question J — where solver success might be
conflated with engineering authority — has **no current instance in production
code**, for the same reason. Both risks are prospective, not present.

### O6 — `src/lib/` sits above the kernel, not below it (Observed)

`src/lib/geom/frame/pose2.js` imports `src/aim-core/geometry/pose2.js`. Four
`src/lib/` files import from `src/aim-core/`. There is no edge in the reverse
direction (forbidden by `O2`).

**Inferred:** the intuitive reading of `src/lib` as the lowest mathematical layer is
wrong. It is a consumer of the kernel. Any target layering that places `src/lib`
beneath `src/aim-core/` would invert a real, tested dependency.

### O7 — Boundary tests already exist in quantity (Observed)

342 test files in total. `test/aim-core/module-boundaries/` holds **64 files**,
consistently paired as `<unit>-core-module-boundary` plus `<unit>-core-compatibility`
— boundary for the extraction rule, compatibility for the facade. Coverage spans
geometry, elements, authoring, aggregate, profile, topology, transition AST,
registry, runtime, grammar, query, versioned and the AXTRAN contract.

`HEAD` itself adds `test/app/workspace/transed-global-entry-boundary.test.mjs`.

**Inferred:** the extraction pattern used so far — extract to `src/aim-core/`, leave
a facade, add a boundary test and a compatibility test — is established, repeatable
and already applied 30-odd times. The modularization sequence below reuses it rather
than proposing anything new.

### O8 — Boundary violations, with evidence

Seven, none inside `src/aim-core/`:

| id | violation | evidence |
|---|---|---|
| `V1` | kernel binding layer depends on SPOT | `src/domain/alignment/service/sampleSparseAlignmentForView.js:22` imports `../../../model/spot/validation/validateSparseAlignment.js`, while line 13 of the same file states "no SPOT logic" |
| `V2` | same, in a dead twin | `src/domain/alignment/service/sampleSparseAlignmentForView_old.js:22`; its only reference anywhere is a path string in `test/aim-core/module-boundaries/alignment-aggregate-factory-core-module-boundary.test.mjs:122` |
| `V3` | Application Service depends on the import adapter | `src/services/alignment/GndStationFrameChainageCandidateService.js` imports `src/import/evidence/gndStationDecoderProfileContract.js` and `…/gndStationDecoderProfileCatalogue.js` |
| `V4` | shared runtime depends on the import adapter | `src/shared/messaging/SharedMessagingWorker.js` → `src/import/evidence/importResultEvidence.js`; `src/shared/messaging/service/ImportSessionService.js` → `src/import/validation/validateImportSessionItem.js` |
| `V5` | SPOT model depends on the import adapter | `src/model/spot/mutate/promoteImportItems.js` → `src/import/spot/assessSpotAdmission.js` |
| `V6` | **Presentation reaches the Kernel directly** | 21 files under `app/controllers/alignment-profile/**` deep-import `src/aim-core/alignment/profile/{CantConstructiveState,ChainageMapping,VerticalConstructiveState,RailPairCantConstructiveState}.js`, bypassing both Application Services and the public API |
| `V7` | public API bypassed wholesale | `O3`: 188 of 204 edges into `src/aim-core/` are deep; the root barrel has zero importers |

`V6` is the most consequential: it is the required dependency direction
`Presentation → Application Services → Kernel Services → Kernel` collapsed into a
single hop, repeated 21 times, in the newest area of the application.

Two further upward edges exist but are **not** claimed as violations: `app/runtime/`
imports `app/controllers/` and `app/view/` 65 times, and `app/gndImportWorkbench/`
imports `app/domain/workspace/` 9 times. `app/runtime/` is the composition root and
legitimately wires the layers it composes; counting that as a violation would be an
artifact of my layer numbering, not a finding.

### O9 — Dead but test-pinned code (Observed)

`src/domain/transition/registry/compose/composeTotal.js` and `solvePartitionC1.js`
have exactly one reference each in the repository, and it is
`test/aim-core/module-boundaries/transition-function-runtime-core-module-boundary.test.mjs:168-169`
asserting `"composeTotal" in runtime === false`. They are deliberately excluded from
the runtime barrel and unreachable from production. This confirms, independently,
the "implemented but disconnected" status recorded by
`RESEARCH-BERLINISH-AXTRAN-001`.

### O10 — TransEd already satisfies its target rule (Observed)

`app/controllers/bridges/transitionEditorBridge.js:160-185`:
`readActiveAlignmentContext()` returns `{alignmentId: null, elementId: null}` when
there is no workspace selection, and its only consumer is
`refreshEngineeringPreview()`. `open()` carries no alignment guard. The alignment is
therefore optional preview context, exactly as the target layering requires, and
`HEAD` ("fix(app): restore global TransEd entry") adds a boundary test for it.

### Named target architecture

**alignmentOS Kernel** — the pure, application-independent realization of the
Knowledge Kernel: mathematical states and laws, identities and invariants, no
input/output, no data binding, no browser. Implemented today by `src/aim-core/`,
whose purity is already enforced by `O2`. It comprises three subsystems:

1. **Alignment Kernel** — `src/aim-core/geometry/**` (pose, vec, romberg, elements,
   `Alignment2D`), `src/aim-core/alignment/{aggregate,authoring,profile,topology}/**`
   (horizontal, vertical, Rail-Pair cant, chainage, transformation, evaluation).
   *Status: extracted, tested, canonical.*
2. **Transition Kernel** — `src/aim-core/transition/{ast,grammar,registry,runtime,
   continuity,query,versioned}/**` plus the transitionDB **binding** in
   `src/domain/transition/registry/RegistryResolver.js` and the data file
   `src/domain/transition/transitionLookup.json`. *Status: extracted and tested; the
   data binding deliberately sits outside Core.*
3. **AXTRAN2 Calculation Kernel** — problem declaration, fixed/free/derived
   quantities, boundary, connection and continuity conditions, candidate generation,
   solver, residuals, diagnostics and consequences; **no automatic engineering
   selection**. *Status: contract only in Core; calculation outside Core, 18 of 22
   files empty, no production consumer.*

Everything else is outside the kernel: Kernel Services (`src/domain/{coordinates,
crs,coord,metric,projection}`, `src/model/`), Application Services (`src/services/`,
`src/shared/`), Adapters (`src/import/`, `src/export/`, `app/io/`,
`app/gndImportWorkbench/`), Engineering Workspace (`app/runtime/`, `app/domain/
workspace/`), Apps-in-App (TransEd), Presentation (`app/controllers/`, `app/view/`,
`app/ui/`).

### Dependency rule set

- `R1` — `src/aim-core/**` may import only relatively and only within itself.
  *Already enforced by `aim-core-global-dependency-boundary.test.mjs`.*
- `R2` — no module outside `src/aim-core/**` may deep-import into it; entry is
  through `src/aim-core/index.js` or an area barrel. *Not enforced; 188 violations
  (`V7`).*
- `R3` — direction is `Presentation → Application Services → Kernel Services →
  alignmentOS Kernel`. Adapters implement ports and are never imported by the layers
  above them as authority. *Not enforced; violated by `V3`, `V4`, `V5`, `V6`.*
- `R4` — `src/domain/{alignment,transition}/**` may bind data and inject
  dependencies into the Kernel, and may import from `src/aim-core/**`, but may not
  import SPOT, import, workspace or app modules. *Violated by `V1`, `V2`.*
- `R5` — the AXTRAN2 Calculation Kernel may read Kernel state and produce proposals,
  candidates, deltas and diagnostics, and may never apply, persist, select or focus.
  *No current violation, because there is no consumer (`O5`).*

## 5. Changed Files

Added: None.

Modified: None.

Moved or renamed: None.

Deleted: None.

This mission was read-only. No file in `/Users/uwefalz/Developer/ufAIM` was created,
changed, moved or deleted, and the shared checkout was not switched.

## 6. Evidence and Validation

| What was checked | Method | Result | Limitation |
|---|---|---|---|
| Baseline is clean for `src/`, `app/`, `test/` | `git status --porcelain` | `passed` | dirty thesis and viewer files noted in §3 |
| Kernel purity | every specifier in `src/aim-core/` extracted and resolved | `passed`, zero external, zero escaping | static only; no runtime reflection |
| Purity is enforced | read `aim-core-global-dependency-boundary.test.mjs` | `passed` | test read, not executed by this mission |
| Public API usage | resolved 204 edges into `src/aim-core/` | `passed`, 0 root / 16 area / 188 deep | alias resolution from `importmap.internal.json`; unresolvable bare specifiers excluded |
| Facade vs duplicate | code-line comparison after comment stripping | `passed`, 35 facades / 2 adapters / 0 identical copies | twin matching is by basename, so `index.js` pairs are meaningless and were re-verified by hand |
| Boundary violations | layer assignment plus edge direction | `passed`, 7 named with file evidence | layer assignment is mine and is argued, not authoritative; `app/runtime` edges explicitly excluded as composition root |
| AXTRAN2 consumers | repository-wide grep for the module paths | `passed`, only two test files | — |
| Dead code | reference count per file | `passed`, `composeTotal`/`solvePartitionC1` test-pinned only | — |
| TransEd independence | read `transitionEditorBridge.js:160-185` | `passed` | read, not exercised |

Not run: no test suite was executed, no browser acceptance was performed, and no
runtime behaviour was observed. Every statement above is static. The distinction
matters most for `O5`: "no production importers" is a static fact and does not by
itself prove AXTRAN2 is unreachable at runtime through some dynamic path, though
`R1`'s ban on dynamic `import(` inside Core makes that unlikely for the contract
portion.

Read-only confirmation: this mission changed no files.

## 7. Kernel and Architecture Impact

```text
Kernel impact: none
Architecture impact: conforming
RefImpl impact: none
Thesis impact: follow-up-required
```

Kernel impact `none`: `docs/knowledgeKernel/` was read only and is unchanged. No
Kernel concept was redefined, renamed or reduced. The three named subsystems are a
description of existing implementation, not new semantics.

Architecture impact `conforming`: the observed implementation already matches the
mission's working thesis for two of three subsystems, and the naming proposed here
follows what the code and its tests already do.

Thesis impact `follow-up-required`: the Thesis describes the AXTRAN reinterpretation.
`O5` establishes that the Calculation Kernel is presently a contract plus four
unwired files. Any Thesis passage presenting AXTRAN2 as a working calculation core
needs that qualification. No Thesis file was inspected in detail or changed.

## 8. Conflicts, Risks, and Open Decisions

- `D-1` — **Should the public API be enforced, or retired and re-cut?**
  `O3`/`V7` show a frozen 151-name barrel with zero users and 188 deep imports.
  Options: (a) enforce `R2` and migrate 188 edges — large, touches
  `app/controllers/alignment-profile/**` heavily; (b) accept deep imports as the
  real contract and delete the freeze — cheap, but abandons governance; (c) freeze
  the *deep* surface as it stands, then narrow it package by package.
  **Recommendation: (c).** It makes today's true surface visible and testable
  without a migration wave before September. Irreversible if the freeze is deleted,
  hence a decision for Uwe.

- `D-2` — **Where does the AXTRAN2 Calculation Kernel live?** Options: (a) inside
  `src/aim-core/axtran2/**`, which subjects it to `R1` — no JSON, no dynamic import,
  no data binding, and therefore no direct transitionDB access; (b) as a peer of the
  Kernel in `src/calculation/**`, free to bind data, importing Core through the
  public API. The current split — contract in Core, calculation in
  `src/domain/optimization/` — is neither. **Recommendation: (b)**, because the
  calculation needs the transition registry and `world2Track`, and `RegistryResolver`
  shows the project already puts data binding outside Core. This determines the
  target of every later AXTRAN2 package and is expensive to reverse.

- `D-3` — **Is `src/lib/` above or below the Kernel?** `O6` observes four edges from
  `src/lib/` into `src/aim-core/` and none back. Options: (a) accept `src/lib` as a
  Kernel *consumer* and rename to reflect it; (b) invert — move the shared primitives
  down into Core and have Core stop re-exporting them. Both are defensible; the
  current arrangement is only confusing because the name suggests the opposite of
  the dependency. **Recommendation: (a)**, as it matches the tested reality.

- `D-4` — **Do `V3`, `V4`, `V5` mean the import layer is an Adapter, or a Kernel
  Service?** Three separate upward edges reach `src/import/**` from Application
  Services, shared runtime and the SPOT model. Either those three are violations to
  be inverted through ports, or `src/import/evidence/**` is really domain knowledge
  misfiled under an adapter. This is a genuine modelling question about where GND
  evidence semantics belong, and it should be answered before any of the three is
  "fixed".

- Risk — **Layer assignment is mine.** §4 and `R3` rest on a layer map I proposed
  from resolved edges. `app/runtime/` was explicitly exempted as a composition root;
  a different but equally defensible map would move other counts. The violations
  `V1`–`V7` are cited with file and line so they can be judged independently of the
  map.

- Risk — **Static analysis only.** No test was executed and no runtime path was
  observed. Dynamically constructed specifiers, if any exist outside Core, are
  invisible to this method.

- Not a conflict — no contradiction with `docs/knowledgeKernel/` was found, and
  `RESEARCH-BERLINISH-AXTRAN-001` is corroborated: its "implemented but
  disconnected" status for `composeTotal`/`solvePartitionC1` is independently
  reproduced in `O9`.

## 9. Handover

Next safe step: **P1**, below. It is read-only-adjacent, adds no production code and
is the prerequisite for every later package because it makes the current surface
measurable.

Incremental extraction sequence, ordered by risk and delivery value. Each package is
one commit, reuses the established boundary + compatibility test pattern from `O7`,
and states its own done criterion. Nothing here is a big-bang move.

| # | package | touches | done criterion | before Sept 2026? |
|---|---|---|---|---|
| **P1** | Freeze the *actual* Kernel entry surface: a test that enumerates every deep import into `src/aim-core/` and pins the list | new test only | the 188 edges are enumerated and any new one fails CI | **yes — safe, additive** |
| **P2** | Enforce `R1` for the binding layer: extend the purity test to forbid SPOT/import/app imports in `src/domain/{alignment,transition}/**` | new test; fixes `V1` | `V1` resolved by moving `validateSparseAlignment` behind a port or by relocating the sampler | **yes — one real edge** |
| **P3** | Delete-candidate review for `V2` and `O9` (`sampleSparseAlignmentForView_old`, `composeTotal`, `solvePartitionC1`) | removal + test update | each is proven unreachable, then removed with its test pin | yes, but **no value before September** |
| **P4** | Introduce Application Services for `app/controllers/alignment-profile/**` so Presentation stops importing Core directly | 21 controllers | `V6` count drops to zero; `R3` testable | **no — defer past September** |
| **P5** | Decide `D-2`, then create the AXTRAN2 Calculation Kernel package boundary with the empty files given real contracts | `src/domain/optimization/` or a new peer | a problem document can be built and inspected; no solver required | **no — after September** |
| **P6** | Invert `V3`, `V4`, `V5` through ports, once `D-4` is answered | services, shared, model | the three upward edges are gone | **no** |
| **P7** | Narrow the public API per area, retiring facades only where a boundary test proves the facade has no importers | `src/domain/**` facades | each retired facade has zero importers at retirement | **no — never before September** |

Prerequisites: `D-1` before `P1` is finalised in its (c) form; `D-2` before `P5`;
`D-4` before `P6`.

Files or areas the next package may touch: `test/**` only, for `P1` and `P2`. No
production file needs to change before September under this sequence.

Other streams can proceed independently: yes. This mission holds no lock and changed
nothing.

**Delivery impact.**

- *September 2026 user path* — unaffected by `P1`–`P3`; those are tests and dead
  code. `P4` touches 21 live authoring controllers and must not run before
  September. `P5`–`P7` are post-September.
- *Workbench Alpha* — unaffected. `app/gndImportWorkbench/**` appears in no proposed
  package; its 9 upward edges into `app/domain/workspace/` are explicitly not
  claimed as violations.
- *IFCalignment roundtrip* — **Observed:** `src/import/parsers/IFC/index.js` exists
  but is a 12-line stub: `meta.id` is the literal `'...'`, `sniff.looksLike` returns
  `false` unconditionally, and `parse()` returns `{}`. Nothing in `src/` or `app/`
  imports or registers it. `src/import/parsers/infraGML/index.js` is in the same
  state. The working Adapter layer today is GND, LandXML and MDB on the import side
  and `src/export/exportLandXML.js` on the export side; there is **no IFC export at
  all**. IFCalignment roundtrip is therefore not blocked by this modularization —
  it is unimplemented, and it lands in the Adapter layer, which no package `P1`–`P7`
  touches.
- **Do not touch before September:** `app/controllers/alignment-profile/**`,
  the `src/domain/**` facades, and `src/aim-core/**` itself.

Done criterion for the next package (`P1`): a test enumerates every module outside
`src/aim-core/` that imports into it, together with the imported path; the list
matches the 204 edges observed here; and adding a new deep import fails.

Recommendations in this report do not authorize a new mission.
