# MISSION REPORT

## 1. Mission

Mission: `RESEARCH-RAILWAY-ALIGNMENT-HISTORY-002 — German Rules, Stationing and Computation`

Responsible stream: `research`

Objective: deepen the German development of railway alignment rules,
transition curves, cant/speed, vertical planning, kilometre referencing and
computational aids with page- and edition-specific evidence, negative searches
and corrected novelty language.

Package: `docs/knowledgeKernel/research/RAILWAY_ALIGNMENT_HISTORY_002/`

## 2. Status

`complete`

Research outcome: `survives with reformulation`.

The German line is supportable as four interacting but non-identical estates:
law, operator rules, specialist/textbook geometry, and
survey/reference/computational production. A continuous formula genealogy from
Reichsbahn to DB Ril 800/883 was not established.

## 3. Baseline and Scope

- Repository root: `/Users/uwefalz/Documents/developer/ufAIM`
- Branch: `main`
- Baseline commit: `de5fb58f5dd809624fcefb8c6a9a394a10489e6b`
- Authorized Research paths:
  - `docs/knowledgeKernel/research/RAILWAY_ALIGNMENT_HISTORY_001/`
  - `docs/knowledgeKernel/research/RAILWAY_ALIGNMENT_HISTORY_002/`
- Excluded: active Kernel, App, Thesis, Governance, other Research packages and
  protected PlantUML.
- Local rule/teaching PDFs were read-only evidence. No PDF or extracted page is
  included.
- Pre-existing App/import/test/tool changes were present and excluded from the
  commit.

## 4. Work Performed

- Page-verified the 1892 Reich norms, the 1908 German railway-engineering
  sequence and an accessible copy of Ril 883.0010.
- Edition-verified DRG DV 820 (1928), Schramm (1931, 1954, 1962), post-war
  DB/DR 820 records, Transpress (1966), DR DV 820 (1977) and digital-era items.
- Read the local ÖBB B 50-2 source as comparative German-language evidence,
  including PDF pp. 1–6 and its detailed element/speed structure.
- Separated legal minimum rules from operator calculation rules and textbooks.
- Established that kilometre address can survive geometry changes, include
  jumps and differ from true length.
- Found direct metadata evidence for a DR DIKART/MULTICAD track-plan workflow
  in 1990; did not overstate the weaker DB computing chronology.
- Logged twelve negative searches and six prioritized archive requests.
- Added a German source section to the baseline catalogue.
- Replaced national priority and ufAIM novelty claims with bounded hypotheses.
- Confidence: high for page-verified legal/kilometre claims; medium for
  institutional rule genealogy; low-to-medium for mechanical and early digital
  computation chronology.

## 5. Changed Files

Added:

- `docs/knowledgeKernel/research/RAILWAY_ALIGNMENT_HISTORY_002/README.md`
- `docs/knowledgeKernel/research/RAILWAY_ALIGNMENT_HISTORY_002/GERMAN_RULES_STATIONING_COMPUTATION.md`
- `docs/knowledgeKernel/research/RAILWAY_ALIGNMENT_HISTORY_002/EVIDENCE_LEDGER.md`
- `docs/knowledgeKernel/research/RAILWAY_ALIGNMENT_HISTORY_002/NEGATIVE_SEARCHES.md`
- `docs/knowledgeKernel/research/RAILWAY_ALIGNMENT_HISTORY_002/MISSION_REPORT.md`

Modified:

- `docs/knowledgeKernel/research/RAILWAY_ALIGNMENT_HISTORY_001/README.md`
- `docs/knowledgeKernel/research/RAILWAY_ALIGNMENT_HISTORY_001/SOURCES.md`

Moved or renamed: None.

Deleted: None.

## 6. Evidence and Validation

- Web/catalogue research across DDB/DNB, Landesarchiv Berlin, Google Books,
  e-rara, UIC/DIN/DB metadata, KIT, ORLIS, TRID and lawful open scans: `passed`.
- Local PDF inspection with `pdfplumber` page extraction and a visual Poppler
  title-page rendering in `/private/tmp/rah002/`: `passed`; no derivative
  retained.
- Page/edition ledger: 25 German evidence entries with explicit evidence class
  and limitation: `passed`.
- Negative-search register: 12 documented searches: `passed`.
- Link and whitespace validation over both Research packages: `passed`.
- Scope-isolation and staged-file audit before commit: `passed`.
- No active Kernel, App, Thesis, Governance or protected file was changed.
- Local Research-only commit created; no push performed.

## 7. Kernel and Architecture Impact

Kernel impact: candidate

Historical evidence strongly supports keeping intrinsic alignment, kilometre
address, realization and observation distinct; this is Research evidence, not
promotion.

Architecture impact: candidate

The four-estate model and kilometre-line evidence are relevant to provenance
and reference architecture, but authorize no implementation.

RefImpl impact: none

Thesis impact: follow-up-required

The package can support a later German state-of-the-art section after archival
verification of DS/DV/Ril editions.

## 8. Conflicts, Risks, and Open Decisions

- `RAH2-D001 — Next archive family`
  - A: DS 877 → DS 800 → Ril 800 edition genealogy - recommended.
  - B: DV/DS 820 cross-German comparison.
  - C: kilometre rules DV 844 → Ril 883.
  - D: DB/DR computing and CAD oral history.
- Risk: unchanged rule numbers can conceal substantial semantic changes.
- Risk: the accessible Ril 883 copy has unresolved issue/current-status
  metadata.
- Risk: German digitization favours textbooks over internal calculation
  instructions and software manuals.
- Risk: local ÖBB evidence is comparative and must never be attributed to DB.
- No ownership conflict was found in the authorized Research paths.

## 9. Handover

Next safe step: authorize `RAH2-D001 A` and obtain edition registers/change
notices from Bundesarchiv or DB Museum before making formula-level historical
claims.

Prerequisites: archive access, citation/quotation permissions and a fixed
edition range.

Research can proceed independently. Kernel/App remain unaffected; Thesis work
should wait for archival confirmation.

Done criterion: an edition-by-edition DS 877/DS 800/Ril 800 table with validity
dates, module changes, page-level rule differences, documented missing
editions and no inference of continuity from numbering alone.
