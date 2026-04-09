# ufAIM – Session Transfer

Date: 2026-03-17  
Session: short description

Wir arbeiten gerade an TransitionRegistry
pose2 ist falsch
RegistryCompiler wird aufgespalten

---

# STATUS

## Stable parts

	•	Import pipeline (high level):
	•	sniff → parse → landFAT → buildSparse → SPOT
	•	parseTRA_GRA:
	•	liefert valide coordGeom
	•	staEquation korrekt
	•	cant (source-near) vorhanden
	•	buildSparseFromLandFAT:
	•	funktioniert strukturell
	•	Alternation enforced
	•	WorkingItems / SpotCandidates
	•	Pipeline läuft durch
	•	Messaging:
	•	SharedMessagingWorker stabil
	•	Overall:
	•	E2E-Import läuft real durch (TRA/GRA)
	
## Working (but not clean)
	•	validateSparse
	•	basiert auf falschem Pose-Contract ❗
	•	pose2.js
	•	funktional OK, aber API nicht sauber kapselnd
	•	buildSparseFromLandFAT
	•	robust, aber:
	•	nutzt Pose korrekt
	•	Validator widerspricht → Inkonsistenz
	•	UI:
	•	nutzt teilweise noch legacy preview geometry
	
## Broken / Mismatch

🚨 POSE-CONTRACT BRUCH (zentral!)

Ist-Zustand:
	•	pose2.js:
	
{ p: {x,y}, t: {x,y} }


	•	validateSparse erwartet:
	
{ x, y, dir }

➡️ Ergebnis:
	•	poseA invalid für ALLE Elemente
	•	obwohl Builder korrekt arbeitet

👉 Das ist aktuell der Hauptfehler im System.

⸻

🧪 Experimental
	•	traLikeCoordGeom
	•	jetzt der richtige zentrale Builder-Kandidat
	•	TransitionRegistry / RegistryCompiler
	•	im Umbau
	•	AlignmentFactory
	•	transitionEditorBridge

---

## CURRENT FOCUS

🎯 Primärziel dieser Phase

Import → sparse → SPOT → View muss robust laufen

Das bedeutet konkret:
	1.	Pose-Contract fixen
	2.	Sparse Validator korrekt machen
	3.	GND Import durch gleiche Pipeline schicken wie TRA

⸻

🔧 Konkrete Tasks (JETZT)

1. Pose-Contract zentralisieren

NICHT im Validator definieren

➡️ pose2.js wird zur einzigen Wahrheit

Add:

export function isPose2(pose)
export function posePoint(pose)
export function poseTangent(pose)

Dann:
	•	validateSparse nutzt NUR diese
	•	keine eigenen Checks mehr

⸻

2. validateSparse reparieren
	•	isPose() → ersetzen durch isPose2
	•	checkPoseContinuity() → über posePoint()

Zusätzlich:

	startPose → ebenfalls validieren mit isPose2



⸻

3. traLikeCoordGeom finalisieren

Ziel:

👉 Einziger Ort für TRA/GND Geometrie-Mapping

Noch offen:
	•	vollständige Kz → spiType Semantik
	•	evtl. extras.sourceSemantics sauber ergänzen

Wichtig:

➡️ keine Geometrie-Rekonstruktion
➡️ nur “Record → Segment”

⸻

4. parseTRA_GRA vereinfachen

Aktuell doppelte Logik:
	•	mapTRARecordToLandFATElements ❌
	•	traLikeCoordGeom ✅

👉 Ziel:

	coordGeom = buildCoordGeomFromTraLikeRecords(rows)
	
und ALLES andere raus.

⸻

5. GND als echter zweiter Use Case

Jetzt möglich:

👉 GND = TRA-like

Das heißt:
	•	gleiche Pipeline
	•	gleiche Semantik
	•	kein Sonderweg

---

## FOLLOW-UP TASKS

	1.	pose2 sauber kapseln
	2.	validateSparse fixen
	3.	traLikeCoordGeom finalisieren
	4.	parseTRA_GRA vereinfachen
	5.	parseGND_XLSX auf gleiche Struktur bringen

⸻

Mid term

Alignment Core
	•	RegistryCompiler aufspalten:
	•	Parser
	•	Normalizer
	•	Resolver
	•	KappaFcnBuilder nur im Window-Kontext
	•	Transition runtime descriptor

⸻

Long term
	•	pose3 (Cant!)
	•	CoordinateAgent / CRS
	•	Solver Handoff (axtran)
	•	Project Model + Persistence

---

# ARCHITECTURE INSIGHT (wichtiger Schritt!)

🧠 Der eigentliche Shift dieser Session

Du bist gerade von:

„Parser + Builder bauen Dinge“

zu:

„Wir definieren Contracts zwischen Schichten“

übergegangen.

Und genau da lag der Fehler:

❌ vorher
	•	Validator definiert Pose
	•	Builder definiert Pose
	•	pose2 definiert Pose

➡️ 3 Wahrheiten

✅ jetzt
	•	pose2 = einzige Wahrheit
	•	Validator nutzt pose2
	•	Builder nutzt pose2

➡️ 1 Wahrheit

⸻

REMOVE_LEGACY_PREVIEW_GEOMETRY

Status: weiterhin HIGH

Aber jetzt klarer:

Problem

UI nutzt:

	geometry.pts (polyline)
	
statt:

	coordGeom / sparse

Konsequenz
	•	Parser muss Fake-Geometrie liefern
	•	GND braucht Hacks
	•	System wirkt komplizierter als nötig

⸻

Zielbild

	Parser → coordGeom → sparse → Alignment2D → Renderer

OHNE:
	•	polyline
	•	preview hacks

⸻

Strategie

Noch nicht sofort entfernen, aber:
	1.	neuen Renderer vorbereiten
	2.	alignment2dEval stabilisieren
	3.	dann Legacy killen

⸻

NEXT SESSION PLAN

Schritt 1 (Pflicht)

👉 Pose-Contract fixen
	•	pose2.js erweitern
	•	validateSparse umstellen

⸻

Schritt 2

👉 TRA Pipeline cleanen
	•	parseTRA_GRA → nur noch traLikeCoordGeom
	•	alte Mapper raus

⸻

Schritt 3

👉 GND anschließen
	•	gleiche Struktur wie TRA
	•	kein Sonderfall

⸻

Schritt 4

👉 echte Validierung testen

Nach Fix:
	•	verschwinden die poseA invalid Fehler?
	•	bleiben nur echte Geometrieprobleme übrig?

⸻

FINAL SUMMARY

Die Session hat drei entscheidende Dinge gebracht:

⸻

1. Import ist NICHT das Problem

TRA/GRA liefern bereits:
	•	brauchbare Geometrie
	•	ausreichende Semantik

👉 Aufwand war nicht umsonst, sondern Fundament.

⸻

2. Der echte Bug war architektonisch

👉 Pose-Contract war gebrochen

Nicht:
	•	Parser falsch
	•	Builder falsch

sondern:
	•	Validator falsch gekoppelt

⸻

3. System wird gerade einfacher (nicht komplexer)

Du reduzierst gerade:
	•	doppelte Mapper
	•	doppelte Semantik
	•	doppelte Wahrheiten

hin zu:

👉 klare, lineare Pipeline

⸻

Wenn du willst, gehe ich in der nächsten Runde direkt mit dir durch:

👉 minimalen Diff für validateSparse.js + pose2.js

damit das Ding sofort grün wird.

---

## PENDING ARCHITECTURE TOPICS

- GNDedit reference-data import
- CRS Agent
- Solver handoff format
- Project persistence
- MultiWindow focus model

---

# NEXT SESSION PLAN

Suggested next steps:

1. Define **WindowSessionState**
2. Fix import batch statistics
3. Clarify RP-select vs view pick
4. Decide WindowSessionController role

---

# NOTES

Important observations or discoveries.

Example:

- landXML alignments import correctly but lack CRS.
- TRA/GRA imports produce artifacts usable by alignment builder.


## 🚨 REMOVE_LEGACY_PREVIEW_GEOMETRY

Status: OPEN  
Prio: HIGH (TechDebt, aber nicht blocker)

### Problem
UI nutzt aktuell legacy preview geometry (polyline),
nicht coordGeom aus landFAT / sparse.

### Symptome
- TRA funktioniert (wegen buildPolylineFromTRA)
- GND musste künstlich geometry bekommen

### Aktueller Hack
- parseGND_XLSX: inject geometry.pts
- parseTRA: buildPolylineFromTRA / buildCantFromTRA

### Ziel
- UI rendert direkt coordGeom (Alignment2D)
- keine legacy preview helper mehr im Parser

### ToDo
- [ ] UI: Renderer auf coordGeom umstellen
- [ ] alignment2dEval → direkte Nutzung
- [ ] preview pipeline neu denken
- [ ] parser von preview-Logik befreien

### Remove
- [ ] buildPolylineFromTRA
- [ ] buildCantFromTRA
- [ ] GND geometry hack

### Kontext
"Funktioniert aktuell nur wegen bewusstem technischen Schulden-Move"
