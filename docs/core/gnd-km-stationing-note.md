Stationierung, km-Linie und Attribute (GND / TRA / landXML)

1. Grundprinzip

Es existieren zwei getrennte Systeme:

Innere Stationierung (s)
	•	basiert auf wahrer Kurvenlänge
	•	ist monoton und invariant
	•	gehört zur Geometrie (Alignment)

Äußere Stationierung (km)
	•	ist ein Referenzsystem
	•	wird über eine km-Linie / Referenzlinie definiert
	•	dient der netzweit konsistenten Ortsangabe

⸻

2. km-Abbildung

Die äußere Stationierung ist eine Funktion:

km = f(s)

Eigenschaften:
	•	zwischen km-Sprüngen:
	
		d(km)/ds = 1

	•	an km-Sprüngen:
	
		km_out = km_in + Δ



→ stückweise linear + diskrete Sprünge

⸻

3. km-Sprünge (einheitliches Modell)

Ein km-Sprung ist definiert durch:

{s, kmIn, kmOut}

	•	s → Position auf der Geometrie
	•	kmIn → eingehender km-Wert
	•	kmOut → ausgehender km-Wert
	•	Δ = kmOut - kmIn

Formate:

Format	Repräsentation
landXML	StaEquation
TRA	Kz=6
GND	EK


⸻

4. Überlänge / negative Sprünge

Fall:

kmOut < kmIn

→ km ist nicht monoton

Konsequenzen:
	•	km darf nicht als reine Zahl interpretiert werden
	•	Darstellung erfolgt segmentiert:
	
km 59,6+187,123



⸻

5. km-Linie vs. Gleis

Die Beziehung:
	•	km-Linie definiert:
	
		Δkm = Δs_ref

	•	andere Linien:
	
		Δkm ≠ Δs_track



→ Gleise besitzen eigene innere Stationierung, nutzen aber gemeinsame km-Referenz

⸻

6. Gradiente (Profile)

Die Gradiente kann auf zwei Domänen definiert sein:

A) auf Geometrie (s)

	profile(s)
	
B) auf km

	profile(km)

→ abhängig von Festlegung / Datenquelle

Modellanforderung:

profile.domain ∈ { "internal", "external" }


⸻

7. Cant (Überhöhung)
	•	abhängig von Krümmung
	•	Krümmung ist geometrisch definiert

→ zwingend:

cant = f(s)

→ Cant lebt immer auf innerer Stationierung

⸻

8. Architektur-Konsequenz

Ein Alignment benötigt:

alignment {
  geometry: γ(s)

  stationing: {
    events: [{ s, kmIn, kmOut }]
  }

  profile: {
    domain: "internal" | "external"
  }

  cant: {
    domain: "internal"
  }
}


⸻

9. Kernaussagen
	•	Innere Stationierung ist unangetastet und physikalisch
	•	km ist Referenzsystem mit Sprüngen
	•	km ist nicht notwendigerweise monoton
	•	Gradiente kann auf s oder km leben
	•	Cant lebt immer auf s

⸻

10. Relevanz für GND-Import
	•	EK → liefert km-Sprünge ({s, kmIn, kmOut})
	•	EL → liefert Geometrie (γ(s))
	•	EH/PH → Gradiente (Domain klären!)
	•	EU → Cant (immer s-basiert)

⸻

:::
