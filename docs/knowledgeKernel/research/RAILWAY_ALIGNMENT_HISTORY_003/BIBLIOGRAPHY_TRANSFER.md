# Bibliography transfer and duplicate audit

Target inspected read-only:
`docs/thesis/AIM/references.bib`

Access date for online sources: `2026-07-26`.

No active Thesis bibliography was changed. The companion
`railway_alignment_history_transfer.bib` contains only entries classified
`add` or safe `repair-candidate`. This document remains authoritative for
evidence and limitations.

## Status vocabulary

- `reuse`: existing Thesis ID is suitable.
- `repair`: existing ID should remain, but metadata should be corrected or
  completed.
- `add`: no duplicate found; proposal is ready after final syntax review.
- `archive-first`: identity exists but content/page evidence is insufficient.
- `exclude`: not suitable for Thesis citation.

## Duplicate audit summary

| Existing Thesis ID | Decision | Reason |
|---|---|---|
| `Higgins1922TransitionSpiral` | repair | Already present; add stable scan URL and verified page scope. |
| `EN13803_2017` | repair | Already present, but title incorrectly privileges the British adoption; use CEN title plus DIN DOI/metadata. |
| `Kufver1997MathematicalDescription` | reuse/repair | Existing; add report URL and access metadata if verified. |
| `Kufver2000RailwayAlignment` | reuse/repair | Existing; author given name conflicts across sources and should be authority-checked. |
| `Bloss1978TrackGeometry` | reuse/repair | Existing; edition/place/ISBN should be completed from DNB. |
| `Klein1998Trassierung` | reuse/repair | Existing; complete edition/ISBN/DOI if available. |
| `BrustadDalmo2020Review` | reuse | Existing DOI and core metadata are adequate. |
| `RWRIFC2019ConceptualModel` | repair | Existing entry lacks stable report URL and fuller report identity. |
| `BuildingSMARTIFC4x3Scope` | reuse/repair | Existing scope entry differs from proposed `IfcAlignment` entity citation; both may coexist if claims differ. |
| `OGCStandardsProgram2025` | not duplicate | General standards-program page cannot substitute for LandInfra/InfraGML standards. |
| `Hasslinger2002Schwerpunkt` | reuse/repair | Existing patent entry; inventor name/title/publication metadata need authority verification. |

## Transfer records

### HIST-TALBOT-1904

- Proposed BibTeX ID: `Talbot1904RailwayTransitionSpiral`
- Status: `add`
- Author: Arthur Newell Talbot
- Title: *The Railway Transition Spiral*
- Edition: 3rd
- Year: 1904
- Publisher/institution: Engineering News Publishing Company, New York
- Stable access: [Google Books record](https://books.google.com/books/about/The_Railway_Transition_Spiral.html?id=NEI7AQAAMAAJ)
- Verified pages: contents and searchable pp. 1–49; exact quotation pages must
  be re-opened when drafting.
- Evidence class: primary digitized engineering book.
- Supports: railway transition theory, tables, field location, relation to
  speed/superelevation.
- Limitation: catalogue lists earlier 1901 editions; do not transfer 1904 text
  automatically to 1901.

### HIST-WELLINGTON-1877

- Proposed ID: `Wellington1877EconomicLocation`
- Status: `add`
- Author: Arthur Mellen Wellington
- Title: *The Economic Theory of the Location of Railways*
- Edition: first book edition represented by the 1877 record
- Year: 1877
- Publisher: Railroad Gazette, New York
- Stable access: [Google Books](https://books.google.com/books/about/The_Economic_Theory_of_the_Location_of_R.html?id=OvpI84CBTo0C)
- Verified pages: contents identify curvature pp. 34–49, rise/fall pp. 50–100
  and integrated comparisons pp. 162–202; quotation pages need final scan check.
- Evidence class: primary historical monograph.
- Supports: economic trade among curvature, gradient, distance and traffic.
- Limitation: do not mix pagination/content with expanded 1887 edition.

### HIST-SIMMS-1866

- Proposed ID: `Simms1866LevellingRailway`
- Status: `add`
- Author: Frederick Walter Simms
- Title: *A Treatise on the Principles and Practice of Levelling, Showing Its
  Application to Purposes of Railway Engineering and the Construction of Roads*
- Edition: 5th
- Year: 1866
- Publisher: John Weale / Lockwood metadata conflict; resolve from title page
  before application.
- Stable access: [Google Books](https://books.google.com/books/about/A_Treatise_on_the_Principles_and_Practic.html?id=n3oOAAAAYAAJ)
- Verified pages: railway curve setting-out begins p. 121; Trautwine material
  begins p. 139.
- Evidence class: primary digitized handbook.
- Supports: levelling, section drawing and railway curve setting-out as one
  workflow.
- Limitation: `archive-first` for exact publisher field; proposed BibTeX uses
  Lockwood provisionally and carries a note.

### HIST-SHUNK-1890

- Proposed ID: `Shunk1890RailwayCurves`
- Status: `add`
- Author: William Findlay Shunk
- Title: *A Practical Treatise on Railway Curves and Location*
- Edition: 1890 edition; edition number unresolved
- Year: 1890
- Publisher: E. H. Butler & Company, Philadelphia
- Stable access: [Google Books](https://books.google.com/books?id=HZBEAAAAIAAJ)
- Verified pages: degree-of-curve definition p. 7; field methods and tables
  through p. 106; specific quotation pages require reopening.
- Evidence class: primary digitized handbook.
- Supports: transit/chord/deflection practice, compound/reverse curves and
  executable tables.
- Limitation: do not attribute 1890 passages to the first 1850s edition.

### HIST-BAKER-1870

- Proposed ID: `Baker1870RailwayEngineering`
- Status: `add`
- Author: Thomas Baker
- Title: *Railway Engineering; or, Field Work Preparatory to the Construction
  of Railways*
- Edition: 2nd
- Year: 1870
- Publisher: Longmans, Green, Reader, and Dyer, London
- Stable access: [Google Books](https://books.google.com/books/about/Railway_Engineering.html?id=1yjyAAAAMAAJ)
- Verified pages: contents; curves begin p. 1 and deviation problem p. 19.
- Evidence class: primary digitized handbook.
- Supports: curve setting-out, earthwork and exterior-rail elevation in the
  railway field package.
- Limitation: exact subtitle and page claims need title-page/page audit before
  quotation.

### HIST-WEBB-1913

- Proposed ID: `Webb1913RailroadConstruction`
- Status: `add`
- Author: Walter Loring Webb
- Title: *Railroad Construction: Theory and Practice*
- Edition: edition not resolved
- Year: 1913
- Publisher: John Wiley & Sons, New York
- Stable access: [Google Books](https://books.google.com/books/about/Railroad_Construction.html?id=q7LJ3EyQPfkC)
- Verified pages: preliminary surveys p. 9, transition curves p. 43, vertical
  curves p. 61.
- Evidence class: primary textbook.
- Supports: mature curriculum joining surveys, horizontal and vertical
  geometry.
- Limitation: verify edition statement before final bibliography.

### HIST-LEVIEN-2008

- Proposed ID: `Levien2008EulerSpiralHistory`
- Status: `add`
- Author: Raph Levien
- Title: *The Euler Spiral: A Mathematical History*
- Year: 2008
- Institution: University of California, Berkeley, EECS
- Number: UCB/EECS-2008-111
- Stable access: [official record](https://www2.eecs.berkeley.edu/Pubs/TechRpts/2008/EECS-2008-111.html)
- Verified pages: report pp. 1–20.
- Evidence class: specialist secondary history.
- Supports: distinct Bernoulli/Euler, Fresnel/Cornu and Talbot lineages.
- Limitation: not a source for national railway adoption.

### HIST-HIGGINS-1922

- Stable ID: `Higgins1922TransitionSpiral`
- Status: `repair`
- Existing metadata: author/title/publisher/place/year present.
- Add URL: [Internet Archive-derived scan](https://upload.wikimedia.org/wikipedia/commons/6/64/The_transition_spiral_and_its_introduction_to_railway_curves_with_field_exercises_in_construction_and_alignment_%28IA_cu31924031215142%29.pdf)
- Verified pages: full book available; chapter-specific pages must be selected
  during drafting.
- Evidence class: primary/near-contemporary engineering history.
- Supports: transition spiral introduction and field construction.
- Limitation: do not use alone to settle invention priority.

### DE-REICHSNORMEN-1892

- Proposed ID: `Reichsnormen1892Haupteisenbahnen`
- Status: `add`
- Corporate author: Deutsches Reich
- Title: *Bekanntmachung, betreffend die Normen für den Bau und die Ausrüstung
  der Haupteisenbahnen Deutschlands*
- Date: 5 July 1892; promulgated 21 July 1892
- Institution: Reichsgesetzblatt
- Pages: 747–763
- Stable access: [Wikisource with scan provenance](https://de.wikisource.org/wiki/Bekanntmachung%2C_betreffend_die_Normen_f%C3%BCr_den_Bau_und_die_Ausr%C3%BCstung_der_Haupteisenbahnen_Deutschlands)
- Evidence class: primary legal source.
- Supports: legal minimum geometry, especially vertical rounding in § 8.
- Limitation: legal floor, not a complete design rule.

### DE-EISENBAHNBAU-1908

- Proposed ID: `Eisenbahnbau1908Band1`
- Status: `archive-first`
- Author/editor: unresolved from accessed record.
- Title: *Der Eisenbahnbau: Ausgenommen Vorarbeiten, Unterbau und Tunnelbau*,
  vol. 1
- Year: 1908
- Publisher: Wilhelm Engelmann, Leipzig
- Stable access: [Google Books](https://books.google.com/books/about/Der_Eisenbahnbau.html?id=1FE5AAAAMAAJ)
- Verified pages: 135–205 in contents/OCR.
- Evidence class: primary book with incomplete authority metadata.
- Supports: German integration of cant, transitions, vertical rounding and
  operating effects.
- Limitation: must not enter BibTeX patch until title-page authors/editors are
  transcribed. Excluded from companion `.bib`.

### DE-SCHRAMM-1931

- Proposed ID: `Schramm1931VollkommenerGleisbogen`
- Status: `archive-first`
- Author: Gerhard Schramm
- Title: *Der vollkommene Gleisbogen: Seine Gestaltung als Kurve mit stetigem
  Krümmungsverlauf*
- Year: 1931
- Publisher: Springer, Berlin
- Extent: 58 pages
- Stable access: [CiNii Books](https://ci.nii.ac.jp/ncid/BA61927694)
- Verified pages: none; catalogue identity only.
- Evidence class: catalogue.
- Supports now: existence/title/extent only.
- Limitation: no technical Thesis claim until full text is inspected.

### DE-SCHRAMM-1954

- Proposed ID: `Schramm1954Gleisbogen`
- Status: `add`
- Author: Gerhard Schramm
- Title: *Der Gleisbogen: Seine geometrische und bauliche Gestaltung*
- Edition: 2nd
- Year: 1954
- Publisher: Otto Elsner Verlagsgesellschaft, Darmstadt/Berlin
- Stable access: [open scan](https://nmbs.adlibhosting.com/Content/GetContent?command=getcontent&server=pdf&value=Bibliotheek%2FPDF%2FChunk2%2F2015%2F07%2F16%2F3772751.pdf)
- Verified pages: title page and searchable structure; quotation pages still to
  be selected.
- Evidence class: primary specialist monograph.
- Supports: integrated curve geometry, cant/ramp, field correction and
  measurement.
- Limitation: use the 1954 edition only; do not silently cite 1962 pagination.

### DE-DRG-DV820-1928

- Proposed ID: `DRG1928DV820`
- Status: `archive-first`
- Corporate author: Deutsche Reichsbahn-Gesellschaft
- Title: *DV 820 Oberbauvorschriften (Obv) Reichsbahnoberbau*
- Valid from: 1 January 1928
- Institution: Deutsche Reichsbahn; archival holding Landesarchiv Berlin
- Archive ID: `A Rep. 080-04 Nr. 929`
- Stable access: [DDB/Landesarchiv record](https://www.deutsche-digitale-bibliothek.de/item/HLNSA5ERU2WM4XEIXZS66UJ2EWJJVEPG)
- Verified pages: none.
- Evidence class: archival catalogue.
- Supports now: edition identity, date and archive location only.
- Limitation: exclude from companion `.bib` until inspected.

### DE-TRANS1966

- Proposed ID: `LinienfuehrungEisenbahn1966`
- Status: `archive-first`
- Author: unresolved; accessed KIT record exposes only initial `W.`
- Title: *Linienführung der Eisenbahn*
- Year: 1966
- Publisher: Transpress, Verlag für Verkehrswesen, Berlin
- Extent: 323 pages, 13 tables
- Stable access: [KIT catalogue](https://katalog.bibliothek.kit.edu/bib/681075);
  [DNB contents](https://d-nb.info/458687588/04)
- Verified pages: contents only.
- Evidence class: catalogue/contents.
- Supports now: publication structure and edition identity.
- Limitation: no author invention and no technical prose citation.

### DE-EBO-2026

- Proposed ID: `EBO2026Section6`
- Status: `add`
- Corporate author: Bundesrepublik Deutschland
- Title: *Eisenbahn-Bau- und Betriebsordnung, § 6 Gleisbogen*
- Version: current consolidated text accessed 2026-07-26
- Institution: Bundesministerium der Justiz / Bundesamt für Justiz portal
- Stable access: [Gesetze im Internet](https://www.gesetze-im-internet.de/ebo/__6.html)
- Verified section: § 6(1)–(4).
- Evidence class: current primary legal source.
- Supports: current legal principles for radius, continuous direction,
  transition curves, cant and ramps.
- Limitation: not evidence of the original 1967 wording.

### DE-RIL883

- Proposed ID: `DBRil8830010Kilometrierung`
- Status: `add-qualified`
- Corporate author: Deutsche Bahn AG
- Title: *Richtlinie 883.0010: Bahnstrecken kilometrieren*
- Edition/date: unresolved in accessible copy
- Extent: 9 pages
- Stable access: [lawfully accessible copy](https://www.klauserbeck.de/Kilometerstein/RiLi883/RiLi883.pdf)
- Verified pages: 1–9.
- Evidence class: inspected primary rule copy with unresolved status metadata.
- Supports: kilometre line, projection, jumps, false/over-lengths and DB-GIS.
- Limitation: cite as an inspected copy; do not call it current or binding.

### DE-OEBB-B50-2004

- Proposed ID: `OEBB2004B50Part2`
- Status: `add`
- Corporate author: Österreichische Bundesbahnen, Geschäftsbereich Fahrweg
- Title: *Oberbau - Technische Grundsätze B 50 - Teil 2: Linienführung von
  Gleisen*
- Date: 1 December 2004
- Edition: B 50 Teil 2
- Extent: 135 pages
- Public URL/catalogue: unresolved; local lawful copy inspected read-only.
- Verified pages: PDF pp. 1–6, definitions/contents pp. 15–30, requirements
  pp. 39–65, applications pp. 67–120, speed derivations pp. 121–135.
- Evidence class: primary operator rule/technical principles.
- Supports: German-language Europeanized decomposition of curvature, profile,
  cant, speed, jerk and computation.
- Limitation: ÖBB, not DB; public resolver required before Thesis transfer.

### DE-KRAUSE-1990

- Proposed ID: `Krause1990DikartMulticad`
- Status: `add-qualified`
- Author: Helga Krause
- Title: “Studie zur Gleisplanerstellung mit DIKART/MULTICAD”
- Journal: *Vermessungstechnik*
- Volume/year: 38 (1990)
- Issue/pages: 8, 260–261
- Stable access: [ORLIS record and abstract](https://orlis.difu.de/items/5f29ebd3-7782-4fd7-ba9d-864d1138ce71)
- Verified pages: no full article; bibliographic pages and abstract only.
- Evidence class: catalogue plus detailed abstract.
- Supports: existence and described DR interactive track-plan workflow.
- Limitation: cite only claims stated in the abstract until article inspection.

### MOD-ISO19148-2021

- Proposed ID: `ISO19148_2021LinearReferencing`
- Status: `add`
- Corporate author: International Organization for Standardization
- Title: *Geographic information — Linear referencing*
- Edition: 2nd
- Year: 2021
- Standard: ISO 19148:2021
- Stable access: [ISO metadata](https://www.iso.org/standard/75150.html)
- Verified pages: official scope metadata only.
- Evidence class: official standard metadata.
- Supports: existence and scope of generic linear referencing.
- Limitation: no normative clause claim without full licensed text.

### MOD-OGC-LANDINFRA-2016

- Proposed ID: `OGC2016LandInfra`
- Status: `add`
- Corporate author: Open Geospatial Consortium
- Title: *OGC Land and Infrastructure Conceptual Model Standard*
- Year: 2016
- Number: OGC 15-111r1
- Stable access: [official full text](https://docs.ogc.org/is/15-111r1/15-111r1.html)
- Verified sections: alignment and linear-referencing model, including station
  examples.
- Evidence class: official open standard.
- Supports: separation/relation of alignment, linear element and position
  expression.
- Limitation: cross-infrastructure, not railway-only.

### MOD-OGC-INFRAGML-2017

- Proposed ID: `OGC2017InfraGMLRailways`
- Status: `add`
- Corporate author: Open Geospatial Consortium
- Editors: Peter Axelsson and Lars Wikström
- Title: *OGC InfraGML 1.0: Part 5 — Railways — Encoding Standard*
- Year: 2017
- Number: OGC 16-105r2
- Stable access: [official full text](https://docs.ogc.org/is/16-105r2/16-105r2.html)
- Verified sections: part dependencies, railway/alignment conformance and
  kilometre/cant example.
- Evidence class: official open standard.
- Supports: railway relation to alignment, cant, kilometre and survey encodings.
- Limitation: encoding conformance does not prove implementation adoption.

### MOD-UIC-RTM-2016

- Proposed ID: `UIC2016RailTopoModel`
- Status: `add`
- Corporate author: International Union of Railways
- Title: *RailTopoModel — Railway Infrastructure Topological Model*
- Edition: 1st
- Year: 2016
- Standard: IRS 30100
- ISBN: 978-2-7461-2513-1
- Stable access: [UIC catalogue](https://shop.uic.org/en/303-finance-accountancy-costs-statistics/8884-railtopomodel-railway-infrastructure-topological-model.html)
- Verified pages: official 80-page metadata/scope; full downloaded standard not
  inspected in this mission.
- Evidence class: official institutional metadata.
- Supports: multi-level railway topology, positioning and infrastructure model
  purpose.
- Limitation: use scope claims only until full text is inspected.

### MOD-BSI-IFCALIGNMENT

- Proposed ID: `BuildingSMART2023IfcAlignment`
- Status: `add`
- Corporate author: buildingSMART International
- Title: *IFC 4.3.2.0 Documentation: IfcAlignment*
- Version: IFC 4.3.2.0
- Year: use `2023` provisionally; confirm release-date policy during patch.
- Stable access: [official entity documentation](https://standards.buildingsmart.org/IFC/RELEASE/IFC4_3/HTML/lexical/IfcAlignment.htm)
- Verified section: semantic definition.
- Evidence class: official open schema documentation.
- Supports: alignment as linear positioning reference, kinematic path and
  geometric construction; railway cant context.
- Limitation: schema semantics are not physical or engineering authority.

### MOD-EN13803-2017

- Stable ID: `EN13803_2017`
- Status: `repair`
- Corporate author: CEN
- Correct title: *Railway Applications — Track — Track Alignment Design
  Parameters — Track Gauges 1 435 mm and Wider*
- Year: 2017
- German adoption: DIN EN 13803:2017-09
- DOI: `10.31030/2534083`
- Stable metadata: [DIN Media](https://www.dinmedia.de/en/standard/din-en-13803/256505017)
- Verified pages: official scope/history metadata; licensed text not inspected
  in this mission.
- Evidence class: official standards metadata.
- Supports: standard scope, speed dependency and replacement of former parts.
- Limitation: do not cite specific limits from metadata alone.

## Exclusions from Thesis transfer

- Wikipedia or Reddit explanations, even when useful for discovery.
- Antiquarian sales records as support for technical content.
- CARD/1 as “first railway CAD.”
- “25 Jahre EDV bei der Deutschen Bundesbahn” until author, venue, year and
  full text are resolved.
- Current Ril 800 formulas without a lawful, edition-specific source.
- DRG/DB/DR rule continuity inferred only from document number.
- Any source whose author/title was guessed from OCR or a truncated catalogue.

## Application order

1. Apply `repair` entries without changing established citation IDs.
2. Add entries in the companion `.bib` only after resolving fields marked
   provisional.
3. Keep `archive-first` sources out of Thesis prose.
4. Run a duplicate check by DOI, ISBN, normalized title and corporate author,
   not only BibTeX key.
5. Build English and German Thesis editions and inspect every citation.
