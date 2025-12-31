# Transition Editor

Der Transition Editor ist ein **Werkzeug zum Denken**,
nicht zum Zeichnen.

Er betrachtet **einen einzelnen Übergangsbogen**
in seinem **normierten Kern**.

---

## 1. Was der Transition Editor ist

- ein 2D-Plot von Funktionen im Raum \([0,1] \times [0,1]\)
- eine Werkbank für Übergangsbogen-Familien
- ein Experimentierraum für Form, nicht für Maßstab

Der Editor zeigt:
- \( \kappa(u) \) — normierter Krümmungsfortschritt
- Teilbereiche \([0,w_1]\), \([w_1,w_2]\), \([w_2,1]\)
- optional Ableitungen \( \kappa'(u) \), \( \kappa''(u) \)

---

## 2. Was der Transition Editor nicht ist

- kein CAD-Tool
- kein Ersatz für Trassierungssoftware
- kein Automat für korrekte Lösungen

Der Editor **entscheidet nichts**.
Er macht Entscheidungen **sichtbar**.

---

## 3. Trennung von Rollen

### Transition Editor
- arbeitet ausschließlich im Normraum
- kennt keine Meter, Radien oder Koordinaten
- erzeugt **Formfamilien**

### Viewer / Achsband
- zeigen eingebettete Geometrie
- dienen dem Lesen und Verstehen bestehender Trassen

### Optimierung (z. B. SQP)
- verbindet Formfamilie mit realer Geometrie
- erfüllt Anschluss- und Nebenbedingungen

Diese Trennung ist bewusst und notwendig.

---

## 4. Typische Anwendung

1. Gerade und Bogen gelten als **fest**
2. Eine Übergangsfamilie wird im Editor definiert
3. Unterschiede zwischen Klothoide, Bloss, Berlin-Varianten werden sichtbar
4. Erst danach wird die Einbettung gelöst

Der Editor ist damit ein **Vorschaltwerkzeug**.

---

## 5. Didaktische Rolle

Der Transition Editor ist auch ein Lerninstrument:

- macht implizites Wissen explizit
- zeigt Auswirkungen von Parametern unmittelbar
- zwingt zur klaren Begriffsverwendung

Er richtet sich explizit auch an:
- Studierende
- Quereinsteiger
- Ingenieure mit viel Praxis, aber wenig Zeit für Theorie

---

## 6. Status

Der Transition Editor ist **experimentell**.

Er wächst schrittweise:
- zuerst als normierter Funktionseditor
- später mit Diagnosen (Ableitungen, Grenzwerte)
- erst sehr spät mit automatischer Einbettung

Diese Reihenfolge ist Absicht.
