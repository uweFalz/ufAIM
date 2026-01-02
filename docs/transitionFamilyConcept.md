# 2.3 TransitionFamily – Typisierung normierter Übergangsbögen  
*(ufAIM · Editor- und Modell-Brücke)*

## 0. Ziel von 2.3
Der TransitionEditor soll nicht „eine Kurve zeichnen“,  
sondern **Übergangsbogen-Typen definieren**, die

- normiert beschrieben sind
- austauschbar sind
- sowohl im Editor **als auch** in der späteren Alignment-Berechnung
  **identisch** verwendet werden können

Dazu wird das Konzept der **TransitionFamily** eingeführt.

---

## 1. Grundidee: TransitionFamily als formaler Typ
Eine **TransitionFamily** beschreibt *ausschließlich* die normierte Form  
eines Übergangsbogens:

\[
\kappa : [0,1] \rightarrow [0,1]
\]

ohne reale Längen, Radien oder Koordinaten.

➡️ Sie ist damit **Editor- und Solver-neutral**.

---

## 2. Minimal-Interface einer TransitionFamily
Jede TransitionFamily stellt mindestens folgende Funktionen bereit:

```ts
interface TransitionFamily {
  id: string;               // z.B. "clothoid", "bloss", "berlin"
  label: string;            // UI-Name

  kappa(u: number, p): number;     // κ(u)
  dkappa(u: number, p): number;    // κ'(u)
  d2kappa(u: number, p): number;   // κ''(u)

  defaults(): Params;       // Default-Parameter
  constraints?(p): Constraints; // optionale Abhängigkeiten / Hinweise
}
