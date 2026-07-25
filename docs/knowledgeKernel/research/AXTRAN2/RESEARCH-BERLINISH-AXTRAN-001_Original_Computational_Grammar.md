# RESEARCH-BERLINISH-AXTRAN-001 — Original Computational Grammar

Status: complete research reconstruction; non-canonical. Evidence was inspected on branch `main` at baseline `c5d2763e8d6a891d6324c8ee9376970ddb1e5113`. The working tree already contained unrelated and overlapping changes; those files were read only. Tags used below are **Observed**, **Reconstruction**, **Inference**, and **Recommendation**.

## Executive answer

**Reconstruction — Berlinish.** Berlinish is the generalized functional grammar in which a normalized transition curvature law is composed as

\[
T=H_{in}+C+H_{out},\qquad (\lambda_1,\lambda_c,\lambda_2)\ge0,
\qquad \lambda_1+\lambda_c+\lambda_2=1.
\]

The outer components are halfwaves and the middle component is a linear-curvature (clothoid) core. Either outer component or the core may have zero length. Different entering and exiting halfwave families are permitted. This is called the “Berlin-Dogma” directly in `_legacy/ufAIM2/heritage/ufTrassePro.ltx:2734-2740`; Ruch and Gubar are motivating examples.

**Reconstruction — halfwave.** A halfwave is a normalized, bounded transition component derived from a prototype expressed at the κ, κ′, κ″, or integral-of-κ level. The historical note requires the entering halfwave to start at a vertex or inflection with zero first derivative and rise continuously to its end. The exiting component is obtainable by reversal, translation, and rotation; current code implements the normalized reversal as `1-f(1-u)`. A halfwave is therefore not a complete alignment element and not simply half of every named curve.

**Reconstruction — axtranNew.** axtranNew was intended as the computational alignment core that turns the grammar, boundary conditions, constraints, and declared degrees of freedom into connected candidate alignment elements. Its intended operations include parameter and length solution, element coupling, transition selection, curvature/cant coordination, alternative comparison, optimization, and realization as editable structure. No surviving source file named `axtranNew` was found. The strongest surviving specification is the heritage/thesis lineage plus current AXTRAN calculation code; therefore individual operations below are classified by evidence strength rather than attributed to a missing executable.

**Conclusion.** The model **survives with reformulation**. The five-level registry preserves the curvature-function grammar and many families, while the current evaluator narrows it to normalized curvature profiles with a fixed clothoid core, heuristic anchors, runtime-only partition editing, no cant grammar, and only a bounded line–transition–arc optimization problem.

## Evidence inventory

### Primary implementation and data

- `src/domain/transition/transitionLookup.json` — schema v3 registry.
- `src/domain/transition/registry/RegistryResolver.js` — transition → halfwave → prototype resolution; hard-wired `clothoCore`.
- `src/domain/transition/build/KappaFcnBuilder.js` — source-order conversion, symbolic derivatives/integrals, normalization, reversal, piecewise composition.
- `src/domain/transition/registry/ast/{buildProtoAst,evalAst,symDiff,symInt,simplify}.js` — executable expression grammar.
- `src/domain/transition/registry/validator.js` — structural/ref validation.
- `src/domain/transition/registry/compose/{computeAnchorsFromTotal,solvePartitionC1,composeTotal}.js` — composition helpers; only `computeAnchorsFromTotal` is reached by the builder.
- `src/domain/transition/service/TransitionQueryService.js` — catalogue and runtime-only transition partition working copies.
- `src/domain/alignment/elements/TransitionElement.js` — physical scaling and pose integration.
- `src/domain/optimization/alignment/buildChangeTransitionTypeProblem.js` — bounded line–transition–arc NLP/SQP problem.
- `app/controllers/bridges/transitionEditorBridge.js`, `app/view/editors/transitionEditorView.js` — current TransEd catalogue, plots, comparison, and partition editing.
- `test/axtran/axtran-heritage-regression.test.mjs`, `src/domain/alignment/_e2eAlignmentTest.js` — executable parity and alignment cases.

### Historical and explanatory evidence

- `_legacy/ufAIM2/heritage/ufTrassePro.ltx:2380-2760` — normalized laws, Vienna functions, derivative taxonomy, Berlin dogma, cant/dynamic discussion.
- `_legacy/ufGnopper/octave/trasse.m` and `_legacy/ufGnopper/projekt.tex` — early normalized curvature and coordinate integration.
- `_legacy/ufGnopper/gnopper/scilab/20190731.sce` (and dated predecessors) — curve functions and transition calculations.
- `_legacy/ufTrass0/src/modules/physics/DynamicTransitionProfile.js` — cant/overheight-derived curvature experiment.
- `_legacy/ufTrass0/src/modules/alignment/TransitionElement.js`; `_legacy/ufTrass2/src/model/alignment/{Transition,TransitionAtom}.js`; corresponding ufTrass6 files — legacy element lineage.
- `src/domain/alignment/AXTRAN_HERITAGE_PARITY_APP-AXTRAN-HERITAGE-001.md` — current parity inventory.
- `docs/app/architecture/AXTRAN2_OPTIMIZATION_BOUNDARY.md` — current calculation authority boundary.
- `docs/thesis/AIM/modeling/transitions.tex`, `geometry/curvature_transitions.tex`, `discussion/axtran_reinterpretation.tex`, `outlook/part_intro.tex`, and `figures/geometry/berlinish_composition.tex` — current narrative. These were dirty at inspection and are evidence of the working tree, not baseline history.
- `_legacy/ufGnopper/Transition curves in Road Design.doc` — repository mathematical source (inventoried; not needed for claims unavailable in the text/code corpus).

Search found no `axtranNew`-named source or artifact. “ViennaCurve” survives as formulae, identifiers, tests/plots, and thesis material rather than a distinct source tree.

## The five-level grammar

| Level | Responsibility and identity | Inputs / output | Domain, units, conditions | Composition and consumers | Current status |
|---|---|---|---|---|---|
| `constant` | Named reusable scalar (`PI`, `_PI`, `2PI`, `PIHALF`, `ZHALF`) | number → scalar | dimensionless; `ZHALF≈4.49340946` | Intended coefficient vocabulary | Present but resolver, AST builder, and validator do not resolve this level; constants are duplicated inline. |
| `simpleFcn` | Named elementary polynomial/trigonometric primitive | coefficient/op parameters → scalar function | normalized dimensionless argument; polynomial/trig output | `protoFcn` AST refs | Fully executable; 20 records. Parameters are embedded values, not declared free variables. |
| `protoFcn` | Named expression/prototype and the derivative level at which a shape is stated | AST of refs/operators → function | usually `[0,1]`; crops remap domains; no explicit units/BC metadata | selected by `halfWave`; symbolic `diff`/`int` supported | 28 records; executable, but no proto-to-proto refs and no provenance/parameter schema. |
| `halfWave` | Named bounded component selecting prototype plus `source` | prototype + source ∈ {κ,κ′,κ″,κInt} → normalized κ-family | builder integrates/differentiates to κ, normalizes κ(0)=0, κ(1)=1, derives κ′, κ″, ∫κ | transition entering/exiting role; exit is reversed | 28 records; executable. Roles and BCs are implicit, not data. |
| `transition` | Named composition instance | two halfwave IDs + normalized length partition → runtime preset | normalized `u∈[0,1]`; partition intended to sum to 1 | resolver adds fixed clothoid core; builder computes anchors/cuts | 29 records including `test`; evaluator works, but schema cannot name the core, cant law, constraints, or provenance. |

Physical realization is a sixth, external step: `TransitionElement` maps

\[
\kappa(s)=\kappa_A+(\kappa_B-\kappa_A)\widehat\kappa(s/L),
\quad
\kappa'(s)=\frac{\Delta\kappa}{L}\widehat\kappa'(s/L),
\quad
\kappa''(s)=\frac{\Delta\kappa}{L^2}\widehat\kappa''(s/L),
\]

then integrates curvature to heading and position. Units are respectively 1/m, 1/m², and 1/m³ when `s,L` are metres. Registry functions themselves are dimensionless.

## Composition, boundaries, and degrees of freedom

For `u∈[0,1]`, current data stores `λ=[λ1,λc,λ2]`. The cuts are

\[
w_1=\lambda_1,\qquad w_2=\lambda_1+\lambda_c,
\qquad \lambda=[w_1,w_2-w_1,1-w_2].
\]

Thus `w1,w2` are simultaneously normalized component-length accumulators, function-domain/geometric partition boundaries, editable variables, and potential optimization variables. They are not physical lengths until multiplied by `L`. Current AXTRAN optimization does not solve them.

Piece `i` scales a normalized shape `f_i` between curvature anchors `A_i,A_{i+1}`:

\[
K_i(u)=A_i+(A_{i+1}-A_i) f_i((u-w_i)/\lambda_i).
\]

Current mandatory runtime conditions are finite endpoints and successful normalization to κ(0)=0, κ(1)=1; physical endpoints are `κA,κB`. Continuity of κ is built through shared anchors. Smoothness is intended at joins, but the active `computeAnchorsFromTotal` uses endpoint/midpoint slope weights and does not explicitly validate C¹/C² residuals. `solvePartitionC1` is disconnected and its comment/assumptions are not aligned with the general anchor formulation.

**Zero length.** `λ1=0` removes the entering halfwave, `λc=0` removes the core, and `λ2=0` removes the exit. `[0,1,0]` is the clothoid; `[.5,0,.5]` yields symmetric two-halfwave families; positive outer lengths with a core yield Ruch/Gubar-like forms. The active builder skips zero-length pieces. Physical `L=0` is separately handled by `TransitionElement` as endpoint curvature with zero derivatives and unchanged pose. These two zero-length meanings must remain distinct.

The original free-variable space is broader than surviving data: total/component lengths, function identities, function parameters/coefficients, curvature and cant boundary values, and connection pose quantities could be fixed, derived, constrained, coupled, or free. Current records expose only family identity and partition; current bounded optimizer solves three element lengths while holding transition family and end curvature fixed.

## Function taxonomy

| Family / IDs | Definition or generator | Stated source order | Endpoint character / role | Current support and evidence |
|---|---|---|---|---|
| Clothoid (`clothoid`, `HW_CLOTHO`) | `f(u)=u` | κ | constant κ′, κ″=0; core or full transition | Full; heritage table and `IDENT`. |
| Helmert/biquadratic (`helmert`, `ruch_schuhr`, `HW_BIQUAD`) | entering half `2u²` after crop/normalization | κ | κ′ starts zero; two halves or outer waves | Full; historical Ruch three-part use. |
| Bloss / regular-1 / Klauder 0,1 | `3u²−2u³`; equivalently κ′∝u(1−u), or κ″ generator | κ, κ′, κ″ | zero κ′ endpoints; symmetric | Full under `bloss`, `bloss_k1`, `bloss_k2`. |
| Watorek / regular-2 / Klauder 1,1 | `10u³−15u⁴+6u⁵`; κ′∝u²(1−u)² | κ, κ′, κ″ | zero κ′ and κ″ endpoints | Full under three source-order variants. |
| Mieloszyk/Koc (`mieloko`,`okoleim`) | `20u³−45u⁴+36u⁵−10u⁶` and reverse pairing | κ | asymmetric higher endpoint smoothness | Full; distinct halfwaves produce integrals 4/7 and 3/7 in executable check. |
| Vienna2 | `35u⁴−84u⁵+70u⁶−20u⁷` | κ | continuation of smoothstep order | Full. |
| Vienna7 | `126u⁵−420u⁶+540u⁷−315u⁸+70u⁹` | κ | higher endpoint smoothness | Full. |
| Vienna3 | Bloss plus trig correction with `Z/2≈4.49340946` | mixed κ expression | mixed polynomial/trigonometric | Full evaluator; constant duplicated inline. |
| Vienna4 | weighted Bloss/cosine/sine combination | mixed κ expression | mixed | Full evaluator. |
| Vienna5 | weighted sine and Watorek | mixed κ expression | mixed | Full evaluator. |
| Vienna6 / part-V6 | cosine plus polynomial component | mixed κ expression | mixed; `part_v6` and `vienna6` currently resolve the same halfwave | Full but duplicated/ambiguous naming. |
| Sine (`sine`, `sine_k2`) | `u−sin(2πu)/(2π)` or its κ″ expression | κ and κ″ | zero κ′ and κ″ endpoints | Full. |
| Cosine (`cose`, `cose_k1`) | `(1−cos πu)/2` or κ′ expression | κ and κ′ | zero κ′ endpoints; Gubar outer wave | Full; spelling `cose` is registry-specific. |
| Klauder `pol_2_n` (`n=1,2,3,5,9`) | κ″ proportional to `(1+s)² sⁿ (1−s)²`, transformed/cropped | κ″ | parameterized polynomial generator concept | Five enumerated instances executable; not a parameterized family schema. Even `n=2` is present though the historical discussion emphasizes odd central orders. |
| Regular-3/4 | powers represented in prototypes/halfwaves | κ′ | potential smoothstep extensions | Present but no named transition consumes `HW_REGULAR3/4`; preserved but inaccessible. |

Named transition ≠ family ≠ parameterized function ≠ halfwave instance ≠ composed transition ≠ physical alignment element. The current UI flattens some of these distinctions into catalogue records but does retain five separate levels.

## Curvature and cant

**Observed.** The active registry and evaluator contain only curvature. No cant law, cant endpoints, gauge, speed, roll-axis height, or coupling declaration is present. `DynamicTransitionProfile` is legacy-only and maps an overheight function to curvature using a simplified dynamic relation. Heritage notes describe choosing a bank/roll law independently, deriving curvature of a roll-axis path through the balance relation, and applying lateral displacement; Vienna formulas explicitly contain a curvature term corrected by a second derivative of a cant/roll function.

**Reconstruction.** Curvature `κ(s)` and cant/roll `u(s)` may reuse the same abstract function grammar, but they require distinct instances, domains/physical scaling, partitions, boundary conditions, units, and provenance. Optional coupling is a constraint layer, not identity of the two functions. Vienna examples demonstrate why derivatives of the cant law participate in derived curvature; they are test cases for coupled dynamics, not merely more curve names.

**Unresolved.** Surviving evidence does not specify one authoritative modern coupling equation, engineering convention, or complete axtranNew objective. Restoration therefore needs an explicit cant-law record, track gauge/roll convention, velocity and height context, coupling model/version, and residual/objective definitions. A unified curvature-cant record would be unevidenced.

## axtranNew operation inventory

| Operation | Classification | Evidence |
|---|---|---|
| Registry family resolution, derivatives, halfwave composition | implemented and reachable | Resolver, builder, TransitionElement, TransEd. |
| Sequential pose/curvature evaluation and editable sparse elements | implemented and reachable | Alignment2D/factory/editor services; parity document/tests. |
| Runtime transition partition edit and comparison | implemented and reachable | TransitionQueryService and TransEd; non-durable. |
| Anchor computation | implemented and reachable | `computeAnchorsFromTotal`; heuristic, no continuity diagnostic. |
| C¹ partition solver and alternate total composer | implemented but disconnected | `solvePartitionC1`, `composeTotal`; no import from active path. |
| Change transition type while preserving end pose; solve lengths | implemented, bounded/experimental | line–transition–arc problem plus equality-QP/SQP machinery. |
| General element coupling and arbitrary boundary-condition solve | intended; partial current primitives only | heritage/thesis intent, sparse recalculation; no general problem compiler. |
| Curvature/cant coordination | legacy experiment and mathematical description only | DynamicTransitionProfile and heritage Vienna/dynamic text. |
| General family/parameter selection and engineering optimization | intended but unsupported as a complete surviving implementation | thesis/architecture narrative; no general reachable solver. |
| Produce reviewable editable candidate structures | partially implemented | editor recalculation exists; optimizer-to-candidate transaction is not general. |

## What narrowed or contradicts the reconstruction

1. `constant` is advertised as a level but is dead data in resolution/validation; values are repeated in ASTs.
2. `protoFcn` is executable expression data, not a true parameterized prototype: parameters, units, admissible domains, BCs, derivative contracts, and provenance are absent.
3. The transition schema cannot select/omit/name a core; resolver always injects `clothoCore`. Zero core is represented only by length zero.
4. Halfwave role and reversal policy are implicit. An asymmetric exiting halfwave cannot declare a different transform.
5. Validator accepts any array length/sum for partitions, while the service validates exactly three nonnegative values summing to one.
6. Active anchors are heuristic and continuity is not reported or enforced. The disconnected C¹ solver is not a substitute for the general problem.
7. All runtime prototypes are forced into normalized curvature endpoints; profiles that require offsets, non-monotonic behavior, independent domains, or unnormalized physical coefficients are narrowed away.
8. Cant is absent from DB, evaluator, TransEd, and AXTRAN problem builder.
9. `w1,w2` are editable in TransEd/alignment elements but not general optimizer variables and are only durably represented through existing partitions.
10. TransEd edits only transition partitions as runtime working copies; all lower grammar levels are read-only and provenance is display inference.
11. Current AXTRAN optimization is one topology with three length variables, not the intended calculation core.
12. Thesis text explains the broad model but, in the inspected dirty working tree, can overstate “current” reachability unless paired with the bounded implementation inventory.

## Ordered handover: APP-TRANSITION-SYSTEM-001

1. **Contract and validator first.** Introduce a versioned schema adapter that preserves every v3 record. Validate constants, exact partitions, finite coefficients, reference cycles, domains, endpoint/derivative contracts, and source order. Add stable labels/aliases without renaming current IDs.
2. **Make function definitions honest.** Add typed parameters (default, bounds, unit), explicit domain mapping, output quantity/order, normalization policy, boundary conditions, symmetry/reversal policy, and provenance/evidence fields. Resolve named constants. Keep AST v3 compatible.
3. **Make composition explicit.** Store an ordered component list with role, function/halfwave instance, length expression, transform, and zero-length policy. Adapt existing `halfWave1 + implicit clothoCore + halfWave2 + partition` records losslessly.
4. **Add continuity diagnostics.** Replace silent anchor fallback with a solver/result object containing κ/C¹/C² residuals, applicability, and degeneracy diagnostics. Reconcile or retire the disconnected composer/partition solver after parity tests.
5. **Separate physical laws.** Add independent `curvatureLaw` and `cantLaw` instances, each with physical scale/domain and boundary conditions. Add a separately versioned optional coupling constraint carrying gauge, speed/velocity profile, height/roll axis, convention, and source. Do not default to coupling.
6. **Evaluator API.** Return value/derivatives/integral by requested physical quantity, plus component boundaries and diagnostics. Define one-sided behavior at zero-length joins. Preserve `KappaFcnBuilder` through an adapter until callers migrate.
7. **TransEd.** Expose level-aware editing, parameter constraints, component roles, derivative/continuity diagnostics, separate curvature/cant plots, physical scaling preview, provenance, and explicit durable-save workflow. Keep current compare and v3 partition controls.
8. **AXTRAN interface.** Define a problem document with topology, fixed/derived/free variables, boundary and continuity constraints, curvature/cant coupling constraints, objectives, tolerances, and candidate/delta output. First generalize the existing line–transition–arc case without granting solver output authority.
9. **Compatibility tests.** Golden-test all 29 v3 transition IDs; formula points for clothoid/Helmert/Bloss/Watorek/Mieloszyk/Vienna2–7/sine/cosine/Klauder; all source-order equivalences; symmetric/asymmetric reversals; `[0,1,0]`, `[.5,0,.5]`, three-positive, and each zero component; signed physical curvature; continuity residuals; Vienna curvature/cant examples only after the coupling convention is approved.
10. **Defer.** General network optimization, automatic family choice, authoritative engineering acceptance, and a single canonical Vienna dynamic model remain research/governance work.

## Kernel and Thesis boundary

No active Kernel conflict was found. Candidate later concepts are “Transition Function Grammar,” “Halfwave,” “Transition Composition,” and “Alignment Calculation Candidate,” with explicit separation between calculation and engineering authority. They require a later Kernel mission.

Thesis may describe the evidenced Berlinish grammar, five levels, physical scaling, zero-length reductions, and the bounded current implementation. It should label generalized axtranNew solving and curvature/cant co-optimization as intended or future until implemented and validated. Historical intent should cite the heritage source and retain the missing-`axtranNew` uncertainty.

## Uncertainty register

| Item | Confidence | Consequence |
|---|---|---|
| “Berlinish” and “Berlin-Dogma” are the same model | high | Direct heritage wording plus current thesis lineage. |
| Exact original axtranNew executable behavior | low/medium | No named source survives; do not claim a complete historical implementation. |
| `w1,w2` historical names | medium | Present meaning is certain in code; heritage may have used other symbols. |
| Anchor formula as original Berlinish mathematics | low | Current helper is observed, not established as historical intent. |
| One authoritative curvature/cant coupling | low | Multiple conceptual relations survive; requires engineering decision. |
| Vienna6 versus `part_v6` identity | medium | Current DB duplicates a halfwave; historical text distinguishes a component and full formula. Preserve IDs pending review. |

## Validation record

- Counts reconciled: 5 constants, 20 simple functions, 28 prototypes, 28 halfwaves, 29 transitions (including `test`).
- `validateLookupV3` returned true.
- Every transition resolved and produced finite κ, κ′, κ″ and integral samples with κ(0)=0 and κ(1)=1.
- Six `test/axtran/axtran-heritage-regression.test.mjs` tests passed.
- Bloss formula and normalized integral matched; asymmetric partitions changed shape as expected; signed curvature and optimization Jacobian cases passed.
- No App, Kernel, Thesis, registry, or legacy source was changed by this mission.

