##Sparse Alignment

The sparse alignment model is the core geometric and mathematical
representation used by ufAIM.

It defines an alignment as a deterministic, parametrized curve
with explicit continuity constraints and engineering semantics.

Sparse alignments are designed to be:
	•	analyzable
	•	optimizable
	•	auditable
	•	independent of visualization concerns

⸻

Begriffsklärung (Deutsch)

Das Sparse Alignment ist die zentrale geometrische und mathematische
Repräsentation in ufAIM.

Es beschreibt eine Achse als deterministische, parametrisierte Kurve
mit expliziten Kontinuitätsbedingungen und klarer ingenieurtechnischer Semantik.

Sparse Alignments sind bewusst:
	•	analysierbar
	•	optimierbar
	•	prüfbar
	•	unabhängig von Darstellungsfragen

⸻

Mathematical Model

A sparse alignment represents a two-dimensional curve

\gamma : s \in [0, L] \rightarrow \mathbb{R}^2

parametrized by arc length s.

The curve is defined indirectly through its curvature function \kappa(s)
and an initial pose (x_0, y_0, cos \theta_0, sin \theta_0).

Position and direction are obtained by integration:

\theta(s) = \theta_0 + \int_0^s \kappa(\sigma)\, d\sigma

(x(s), y(s)) =
(x_0, y_0) +
\int_0^s (\cos\theta(\sigma), \sin\theta(\sigma))\, d\sigma

⸻

Diskrete Repräsentation

In der Praxis wird \kappa(s) nicht als geschlossene Funktion gespeichert,
sondern durch eine endliche Sequenz parametrisierter Elemente beschrieben.

Diese diskrete Struktur bildet das Sparse Alignment.

⸻

Structural Definition

A sparse alignment consists of an alternating sequence of elements:
	1.	fixed elements (fixElem)
	2.	transition elements (transElem)

The sequence always:
	•	starts with a fixed element
	•	ends with a fixed element
	•	alternates strictly between fixed and transition elements

⸻

Fix Elements

A fixed element represents a segment with constant curvature.

Types:
	•	straight line: K = 0
	•	circular arc: K = const \neq 0

Parameters:
	•	arc length L
	•	curvature K

A fixed element contributes a constant segment to the curvature function.

⸻

Transition Elements

A transition element represents a segment with variable curvature.

Instead of defining curvature analytically,
transition elements reference a transition type
that defines how curvature evolves over arc length.

Parameters:
	•	arc length L
	•	type identifier
	•	type-specific parameters

⸻

Continuity Constraints

At all element boundaries, the following continuity conditions are enforced:
	•	positional continuity (C⁰)
	•	directional continuity (C¹)
	•	curvature continuity (C²)

These constraints are mandatory and invariant.

Sparse alignments that violate these constraints are considered invalid.

⸻

Transition Families

Transition families define curvature evolution patterns
independent of absolute scale.

They are evaluated in normalized space and scaled to element length.

This separation allows:
	•	reuse of transition logic
	•	uniform editing
	•	solver-friendly parametrization

⸻

Reference Family: Berlin 3pcs Schema

The reference transition family used in ufAIM
is a three-piece Berlin-style schema consisting of:
	1.	half-wave entry segment
	2.	clothoid core segment
	3.	half-wave exit segment

The family ensures:
	•	smooth curvature entry and exit
	•	bounded curvature derivatives
	•	compatibility with real-world railway design practice

⸻

Sampling and Evaluation

Sparse alignments are evaluated through sampling.

Core evaluation functions include:
	•	pose evaluation (x(s), y(s), \theta(s))
	•	curvature evaluation \kappa(s)
	•	derivative evaluation (optional)

Sampling resolution is an evaluation concern,
not part of the alignment definition.

⸻

Relation to Multiband Representations

Sparse alignments form the geometric backbone
for all multiband representations.

Derived bands include:
	•	curvature k(s)
	•	gradient i(s)
	•	cant u(s)
	•	speed and comfort metrics

All derived bands reference the same arc-length parameter s.

⸻

Extension to 3D and Beyond

By combining sparse alignments with vertical profiles and cant functions,
the curve naturally extends to:

\gamma : s \rightarrow \mathbb{R}^3

Additional parameterizations (e.g. time-based evaluation)
lead to higher-dimensional representations.

The sparse alignment remains the geometric reference axis.

⸻

Solver Compatibility

Sparse alignments are explicitly designed for optimization.

Typical solver variables include:
	•	element lengths
	•	curvatures of fixed elements
	•	parameters of transition families

Constraints naturally encode:
	•	continuity conditions
	•	minimum radius
	•	maximum curvature change
	•	boundary conditions

This structure allows gradient-based and constrained solvers
to operate directly on engineering-meaningful parameters.

⸻

Non-Goals

Sparse alignment deliberately does not attempt to:
	•	encode visualization details
	•	represent mesh geometry
	•	store imported raw data
	•	replace external CAD/BIM authoring tools

Its scope is strictly the deterministic representation
of alignment geometry and semantics.

⸻

Summary

The sparse alignment model provides a minimal yet complete
foundation for alignment engineering.

By combining explicit parametrization,
strict continuity constraints,
and transition families,
it enables robust analysis, visualization, and optimization
without sacrificing engineering intent.

⸻

# Ergänzung 15.02.2026

# ufAIM sparse (alignment2D) – v0.1

## Ziel
Kleines, internes Austauschformat für Alignment2D:
- Elemente sind bogenlängen-parametrisiert (arcLength)
- Jedes Element ist einzeln nutzbar (hat poseA)
- Transition-Krümmungsgrenzen werden NICHT im Transition gespeichert, sondern aus Nachbar-Fixed übernommen
- Alternation: ... fixed – transition – fixed ... (Transition steht nie allein)

## Grundtypen

### Pose2D
- point: { x:number, y:number }
- dir:   { x:number, y:number }  // Einheitsvektor (cos, sin), mathematisches Backend (kein Grad/Gon)

### Element (Base)
Pflicht:
- type: "fixed" | "transition"
- arcLength: number  // >= 0
- poseA: Pose2D

Optional:
- meta: object

### FixedElement (type="fixed")
Pflicht:
- curvature: number  // 1/m, auch bei arcLength==0 (curvatureHolder)

Optional:
- deltaDir: number   // rad, nur falls "Kink" (arcLength==0) als Element geführt wird

### TransitionElement (type="transition")
Pflicht:
- transType: string  // name_of_normalizedChangeFcn (transDB key)

Nicht enthalten:
- curvatureA/curvatureE  // kommen aus Nachbar-Fixed

## Konventionen / Invarianten
- arcLength==0 ist zulässig:
  - fixed: curvatureHolder oder Kink (wenn deltaDir gesetzt)
  - transition: Immediate (Factory normalisiert)
- Factory darf fehlende curvatureHolder vor/nach Transition ergänzen (L=0)
- Richtung in Radiant wird NICHT gespeichert; dir-Vektor ist primär
