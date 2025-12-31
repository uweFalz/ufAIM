# Notation & Denkrahmen

Dieses Dokument definiert die **Sprache**, in der ufAIM denkt.
Sie ist bewusst einfach, explizit und dimensionsklar.

---

## 1. Normraum statt Weltkoordinaten

In ufAIM wird ein Übergangsbogen **zuerst normiert betrachtet**.

### Domain
- \( u \in [0,1] \)
- beschreibt die Position **innerhalb eines Übergangs**
- unabhängig von Länge, Radius oder Einbettung

### Image
- \( \kappa(u) \in [0,1] \)
- beschreibt den **Fortschritt der Krümmung**
- nicht die physische Krümmung selbst

Diese Trennung ist zentral.

---

## 2. Normierte Krümmung

Die normierte Krümmung ist definiert als:

\[
\kappa(u) = \frac{k(u) - k_0}{k_1 - k_0}
\]

mit:
- \( k_0 \): Startkrümmung
- \( k_1 \): Endkrümmung
- \( k(u) \): physische Krümmung

Damit gilt immer:
- \( \kappa(0) = 0 \)
- \( \kappa(1) = 1 \)

---

## 3. Ableitungen und Bedeutung

Die Ableitungen von \( \kappa(u) \) haben klare Bedeutungen:

- \( \kappa'(u) \): Änderungsrate der Krümmung  
  → Zusammenhang zu Dynamik / Komfort
- \( \kappa''(u) \): Glattheit der Änderung  
  → Ruck, technische Qualität

Diese Größen sind **dimensionslos**.
Physische Skalierung erfolgt später.

---

## 4. Klothoide als Spezialfall

Eine klassische Klothoide entspricht:

\[
\kappa(u) = u
\]

Sie ist **linear im Krümmungsraum**.

Wichtig:
> „linear“ bezieht sich hier **nicht auf die Geometrie**,
> sondern auf den Verlauf der Krümmung.

---

## 5. Warum Normierung?

- Vergleichbarkeit unterschiedlicher Übergangsbögen
- Trennung von **Form** und **Maßstab**
- Grundlage für Optimierung (z. B. SQP)
- verständliche Visualisierung im Transition Editor

Die reale Einbettung erfolgt später über:
- Länge \( L \)
- Krümmungsniveau \( k_0, k_1 \)
- Anschlussbedingungen

---

## 6. Konsequenz

In ufAIM wird:
- **nicht** zuerst gezeichnet
- sondern zuerst **gedacht**
- dann **komponiert**
- und erst zuletzt **eingebettet**

Das ist kein akademischer Luxus,
sondern Voraussetzung für robuste Werkzeuge.
