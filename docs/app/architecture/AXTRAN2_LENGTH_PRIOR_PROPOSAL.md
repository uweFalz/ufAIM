# AXTRAN2: the length prior as a question to the user journey

**Decided 2026-09-09 (Uwe Falz): A.** The app's main journey keeps the plan,
`lengthPrior` with σ = 5 % shown and editable (2 % for an as-built record,
20 % for a sketch); B stays the explicit alternative; C waits for the
lexicographic layer. The implementation in the app is a Delivery 1 task of
its own; the solver side is complete. The text below is the proposal as it
was put, with two paragraphs brought up to date.

It follows from the flat-valley finding
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
made. There is no verdict for this case - a stall verdict was tried and
rejected (finding, §3) - but there is the report: `diagnostics.determinacy`
(#30) names the directions the points did not determine, each with its
play, the transitions and their neighbours among them. The result should
show that list beside the lengths, and say that on forty and more elements
the solve runs to its budget without a verdict.

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
`lengthPrior` for A, `diagnostics.determinacy` for B, the lexicographic
solver for C.

Recommendation: A as the default for the app's main journey (the user
arrives with an alignment), σ = 5 % shown and editable; B as the explicit
alternative; C later, with the lexicographic solver, once the exact ramp
form is the default there.
