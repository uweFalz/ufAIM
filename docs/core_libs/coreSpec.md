# MS16 – Core Spec: Alignment2D + Berlinish Transition (v0.1)

## 0. Ziel & Scope
Der Core beschreibt eine 2D-Trasse als Sequenz bogenlängenparametrisierter Kurvenstücke.
Er liefert:
- robuste Evaluation: Punkt, Tangente, Krümmung an beliebigem s
- lokale Korridor-Transformation (s,q) <-> (x,y) im Sinn eines Frenet-like Frames
- Diagnose/Validity (UV, Knick, km-sprung via outerStationing, Degenerates)
- eindeutige Geometrie über Startzustand + Länge + Krümmungsverlauf

Nicht im Scope (aber anschlussfähig):
- 1D-Profile z(s) (Gradiente)
- Cant u(s)
- Gleissystem-Offsets (mehrere Achsen/Spuren), Tunnelachsen-Spezial (zweiter Aspekt)

---

## 1. Grundbegriffe

### 1.1 Bogenlänge / Parametrisierung
- `s` ist **innere Stationierung** (innerStationing): geometrische Bogenlänge entlang der Achse.
- `s` ist innerhalb eines Elements stetig und monoton.

## 1.2 OuterStationing (km-Lauf) – präzisiert
Wichtig: „OuterStationing“ ist **kein** bloßes s→S-Mapping derselben Achse, sondern eine **Referenzierung auf eine stations-gebende Achse** (typisch: km-Linie).

Begriffe:
- **innerStationing**: bogenlängenbasierte Station `s` auf *jeder* Achse (jede Achse hat das inhärent).
- **stations-gebende Achse** (station-giving alignment): eine Achse, die „Projekt-/km-Stationen“ definiert.
  - Nur diese Achse kann **Stationierungssprünge** (km-sprünge) enthalten.
  - Auch sie selbst hat selbstverständlich `s_g` (innerStationing).

Definition:
- Die **äußere Stationierung** eines Achspunktes `P` auf einer Achse `A` ist die Station `S` des **Fußpunktes** `F` von `P` auf der stations-gebenden Achse `G`.
  - Formal: `F = foot_G(P)` (Umformung / Anrechnung auf G)
  - `S = station_G(F)` wobei `station_G` ggf. Sprünge enthält.

Konsequenz:
- OuterStationing wird im Core in zwei Aspekte getrennt:
  1) **OuterStationingRef**: Referenz *auf* eine stations-gebende Achse `G` (inkl. Projektions-/Anrechnungsregel).
  2) **StationingLaw**: die (sprunghafte) Abbildung auf `G`, also `S = phi_G(s_g)` inkl. Sprungstellen.

Minimalmodell:
- `outerStationing.refAlignmentId` (G)
- `outerStationing.footRule` (wie wird der Fußpunkt gebildet; default: orthogonale Projektion im Frenet-Frame von G)
- `outerStationing.stationingLaw` (Sprünge liegen hier, nicht “in allen Achsen”)

---

## 2. Konventionen (Sign & Koordinaten) – Ergänzung
- Tangente `t = (tx, ty)` ist normiert (aus Bogenlängenparametrisierung).
- Wesentlich: **Normiert ⇒ winkel-identisch**:
  - `t` repräsentiert die Richtung unabhängig von Einheiten/Skalierung.
  - Winkel werden intern nicht als “Grad/Gon” geführt, sondern über `t` (und optional `θ = atan2(ty, tx)` in Radiant).
  - Linksnormale `n = t⊥ = (-ty, tx)`.
- Krümmung `kappa = κ`:
  - `κ > 0` ist Linksbogen (CCW).
  - Radius (nur als Derived/Guard): `R = -1/κ` (Vorzeichenkonvention).

---

## 3. Regularität / Stetigkeit
Global gilt (Standardfall):
- `c(s)` ist C¹-stetig (Tangente stetig).
- `κ(s)` darf springen (unvermittelter Bogenwechsel, UV) ⇒ weiterhin C¹, aber nicht C².

Sonderfälle:
- **Knick**: Tangente springt (C⁰ aber nicht C¹) → eigener Elementtyp (siehe 6.2).
- **UV**: κ-sprung bei stetiger Tangente → eigener Elementtyp oder Übergang zwischen FixElementen.
- **kmJump**: betrifft ausschließlich OuterStationing (phi), nicht c(s).

---

## 4. Elementsequenz / Vertrag ("fixxieren")
Default-Vertrag (Produktionsmodus):
1. Sequenz ist alternierend: `FixElement, Transition, FixElement, Transition, ...`
2. Alignment beginnt und endet mit `FixElement`.
3. Übergänge erfüllen:
   - Endpunkt = Startpunkt nächstes Element (Positionskontinuität)
   - Tangente stetig (außer Knick-Element)

Hinweis:
- Für Import/Legacy kann der Vertrag temporär aufgeweicht sein (Validator markiert Violations).

---

## 5. Datentypen

### 5.1 State (lokaler Zustand)
`State2D`:
- `p: {x,y}`
- `t: {tx,ty}` (normiert)
- `kappa: number` (optional / falls an Stützstellen verfügbar)

### 5.2 Alignment2D (Sequenzcontainer)
`Alignment2D`:
- `elements: AlignmentElement[]`
- `outerStationing?: OuterStationingMap`

---

## 6. Elementtypen

### 6.1 FixElement (konstante Krümmung)
Parameter:
- `L: number` (arcLength)
- `kappa: number` konstant
- `start: { p, t }` (globaler Startzustand; kappa optional redundant)
Derived:
- Endzustand aus Integration.

Evaluation:
- `eval(sLocal)` liefert `{p,t,kappa}`

Spezialfälle:
- Gerade: `kappa = 0`
- Kreis: `kappa != 0`

### 6.2 SpecialTransition: Kink (Tangentenknick)
Parameter:
- `L = 0` (oder epsilon)
- `t_before`, `t_after` (oder delta heading)
- optional: "Knickpunkt" = Startpunkt = Endpunkt

Semantik:
- Positionskontinuität, Tangente sprunghaft.

### 6.3 SpecialTransition: UV (κ-sprung)
Parameter:
- `L = 0` (oder epsilon)
- `kappa_before`, `kappa_after`
- Tangente stetig.

Semantik:
- κ springt, c(s) bleibt C¹.

### 6.4 Transition (Berlinish / generisch, κ nicht konstant)
Parameter minimal:
- `L: number`
- `k0: number` (κ at start)
- `k1: number` (κ at end)
- `shape: TransitionShape` (normierter Kern)
- `vienneseCog?: { enabled: boolean, ... }` (ON/OFF; exakt zu spezifizieren)

Normierung:
- `u ∈ [0,1]`
- `κ(u) = k0 + (k1-k0)*K(u)` mit `K(0)=0`, `K(1)=1`
- optional: weitere shape-Parameter (z.B. e, m,n, roots...)

Innerhalb des Elements:
- `κ` mindestens stetig (K(u) C⁰), üblicherweise C¹.
- Ergebnis: c(s) mindestens C² innerhalb des Elements.

---

## 7. Evaluation / API ("minimal und brutal klar")

### 7.1 Element-API (Pflicht)
Für jedes Element:
- `L(): number`
- `eval(sLocal:number): Eval2D`
- `end(): Eval2D` (oder `endState()`)

`Eval2D`:
- `x,y`
- `tx,ty` (normiert)
- `kappa`

### 7.2 Alignment-API (Pflicht)
- `length(): number` (Summe L)
- `eval(s:number): Eval2D` (global s = innerStationing)
- `locate(s:number): { i, sLocal }` (Index + local)
- `evalOuter(S:number): Eval2D` (optional via phiInv)
- `toOuter(s:number): number` (phi)
- `toInner(S:number): number|null` (phiInv falls möglich)

### 7.3 Performance-Hooks (optional)
- `buildCache(stepS:number)` erzeugt Stützstellen (s->i,sLocal) + approx states
- `evalFast(s)` nutzt Cache + lokale Korrektur
- temporäre Funktionsvereinfachung: piecewise polynomial tables für K(u), Θ(u)

---

## 8. Mathematischer Kern (Integration)

### 8.1 Grundgleichungen
- `dθ/ds = κ(s)`
- `dc/ds = t(θ) = (cosθ, sinθ)`

Implementationsvarianten:
A) θ-geführt:
- θ(s) numerisch integrieren, t daraus.
B) t-direkt:
- `dt/ds = κ * t⊥` plus Renormierung.

### 8.2 Transition: Nutzung von Fresnel/Integralen – Schärfung
Für jede Transition-Shape gilt:
- `K(u)` ist als Komposition aus Polynomen und trigonometrischen Funktionen definiert.
- Damit ist `κ(u)` stets geschlossen formulierbar.
- Und entscheidend: `θ(u) = θ0 + L * ∫ κ(u) du` ist damit **immer** analytisch/halb-analytisch auswertbar (je nach Basisfunktionen; Polynom/Trig → geschlossen integrierbar).

Hinweis:
- Der “schwere Teil” ist typischerweise nicht `θ(u)`, sondern `c(s) = ∫ (cos θ, sin θ) ds`, das je nach θ(u) numerisch integriert wird
  (Clothoid als Spezialfall mit Fresnel-Integralen).
  
Vertrag:
- Core akzeptiert Radiant intern (θ).
- Optional: Rückgabe von θ via atan2(t).

---

## 9. Korridor-Transformation (s,q) <-> (x,y)

### 9.1 Vorwärts (track frame -> world)
Für gegebenes `s`:
- `p0 = c(s)`
- `t = t(s)` normiert
- `n = (-ty, tx)`
- `p(s,q) = p0 + q * n`

### 9.2 Gültigkeitsbereich (Radius-Guard)
Für eindeutige lokale Abbildung (ohne Focal/Loop-Effekte) gilt als Guard:
- `|q| < 1/|κ(s)|` am Fusspunkt (bei κ=0 unbeschränkt)
Praktisch:
- in Bahn-Korridoren typ. |q| <= 50 m; Validator kann warnen wenn Guard verletzt.

### 9.3 Rückwärts (world -> track frame)
Problem: Projektion auf Kurve.
Minimalvertrag:
- `umForm(x,y)` liefert `{s,q}` oder null, plus Diagnose.
- Implementationsstrategie:
  - initial guess via segment search (bbox / coarse sampling)
  - refine via 1D root find auf `g(s) = dot(x-c(s), t(s))` oder per Newton/Brent
  - q aus `dot(x-c(s), n(s))`

---

## 10. Validierung / Diagnostik (wasserfest)

`Diagnostics` je Elementgrenze:
- `tangentJump: boolean` (+ angleDelta)
- `kappaJump: boolean` (+ deltaKappa)
- `degenerate: boolean` (L<=eps, NaNs, etc.)

Global:
- `sequenceContractViolation` (nicht fixx/trans alternierend, startet/endet nicht fixx)
- `outerStationingJumpCount`
- `corridorGuardViolations` (|q| >= 1/|κ|)

Sonderfälle:
- Kink und UV sind eigene Elementtypen => Diagnose ist strukturell, nicht nur numerisch.

---

## 11. Berlinish Transition – nicht optional
Berlinish Transition ist **definiert** durch die 3-Teilung:
- `halfWave1 – clotho – halfWave2`

Diese Kompositionsmechanik ist nicht optional, sondern der Kern des Ansatzes.
Die konkrete Wahl der halfWave-Formen erfolgt über Lookup (k-typ + optParam).

---

## 12. Anschluss: 3D / Gradiente / Überhöhung
Separat, aber kompatibel:
- `z(s)` als 1D-Feld (piecewise linear points oder smoother)
- `cant(s)` als 1D-Feld
- 3D Punkt: `P3(s,q) = (x,y,z(s)) + ...` (Cant wirkt über lokale Querrotation)

---

## 13. Minimal JSON-Schema (nur Referenz)
Siehe nächste Iteration (wenn gewünscht als JSON).

---

# MS16 – Berlinish Transition Spec (v0.2)

## B0. Transition-Parameter (Instanz)
Jede Transition `T` ist parametrisiert durch:
- `L` (arcLength)
- `k_a` (Startkrümmung; Referenz auf κ des vorgehenden FixxElements am Anschluss)
- `k_e` (Endkrümmung; Referenz auf κ des nachfolgenden FixxElements am Anschluss)
- `A.state` (Startpunkt + Startrichtung) wird **nicht** frei gespeichert, sondern kommt aus dem Endzustand des vorherigen Elements
- `kType` (Lookup-Key, sprechender Klarname)
- `optParam` (optional, z.B. e/shapeParameter; wird vom Lookup interpretiert)

Damit ist Transition-Geometrie eindeutig über:
`(A.state, L, k_a, k_e, kType, optParam)`.

## B1. Lookup-Schichten (die „witzige“ Kaskade, aber sauber)
Es gibt drei Ebenen:

### B1.1 TransitionLookup (kType -> 3-Teilung)
`TransitionLookup[kType] = { parts: [halfWave1Def, clothoDef, halfWave2Def], ... }`

- `halfWave1Def` verweist auf einen Atom/halfWave-Typ + Parameter
- `clothoDef` ist i.d.R. “Euler” (linearer κ-Verlauf) als zentraler Anteil
- `halfWave2Def` analog zu 1, ggf. invertiert/gespiegelt

### B1.2 HalfWave/AtomTable (atomKey -> Komposition)
`AtomTable[atomKey] = { K(u): composedSimpleFunctions, constraints, ... }`

- Atoms beschreiben **normierte** Kernfunktionen auf `u∈[0,1]`
- Sie sind kompositionsfähig (Summe/Skalierung/Spiegelung/Domain-Map)

### B1.3 SimpleFunction Library (Basisterme)
SimpleFunctions sind die elementaren Bausteine:
- Polynome (inkl. Ableitungen/Integrale direkt verfügbar)
- Trigonometrische (sin/cos mit Affin-Mapping des Arguments)
- Domain-Mapping (u↦a+bu)
- Linearkombinationen & Kompositionen

Wichtig: Alle SimpleFunctions sind so gebaut, dass:
- `K(u)` evaluierbar ist
- `∫K(u) du` evaluierbar ist (⇒ θ(u) immer geschlossen auswertbar)

## B2. Normierter Aufbau der Transition (Krümmungsmodell)
Für die gesamte Transition gilt:
- `u = s/L ∈ [0,1]`
- `κ(u) = k_a + (k_e - k_a) * K_total(u)`

`K_total(u)` entsteht durch die 3-Teilung:
- `K_total` ist stückweise definiert durch die drei Parts
- Jeder Part hat sein eigenes lokales `u_i ∈ [0,1]` plus Längenanteil `λ_i` (mit Σλ_i = 1)

### B2.1 Länge-Partition
- `L1 = λ1 * L` (halfWave1)
- `L2 = λ2 * L` (clotho)
- `L3 = λ3 * L` (halfWave2)

Die λ_i kommen aus `TransitionLookup` oder aus `optParam`.

## B3. Stetigkeitsanforderungen (Berlinish)
Am Minimum:
- Position stetig (immer)
- Tangente stetig (C¹ über Elementgrenzen; Knick ist eigener Spezialtyp)

Innerhalb der Transition:
- κ ist stückweise kontinuierlich, Übergänge der Parts so definiert, dass:
  - mindestens κ-stetig an Partgrenzen (Ziel)
  - optional auch κ’-stetig (je nach Atomwahl)

## B4. Auswertung (Pflichten)
Für jeden Part muss verfügbar sein:
- `K(u)` und `I_K(u) = ∫_0^u K(v) dv`

Dann:
- `θ(u) = θ0 + L * [ k_a*u + (k_e-k_a)*I_K(u) ]`   (Radiant, geschlossen auswertbar)

Die Ortskurve:
- `c(s) = c0 + ∫_0^s (cos θ(σ), sin θ(σ)) dσ`
- Numerik:
  - Clotho-Teil: optional Fresnel-Spezialpfad
  - sonst: adaptive Quadratur (stabil, deterministisch)

## B5. Schwerpunkttrassierung (Viennese ON/OFF)
Schwerpunkt/Viennese ist **ein Schalter** auf der Krümmungsfunktion (oder deren Kernel),
nicht ein separates Transition-System.

In der Spec als:
- `vienneseCog.enabled: boolean`
- und ggf. zusätzliche Parameter (z.B. Bezugs-/Höhenbezug später)

Semantik:
- Modifiziert K(u) durch eine definierte Zusatzkomponente `ΔK(u)` (ebenfalls aus AtomTable/Lookup).

(Die genaue ΔK-Definition wird als nächster Sub-Abschnitt festgeschrieben, sobald wir die konkrete Familie auswählen.)

## B6. Datenformat (minimal)
Transition-Instanz im Sparse-Modell:
- `type: "transition"`
- `L`
- `kType`
- `optParam?`
- `k_a` wird nicht redundant gespeichert (kommt aus prev Fixx)
- `k_e` wird nicht redundant gespeichert (kommt aus next Fixx)
- Startzustand kommt aus prev Endzustand

Validator stellt sicher:
- prev/next existieren und sind Fixx (außer Import-Relax-Modus)
