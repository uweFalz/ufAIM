# Transition Editor – Konzept & Architektur  
*(ufAIM · Normierter Baukasten für Übergangsbögen)*

## 0. Motivation
Die klassische **Klothoide** ist zwar stetig im Krümmungsbild, aber nicht glatt:  
Am Anfang und Ende springt die Krümmungsänderung.  

In der Praxis – insbesondere bei hohen Geschwindigkeiten – ist das problematisch:
- Überhöhungsrampen können nicht knicken  
- Schienen verhalten sich nicht stückweise-linear  
- Komfort, Dynamik und Regelwerke verlangen höhere Glattheit

Seit Beginn des Eisenbahnzeitalters existieren deshalb alternative Übergangsbögen  
(Ruch, Gubar, Bloss, Helmert u. a.), die glattere An- und Ausläufe erzeugen –  
meist auf Kosten größerer Entwicklungslängen.

**ufAIM verfolgt einen anderen Ansatz:**  
Nicht ein neuer Übergangsbogen, sondern ein **generischer Baukasten**,  
mit dem fast alle bekannten – und auch neue – Übergangsbogen-Typen  
systematisch beschrieben und erzeugt werden können.

---

## 1. Normierung als Schlüsselidee
Jeder Übergangsbogen wird zunächst **normiert** beschrieben:

\[
\kappa : [0,1] \rightarrow [0,1]
\]

Die reale Krümmung ergibt sich durch affine Rückskalierung:

\[
k(s) = k_A + \kappa\!\left(\frac{s}{L}\right)\cdot (k_E - k_A)
\]

Dabei sind:
- \(L\) die reale Übergangslänge  
- \(k_A\) die Anfangskrümmung  
- \(k_E\) die Endkrümmung  

Diese Größen gehören **nicht** zum Typ, sondern zur Einbettung.

➡️ **Ein Übergangsbogen-Typ ist vollständig durch seine normierte Krümmungsfunktion \(\kappa\) definiert.**

---

## 2. Stückelung: halfWave – Mitte – halfWave
Die normierte Funktion \(\kappa\) wird grundsätzlich **stückweise** aufgebaut:

- Bereich A: \(u \in [0, w_1]\) → *halfwave1*  
- Bereich B: \(u \in [w_1, w_2]\) → *affin-lineare Mitte*  
- Bereich C: \(u \in [w_2, 1]\) → *halfwave2*  

Diese Dreiteilung ist das zentrale **Berlin-Dogma**.

### Spezialfälle
- **Klothoide:** \(w_1 = 0,\; w_2 = 1\)  
- **Blossbogen:** \(w_1 = w_2 = 0.5\)  
- **Ruch / Gubar:** feste, literaturbekannte Werte für \(w_1, w_2\)

---

## 3. HalfWaves als atomare Bausteine
Ein *halfwave* ist eine normierte Funktion

\[
f : [0,1] \rightarrow [0,1]
\]

mit typischen Randbedingungen:
- \(f(0)=0,\; f(1)=1\)  
- \(f'(0)=0\) (glatter Start)  
- gewünschte Endsteigung \(f'(1)=m\)  
- optional: \(f''(1)=0\)  

### Schiefsymmetrie
Für viele Übergangsbögen gilt für den Ausgangsteil:

\[
g(u) = 1 - f(1-u)
\]

Damit ergeben sich:
- gleiche Steigung am Nahtpunkt  
- gleiche Glattheit  
- minimale Freiheitsgrade  

➡️ Viele bekannte Übergangsbögen sind **schiefsymmetrisch** aufgebaut.

---

## 4. Die Rolle der linearen Mitte
Der Mittelteil ist bewusst **affin-linear** im Krümmungsraum:

\[
\kappa(u) = m \cdot u + b
\]

mit Steigung \(m\), die exakt an die HalfWaves angepasst ist.

**Wichtig:**  
„Linear in \(\kappa\)“ entspricht einer **Klothoide im physikalischen Raum**.  
Der Mittelteil ist also kein Kompromiss, sondern der bekannte Standard –  
sauber eingebettet in glatte Ein- und Ausläufe.

---

## 5. Glattheit als explizite Entwurfsgröße
Durch die Konstruktion ergeben sich automatisch:
- \(\kappa\) stetig (C⁰)  
- \(\kappa'\) stetig (C¹), wenn die Steigungen passen  
- \(\kappa''\) stetig (C²), wenn die HalfWaves entsprechend gewählt sind  

➡️ **κ′ und κ″ sind Diagnose- und Entwurfsgrößen**, keine Nebenprodukte.

Deshalb zeigt der TransitionEditor:
- \(\kappa\) (normativ)  
- \(\kappa'\), \(\kappa''\) (diagnostisch, auto-skaliert)

---

## 6. Verallgemeinerung
HalfWaves müssen weder symmetrisch noch fest verdrahtet sein:
- polynomiale Funktionen  
- trigonometrische Funktionen  
- gemischte Ansätze  

Entscheidend sind:
- Monotonie  
- Randbedingungen  
- gewünschte Ableitungswerte  

Jede HalfWave lässt sich:
- auf \([0,1]\) normieren  
- in Länge und Bild skalieren  
- analytisch differenzieren und integrieren  

---

## 7. Übergang zum Alignment-Model
In der späteren **Alignment-Berechnung** wird exakt derselbe Weg gegangen:

1. Auswahl eines Transition-Typs aus der Bibliothek  
   *(halfwave1, halfwave2, \(w_1\), \(w_2\))*  
2. Rückskalierung auf reale Größen \(L, k_A, k_E\)  
3. Stückweise Berechnung:
   - reale Krümmungsfunktionen  
   - Integration → Richtung  
   - Integration → Lage  

➡️ **Es gibt keine Sonderfälle mehr.**  
Jeder bekannte oder neu definierte Übergangsbogen wird gleich behandelt.

---

## 8. Konsequenz für die Software-Architektur
- **TransitionEditor:** Typ-Designer (normiert)  
- **AlignmentModel:** Typ-Anwender (realweltlich)  
- **Solver (SQP / Axtran):** Einbettungs-Optimierer  

Der Editor definiert *was* ein Übergangsbogen ist.  
Der Solver entscheidet *wo* und *wie* er eingesetzt wird.

---

## 9. Ausblick: Funktionsbaukasten
Zur Umsetzung wird ein analytischer Baukasten benötigt:
- Polynom-Basisfunktionen  
- Trigonometrische Basisfunktionen  
- explizite Ableitungen & Integrale  
- normierte Wrapper  

➡️ Keine numerische Blackbox, sondern **kontrollierbare Mathematik**.

---

### Kurz gesagt
> Der TransitionEditor ist kein Gimmick.  
> Er ist die **Typdefinitionsebene** von ufAIM.
