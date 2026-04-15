# Sparse Alignment

The sparse alignment model is the core geometric and mathematical
representation used by ufAIM.

It defines an alignment as a deterministic, parametrized curve
with explicit continuity constraints and engineering semantics.

Sparse alignments are designed to be:
- analyzable
- optimizable
- auditable
- independent of visualization and storage concerns

---

## Begriffsklärung (Deutsch)

Das Sparse Alignment ist die zentrale geometrische und mathematische
Repräsentation in ufAIM.

Es beschreibt eine Achse als deterministische, parametrisierte Kurve
mit expliziten Kontinuitätsbedingungen und klarer ingenieurtechnischer Semantik.

Sparse Alignments sind bewusst:
- analysierbar
- optimierbar
- prüfbar
- unabhängig von Darstellungs- und Importfragen

---

# Role in System Architecture

Sparse alignments are part of the **geometry layer** of ufAIM.

They are:
- stored as payload of alignment-related SPOT objects
- derived from alignment interpretations
- independent of import formats such as landFAT
- independent of SPOT relations and topology

Important:

A sparse alignment represents **only horizontal geometry**.

Additional datasets such as:
- vertical profile (`profile`)
- cant (`cant`)
- stationing (`staEq`)

are **not part of the sparse alignment itself**.

They are combined with sparse geometry in higher-level representations.

---

# Mathematical Model

A sparse alignment represents a two-dimensional curve

\[
\gamma : s \in [0, L] \rightarrow \mathbb{R}^2
\]

parametrized by arc length \( s \).

The curve is defined via its curvature function \( \kappa(s) \)
and an initial pose:

\[
(x_0, y_0, \cos\theta_0, \sin\theta_0)
\]

---

## Integration

\[
\theta(s) = \theta_0 + \int_0^s \kappa(\sigma)\, d\sigma
\]

\[
(x(s), y(s)) =
(x_0, y_0) +
\int_0^s (\cos\theta(\sigma), \sin\theta(\sigma))\, d\sigma
\]

---

# Discrete Representation

In practice, the curvature function is not stored analytically,
but represented by a finite sequence of parametric elements.

This sequence defines the sparse alignment.

---

# Structural Definition

A sparse alignment consists of an alternating sequence of elements:

1. fixed elements (`fixElem`)
2. transition elements (`transElem`)

Rules:
- sequence starts with a fixed element
- sequence ends with a fixed element
- strict alternation is enforced

---

# Elements

## Base Element

```js
Element {
  type: "fixed" | "transition",
  arcLength: number,
  poseA: Pose2D,
  meta?: object
}


⸻

Pose2D

Pose2D = {
  point: { x, y },
  dir:   { x, y }   // unit vector (cos, sin)
}

Notes:
	•	no angles stored explicitly
	•	direction is primary representation
	•	avoids ambiguity (deg / rad / gon)

⸻

Fixed Element

Represents constant curvature.

{
  type: "fixed",
  arcLength: number,
  poseA: Pose2D,
  curvature: number
}

Types:
	•	straight line → curvature = 0
	•	circular arc → curvature = const ≠ 0

⸻

Special Case: Zero-Length Fixed

arcLength == 0

Used as:
	•	curvature holder
	•	boundary condition carrier
	•	kink (if deltaDir is provided)

⸻

Transition Element

Represents variable curvature.

{
  type: "transition",
  arcLength: number,
  poseA: Pose2D,
  transType: string
}

Important:
	•	does NOT store curvature explicitly
	•	curvature is defined via transition family
	•	curvature boundaries are derived from neighbouring fixed elements

⸻

Continuity Constraints

At all element boundaries:
	•	C⁰: positional continuity
	•	C¹: directional continuity
	•	C²: curvature continuity

These constraints are:
	•	mandatory
	•	invariant
	•	not optional

Invalid alignments must be rejected or normalized.

⸻

Transition Families

Transition families define curvature evolution patterns
independent of absolute scale.

Evaluation is performed in normalized space and scaled to arc length.

Benefits:
	•	reusable transition definitions
	•	consistent editing
	•	solver-friendly parametrization

⸻

Reference Family: Berlin 3pcs

The reference transition family consists of:
	1.	half-wave entry
	2.	clothoid core
	3.	half-wave exit

Properties:
	•	smooth curvature entry/exit
	•	bounded curvature derivatives
	•	engineering compatibility

⸻

Evaluation

Sparse alignments are evaluated via sampling.

Core evaluations:
	•	position: ( x(s), y(s) )
	•	direction: ( \theta(s) )
	•	curvature: ( \kappa(s) )

Sampling resolution is:
	•	NOT part of the model
	•	purely an evaluation concern

⸻

Relation to Multiband Representations

Sparse alignment is the geometric backbone for all bands:
	•	curvature ( k(s) )
	•	gradient ( i(s) )
	•	cant ( u(s) )
	•	derived metrics

All bands share the same parameter:

[
s
]

⸻

Extension to 3D

Sparse alignment defines only the horizontal geometry.

3D curves are constructed by combining:
	•	sparse alignment (XY)
	•	vertical profile (Z)
	•	cant (rotation / cross section)

Result:

[
\gamma : s \rightarrow \mathbb{R}^3
]

This composition occurs outside the sparse model.

⸻

Solver Compatibility

Sparse alignments are explicitly designed for optimization.

Typical variables:
	•	arc lengths
	•	curvatures (fixed elements)
	•	transition parameters

Constraints:
	•	continuity
	•	curvature limits
	•	design rules

Supports:
	•	gradient-based solvers
	•	constrained optimization
	•	engineering parameter tuning

⸻

Non-Goals

Sparse alignment deliberately does NOT:
	•	store raw import data
	•	encode visualization details
	•	represent meshes
	•	manage CRS transformations
	•	define relations between datasets

⸻

Summary

Sparse alignment is a minimal, deterministic representation
of horizontal alignment geometry.

It provides:
	•	a mathematically rigorous backbone
	•	a solver-friendly structure
	•	a stable reference for all derived representations

It is not a data container, but a geometric kernel.
