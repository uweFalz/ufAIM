🧭 ufAIM – Release 1 Roadmap

Zielbild (R1)

Ein Tool, in dem der Nutzer:
	•	Daten importiert (TRA/GRA/GND/…)
	•	diese im Cockpit (Ex-Grabbeltisch) organisiert
	•	eine stabile Alignment-Darstellung sieht
	•	einfache Transitions bearbeiten kann
	•	erste Solver-Ergebnisse bekommt
	•	und das Ganze CRS-konsistent ist

⸻

🧱 PHASE 1 — Kern stabilisieren

👉 „Alles steht auf diesem Fundament“

Inhalte
	•	Import → landFAT → sparse → SpotCandidate
	•	validateLandFAT + validateSparse sauber
	•	kein Doppelpfad mehr (geometry vs sparse vs preview)
	•	buildImportArtifacts auf sparse-only
	•	direction / semanticMap sauber (kein Rechnen im Parser)

Ergebnis
	•	jede Alignment-Kette ist:
	•	nachvollziehbar
	•	validiert
	•	preview-bar

Dauer

👉 2–4 Wochen

Risiko
	•	Altlasten halb behalten → Chaos bleibt

⸻

🧱 PHASE 2 — SPOT + Cockpit

👉 „User bekommt Kontrolle“

Inhalte
	•	WorkingSet vs SPOT sauber trennen
	•	SpotCandidate → Promote/Ignore/Relate
	•	CockpitController einziehen
	•	WindowSession ↔ SPOT ↔ Cockpit synchronisieren
	•	Grouping / Slots stabilisieren

Ergebnis
	•	User kann:
	•	importierte Daten strukturieren
	•	Entscheidungen treffen
	•	mehrere Alignments kontrollieren

Dauer

👉 2–4 Wochen

Risiko
	•	Cockpit nur UI → keine echte Steuerung

⸻

🧱 PHASE 3 — Projection sauber

👉 „ein Weg zur Darstellung“

Inhalte
	•	ViewProjectionController wirklich nutzen
	•	AlignmentProjectionService:
	•	sparse → polyline
	•	Marker / Stationierung
	•	buildImportArtifacts → nur Adapter, kein Logikmonster
	•	RepresentationCache stabil

Ergebnis
	•	alle Views sehen die gleiche Wahrheit
	•	kein Sonderpfad mehr für Preview

Dauer

👉 2–3 Wochen

Risiko
	•	Preview-Hacks bleiben → Inkonsistenz

⸻

🧱 PHASE 4 — CRS + mapLibre (MVP)

👉 „Koordinaten stimmen endlich“

Inhalte
	•	einfacher CoordinateAgent:
	•	WGS84 ↔ Engineering (UTM/GK/DBRef minimal)
	•	mapLibre:
	•	Karte anzeigen
	•	Alignment-Overlay
	•	klare Trennung:
	•	Engineering CRS vs View CRS

Ergebnis
	•	Alignment liegt korrekt auf Karte
	•	Transformation nachvollziehbar

Dauer

👉 3–5 Wochen

Risiko
	•	zu früh „perfektes CRS“ → Zeitfresser

⸻

🧱 PHASE 5 — Transition Editor enhanced

👉 „mathematische Stärke sichtbar machen“

Inhalte
	•	KappaFcnBuilder sauber integriert
	•	RegistryResolver stabil
	•	Editor kann:
	•	Kurven anzeigen
	•	Parameter ändern
	•	Ergebnis zurückgeben
	•	Verbindung:
	•	Editor → sparseAlignment

Ergebnis
	•	echter Mehrwert gegenüber Standard-Tools

Dauer

👉 3–5 Wochen

Risiko
	•	zu viel Feature-Tiefe → verzetteln

⸻

🧱 PHASE 6 — Solver MVP

👉 „erste Intelligenz im System“

Inhalte
	•	einfacher Solver:
	•	Input: sparseAlignment
	•	Output: neue Kandidaten
	•	Integration:
	•	WorkingSet (nicht direkt SPOT!)
	•	Cockpit:
	•	„Solver-Vorschläge annehmen“

Ergebnis
	•	Solver ist nutzbar, nicht perfekt

Dauer

👉 4–6 Wochen

Risiko
	•	zu ambitionierter Solver → Blockade

⸻

🧱 PHASE 7 — UX + Integration

👉 „fühlt sich wie ein Tool an“

Inhalte
	•	Cockpit + Views flüssig
	•	MultiView sinnvoll gekoppelt
	•	einfache Workflows:
	•	Import → Sort → Preview → Edit → Accept
	•	Debug raus / UX rein

Ergebnis
	•	Demo-fähig
	•	erste externe Nutzer möglich

Dauer

👉 2–4 Wochen

⸻

🎯 Kritischer Pfad

Das hier entscheidet alles:

Import → sparse → SPOT → Projection → View

Wenn dieser Pfad 100 % sauber ist:

👉 Alles andere wird einfacher

Wenn nicht:

👉 Alles wird langsam und fehleranfällig

⸻

🔥 Wichtigste Priorisierung

Wenn du morgen weitermachst:

NICHT:
	•	mapLibre zuerst
	•	Solver zuerst
	•	fancy UI

SONDERN:

👉 Phase 1 + 2 vollständig sauber machen
