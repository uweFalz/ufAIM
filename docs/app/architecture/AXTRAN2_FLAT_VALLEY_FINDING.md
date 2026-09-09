# AXTRAN2: the flat valley of the points fit

Finding from the scaling work on the TRA corpus (PRs #23–#25 and this
branch). It explains why a points fit on forty and more elements reaches the
noise floor and then walks for thousands of iterations without a verdict,
and what can be done about it, and by whom.

## 1. What was measured

On `Landshut/5500R074-082` (41 elements, 46 free quantities, 123 points) and
`posN/3250_4-11_S` (64 elements, 82, 144) the fit with an eager start and the
Gauss-Newton curvature (#24) reaches rms 0.12–0.13 in tolerance units (noise
floor 0.154) within a hundred full steps, the end pose to 1e-6, and then:

- the objective falls by 1e-7 to 1e-5 of itself per step, every step full,
  no backtracking, for two thousand steps;
- the KKT residual oscillates between 0.05 and 1 (64 elements) and 1 and 30
  (71) instead of falling below 1e-4 of the gradient scale;
- the model's predicted decrease is 3e-4 a step where the objective gives
  1e-8: the curvature along the step is underestimated by four orders.

The spectrum of J'J at the fit, J the residual Jacobian in the solver's
scaled coordinates (script in the session's scratchpad, reproducible from
`analyticJacobian.lateralDerivative`):

| file | λmax | eigenvalues below 1e-6 · λmax | below 1e-10 | exactly zero |
|---|---|---|---|---|
| 5500R074-082, 46 unknowns | 2.6e10 | 38 | 32 | 1 |
| 3250_4-11_S, 82 unknowns | 3.0e10 | 68 | 57 | 4–5 |

The eigenvectors of the smallest eigenvalues, by element (a = arc, t =
transition, s = straight, number = length in metres):

- λ = 0: `E40:s1796m.length` alone. The last element is a straight; extending
  it moves no point laterally. Only the end pose - an equality - holds it.
- λ = 4e-13: `E32:a57.length −0.64, E33:t40.length +0.46, E35:t80.length
  +0.32, E34:a35.length −0.30` - length traded between a transition and its
  neighbouring arcs.
- λ = 6e-14, 1e-12, 6e-12, 3e-11: the same pattern on other
  arc–transition–arc runs (`E7 t38 / E6 a57`, `E18 t32 / E17 a60`, `E19 a42 /
  E20 t50`).

So the valley is physics, not a solver defect: **the length of a transition,
and where it hands over to its neighbouring arc, is weakly determined by
lateral offsets.** Shifting that boundary by a metre moves the residuals by
millimetres. The literature on alignment reconstruction knows this; the
corpus just makes it measurable.

## 2. What the solver can do about it

Three things were tried on this branch, all measured on the corpus 0–161
(points objective, `bound`, eager start) and the giants:

| variant | verdicts / 161 | converged | mean iterations | mean rms | mean distance to truth |
|---|---|---|---|---|---|
| BFGS (default) | 150 | 77 | 23.8 | 0.131 | 14 % |
| Gauss-Newton + Fletcher-Xu hybrid | 154 | 89 | 13.8 | 0.130 | 22 % |
| … + length prior σ = 0.05 | **159** | **119** | **5.4** | 0.143 | **9 %** |
| … + length prior σ = 0.2 | 157 | 107 | 6.6 | 0.149 | 7 % |

- **Fletcher-Xu hybrid** (`hybridSwitch`, default 0.02): Gauss-Newton while a
  step takes at least 2 % of the objective, BFGS on the current matrix
  otherwise. It halves the KKT residual's tail on the giants and adds four
  corpus verdicts. It does not end the valley: the curvature BFGS learns there
  is the residuals' own, small and noisy.
- **The full structured secant** (Dennis-Gay-Welsch, B estimating what J'J
  leaves out of the objective as well as the constraints) was worse: KKT 25
  instead of 2 on 64 elements. Rejected.
- **A weak length prior** (`lengthPrior: { sigma, elements? }`): a residual
  (L − L₀)/(σ L₀) per free length, the pseudo-observation a geodetic
  adjustment carries on a weakly determined parameter. It turns the valley
  into a bowl. With σ = 0.05 every giant reaches a verdict (64 elements in 13
  iterations, 71 in 76, 110 and 119 within 200) and the corpus gains nine
  verdicts, at an rms nearer the noise floor - less overfitting - and a
  smaller distance to the truth. A prior on the transitions alone is not
  enough (64 elements: stationary at 297); the arcs beside them share the
  valley.

## 3. What is a decision, and whose

The prior says what the points cannot. With it, the fit prefers the start's
lengths where the points are indifferent; that is a bias toward the plan,
and it is what a planner adjusting an existing alignment usually wants -
"stay as you are unless the measurements say otherwise". It is not what a
reconstruction from measurements alone should assume. Hence: an option, off
by default, and for the app a question to the user journey, not to the
solver. The scenario's start is the truth disturbed by 3 %, so on the corpus
the prior also pulls toward the truth; the 9 % against 22 % above is partly
that.

Without a prior the honest verdict on a giant is: rms at the noise floor,
end pose met, gradient not resolvable - the fit is done and the problem is
ill-determined in the directions listed above. The solver does not say that
yet; it says `max_iterations`.

A least-squares stall verdict was tried for this (2026-09-09): feasible,
full uncut steps, the objective changing by no more than 1e-6 of itself for
five steps in a row. On the corpus it gained two verdicts per objective and
lost nothing measurable. On the giants it never fired - the objective still
falls by 6e-5 of itself a step at iteration 400, and the end pose hovers at
8e-6 against a relative tolerance of 3e-6 - and in the ladder and
lexicographic tests it fired too early, on tiers that were slow rather than
finished. Slow progress and a stall are not told apart by the objective's
change alone, and that is exactly the giants' state. Rejected. What would
tell them apart is the residual's sensitivity along the null directions of
J'J - the eigenvectors above - reported as a diagnostic: "these lengths the
points do not determine". That is a diagnostics feature, not a verdict rule,
and it is the remaining open item here.

## 4. Scenario corrections made on the way

- The corpus start's length perturbation sums to zero over the free lengths,
  so the start is as long as the truth; the points keep clear of the ends only
  as far as the start's end falls short of the truth's along its tangent (the
  curvature perturbation still leaves it 13 m short on 11 km), and never less
  than half a spacing, instead of 3 % of the length. Whole elements had lain
  in the margin, seen by no point: five exact zero eigenvalues where there is
  now one.
- Only the double slip `Abzw-li_DKW503` still starts blocked on its floor for
  the restoration regression; the two Büchen turnouts start near enough to
  solve without a verdict.
