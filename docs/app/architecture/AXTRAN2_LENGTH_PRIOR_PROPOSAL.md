# AXTRAN2: the length prior as a question to the user journey

A proposal, not a decision. It follows from the flat-valley finding
(`AXTRAN2_FLAT_VALLEY_FINDING.md`): the points fit cannot determine where a
transition hands over to its neighbouring arc, and `lengthPrior` on the
alignment solver - a residual (L − L₀)/(σ·L₀) per free length - turns that
valley into a bowl. Measured on the corpus, σ = 0.05 lifts the verdicts from
150 to 159 of 161 at a fifth of the iterations, rms nearer the noise floor.
The solver has the option and keeps it off. Whether the app sets it, and
with what σ, is a modelling choice the user has to own. Three ways to put it.

## A. A plan that is to be kept

The user starts from an existing or planned alignment and fits it to
measured points. Expectation: "stay as I planned unless the points say
otherwise". This is the geodetic pseudo-observation on a weakly determined
parameter, and a prior on every free length with σ from the user's own
confidence in the plan: 2 % for an as-built record, 5 % for a preliminary
design, 20 % for a sketch. The verdict then reads "fitted, kept to the plan
within σ where the points were indifferent". Bias: toward the plan, by
construction, and only in directions the points do not see.

## B. A reconstruction from measurements alone

No plan, or a plan not to be trusted. Then a prior toward L₀ is a prior
toward whatever the start happened to be, which is not a statement anyone
made. The honest verdict is the solver's `stationary` with the reason
`objective_stalled`: the fit is complete within the data's resolution, and
the report should name the directions the points did not determine - the
transitions and their neighbours - rather than present the lengths as found.
That naming is not built; the eigenvectors of J'J at the fit give it
(finding, §1), and it would be a diagnostics field, not a change to the solve.

## C. The regulation's own answer

A transition's length is not free in the rules: the ramp rule gives its
minimum (`rampLengthAs`), and the design profile a customary length per
speed. A prior toward the *rule's* length rather than the start's - or
simply the exact ramp form `"constraint"` with the prior toward its lower
bound - would say "as short as the rule allows unless the points ask for
more". That is a design objective, not a measurement statement, and it
belongs to the lexicographic layer (`AlignmentLexicographicSolver`), where
length is already the second objective after the points.

## What the app would have to ask

One question at the start of a fit, with three answers - keep my plan (and
how sure am I: 2 / 5 / 20 %), measurements only, or rules where the
measurements are silent - and one sentence in the result that says which
was chosen and what it did. Everything else is already in the solver:
`lengthPrior` for A, the stalled verdict for B, the lexicographic solver
for C.

Recommendation: A as the default for the app's main journey (the user
arrives with an alignment), σ = 5 % shown and editable; B as the explicit
alternative; C later, with the lexicographic solver, once the exact ramp
form is the default there.
