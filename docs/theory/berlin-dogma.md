# Berlin-Dogma — Übergangsbögen als Komposition

Dieses Dokument beschreibt das sogenannte **Berlin-Dogma**:
einen kompositorischen Ansatz für Übergangsbögen,
der fast alle bekannten Formen der Literatur umfasst.

Der Ansatz ist **kein neuer Kurventyp**,
sondern ein **Strukturprinzip**.

---

## 1. Grundidee

Ein Übergangsbogen wird nicht als monolithische Kurve verstanden,
sondern als **Zusammensetzung von Teilfunktionen** im normierten Raum.

Im Krümmungsraum bedeutet das:

\[
\kappa(u) =
\begin{cases}
\kappa_1(u) & u \in [0, w_1] \\
\kappa_\text{mid}(u) & u \in [w_1, w_2] \\
\kappa_2(u) & u \in [w_2, 1]
\end{cases}
\]

mit:
- \( u \in [0,1] \) normierte Längskoordinate
- \( \kappa(u) \in [0,1] \) normierter Krümmungsfortschritt

---

## 2. Bedeutung der Teilbereiche

### Einlaufbereich \([0, w_1]\)
- sogenannte **halfWave₁**
- Ziel: sanfter Beginn der Krümmungsänderung
- typische Forderung:
  - \( \kappa'(0) = 0 \)
- verschiedene Familien möglich (z. B. Bloss-, Helmert-, Cosinus-Halbwellen)

### Mittelbereich \([w_1, w_2]\)
- **linearer Krümmungsverlauf**
- entspricht der klassischen **Klothoide**
- hier findet der „eigentliche“ Übergang statt

### Auslaufbereich \([w_2, 1]\)
- **halfWave₂**
- Ziel: sanftes Abklingen der Krümmungsänderung
- typische Forderung:
  - \( \kappa'(1) = 0 \)

---

## 3. Rand- und Stetigkeitsbedingungen

Unabhängig von der konkreten Wahl der Teilfunktionen gilt:

- \( \kappa(0) = 0 \)
- \( \kappa(1) = 1 \)

Je nach Anspruch zusätzlich:
- \( C^1 \)-Stetigkeit: keine Sprünge der Krümmung
- \( C^2 \)-Stetigkeit: keine Sprünge der Krümmungsänderung

Das Berlin-Dogma zwingt diese Bedingungen **strukturell**,
nicht durch nachträgliches „Glätten“.

---

## 4. Bekannte Übergangsbögen als Spezialfälle

| Übergangsbogen | \(w_1\) | \(w_2\) | Beschreibung |
|---------------|--------|--------|--------------|
| Klothoide | 0 | 1 | reiner linearer Verlauf |
| Bloss | 0.5 | 0.5 | nur Halbwellen, kein Mittelteil |
| Ruch (1903) | fest | fest | Helmert–Klothoid–Helmert |
| Gubar (1990) | fest | fest | Cosinus–Klothoid–Cosinus |

Der wesentliche Unterschied:
> In der Literatur sind die Verhältnisse **fest verdrahtet**.  
> Im Berlin-Dogma sind sie **Parameter**.

---

## 5. Warum dieser Ansatz mächtig ist

- Vereinheitlicht scheinbar unterschiedliche Kurvenfamilien
- Erlaubt neue, bislang nicht beschriebene Übergangsbögen
- Trennt **Formdefinition** von **Einbettung**
- Ist ideal für Optimierungsverfahren (z. B. SQP)

Das Berlin-Dogma ist damit kein Rezept,
sondern ein **Suchraum**.

---

## 6. Rolle im ufAIM

In ufAIM ist das Berlin-Dogma:
- die konzeptionelle Basis des Transition Editors
- die Sprache zwischen Ingenieur und Optimierer
- der Ort, an dem Wissen explizit wird

Die konkrete Einbettung zwischen Gerade und Bogen
ist **nicht Teil** dieses Dokuments,
sondern Aufgabe der Optimierung.
