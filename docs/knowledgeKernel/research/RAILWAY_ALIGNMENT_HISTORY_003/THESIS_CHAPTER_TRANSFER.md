# Thesis chapter transfer

## 1. Proposed role

Working title:

> **From Setting Out Curves to Alignment Knowledge: Why Railway Geometry Became
> a Referenced, Evaluated Engineering Object**

German working title:

> **Vom Abstecken des Bogens zum Alignment-Wissen: Wie Eisenbahngeometrie zum
> referenzierten und bewerteten Ingenieurobjekt wurde**

Recommended placement: a late, independent chapter after the constructive,
realization and engineering-rule foundations, but before the final contribution
and outlook. It should not interrupt the mathematical development and should
not become a general history of railways.

Target length: 20–28 Thesis pages plus bibliography.

Purpose: show that AIM addresses a historically accumulated integration gap,
not a lack of curve formulas.

## 2. Governing question

How did the practical railway problem change from placing a buildable line in
terrain to preserving the identity, references, observations, evaluations and
authority of an alignment across calculation and digital representations?

The chapter must answer this question through engineering problems and
epistemic transitions, not through a year-by-year parade of books.

## 3. Narrative arc

### 3.1 Practical problem: make a guided route buildable

Start with the engineer in the field. The early object is a staked centre line
whose gradients, curves, land take and earthworks must close.

Core claims:

- levelling, profiles and curve setting-out entered railway practice as one
  field workflow;
- tables and stations were executable parts of that workflow;
- the railway-specific pressure came from guided wheelsets, low adhesion,
  train length and speed.

Immediate citations:

- `Simms1866LevellingRailway`, pp. 121–159;
- `Shunk1890RailwayCurves`, pp. 7–60;
- `Baker1870RailwayEngineering`, contents and pp. 1–19 only after final page
  confirmation.

Do not include: a broad prehistory of mining, canals or steam locomotion. One
context paragraph is sufficient until archive evidence improves.

### 3.2 Insight jump: tangent and circle become insufficient

Frame the transition curve as a continuity problem made visible by dynamic and
constructional consequences, not as a competition over who “invented” a named
spiral.

Core claims:

- the mature nineteenth-century field calculus treated tangent/circle,
  compound and reverse curves as reproducible constructions;
- transition curves regularized curvature change and provided room for gradual
  cant application;
- Euler/Fresnel/Cornu/Talbot histories converged retrospectively but had
  different original problems.

Immediate citations:

- `Talbot1904RailwayTransitionSpiral`, pp. 1–49;
- existing `Higgins1922TransitionSpiral`, with corrected URL/pages added;
- `Levien2008EulerSpiralHistory`, pp. 1–20;
- existing `BrustadDalmo2020Review`, for the modern review boundary.

Archive-first:

- `Schramm1931VollkommenerGleisbogen`;
- DRG DV 820 formula-level history.

Do not write: “Euler invented the railway transition curve,” “Talbot invented
the clothoid,” or “Germany introduced continuous curvature.”

### 3.3 Insight jump: geometry becomes speed-dependent railway state

Use cant and mixed traffic to show why railway alignment is not merely a planar
curve. The same track carries vehicles at different speeds; applied cant,
deficiency and excess express different evaluations of one construction.

Core claims:

- speed, radius and cant are coupled, but speed is not intrinsic alignment
  identity;
- modern rules limit both static quantities and rates/abrupt changes;
- plan, vertical profile and cant remain distinct constructive laws even when
  jointly evaluated.

Immediate citations:

- existing `EN13803_2017`, but repair its title/DOI/URL;
- `EBO2026Section6`, § 6;
- `OEBB2004B50Part2`, PDF pp. 2–6, 15–30, 39–65, 82–135;
- existing `Kufver2000RailwayAlignment`;
- existing `Bloss1978TrackGeometry`.

Qualification: ÖBB B 50 is comparative German-language evidence, never a DB
rule.

### 3.4 Insight jump: vertical alignment and economic location

Move from individual elements to choice among whole feasible lines. The
critical change is not only a better vertical formula but the conversion of
length, grade, curvature, traffic and costs into competing objectives.

Immediate citations:

- `Reichsnormen1892Haupteisenbahnen`, RGBl. pp. 747–763, especially § 8;
- `Wellington1877EconomicLocation`, pp. 34–100 and 162–202 after final scan
  confirmation;
- `Webb1913RailroadConstruction`, pp. 9–61;
- `Li1996RailwayAlignmentDP`, article pp. 837–844 after page verification;
- `Kang2012LongitudinalOptimization`, journal pages to be completed before use.

Thesis role: demonstrate continuity from economic engineering judgment to
conditional numerical optimization. Do not imply that an optimizer owns the
objective or decision.

### 3.5 Rechenmittel: table, instrument, solver and digital production

Organize computation by what it externalized:

| Medium | Externalized knowledge | New risk |
|---|---|---|
| field table | repeated formula evaluation | hidden convention/edition |
| theodolite and station book | reconstruction of the design | accumulated field error |
| mechanical/electronic calculator | arithmetic | false confidence in inputs |
| CAD | constructive geometry and drawing | file/model identity conflation |
| GIS | spatial and linear reference | coordinates treated as object identity |
| BIM/exchange schema | federated model structure | exchange entity treated as authority |
| solver/optimizer | constrained candidate generation | optimum treated as decision |

Immediate citations:

- `Krause1990DikartMulticad`, abstract and bibliographic pages only;
- existing `Kufver1997MathematicalDescription`;
- existing `BuildingSMARTIFC4x3Scope`;
- `BuildingSMART2023IfcAlignment`;
- `OGC2017InfraGMLRailways`;
- `UIC2016RailTopoModel`.

Archive-first:

- “25 Jahre EDV bei der Deutschen Bundesbahn”;
- first German railway CAD or mainframe chronology;
- mechanical-calculator adoption.

Do not include vendor-product history unless independently verified and needed
for an engineering claim.

### 3.6 Insight jump: kilometre address is not curve length

This section should be short and decisive because it has direct relevance to
the current Thesis.

Core claims:

- line number plus kilometre is an operational ordering/address system;
- the kilometre line may be geometrically distinct from the track axis and may
  remain stable when track geometry changes;
- kilometre differences are not necessarily true lengths;
- jumps, false lengths and overlengths are rule-governed reference events, not
  breaks in intrinsic alignment geometry.

Immediate citation:

- `DBRil8830010Kilometrierung`, inspected copy pp. 1–9, with the explicit note
  that issue date/current validity remain unresolved.

Supporting modern references:

- `ISO19148_2021LinearReferencing`;
- `OGC2016LandInfra`;
- `OGC2017InfraGMLRailways`;
- `BuildingSMART2023IfcAlignment`.

Archive-first:

- `DRGDV8441939Nummernsteine`;
- continuous DV 844 → Ril 883 rule genealogy.

This is historical support for the Thesis distinction, not proof that AIM first
made it.

### 3.7 Today’s alignment gap

Synthesize the historical layers:

```text
constructive rule
≠ realized track
≠ observed geometry
≠ operational kilometre address
≠ CRS coordinate
≠ network topology
≠ evaluation
≠ engineering authority
```

Argue that modern standards can encode several of these relations, yet no file
format or solver becomes the engineering object or decision authority merely
by carrying them.

Immediate citations:

- existing `RWRIFC2019ConceptualModel`, after metadata completion;
- `OGC2016LandInfra`;
- `OGC2017InfraGMLRailways`;
- `UIC2016RailTopoModel`;
- `BuildingSMART2023IfcAlignment`;
- existing `Turk2020Interoperability`.

### 3.8 ufAIM connection: synthesis, not priority

The closing move should be modest:

> The historical evidence makes ufAIM’s separations necessary and intelligible.
> It does not establish that their individual ingredients are new.

Historically connected:

- Berlinish to notation, tables and domain calculation grammars;
- transitionDB to transition tables/catalogues;
- AXTRAN to analytic and numerical candidate calculation;
- curvature primacy to transition-curve and differential-geometric traditions;
- speed/cant/profile to mature railway rules;
- CRS, kilometre reference and topology to modern geospatial/network models.

Potentially distinctive only as hypotheses:

- constructive alignment identity independent of samples and CRS;
- explicit coexistence of intrinsic `s`, operational kilometre and source
  station claims;
- provenance-bearing transition families;
- solver candidate separated from applicability, evaluation and authority;
- geometry, topology, realization and observation composed without collapsing
  their identities.

No sentence should use “first,” “unique,” “unprecedented” or “invented by
ufAIM” without a separate prior-art result.

## 4. Claim admission matrix

| Claim ID | Proposed Thesis statement | Status | Required citation/action |
|---|---|---|---|
| HC-01 | Nineteenth-century railway field practice joined levelling, profile, curve setting-out and quantities. | cite-now | Simms 1866, cited pages. |
| HC-02 | Tables were part of the executable field method, not merely appendices. | cite-now | Shunk 1890 and Talbot 1904, table/use pages. |
| HC-03 | German Reich rules in 1892 prescribed circular rounding of grade changes. | cite-now | Reichsnormen 1892, § 8. |
| HC-04 | By 1908 German railway literature treated cant, transition curves, vertical rounding and operating effects together. | cite-now-with-check | Full title-page transcription plus pp. 135–205. |
| HC-05 | DRG DV 820 contained a specific transition formula in 1928. | archive-first | Inspect A Rep. 080-04 Nr. 929. |
| HC-06 | Schramm’s German programme emphasized continuously varying curvature and existing-curve correction. | cite-now/limited | 1931 catalogue plus 1933 issue; do not claim priority. |
| HC-07 | DB and DR rule families remained formulaically continuous after 1949. | not-admissible | Common numbering is insufficient. |
| HC-08 | Speed, cant and curvature are coupled evaluation quantities. | cite-now | EN 13803, Kufver, B 50. |
| HC-09 | An operational kilometre address need not equal true distance along the track. | cite-now/qualified | Ril 883 copy pp. 1–9; disclose status uncertainty. |
| HC-10 | Ril 883 is the current binding DB rule in the inspected form. | not-admissible | Official issue/status evidence absent. |
| HC-11 | DR used an interactive structured track-plan workflow with DIKART/MULTICAD by 1990. | cite-now/abstract | Krause metadata/abstract; avoid claims beyond it. |
| HC-12 | German railway alignment CAD began in 1985 with CARD/1. | not-admissible | Vendor/product summary does not prove priority. |
| HC-13 | IFC/InfraGML/RailTopoModel distinguish alignment, referencing, railway and topology concerns. | cite-now | Official standards/model documentation. |
| HC-14 | ufAIM’s composition is historically unprecedented. | not-admissible | Requires patent/software/schema prior-art audit. |
| HC-15 | ufAIM’s explicit composition may address a persistent integration gap. | hypothesis | State as research interpretation, not fact. |

## 5. Figure plan

Only three figures are justified:

1. **The expanding engineering object**
   Stake line → tangent/circle chain → speed/cant/profile system → measured
   track → referenced network knowledge. This is the chapter’s main figure.
2. **One location, four longitudinal values**
   Intrinsic `s`, track-axis chainage, operational kilometre with a jump, and
   CRS position. Use the Ril 883 distinction without reproducing its figures.
3. **Computation changes, decision boundary remains**
   Table → calculator → CAD/GIS/BIM → solver, all producing representations or
   candidates below an explicit engineering-authority boundary.

Avoid portraits, train photographs, decorative timelines and facsimile pages.

## 6. Citation discipline

- Historical claim: cite the original page and optionally one modern history.
- Rule claim: cite the exact edition/module/status; never cite a generic
  rule-family number.
- Catalogue-only source: use only for existence, edition or archive location.
- Secondary account: do not convert “reported” into “introduced.”
- Current standard: distinguish public metadata from inspected normative text.
- Local PDF: cite its public bibliographic identity where possible; never expose
  a private filesystem path in the Thesis.
- German and English editions should share citation IDs and evidential meaning.

## 7. Mechanical implementation plan for a later Thesis mission

1. Resolve every `archive-first` item selected for prose.
2. Apply only `add` and `repair` entries from the bibliography transfer.
3. Create paired chapter sources:
   `history/alignment_knowledge.tex` and
   `history/alignment_knowledge-DE.tex`.
4. Add the chapter at the agreed late-book location.
5. Add three figures through the existing figure registry.
6. Build both editions and inspect citations, index entries, page balance and
   bibliography.
7. Run a claim audit against the matrix above.

Done means the chapter can be read without the Research package, every
historical assertion has a page-level source, and the ufAIM conclusion remains
explicitly hypothetical where novelty is concerned.
