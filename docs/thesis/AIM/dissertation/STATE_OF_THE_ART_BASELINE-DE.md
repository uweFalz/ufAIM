# AIM-Dissertation: Forschungsstands-Baseline

## Zweck und Methode

Dieses DISS-03-Arbeitsdokument prüft den Forschungs- und Beitragsvertrag aus
`RESEARCH_QUESTIONS_AND_CONTRIBUTIONS-DE.md` gegen Primärquellen: offizielle
Standards, normative Spezifikationen und Originalpublikationen. Es beansprucht
keine systematische Literaturübersicht. Die Suche zielte auf die stärksten
bekannten Gegenbelege zu jedem Neuheitsanspruch. Ein fehlender Treffer in
dieser begrenzten Baseline ist kein Beleg für Neuheit.

Die Ergebniskennzeichen bedeuten:

- `survives`: Keine gefundene Quelle widerlegt die formulierte Neuheitsgrenze;
- `survives with reformulation`: Stand der Technik widerlegt die breite
  Formulierung, ein engerer prüfbarer Integrationsanspruch bleibt bestehen;
- `eliminated`: Der Punkt ist nicht als eigenständiger Neuheitsbeitrag haltbar.

## Primärquellenregister

| ID | Primär- oder offizielle Quelle | Für AIM relevante etablierte Fähigkeit |
|---|---|---|
| S01 | W3C, [PROV-O: The PROV Ontology](https://www.w3.org/TR/2013/REC-prov-o-20130430/), Recommendation, 30. April 2013 | Austauschbare Provenienz durch Entitäten, Aktivitäten, Agenten und qualifizierte Relationen. |
| S02 | W3C, [Shapes Constraint Language (SHACL)](https://www.w3.org/TR/shacl/), Recommendation, 20. Juli 2017 | Maschinell ausführbare Constraints über Daten- und Shapes-Graphen mit Konformitäts- und Validierungsberichten. |
| S03 | buildingSMART, [Information Delivery Specification 1.0](https://www.buildingsmart.org/standards/bsi-standards/information-delivery-specification-ids/), freigegebener Standard, 1. Juni 2024 | Maschineninterpretierbare Informationsanforderungen und automatisierte IFC-Konformitätsprüfung. |
| S04 | buildingSMART, [IfcAlignment](https://standards.buildingsmart.org/IFC/RELEASE/IFC4_3/HTML/lexical/IfcAlignment.htm), IFC 4.3.2.0 | Horizontale, vertikale und Cant-Layouts; Distance-along-Struktur; Referenten für Stationierung oder Kilometrierung. |
| S05 | buildingSMART, [IfcAlignmentCantSegment](https://standards.buildingsmart.org/IFC/RELEASE/IFC4_3/HTML/lexical/IfcAlignmentCantSegment.htm), IFC 4.3.2.0 | Cant-Segmente entlang der horizontalen Trassierung mit schienenbezogenen Höhenangaben. |
| S06 | OGC, [Land and Infrastructure Conceptual Model Standard 1.0](https://docs.ogc.org/is/15-111r1/15-111r1.html), OGC 15-111r1, 2016 | Alignment-Positionierung, lineare Referenzierung, horizontale/vertikale Segmentmodelle und expliziter CRS-Kontext. |
| S07 | OGC, [InfraGML Part 3 — Alignments](https://docs.ogc.org/is/16-103r2/16-103r2.html), OGC 16-103r2, 2017 | XML-Kodierung des LandInfra-Alignmentmodells. |
| S08 | ISO, [ISO 19148:2021 Geographic information — Linear referencing](https://www.iso.org/standard/75150.html), 2. Ausgabe, April 2021 | Konzeptschema für Positionen, die entlang eines eindimensionalen Objekts und optional mit Offset gemessen werden. |
| S09 | ISO, [ISO 23054-1:2022 Railway applications — Track geometry quality — Part 1](https://www.iso.org/standard/74457.html), 2022 | Gleisgeometrieparameter, Messanforderungen und Bewertungsmethoden. |
| S10 | W. Koc, [Design of Rail-Track Geometric Systems by Satellite Measurement](https://doi.org/10.1061/(ASCE)TE.1943-5436.0000303), *Journal of Transportation Engineering* 138(1), 2012, 114–122 | Ursprüngliche Rekonstruktions-/Entwurfsmethode auf Basis gemessener Gleisgeometrie. |
| S11 | W. Koc, [Analytical Method of Modelling the Geometric System of Communication Route](https://doi.org/10.1155/2014/679817), *Mathematical Problems in Engineering*, 2014, Artikel 679817 | Krümmungsbasierte Streckenmodellierung und analoge Modellierung von Überhöhungsrampen. |
| S12 | K. Zboinski und P. Woznica, [Combined use of dynamical simulation and optimisation to form railway transition curves](https://doi.org/10.1080/00423114.2017.1421315), *Vehicle System Dynamics* 56(9), 2018, 1394–1450 | Bildung von Übergangsbogenkandidaten durch gekoppelte Fahrzeug-Gleis-Simulation und Optimierung. |
| S13 | A. R. Hevner, S. T. March, J. Park und S. Ram, [Design Science in Information Systems Research](https://aisel.aisnet.org/misq/vol28/iss1/6/), *MIS Quarterly* 28(1), 2004, 75–105, DOI 10.2307/25148625 | Konstruktion und Bewertung zweckgerichteter Artefakte als etablierte Forschungsmethode. |
| S14 | ACM, [Artifact Review and Badging](https://www.acm.org/publications/policies/artifact-review-and-badging-current) | Etablierte Kriterien für verfügbare, funktionsfähige und wiederverwendbare Artefakte sowie unabhängig validierte Ergebnisse. |

## Baseline je Forschungsfrage

| Forschungsfrage | Stärkste Vorleistung und Gegenbeleg | Verbleibende prüfbare Forschungslücke | Konsequenz für die Baseline |
|---|---|---|---|
| RQ1 — Identität und Verantwortung | PROV-O trennt bereits Entitäten, Aktivitäten und Agenten sowie qualifizierte Ableitung und Zuschreibung (S01). IFC gibt Alignment-Objekten Identität, Zerlegung und typisierte Relationen (S04). | Alignment-spezifische operative Trennung dauerhafter Identität/Revision von Konstruktion, Realisierung, Repräsentation, Beobachtung, Bewertung und Entscheidung, nachgewiesen über folgenreiche Änderung und semantisches Wiederöffnen. | Keine allgemeine Identitäts- oder Provenienztheorie beanspruchen; die engere Verantwortungsgrenze und Kontinuitätsspur prüfen. |
| RQ2 — ausführbares begrenztes Wissen | SHACL führt Constraints aus und erzeugt Konformitätsberichte (S02); IDS macht IFC-Informationsanforderungen maschineninterpretierbar und prüfbar (S03). Optimierung erzeugt bereits Übergangsbogenkandidaten (S12). | Alignment-weiter Vertrag aus Anwendbarkeit, Annahmen, Residuen und expliziter Nicht-Autorität, der Kandidatenerzeugung oder Bewertung von Zulassung, Freigabe und Persistenz trennt. | Ausführbare Constraints, Regelprüfung und Solver nicht als neu beanspruchen; Autoritätsgrenze und terminale Ergebnisse prüfen. |
| RQ3 — intrinsische Komposition und Realisierung | IFC 4.3 kombiniert horizontale, vertikale und Cant-Layouts bereits über die Entfernung entlang der Horizontalen (S04–S05). LandInfra und ISO 19148 liefern Alignment-Positionierung und lineare Referenzierung (S06–S08). Koc modelliert Krümmung und Überhöhungsrampen (S11). | Getrennt autoritative linke/rechte Schienengesetze; strikt abgeleitete Mittellage, cross-level und common offset; explizite Trennung intrinsischer Position, betrieblicher Kilometrierung und qualifizierter Realisierung; bedeutungserhaltendes Wiederöffnen. | Der breite Anspruch eines gemeinsamen Längsparameters ist Stand der Technik; nur die engere verantwortungserhaltende Komposition prüfen. |
| RQ4 — epistemische Erhaltung | PROV repräsentiert Provenienz (S01); SHACL und IDS erhalten Validierungsergebnisse statt nur Daten zu parsen (S02–S03); IFC stellt Austauschstrukturen bereit (S04–S05). | Durchgängiger Bahn-Workflow, der akzeptierten, abgelehnten, mehrdeutigen und unbelegten Evidenzstatus durch Admission, folgenreiche Änderung, Review, Persistenz und Wiederöffnen ohne stille Hochstufung erhält. | Provenienz, Validierungsberichte oder Austausch allein nicht als neu beanspruchen; Erhaltung über den vollständigen Workflow prüfen. |

## Gegenbelegtest der Neuheitsansprüche

### C1 — Alignment-spezifisches Verantwortungs- und Identitätsmodell

**Gegenbeleg.** PROV-O liefert bereits typisierte Provenienzrelationen; IFC
liefert identifizierte Alignment-Objekte und Zerlegung (S01, S04). Damit entfällt
jeder Anspruch auf allgemeine typisierte Identität, Abstammung oder Provenienz.

**Ergebnis: `survives with reformulation`.** Kandidat ist nur noch die
Alignment-spezifische ausführbare Trennung von Identität/Revision und sechs
Ingenieurverantwortungen samt Nachweis, dass sie folgenreiche Änderung und
semantisches Wiederöffnen übersteht. Sie besteht nur, wenn Vergleich und
Fallstudie zeigen, dass dies nicht bloß eine Umbenennung von PROV und IFC ist.

### C2 — Methode ausführbarer Wissensverträge

**Gegenbeleg.** SHACL macht Constraints bereits ausführbar und liefert
Validierungsergebnisse; IDS unterstützt automatisierte Prüfung maschinenlesbarer
Informationsanforderungen; Übergangsbogenoptimierung erzeugt bereits numerische
Kandidaten (S02, S03, S12).

**Ergebnis: `survives with reformulation`.** Allgemeine Neuheitsformulierungen
zu ausführbarem Wissen, Regeln oder Solvern entfallen. Verbleibender Kandidat
ist ein domänenspezifischer Vertrag aus Anwendbarkeit, Annahmen, Residuen,
terminalen Ergebnissen und Nicht-Autorität mit erzwingbarer Trennung von
Kandidat, Bewertung, geregelter Entscheidung, Apply und Persistenz.

### C3 — Intrinsisches konstruktives Mehrbandmodell

**Gegenbeleg.** IFC 4.3 koordiniert horizontale, vertikale und Cant-Layouts
explizit über die Entfernung entlang des horizontalen Alignments; LandInfra und
ISO 19148 etablieren Alignment-Positionierung und lineare Referenzierung; Koc
verwendet Krümmung und modelliert Überhöhung als Schienenhöhendifferenz
(S04–S08, S11). Damit sind gemeinsamer Längsparameter und kombiniertes
Horizontal-/Vertikal-/Cant-Modell nicht neu.

**Ergebnis: `survives with reformulation`.** Verbleibender Kandidat ist die
Kombination explizit autoritativer linker/rechter Schienengesetze, ausschließlich
abgeleiteter midpoint-/crossLevel-/commonOffset-Größen und strikter Grenzen
zwischen intrinsischer Position, Kilometrierung, Identität und qualifizierter
Realisierung einschließlich verlustfreiem semantischem Wiederöffnen. Ohne
Einzel- und Integrationsnachweis sinkt C3 auf Implementierungssynthese.

### C4 — Fail-closed Admission und Workflow epistemischer Zustände

**Gegenbeleg.** PROV zeichnet Provenienz auf; SHACL trennt Konformität,
Verletzungen und Validierungsfehler; IDS ermöglicht automatisierte
Informationskonformität (S01–S03). Sichtbar scheiternde Validierung ist damit
keine neue allgemeine Technik.

**Ergebnis: `survives with reformulation`.** Verbleibender Kandidat ist die
Erhaltung des Evidenzstatus über die gesamte Kausalkette: Quelleninventar,
Admission, folgenreiche Alignment-Änderung, synchrones Review, Persistenz und
Wiederöffnen. Der Anspruch scheitert, wenn ein abgelehnter, ungeklärter oder
unbelegter Datensatz verschwindet oder still hochgestuft wird.

### C5 — Reproduzierbare Referenzrealisierung und Validierungsprotokoll

**Gegenbeleg.** Design-Science-Forschung behandelt Artefaktkonstruktion und
-bewertung bereits als Kernmethode (S13). Das ACM-Artefaktreview definiert
bereits Verfügbarkeit, Funktionsfähigkeit, Wiederverwendbarkeit und Kriterien
zur Ergebnisvalidierung (S14).

**Ergebnis: `eliminated`.** C5 ist kein eigenständiger wissenschaftlicher
Neuheitsanspruch. Es bleibt verpflichtende Forschungsmethode und
Evidenzprotokoll der Dissertation: versionierte Implementierung, ausführbare
Tests, reale Fallstudie, Negativfälle und reproduzierbarer semantischer
Vergleich. Es stützt C1–C4, wird aber nicht als fünfter Neuheitsbeitrag gezählt.

## Revidierte Beitragsmenge nach DISS-03

Die vorläufig verteidigbare Beitragsmenge enthält vier bedingte Ansprüche:

1. Alignment-spezifische Verantwortungs- und Identitätserhaltung;
2. autoritätsbegrenzte Alignment-Wissensverträge;
3. verantwortungserhaltende intrinsische Komposition mit expliziter
   Rail-Pair-Autorität und qualifizierter Realisierung;
4. durchgängige Erhaltung epistemischer Zustände in Alignment Knowledge Work.

Alle vier hängen von mathematischem Abschluss in DISS-04, realer
Validierungsfallstudie und kritischer Diskussion der Generalisierbarkeit ab.
C5 wird zur übergreifenden Validierungsmethode. Kein Ergebnis ändert Bedeutung
des freigegebenen Knowledge Kernel.

## Abdeckungsgrenzen und nächste Suchpflichten

- Dies ist eine gezielte Primärquellen-Baseline, keine vollständige
  systematische Übersicht.
- DISS-04 oder ein eigenes Related-Work-Paket muss Originalarbeiten zu Digital
  Twins, MBSE, Bahninfrastruktur-Information und semantischem Roundtrip nach
  näheren Gegenbelegen zum Verantwortungsmodell durchsuchen.
- Lizenzierte ISO-Volltexte wurden nicht reproduziert; für S08 und S09 wurden
  ausschließlich offizielle Katalogangaben zu Umfang und Metadaten verwendet.
- Die Dissertation-Bibliographie darf erst aktualisiert werden, nachdem die
  derzeit fremd belegte `references.bib` freigegeben und jeder Eintrag gegen das
  Quellenregister geprüft wurde.
