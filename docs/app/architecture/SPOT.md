# SPOT

## STATUS

SPOT hat sich in den letzten Entwicklungszyklen implizit von einem einfachen Parameter-Store zu einem Engineering Object Space entwickelt.

Die aktuelle Richtung ist konsistent mit den Architekturentscheidungen rund um:

- Import
- Preview
- AlignmentData
- RouteProject
- MultiView
- Messaging
- Canonical Data Ownership

SPOT sollte daher nun explizit definiert und architektonisch eingefroren werden.

---

# CURRENT OBSERVATIONS

Aktuell existieren drei unterschiedliche Interpretationen von SPOT.

## Modell A — Import-Zwischenablage

```text
Drop
 → ImportSession
 → SPOT
 → übernehmen
```

Historisch entstanden.

---

## Modell B — Alignment-Sammlung

```text
SPOT
 ├─ AlignmentData
 ├─ AlignmentData
 ├─ AlignmentData
 └─ ...
```

Teilweise heute noch sichtbar.

---

## Modell C — Canonical Object Universe

```text
SPOT
 ├─ Alignments
 ├─ Profiles
 ├─ Cants
 ├─ CRS
 ├─ Environment
 ├─ Relations
 └─ ...
```

Dies entspricht der tatsächlichen Entwicklungsrichtung.

---

# PROPOSED DEFINITION

## What is SPOT?

SPOT is the canonical engineering object space of the application.

SPOT enthält alle langlebigen fachlichen Objekte,
die innerhalb des aktuellen Arbeitskontextes existieren.

SPOT ist:

- modellnah
- UI-unabhängig
- workflow-unabhängig
- view-unabhängig

SPOT beantwortet die Frage:

> What engineering objects currently exist?

Nicht:

> What is the user currently doing?

---

## Core Thesis

```text
SPOT contains durable engineering semantics.

SPOT does not contain workflows.
```

---

## Mental Model

```text
Import
    ↓

Preview
    ↓

SPOT
    ↓

RouteProject
```

---

# OBJECT MODEL

## Canonical Root

```text
SPOT
 ├─ objects
 ├─ relations
 ├─ context
 └─ metadata
```

---

## SpotObject

Alle Engineering-Objekte werden über einen gemeinsamen Objekttyp repräsentiert.

```js
SpotObject
{
    id,
    type,
    payload,
    spatialRef,
    meta
}
```

---

# INITIAL OBJECT TYPES

## Alignment

```js
{
    type: "alignment",
    payload: AlignmentData
}
```

Beispiele:

- Main Track
- Left Track
- Right Track
- Kilometer Line

---

## Profile

```js
{
    type: "profile"
}
```

---

## Cant

```js
{
    type: "cant"
}
```

---

## Station Equation

```js
{
    type: "staEq"
}
```

---

## CRS

```js
{
    type: "crs"
}
```

Nur wenn fachlich relevant.

---

## Environment

Zukünftig:

```js
{
    type: "environment"
}
```

Beispiele:

- Terrain
- Surface
- Building
- Bridge
- Tunnel
- Utility
- IFC Object
- Point Cloud Reference

---

# RELATIONS

Relations sind eigenständige Objekte.

Nicht:

```js
alignment.profileId
```

sondern:

```js
Relation
{
    id,
    type,
    source,
    target
}
```

---

## Beispiele

```text
alignment
    uses
profile
```

```text
alignment
    uses
cant
```

```text
alignment
    locatedIn
crs
```

```text
alignment
    intersects
environment
```

---

# IMPORT RELATIONSHIP

Import gehört nicht zu SPOT.

Import erzeugt Kandidaten.

```text
ImportSession
```

ist grundsätzlich temporär.

---

Import Pipeline:

```text
file
 → parser
 → landFAT
 → sparse
 → candidate
```

Erst nach expliziter Übernahme entsteht:

```text
candidate
 → SpotObject
```

---

# PREVIEW RELATIONSHIP

Preview gehört nicht zu SPOT.

Preview ist ausschließlich eine abgeleitete Darstellung.

```text
derived visualization
```

Beispiele:

- previewPolyline
- previewTrack
- previewMesh
- previewBand

sind niemals Bestandteil von SPOT.

---

# ALIGNMENTDATA RELATIONSHIP

AlignmentData lebt innerhalb von SPOT.

Beispiel:

```js
SpotObject
{
    type: "alignment",
    payload: AlignmentData
}
```

AlignmentData enthält die Fachdaten.

SPOT verwaltet die Engineering-Objekte.

---

# ROUTEPROJECT RELATIONSHIP

RouteProject ist größer als SPOT.

SPOT:

```text
working engineering universe
```

RouteProject:

```text
persisted project universe
```

---

Mögliche zukünftige Struktur:

```js
RouteProject
{
    spotSnapshot,
    settings,
    history,
    documents
}
```

---

# CRS RELATIONSHIP

CRS kann Bestandteil von SPOT sein.

Allerdings ausschließlich als Engineering-Referenz.

Beispiel:

```text
Alignment
    →
CRS
```

---

Nicht Bestandteil von SPOT:

```text
currentMapProjection
userSelectedProjection
globeMode
mercatorMode
```

Diese Informationen gehören zur Darstellungsebene.

---

# SPATIAL INDEPENDENCE

SPOT is spatially independent.

SPOT objects may reference spatial information,
but SPOT itself does not depend on any specific spatial representation.

Beispiele:

- Engineering CRS
- WGS84
- UTM
- DBREF
- lokale Projektkoordinaten

sind gleichermaßen gültige Referenzen.

Ebenso können verschiedene Repräsentationen gleichzeitig existieren:

- Engineering-Projektion
- Globe-Projektion
- Mercator-Projektion
- zukünftige ellipsoidale Berechnung

ohne die Identität eines SpotObjects zu verändern.

Ein SpotObject bleibt dasselbe Objekt,
unabhängig davon, wie es räumlich dargestellt wird.

```text
SpotObject
    ≠ Representation
```

```text
SpotObject
    ≠ Projection
```

SPOT speichert Engineering-Objekte.

Darstellungen werden daraus abgeleitet.

---

# ENVIRONMENT RELATIONSHIP

Environment gehört langfristig zu SPOT.

Beispiele:

- Terrain
- Surface
- Building
- Tunnel
- Bridge
- Utility
- Point Cloud Reference

Diese Objekte besitzen Engineering-Relevanz und Persistenz.

---

# REPRESENTATIONS

Representations are not SpotObjects.

Representations are derived views of SpotObjects.

Beispiele:

```text
AlignmentData
    →
Polyline
```

```text
AlignmentData
    →
Track Mesh
```

```text
AlignmentData
    →
Three.js Geometry
```

```text
AlignmentData
    →
MapLibre Layer
```

```text
AlignmentData
    →
Station Table
```

```text
AlignmentData
    →
FcnPlot
```

Die Darstellung kann sich ändern.

Das SpotObject bleibt unverändert.

Representations sind austauschbar.

SpotObjects sind dauerhaft.

---

# VIEW RELATIONSHIP

Views besitzen keine Wahrheit.

Views konsumieren SPOT.

```text
GeoView
    ←

SPOT

    →
FcnPlotView

    →
TableView
```

---

Regel:

```text
SPOT knows nothing about Views.

Views know SPOT.
```

---

# NON-GOALS

SPOT enthält ausdrücklich nicht:

## UI State

```text
selectedObject
hoveredObject
expandedTreeNode
```

---

## Workflow State

```text
importStep
wizardState
dropProgress
```

---

## Preview State

```text
previewAlignment
previewTrack
previewMesh
previewBand
```

---

## Representations

```text
Polyline
TrackMesh
MapLibreLayer
ThreeGeometry
FcnPlotCurve
```

---

## View Preferences

```text
camera
zoom
pitch
theme
layout
```

---

## Controller State

```text
activeTool
editMode
currentCommand
```

---

# ADMISSION CRITERIA

Ein Objekt darf nur dann Teil von SPOT werden, wenn es:

```text
durable
+
engineering relevant
+
referenceable
```

ist.

---

# OPEN QUESTIONS

## 1. Profile and Cant Ownership

Sind Profile und Cant eigenständige SpotObjects?

Oder Bestandteile von AlignmentData?

Bewusst offen gelassen.

---

## 2. Relation Ownership

Leben Relations innerhalb von:

```text
spot.relations
```

oder in einem separaten Store?

Aktuelle Präferenz:

```text
spot.relations
```

---

## 3. SPOT Admission Rules

Welche Objekte dürfen automatisch nach SPOT übernommen werden?

Möglicherweise:

```text
SPOT_READY
```

als formales Aufnahmekriterium.

---

## 4. Versioning

Benötigt SPOT eigene Historisierung?

Aktuelle Antwort:

```text
No
```

Versionierung gehört eher zu RouteProject.

---

# PROPOSED USER MODEL

```text
Import
    = incoming data

Preview
    = inspection

SPOT
    = engineering objects currently existing

RouteProject
    = persisted engineering world

Views
    = representations of SPOT
```

---

# FINAL DEFINITION

SPOT is the single canonical source of durable engineering objects between import and project persistence.

SPOT contains engineering objects.

SPOT does not contain workflows, previews, user interface state, representations, or view-specific information.

SPOT is not a project.

SPOT is the engineering universe currently loaded into memory.
