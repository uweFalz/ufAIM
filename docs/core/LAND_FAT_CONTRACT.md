# LAND_FAT_CONTRACT

## Zweck

`landFAT` ist das interne, parserübergreifende Austauschformat des Parsing-Subsystems.

Es ist:

- ein leicht erweitertes `landXML` als JSON
- verlust- und rechnungsfrei gemeint
- nur Übergabeformat zwischen format-spezifischen Parsern und dem gemeinsamen Folge-Schritt

Es ist **nicht**:

- kein Zielmodell
- kein UI-/Preview-Format
- kein sparse
- kein Rechenformat

Der Schritt

`formatParser -> landFAT -> buildSparseFromFAT() -> sparse`

ist strikt einzuhalten.

---

## Grundprinzipien

### 1. Parser rechnen nicht

Format-spezifische Parser dürfen **nicht**:

- Geometrie rekonstruieren
- Chord-Lengths berechnen
- Richtungen umrechnen
- Pose ableiten
- sparse erzeugen
- Preview-Polylinien erzwingen

Parser dürfen nur:

- lesen
- source-semantisch aufbereiten
- verlustfrei in `landFAT` übersetzen

---

### 2. landFAT ist teilbasiert

Ein `landFAT`-Dokument beschreibt genau **einen fachlich homogenen Teil**.

Ein Teil hat insbesondere einheitliche:

- `units`
- `coordinateSystem`

Bei gemischten CRS- oder Einheitensystemen ist in mehrere Teile zu splitten.

```md
@baustelle [MULTI-PART]
Wie mehrere Teile logisch zusammengehören (z. B. gleiche Strecke),
wird aktuell **nicht im Contract geregelt**.


⸻

3. Markup vs. Non-Markup

Für moderne Markup-Formate wie:
	•	landXML
	•	infraGML
	•	IFC Alignment

liegt die Semantik weitgehend bereits im Format selbst.

Für non-Markup-/Alt-/Binärformate wie:
	•	TRA
	•	GRA
	•	GND/XLSX
	•	MDB

muss fehlendes Formatwissen in extras.sourceSemantics transportiert werden.

⸻

Root-Struktur

{
  type: "landFAT",

  meta: { ... },

  units: {
    linearUnit: "meter",
    elevationUnit: "meter",
    angularUnit: "radian" | "gon" | "degree" | null
  },

  coordinateSystem: {
    horizontalCoordinateSystemName: string | null,
    verticalCoordinateSystemName: string | null
  },

  alignments: [
    {
      type: "Alignment",
      id: string,
      name: string | null,

      coordGeom: {
        elements: [ Line | Curve | Spiral ]
      },

      staEquations: [ StaEquation ] | null,
      profile: Profile | null,
      cant: Cant | null,

      extras: { ... }
    }
  ],

  extras: { ... }
}

⸻

Alignment

Ein Alignment ist die zentrale fachliche Einheit.

Ein Alignment enthält:
	•	genau eine coordGeom
	•	optional staEquations
	•	optional profile
	•	optional cant
	
{
  type: "Alignment",

  id: string,
  name: string | null,

  coordGeom: {
    elements: [ CoordGeomElement ]
  },

  staEquations: [ ... ] | null,

  profile: { ... } | null,
  cant: { ... } | null,

  extras: { ... }
}

@baustelle [ALIGNMENT-STRICTNESS]
- Beziehungen zwischen Alignment / Profile / Cant sind noch nicht vollständig formalisiert
- 7L-Modell wird erst im sparseBuilder erzwungen


⸻

CoordGeom

coordGeom: {
  elements: [
    Line | Curve | Spiral
  ]
}

Reihenfolge = topologisch korrekt.

Keine Berechnung, keine Rekonstruktion.

⸻

CoordGeomElement

Line

{
  type: "Line",

  start: Point2D,
  end: Point2D,

  length: Measure | null,
  direction: Angle | null,

  staStart: Measure | null,

  extras: { ... }
}


⸻

Curve

{
  type: "Curve",

  start: Point2D,
  end: Point2D,
  center: Point2D | null,

  radius: RadiusValue,
  rot: "cw" | "ccw" | null,

  length: Measure | null,
  dirStart: Angle | null,
  
  staStart: Measure | null,

  extras: { ... }
}

⸻

Spiral

{
  type: "Spiral",

  start: Point2D,
  end: Point2D,
  pi: Point2D | null,

  radiusStart: RadiusValue,
  radiusEnd: RadiusValue,

  spiType: string | null,

  length: Measure | null,
  staStart: Angle | null,

  staStart: Measure | null,

  extras: { ... }
}

@baustelle [SPIRAL-TYPING]
- spiType ist aktuell nur String
- spätere Typisierung (clothoid, bloss, ...) geplant


⸻

Typdefinitionen

Point2D

{
  easting: number,
  northing: number
}

@baustelle [POINT-Z]
Z-Komponente optional / später


⸻

Measure

{
  value: number,
  unit?: string
}


⸻

## Winkelwerte

Winkelwerte sind in `landFAT` niemals nur nackte Zahlen.

Ein Winkelwert ist immer explizit typisiert als:

```js
{
  value: 1.234,
  unit: "radian" | "gon" | "degree",
  orientation: "cw" | "ccw",
  origin: "north" | "east" | "south" | "west"
}

Begründung

Nur value + unit ist nicht ausreichend, da Alt- und Quellformate
unterschiedliche Winkelkonventionen nutzen können:
	•	mathematisch: ccw, Ursprung east
	•	vermessungstechnisch: cw, Ursprung north
	•	formatabhängige Sonderfälle, z. B. TRA-Knick: gon, cw, Ursprung west

Regeln
	•	Parser rechnen Winkel nicht um.
	•	Parser geben Winkel source-nah mit vollständiger Semantik aus.
	•	Wenn ein Format globale Winkelkonventionen hat, dürfen diese zusätzlich in
extras.sourceSemantics.angular dokumentiert werden.
	•	Wenn ein Feld davon abweicht, muss die Feldsemantik direkt am Feld selbst
stehen.

Beispiele

Normale Richtungsangabe:

dir: {
  value: 1.3281590310,
  unit: "radian",
  orientation: "cw",
  origin: "north"
}

TRA-Knick:

delta: {
  value: 200.042,
  unit: "gon",
  orientation: "cw",
  origin: "west"
}

⸻

RadiusValue

number
| {
    value: "INF",
    representation: "infinite"
  }
  
@baustelle [RADIUS-SEMANTICS]
- "INF" ist source-nah
- Interpretation erfolgt erst im sparseBuilder


⸻

extras: Semantik-Erweiterungen

extras ist der einzige erlaubte Ort für formatbezogene Zusatzinformation.

Es gibt zwei klar getrennte Konzepte:

⸻

sourceSemantics

Zweck:

Beschreibt Semantik, die im Quellformat nicht explizit enthalten ist, aber zum korrekten Verständnis notwendig ist.

Typische Fälle:
	•	fehlende Units
	•	fehlendes oder unvollständiges CRS
	•	implizite Richtungsdefinitionen
	•	feldabhängige Sonderlogiken
	•	binäre oder codierte Bedeutungen

→ Wird vor allem bei non-Markup-Formaten verwendet.

⸻

semanticMap

Zweck:

Dokumentiert die Abbildung von Quellstruktur auf landFAT-Struktur.

Typische Inhalte:
	•	Mapping von XML-Attributen auf JSON-Felder
	•	Umbenennungen
	•	Strukturtransformationen
	•	Herkunft eines Wertes

→ Wird vor allem bei Markup-Formaten verwendet.

⸻


@baustelle [SEMANTIC-SCOPE]
- keine formale Struktur für semanticMap definiert
- aktuell rein dokumentativ gedacht

---

⸻

## Railway Context (optional)

Zur Unterstützung bahnspezifischer Modelle (insb. 7-Linien-Ansatz) können
Alignment, Profile und Cant optional um einen `railContext` erweitert werden.

Dieser Block ist vollständig optional und darf fehlen, ohne die
landFAT-Konformität zu verletzen.

Fehlt `railContext`, entspricht das Objekt reinem landXML-/Basis-landFAT-Verhalten.

⸻

### Ziel

- explizite Rollenkennzeichnung
- Zuordnung zusammengehöriger Linien
- Vorbereitung für km-/Referenzlinien-Logik
- keine Beeinflussung der Parser-Logik
- keine Vorwegnahme von sparse

⸻

### Grundsatz

`railContext` beschreibt **nur fachliche Zuordnung**, niemals Geometrie
und niemals berechnete Beziehungen.

Parser dürfen ihn setzen, müssen es aber nicht.

⸻

### Struktur

railContext: {
  role?: string,
  side?: "left" | "right" | "center" | null,
  groupId?: string,
  stationDomain?: "internal" | "reference" | "km",
  references?: {
    referenceAlignmentId?: string
  }
}

⸻

### Felder

role

Beschreibt die fachliche Rolle des Objekts.

Typische Werte:
- "referenceLine"      (km-Linie)
- "trackAxis"          (Gleisachse)
- "profile"            (Gradiente)
- "cant"               (Überhöhung)
- "other"

⸻

side

Seitliche Zuordnung bei mehrgleisigen Systemen.

- "left"
- "right"
- "center"
- null

⸻

groupId

Freies Gruppierungsmerkmal zur Zusammenfassung zusammengehöriger Linien
(z. B. 7-Linien-Bündel).

Keine globale Bedeutung, keine Eindeutigkeitsgarantie erforderlich.

⸻

stationDomain

Beschreibt die Bedeutung der Stationierungswerte:

- "internal"   → entlang eigener Geometrie
- "reference"  → bezogen auf Referenzlinie
- "km"         → Kilometerangaben

⸻

references.referenceAlignmentId

Optionale Referenz auf ein anderes Alignment (z. B. km-Linie).

Nur Identifikation, keine Berechnung.

⸻

### Beispiel

{
  type: "Alignment",
  id: "track_r_1720",

  railContext: {
    role: "trackAxis",
    side: "right",
    groupId: "1720_main",
    stationDomain: "internal",
    references: {
      referenceAlignmentId: "km_1720"
    }
  },

  ...
}

⸻

### Designentscheidungen

- keine Pflichtfelder → volle Abwärtskompatibilität
- keine komplexen Strukturen → bewusst minimal gehalten
- keine impliziten Berechnungen → reine Semantik
- keine Bündelstruktur im Root → bleibt Aufgabe späterer Modelle

⸻

@baustelle [RAIL-CONTEXT-EXTENSION]
- mögliche Erweiterung um profile-/cant-spezifische Referenzen
- mögliche spätere Einführung expliziter AlignmentBundles
- Mapping zu sparse_v2 (node-edge) noch offen

---
