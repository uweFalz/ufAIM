# German Rules, Stationing and Computation

## 1. Result in one sentence

Between the late nineteenth century and the digital planning estate, German
railway alignment knowledge moved from minimum legal geometry and tabulated
field construction toward a layered system in which geometric continuity,
vehicle dynamics, maintenance condition, kilometre address, geodetic
realization and digital data production are related but not interchangeable.

This is a finding about the structure of the surviving evidence. It is not a
claim of German priority.

## 2. Evidence classes

| Class | Meaning in this package |
|---|---|
| `P` | Primary text or scan inspected at the cited page(s). |
| `C` | Catalogue/edition identity verified; technical contents known only from contents metadata or snippets. |
| `I` | Official institutional metadata or current legal text. |
| `S` | Secondary historical reconstruction. |
| `U` | Unresolved; useful lead, not used as a factual foundation. |

Page numbers are printed pages where the source exposes them reliably.
“PDF p.” is used only when the digital file’s page index is the reproducible
locator.

## 3. Epistemic and institutional sequence

### 3.1 Before national rules: technical agreements, manuals and local practice

The German-speaking railway landscape began as multiple administrations and
companies. The *Verein Deutscher Eisenbahn-Verwaltungen* provided an important
arena for technical agreement, but “German practice” was not yet one rule set.
An 1872 publication, *Grundzüge für die Gestaltung der secundären
Eisenbahnen*, already exposes rule vocabulary around radii, gradients,
stations and *Ueberhöhung des äussern* rail. This is catalogue/full-view
evidence (`C`), not proof of the earliest adoption of any formula.

The correct historical proposition is therefore:

> By the 1870s, German-language inter-railway guidance treated route geometry,
> gradients and outer-rail elevation as rule-worthy railway properties.

It is not defensible from the consulted material to call 1872 the first German
superelevation rule.

### 3.2 Reich-wide minimum geometry: 1885 and 1892

The 1892 *Normen für den Bau und die Ausrüstung der Haupteisenbahnen
Deutschlands* replaced the 1885 norms. The Reichsgesetzblatt source is
page-verified (`P`):

- RGBl. 1892, pp. 747–763 contains the promulgated norms.
- § 8 requires grade changes on open line to be rounded with a circular arc of
  at least 5,000 m radius; immediately before stations, 2,000 m is allowed.
- § 1 requires curvature, gauge widening and outer-rail elevation to be
  considered in clearance.

This matters because vertical alignment was already a legal design object, not
merely a later textbook refinement. The rule does not yet constitute the
modern coupled calculation of vertical acceleration or jerk.

The 1892 norms are a legal floor. They should not be treated as a complete
design manual, nor should later Reichsbahn/DB rules be read back into them.

### 3.3 The mature pre-war textbook system, ca. 1897–1914

The German encyclopaedic railway literature separates route finding,
construction, track geometry and operation. The 1908 volume *Der
Eisenbahnbau: Ausgenommen Vorarbeiten, Unterbau und Tunnelbau* provides an
especially clear page sequence (`P/C`, full-view OCR and contents):

- pp. 135–140: elevation of the outer rail in curves;
- pp. 141–149: transition curves;
- p. 150 onward: setting out transition curves;
- pp. 152–159: insertion into existing track, compound forms, choice of the
  transition constant and limits;
- p. 175: rounding grade changes;
- pp. 192–205: operational influence of gradients and curvature.

The knowledge object is already coupled: vehicle movement in curves, wear,
superelevation, transition geometry, vertical alignment and operating
resistance are adjacent parts of one railway-engineering account.

However, adjacency is not yet a single invariant computational model. Most
calculation remained element-wise and table/formula-driven.

### 3.4 Reichsbahn codification: DV 820 and the inter-war curvature programme

The Landesarchiv Berlin catalogue verifies (`I/C`) *DV 820
Oberbauvorschriften (Obv) Reichsbahnoberbau*, valid from 1 January 1928,
archive signature `A Rep. 080-04 Nr. 929`. A 1939 edition is separately
catalogued by the antiquarian record; this package does not infer unchanged
contents between editions.

The numbering is historically important because `820` remained associated
with track/upper-structure rules in later Deutsche Bundesbahn and Deutsche
Reichsbahn estates. Continuity of number does not prove continuity of every
rule.

The 1930s also produced a distinct specialist geometry programme:

- Gerhard Schramm, *Der vollkommene Gleisbogen. Seine Gestaltung als Kurve
  mit stetigem Krümmungsverlauf*, Springer, 1931, 58 pp. (`C`);
- the 1933 *Organ für die Fortschritte des Eisenbahnwesens* special issue,
  “Die Gestaltung des Gleisbogens,” explicitly contrasts new-line setting-out
  with correction of existing curves and highlights the transition curve
  (`P`, issue text);
- Schramm’s later editions synthesize geometric, constructional and
  maintenance viewpoints.

The careful formulation is not “Schramm introduced continuous curvature to
railways.” Linear curvature transition ideas predate him internationally and
in railway engineering. His documented contribution lies in a German
specialist programme for continuously varying curvature, reconstruction and
field correction of the *Gleisbogen*.

### 3.5 Two post-war railway administrations

After 1949, “German railway rules” split institutionally:

- Deutsche Bundesbahn used `DS` (Druckschrift) series;
- Deutsche Reichsbahn in the GDR used `DV` series.

Both are represented in surviving catalogues, but open, edition-complete
scans are scarce. DGEG catalogue metadata verifies parallel `DS 820` and
`DV 820` *Oberbauvorschrift für Regelspurbahnen*, valid from 1 September
1969. A GDR edition is catalogued as first edition 1977, 208 pages. These
records establish editions and coexistence (`C`); they do not establish
formula-level identity.

The 1966 Transpress book *Linienführung der Eisenbahn*, 323 pages and
13 tables, is identifiable in KIT/DNB catalogues (`C`). Its contents begin
with project stages and technical/economic choice, then vehicle-dynamic
foundations. It provides a bridge into the DR teaching tradition, but the
full text was not lawfully open in this mission.

### 3.6 Bundesbahn synthesis: Schramm, DS 877 and DS 800

Schramm’s *Der Gleisbogen* is edition-resolved:

- 2nd edition, Otto Elsner, 1954, 344 pages, open scan (`P`);
- 4th edition, Darmstadt: Elsner, 1962, IX + 338 pages, 111 figures and
  20 tables (`C`, DDB/DNB).

The 1954 contents and searchable pages integrate lateral acceleration,
superelevation, deficiency, transition forms, straight and S-shaped ramps,
clothoid, curve correction, measurement-car evidence and field staking.
Because Schramm served in the Bundesbahn headquarters, the work is highly
relevant to the Bundesbahn knowledge environment; it is still a textbook/
specialist work, not itself a DB rule.

Secondary historical accounts state that the Bundesbahn gathered alignment
principles in the late 1970s in `DS 877`, *Vorschrift für das Entwerfen von
Bahnanlagen*, later renumbered `DS 800`. This sequence is plausible and
widely repeated, but no open, authoritative edition history was found.
Accordingly:

- existence of the DS 877 → DS 800 sequence: `S`, medium confidence;
- exact dates, module boundaries and formula changes: `U`;
- no priority claim is made.

### 3.7 EBO 1967 to current § 6: law remains a boundary layer

Current EBO § 6 (`I/P`) requires:

- generally continuous change of direction in through main tracks;
- transition curves where required;
- outer-rail elevation in curves as a rule;
- cant chosen with regard to track, vehicle and load;
- maximum cant including operating deviations of 180 mm;
- cant changes mediated by a ramp, with stated maximum ramp gradients.

The EBO is intentionally less detailed than Ril 800 or EN 13803. It defines
legal boundaries and principles, not the complete engineering calculation.
The 180 mm current text must not be projected onto the 1967 original without
edition-specific verification; a secondary account reports a 150 mm limit
introduced in 1967.

### 3.8 DB AG: Ril 800 and European parameterization

Current technical literature identifies `Ril 800.0110` as the principal DB
module for track alignment parameters. DIN metadata establishes that
DIN EN 13803:2017 combines the earlier EN 13803-1 and -2 and defines
speed-dependent track-alignment rules for gauges 1,435 mm and wider.

No current proprietary DB module was copied or committed. Public metadata and
lawful secondary literature support only these bounded claims:

- DB design practice is module-based rather than one monolithic textbook;
- European limits and national/operator-specific requirements coexist;
- permissible speed can be derived from existing geometry, while required
  geometry can be designed from speed assumptions;
- design, exceptional limits and maintenance tolerances must not be conflated.

The open 2004 ÖBB `B 50 Teil 2`, *Linienführung von Gleisen*, is not a DB rule,
but it is valuable German-language contemporary evidence (`P`) for the
European transition:

- PDF pp. 5–6 state that B 50-2 was based on prior B 52 and high-performance
  line rules plus ENV/prEN 13803 and replaced prior normal-gauge alignment
  rules;
- PDF p. 5 explicitly names measurement cars, automated track construction/
  maintenance and computing as sources of increased complexity;
- PDF pp. 2–4 show the mature decomposition into curvature, vertical radius,
  cant, twist, unbalanced acceleration, jerk, transition forms, vertical
  changes and speed derivation;
- PDF p. 17 distinguishes *Gleisachse* from *Bahnachse*;
- PDF p. 16 and surrounding definitions orient signs along increasing
  kilometre direction.

Its evidential role is comparative: it demonstrates the German-language,
Europeanized state of the art, not DB institutional history.

## 4. Transition curves: corrected history

### 4.1 What can be established

1. German-language railway texts around 1908 devote a substantial, independent
   treatment to transition curves and their insertion into existing track.
2. Reichsbahn-era specialist work in 1931/1933 foregrounds continuous
   curvature and curve correction.
3. Bundesbahn-era Schramm editions integrate clothoid, parabolic and other
   transition/ramp forms with maintenance and measurement.
4. Modern German-language rules distinguish the horizontal transition law
   from the cant-ramp law and evaluate both through static and dynamic limits.

### 4.2 What is not established

- the first German use of a transition curve;
- the first mandatory German transition-curve rule;
- the first German use of the clothoid;
- formula-level continuity from DRG DV 820 to DB/DR 820;
- a uniquely German invention of continuous-curvature railway design.

### 4.3 Technical interpretation

The historical step is best described as a change in continuity requirement:

- tangent/circle construction controls position and direction (`G1`);
- a transition controls curvature evolution (`G2` in modern geometric
  language);
- modern ramps and vehicle-dynamic checks control changes of acceleration,
  roll rate/acceleration and jerk;
- field realization and maintenance add tolerances and observations that are
  not part of the ideal law.

The modern notation should not be retroactively attributed to historical
authors unless they used it.

## 5. Cant, speed and mixed traffic

German rules evolved from prescribing or discussing outer-rail elevation to
managing a family of speed-dependent quantities:

- equilibrium cant;
- applied cant;
- cant deficiency for faster trains;
- cant excess for slower trains;
- cant gradient/twist;
- temporal rate of cant change;
- abrupt change of unbalanced lateral acceleration;
- permitted speed under actual geometry.

The mixed-traffic problem is historically central. A cant suited to a fast
passenger train can create excess for a slower freight train. Thus “the speed
of the alignment” is not an intrinsic scalar property without train and
operating context.

The 1908 book’s adjacency of vehicle motion, wear, cant and operating
resistance shows the early systems character. Modern EN/operator rules make
the dependency explicit and limit-based. The evidence supports ufAIM’s
separation of constructive geometry from speed-based evaluation; that
separation is useful, not demonstrably unprecedented.

## 6. Vertical planning

The page-verified 1892 rule already requires circular rounding of grade
changes. By 1908, vertical rounding and the operational effects of gradients
are standard textbook subjects. Later systems add:

- vertical acceleration limits;
- minimum vertical radii;
- coordination with switches, platforms, structures and horizontal geometry;
- machine-readable vertical elements;
- computation of permissible speed from the vertical layout.

Historically, plan and profile were often calculated separately because
survey, drawing and formulas were organized that way. Modern 3D realization
does not erase the engineering value of separate horizontal and vertical laws;
it adds transformations and combined checks.

## 7. Kilometrierung and Stationierung

### 7.1 The decisive primary evidence: Ril 883.0010

An openly accessible nine-page copy of `Richtlinie 883.0010`,
*Bahnstrecken kilometrieren*, was inspected page by page (`P`). It states:

- p. 1: kilometre and line number are cross-disciplinary ordering references;
  distances may be computed only with kilometre jumps considered;
- pp. 2–3: the kilometre line is mathematically/geometrically defined, usually
  follows a track or line axis, but can remain unchanged when track geometry
  changes;
- p. 3: a kilometre value is the orthogonal/radial projection of a point onto
  the kilometre line; differences of kilometre values are therefore not
  necessarily true lengths;
- pp. 4–7: jumps have incoming and outgoing values; gaps are *Fehllängen* and
  overlaps *Überlängen* with special notation;
- p. 9: the kilometre line is held in DB-GIS and locally marked by kilometre/
  hectometre boards.

The copy’s exact issue date and current validity were not established from an
official DB catalogue. It must be cited as an accessible historical copy, not
as the current DB rule.

### 7.2 Historical anchoring

The Landesarchiv Berlin catalogue verifies `DV 844`, valid 1 October 1939,
governing the form, labelling, placement and handling of *Nummernsteine*.
This establishes that physical linear-reference marking was a formal
Reichsbahn subject. The catalogue does not reveal whether the complete
mathematical kilometre-line model of later Ril 883 was already present.

DR regional appendices to operating-performance rules include route and
kilometre tables; an RBD Cottbus 1982 record is edition-identifiable.
Again, these prove administrative kilometre estates, not a single national
geometry model.

### 7.3 Consequence

German railway evidence strongly rejects the equation:

`station/km address = intrinsic arclength = geographic position`.

A more accurate relation is:

`network/line identity + kilometre system + jump branch + projection rule`

identifies an operational address, while geometric length and CRS position are
separate derivations/realizations. This is one of the strongest historical
supports for ufAIM’s distinction between intrinsic `s`, kilometre addressing
and source evidence. Novelty remains a hypothesis because ISO 19148, InfraGML,
IFC and railway GIS contain close prior art.

## 8. Computation: tables to digital planning estate

### 8.1 Tables were executable engineering

Nineteenth- and early twentieth-century books packaged formulas with tables for
radii, chords, ordinates, transition offsets, gradients and earthwork. The
human, instrument and table formed a computational system. “Manual” does not
mean informal.

### 8.2 Mechanical aids: evidence gap

German engineers certainly used logarithmic tables, slide rules, planimeters
and calculating machines in the wider profession. This mission did not find a
page-verified railway-administration source assigning particular machines to
alignment workflows. No railway-specific adoption chronology is claimed.

### 8.3 Mainframe and departmental EDV

A TRID catalogue record, “25 Jahre EDV bei der Deutschen Bundesbahn,” confirms
a retrospective literature item but its full text was not accessible. The
precise start date and alignment-specific applications remain unresolved.

For the DR, Helga Krause’s 1990 article “Studie zur Gleisplanerstellung mit
DIKART/MULTICAD,” *Vermessungstechnik* 38(8), pp. 260–261, is strong metadata/
abstract evidence (`C`): tachymetric measurements and hand sketches were
transferred into an interactive graphical system; track, switches, crossings,
signals, line elements and coordinates were structured at screen/file level.
This is direct evidence of a transition from drawing-centred inventory to a
structured digital production model.

### 8.4 PC CAD and current BIM

CARD/1 is catalogued as a German civil/survey CAD system from 1985 with railway
alignment capability (`S`; vendor-independent history not inspected).
Contemporary DB BIM statements define BIM as a cooperative method for
consistent capture, management and exchange of lifecycle information in
digital models (`I`).

The historical sequence should not be romanticized:

- CAD digitized calculation and drawing, but could preserve file silos;
- GIS added spatial/reference management, but could flatten constructive
  semantics;
- BIM added model federation and lifecycle information, but does not by itself
  establish observation provenance or authority;
- a digital twin claim requires temporal state and reconciliation, not only a
  3D model.

## 9. Rule genealogy: confidence matrix

| Claim | Evidence | Confidence |
|---|---|---|
| 1892 Reich norms legally regulated vertical rounding and considered cant in clearance. | RGBl. pp. 747–763, page-verified. | high |
| By 1908 German railway literature integrated cant, transitions, vertical changes and operating effects. | *Der Eisenbahnbau*, pp. 135–205, full-view contents/OCR. | high |
| DRG DV 820 was valid from 1 January 1928. | Landesarchiv Berlin record. | high for identity/date; unknown for detailed contents |
| Schramm’s 1931/1933 work centred continuous curvature and existing-curve correction. | edition catalogues and 1933 issue text. | high |
| DB and DR both maintained 820 upper-structure rule families after 1949. | DGEG/antiquarian edition metadata. | medium-high |
| DS 877 became DS 800 in the late Bundesbahn period. | repeated secondary accounts. | medium |
| Ril 800.0110 is the current principal DB alignment module. | current technical literature; no committed proprietary copy. | medium-high |
| Ril 883 treats kilometre address as distinct from true length and permits an independently maintained kilometre line. | inspected pp. 1–9 of accessible copy. | high for that copy; current status unknown |
| DR used DIKART/MULTICAD for structured digital track-plan production by 1990. | article metadata and abstract. | high for study existence and stated workflow |
| German railway alignment moved directly from slide rule to BIM. | contradicted by fragmented, overlapping table, EDV, CAD, GIS and rule estates. | eliminated |

## 10. Corrections to priority and novelty language

Replace:

- “the Germans introduced the clothoid” with “German railway specialists
  developed and institutionalized several transition-curve and correction
  practices within an international mathematical and railway tradition”;
- “Ril 800 invented modern alignment” with “Ril 800 codifies an accumulated,
  operator-specific and Europeanized rule system”;
- “stationing is distance along the track” with “stationing/kilometre address
  is a rule-governed linear reference that may diverge from true length”;
- “CAD created the digital alignment” with “CAD mechanized geometry and
  drawing; GIS/BIM later broadened reference, structure and lifecycle data”;
- “ufAIM is the first curvature-first railway model” with “ufAIM’s explicit
  constructive-identity and provenance composition may be distinctive, but
  curvature-first mathematics and railway transition practice are established
  prior art.”

## 11. Implications for ufAIM

### Strong historical continuities

- curvature evolution as a primary design concern;
- separate horizontal, vertical and cant laws;
- speed-dependent evaluation;
- table/solver results requiring engineering interpretation;
- maintenance geometry differing from ideal design;
- kilometre direction supplying orientation conventions;
- operational kilometre systems surviving geometry change.

### Plausibly distinctive synthesis - hypothesis only

- constructive alignment identity independent of samples and CRS;
- explicit distinction among intrinsic `s`, kilometre address and source
  station claims;
- candidate-generating solver separated from evaluation and authority;
- transition families retained with provenance rather than normalized to one
  interchange primitive;
- topology, geometry, realization and observation kept related but non-identical.

### Required before any novelty claim

Patent and software-manual research for DB/DR and commercial alignment systems;
edition-level comparison of DS/DV/Ril 800 and 883; schema comparison with
LandXML, OKSTRA, railML, RTM/RSM, InfraGML and IFC; and interviews with former
Bundesbahn/Reichsbahn planning-system developers.

## 12. Conclusion

The most valuable German historical result is not a national “first.” It is a
long-running separation of rule layers that modern software easily collapses:
law, operator design rule, constructive geometry, measured track, operational
kilometre address and digital representation.

That separation gives ufAIM a strong historical footing. Its research
opportunity is to make the relations among those layers explicit, reproducible
and provenance-bearing - not to claim invention of their ingredients.
