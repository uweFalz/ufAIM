# AXTRAN Heritage Parity Matrix (APP-AXTRAN-HERITAGE-001)

Scope baseline:
- Legacy read-only corpus: _legacy/ufGnopper and _legacy/ufTrass
- Current implementation: src/domain/alignment, src/domain/transition, src/domain/optimization/alignment, src/services/alignment, app/controllers/alignmentEditorController.js, app/controllers/bridges/transitionEditorBridge.js

## Current AXTRAN Capability (observed)

- Supported element types:
  - fixed curvature element, including straight as curvature 0
  - transition element with runtime kappa profile
  - zero-length curvature holder (ZeroLengthFixed)
  - zero-length immediate transition and zero-length kink transition
- Supported transition families:
  - registry-defined families in transitionLookup.json, including clothoid, helmert, ruch_schuhr, bloss, watorek, vienna variants, sine/cose, regular and klauder derivatives
- Parameterization:
  - sparse v1 elements with arcLength, curvature, transType, optional opts (w1/w2 split)
  - transition kappaA from previous fixed, kappaB from next fixed
- Composition:
  - sparse-to-Alignment2D builder with sequential pose propagation
- Boundary and anchor handling:
  - descriptor + KappaFcnBuilder with partition lambdas and computed curvature anchors/cuts
- Evaluation:
  - pointAt, tangentAt, poseAt, curvatureAt, world2Track
  - transition pose via romberg-integrated heading/position
- Optimization integration:
  - change-transition-type problem builder (line-transition-arc), equality QP and SQP step/loop in lib/math/optim
- Editor integration:
  - AlignmentEditorController -> AlignmentApplicationService -> edit ops -> sparse rebuild -> spot save
  - Transition editor bridge/view uses Transition.ListPresets and Transition.GetPresetSpec
- Produced alignment state:
  - AlignmentData in SpotObject and derived sparseAlignment kernel
- Existing numerical tests:
  - src/domain/alignment/_e2eAlignmentTest.js
  - src/services/alignment/_e2eAlignmentEditModelBoundaryTest.js

## Heritage Parity Matrix

| Capability | Legacy source | Current correspondence | Parity status | Evidence | Required action |
|---|---|---|---|---|---|
| Transition-curve families (linear/clothoid, schramm/biquad, bloss, watorek/smoothstep, sinusoid) | _legacy/ufGnopper/octave/trasse.m, _legacy/ufGnopper/projekt.tex, _legacy/ufTrass/src/modules/alignment/modlMain2.js | transitionLookup.json family registry with normalized AST-based builders | current-improved | transitionLookup transition + protoFcn sections; RegistryResolver/KappaFcnBuilder | none |
| Curvature definition κ(s) from normalized shape with endpoint curvatures | trasse.m: κ(s)=ka+(ke-ka)k(s/L) | TransitionElement.curvatureAt | equivalent | src/domain/alignment/elements/TransitionElement.js | none |
| Curvature integration to heading/position | trasse.m deltaTau/deltaCurve (numerical integrate) | TransitionElement.poseAt with Romberg integration | current-improved | src/domain/alignment/elements/TransitionElement.js | none |
| Straight/arc/transition behavior | FixxElement.js, AlignmentElement.js | FixedElement + TransitionElement + Alignment2D | equivalent | src/domain/alignment/elements/FixedElement.js, src/domain/alignment/Alignment2D.js | none |
| Continuity at element boundaries | legacy sequential deltaCurve composition | AlignmentFactory composition and e2e continuity probes | equivalent | src/domain/alignment/build/AlignmentFactory.js, src/domain/alignment/_e2eAlignmentTest.js | none |
| Anchor calculations for transition partitions | modlMain2.js partition/core assembly | computeAnchorsFromTotal + buildPiecewisePreset | current-improved | src/domain/transition/build/KappaFcnBuilder.js, src/domain/transition/registry/compose/computeAnchorsFromTotal.js | none |
| Angle conventions | trasse.m and projekt.tex show mixed signs/frames | current uses mathematical atan2 and tangent vectors | semantically-different | legacy uses negative tau integral and gon conversion; current pose APIs are rad/tangent | documented convention difference; no code change |
| Curvature-sign conventions | legacy includes sign and orientation dependent formulas | current uses right-handed tangent rotation and explicit k sign | semantically-different | TransitionElement.poseAt and FixedElement/poseAdvance | documented convention difference; no code change |
| Stationing conventions (global s with local segment dispatch) | trasse.m trafo(s,q) with segment walk | Alignment2D._findSegment and world2Track | equivalent | src/domain/alignment/Alignment2D.js | none |
| FAT-to-sparse conversion concept | modlMain2.js fatAttribute / sparseAttributes | current import + spot pipeline produce sparseAlignment kernel | inconclusive | legacy conversion exists; current import pipeline not fully audited in this package | decision-not-required; follow-up trace possible |
| Constrained fitting and optimization | projekt.tex SQP chapter, trasse.m optim comments, modlMain2.js roots/optimization helpers | buildChangeTransitionTypeProblem + QP/SQP solvers | current-improved | src/domain/optimization/alignment/buildChangeTransitionTypeProblem.js, src/lib/math/optim | keep adding targeted problems/tests |
| Dynamic transition profile from superelevation concepts | DynamicTransitionProfile.js | no direct production equivalent yet | missing | _legacy/ufTrass/src/modules/physics/DynamicTransitionProfile.js | no implementation in this package; requires validated physics contract |

## Numerical Regression Vectors (executable)

Vectors implemented in test/axtran/axtran-heritage-regression.test.mjs

1) Legacy Bloss normalized curvature points
- Legacy source file: _legacy/ufGnopper/octave/trasse.m (case 3), _legacy/ufGnopper/projekt.tex (Bloss: 3x^2-2x^3)
- Input parameters: u in {0.25, 0.5, 0.75}
- Units: dimensionless normalized parameter u
- Coordinate and angle conventions: none (shape function only)
- Expected position: not applicable
- Expected tangent or heading: not applicable
- Expected curvature: k(u)=3u^2-2u^3
- Tolerance: 1e-10 on k(u), 2e-6 on integral check
- Verification status: independently verified against analytic polynomial and numeric integration

2) Line-Bloss-Arc heading composition
- Legacy source file: same as above for Bloss definition
- Input parameters: poseA=(0,0,theta0=0), Lg=80m, Lu=60m, Lb=120m, kB=1/300 1/m
- Units: meters, radians, 1/m
- Coordinate and angle conventions: current right-handed tangent frame
- Expected position: not asserted in this vector
- Expected tangent or heading: theta_end = kB*(0.5*Lu + Lb)
- Expected curvature: implied by transition and arc definitions
- Tolerance: 5e-4 rad
- Verification status: independently verified from integral of normalized Bloss profile

3) Custom transition Jacobian contribution
- Legacy source file: heritage-inspired differential consistency check (not tied to one legacy line)
- Input parameters: kappa01(u)=u^2, kB=0.002 1/m
- Units: normalized u, 1/m
- Coordinate and angle conventions: current right-handed tangent frame
- Expected position: not applicable
- Expected tangent or heading: JG_theta_Lu = kB * integral_0^1 u^2 du = kB/3
- Expected curvature: via custom shape
- Tolerance: 1e-4
- Verification status: independently verified analytically

## Legacy Mathematics Classification

| Formula or algorithm | Classification | Engineering reason |
|---|---|---|
| κ(s)=ka+(ke-ka)k(s/L) transition normalization | accepted | Dimensionally consistent and directly represented in current TransitionElement |
| Bloss k(u)=3u^2-2u^3 | accepted | Legacy and current transition registry agree exactly |
| Watorek/quintic smoothstep family | accepted-after-reformulation | Valid as separate family, but not a substitute for Bloss in Bloss-named optimization path |
| trasse.m heading sign convention (negative integral) | accepted-after-reformulation | Convention differs by orientation frame; current implementation keeps consistent internal sign convention |
| DynamicTransitionProfile evaluate(sNorm) using tan(u/b) with u documented as rad | rejected | Dimensional inconsistency and ambiguous units (rad vs length over gauge) |
| Legacy optimization comments and SQP strategy | already-superseded | Current code has explicit QP/SQP solver modules and structured problem snapshots |
| Legacy mixed gon/rad conversion and hidden assumptions | unresolved | Requires broader contract for survey frame conventions to avoid semantic drift |

## Implemented Gap in This Package

- Demonstrated gap: change-transition-type optimization used a hardcoded quintic curve in a Bloss-named path, creating semantic mismatch with legacy Bloss corpus and with transition registry semantics.
- Implemented correction:
  - buildChangeTransitionTypeProblem now resolves normalized transition curvature from the current transition registry (default transitionType=bloss) or accepts injected custom transition shape.
  - Jacobian heading derivative for Lu now uses kB * integral_0^1(kappa01), avoiding hardcoded kB assumption.
- Added executable regression tests documenting and enforcing the corrected heritage behavior.

## Heritage-002 Extension (Composed Alignment Regression)

Additional executable coverage added in APP-AXTRAN-HERITAGE-002:

- Composed multi-element alignment cases with straight, transition, circular arc, and multiple consecutive elements.
- Signed curvature behavior for both positive and negative curvature, including left/right orientation checks.
- Asymmetric transition partition checks using non-symmetric w1/w2 cuts.
- world2Track roundtrip checks on a composed transition-arc-straight alignment for interior, boundary, and near-boundary stations with signed lateral offsets.
- Optimization Jacobian finite-difference consistency checks for transition-family-based problems.
- Editor-to-calculator parameter-change path via straight-length update and derived sparse recalculation.

Conventions explicitly verified:

- Curvature sign: positive turns left, negative turns right (right-handed x/y frame with tangent-based normal).
- Heading accumulation: transition heading gain depends on normalized transition integral, not only end curvature.
- Stationing: global station is piecewise-local over sparse elements and recovered through world2Track within declared tolerances.

Known current limitation (isolated, not changed here):

- Native alignment edit model currently exposes straight-element authoring and straight-length parameter change; composed transition/arc editing is validated at calculator level but not yet exposed as equivalent editor-native parameter operations in this package.

## Editor-003 Extension (Native Arc and Transition Editing)

APP-AXTRAN-EDITOR-003 extends native editor behavior from straight-only editing to arc and transition editing with deterministic AXTRAN recalculation.

Current native editor element model (observed and enforced):

- straight:
  - parameters.length (m)
- arc:
  - parameters.length (m)
  - parameters.curvature (1/m) as canonical signed value
  - parameters.radius (m) accepted as input, deterministically converted to curvature
- transition:
  - parameters.length (m)
  - parameters.transitionType (registry id)
  - optional parameters.w1 / parameters.w2 for asymmetric partition where supported

Validation and rejection behavior:

- Arc radius/curvature must be finite and non-zero.
- Transition length must be positive.
- Transition family must resolve through the transition registry.
- Invalid edits are rejected with structured result (`status: rejected`) and do not persist partial model updates.

AXTRAN recalculation path after edit:

`AlignmentEditorController -> AlignmentApplicationService -> alignmentEditOps -> buildSparseAlignment -> AlignmentFactory/AXTRAN -> Spot mapper update`

Selection and operation model boundary:

- Editing is currently element-id targeted (no separate editor selection state object required in service boundary).
- Unaffected elements preserve id and intent fields; downstream geometric state is recalculated from sparse sequence.

Sparse sequence contract for native editing:

- Sequence must start and end with fixed elements.
- Elements must strictly alternate fixed/transition in sparse representation.
- Arc is represented as fixed with signed curvature (no second arc representation introduced).
