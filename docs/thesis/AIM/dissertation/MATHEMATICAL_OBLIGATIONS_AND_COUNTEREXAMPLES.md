# AIM Dissertation Mathematical Obligations and Closer Counterexamples

## Scope and status vocabulary

This DISS-04 working document audits the eighteen propositions classified as
`SCI-MATH` in `PROPOSITION_INVENTORY.md`, with emphasis on C3. It does not
change the propositions or approved Kernel meaning. A mathematical status is
assigned only where the statement is genuinely mathematical:

- `proved`: the stated result follows under its declared hypotheses;
- `bounded derivation`: a calculation is valid only under explicit local
  assumptions and is not a universal theorem;
- `revise`: the statement is false, underspecified or overbroad as written;
- `reclassify`: the statement is a definition, engineering contract or
  methodological assertion and must not be presented as a theorem.

## Audit matrix

| ID | Status | Mathematical obligation and finding | Required Thesis action |
|---|---|---|---|
| P024 | `proved` | For integrable \(\kappa\), the two displayed integrals uniquely define absolutely continuous \(\theta\) and \(\gamma\) from initial data. The existing proof is complete relative to the two stated axioms. | Replace “sufficiently regular” by an explicit regularity class when incorporated. |
| P051 | `bounded derivation` | This is the reconstruction chain already proved by P024, not a second theorem. | Convert to a corollary or explanatory summary citing P024. |
| P053 | `revise` | “Any transition curve” is false without regularity and regular parametrization. Corners have no classical curvature; arbitrary parametrizations do not make \(s\) arc length. | Restrict to regular planar \(C^2\) curves parameterized by arc length, or to \(W^{2,1}\) curves with curvature almost everywhere. |
| P055 | `bounded derivation` | The formula is an affine rescaling definition. It satisfies endpoint curvatures only if \(L>0\), \(\widehat\kappa(0)=0\) and \(\widehat\kappa(1)=1\). | Relabel as definition and state endpoint and domain hypotheses. |
| P056 | `proved` | For \(J=\int_0^L(\kappa')^2ds\) on the stated affine subset of \(H^1\), first variation gives \(\int\kappa'\eta'=0\) for all \(\eta\in H_0^1\), hence \(\kappa''=0\) distributionally. | Add the short weak Euler–Lagrange proof. |
| P057 | `proved` | From P056, \(\kappa=as+b\); endpoint values give \(b=0\), \(a=\kappa_1/L\). Strict convexity gives uniqueness. Equivalently Cauchy–Schwarz yields \(J\ge\kappa_1^2/L\), with equality only for constant \(\kappa'\). | Add proof and say “unique minimizer”. |
| P058 | `revise` | \(J_2\) is not defined on the preceding \(H^1\) admissible set, and boundary conditions for a fourth-order problem are unspecified. | Define an \(H^2\) admissible set. Under fixed \(\kappa\) and \(\kappa'\) at both ends, the weak equation is \(\kappa^{(4)}=0\); other boundary choices induce natural boundary conditions. |
| P059 | `bounded derivation` | Substitution \(\phi\equiv0\) removes \(\phi\) as a variable, but the remaining functional can still contain equilibrium, jerk and weight terms. “Pure curvature” means curvature-only, not the earlier \(J_\kappa\) alone. | Reword as a substitution corollary and name the remaining terms. |
| P060 | `bounded derivation` | From the local definition \(a_{\rm eff}=v^2\kappa-g\sin\phi\), setting it to zero yields the equation algebraically. “Perfectly balanced” is an engineering interpretation under the simplified constant-speed, stated-sign model. | Split the identity from the assumption-dependent interpretation. |
| P061 | `revise` | The displayed integrals reconstruct planar heading and position, not “all state variables”; profile, cant, chainage and realization state require other laws/operators. | Restrict the proposition to planar pose2 variables. |
| P062 | `proved` | If \(\kappa(\cdot,p)\) is differentiable in \(p\) and a locally integrable majorant permits differentiation under the integral, Leibniz' rule gives the formula. | Add the domination/differentiability hypotheses. |
| P063 | `proved` | Apply the chain rule to \((\cos\theta,\sin\theta)\), then differentiate under the integral under the P062 hypotheses. | Add the two-line derivation and hypotheses. |
| P064 | `revise` | P062–P063 provide exact derivatives only for differentiable parameterizations and smooth residual/constraint compositions. Nondifferentiable admission logic, active-set changes or black-box operators do not automatically admit exact Jacobians. | Narrow to the smooth reconstruction block; do not claim the entire optimization problem. |
| P065 | `revise` | The formula is correct only for a shape parameter \(p\) of \(\widehat\kappa\) while \(L,\kappa_0,\kappa_1\) are fixed. It is false for the parameter vector stated earlier: derivatives with respect to endpoints and \(L\) have additional terms. | Restrict \(p\in\mathbf T\), or provide separate endpoint/length derivative formulas. |
| P067 | `revise` | Convergence of \(\gamma_{k+1}=\mathcal A(\gamma_k)\) alone does not imply a fixed point when \(\mathcal A\) is discontinuous. | Add continuity (or closed-graph/sequential-continuity) at the limit; then take limits on both sides. |
| P072 | `reclassify` | “The physical design space is the image of the realization operator” is a set definition, not a discovered mathematical result. | Replace the proposition by a definition; empirical adequacy of \(\mathcal R\) remains a separate claim. |
| P083 | `reclassify` | Persistence and engineering authority are normative responsibility claims. Only pose2 reconstruction is mathematical and is already covered by P024. | Classify as `CONTRACT`; validate by Kernel trace and semantic reopen, not proof. |
| P084 | `reclassify` | The existence of a qualified evaluation follows only after choosing metric, frame, transport, gauge and convention operators. Preservation of Alignment reference and provenance is a contract, not a mathematical consequence of \(\kappa,h,u\). | Classify as `CONTRACT`; keep a bounded construction recipe separately. |

## Closed proofs and repair lemmas

### Weak minimizer for P056–P057

Let \(\mathcal A=\{\kappa\in H^1(0,L):\kappa(0)=0,
\kappa(L)=\kappa_1\}\). For every \(\eta\in H_0^1(0,L)\), stationarity gives

\[
0=\left.\frac{d}{d\epsilon}J[\kappa^*+\epsilon\eta]
\right|_{\epsilon=0}=2\int_0^L\kappa^{*\prime}\eta'\,ds.
\]

Thus \(\kappa^{*\prime\prime}=0\) in distributions. The endpoint conditions
give \(\kappa^*(s)=\kappa_1s/L\). Moreover,

\[
\kappa_1^2=\left(\int_0^L\kappa' ds\right)^2
\le L\int_0^L(\kappa')^2ds,
\]

with equality exactly when \(\kappa'\) is constant. This proves existence and
uniqueness without claiming engineering optimality beyond this functional.

### Repair theorem for P058

On an affine subset of \(H^2(0,L)\) with both \(\kappa\) and \(\kappa'\)
fixed at both ends, admissible variations satisfy \(\eta=\eta'=0\) at the
boundary. Twice integrating
\(2\int_0^L\kappa''\eta''ds=0\) by parts gives
\(\kappa^{(4)}=0\) weakly. This is a cubic-polynomial result for that precise
problem. It does not follow from the current text's \(H^1\) set.

### Differentiation lemmas for P062–P065

For a differentiable family \(\kappa(s,p)\), dominated differentiation gives

\[
\partial_p\theta(s,p)=\int_0^s\partial_p\kappa(\sigma,p)d\sigma,
\]

and the chain rule gives the P063 vector integral. For
\(\kappa=\kappa_0+(\kappa_1-\kappa_0)
\widehat\kappa(s/L,\mathbf T)\), the P065 formula holds for
\(p\in\mathbf T\) only. In contrast,

\[
\partial_{\kappa_0}\kappa=1-\widehat\kappa,
\qquad
\partial_{\kappa_1}\kappa=\widehat\kappa,
\]

and \(\partial_L\kappa\) additionally differentiates \(s/L\). This is a direct
counterexample to the universal wording.

### Fixed-point repair for P067

If \(\gamma_k\to\gamma_*\), \(\gamma_{k+1}=\mathcal A(\gamma_k)\), and
\(\mathcal A\) is continuous at \(\gamma_*\), then
\(\gamma_*=\lim\gamma_{k+1}=\lim\mathcal A(\gamma_k)
=\mathcal A(\gamma_*)\). Without continuity, define on \(\mathbb R\)
\(\mathcal A(0)=1\) and \(\mathcal A(x)=x/2\) for \(x\ne0\): an orbit can
converge to zero although zero is not a fixed point.

## Closer original-source and standards counterexamples

| Source | Counterexample to the provisional claim | Consequence |
|---|---|---|
| buildingSMART, [IfcAlignmentCantSegment, IFC 4.3.2.0](https://standards.buildingsmart.org/IFC/RELEASE/IFC4_3/HTML/lexical/IfcAlignmentCantSegment.htm) | The official schema already stores `StartCantLeft`, `EndCantLeft`, `StartCantRight` and `EndCantRight` on segments along the horizontal alignment. | Explicit left/right cant endpoints and their longitudinal segmentation are prior art; they cannot carry C3 novelty. |
| buildingSMART, [IfcAlignmentCantSegmentTypeEnum](https://standards.buildingsmart.org/IFC/RELEASE/IFC4_3/HTML/lexical/IfcAlignmentCantSegmentTypeEnum.htm) | The standard defines cant families and explicitly discusses shortened and scissor ramps. | Non-common rail motion and named cant-transition families are not new in AIM. |
| S. Bischof and G. Schenner, [Rail Topology Ontology: A Rail Infrastructure Base Ontology](https://arxiv.org/abs/2107.04378), 2021 | RTO provides standard-aligned identity, intrinsic coordinates, orientation, topology and integration of disconnected railway sources. | C1/C3 cannot claim railway identity, intrinsic positioning or semantic integration generically; AIM must demonstrate its narrower constructive responsibility boundary. |
| J. Seo et al., [Design of Railway Track Model with Three-Dimensional Alignment Based on Extended Industry Foundation Classes](https://doi.org/10.3390/app10103649), *Applied Sciences* 10(10), 2020, 3649 | The original implementation combines horizontal and vertical alignment and calculates cant-inclusive sleeper orientation; it also reports semantic information loss in the then-current exchange model. | 3D composition is prior art; meaning-preserving semantic exchange remains an empirical gap rather than an assumed novelty. |

## C3 decision after DISS-04

**Outcome: `survives with further reformulation`.** C3 cannot claim novelty for
curvature reconstruction, a shared distance-along parameter, combined
horizontal/vertical/cant state, explicit left/right cant values, named cant
families or 3D pose generation. All have close prior art.

The remaining conditional claim is a responsibility-and-preservation claim:
AIM treats admitted left/right rail laws as constructive authority, keeps
midpoint, cross-level and common offset derived, distinguishes intrinsic
position from chainage and qualified realization, and tests whether those
roles survive consequential change and semantic reopen. This may still reduce
to an implementation synthesis unless the real-data case demonstrates a
failure prevented by the complete boundary that the comparison systems do not
prevent.

### Decision record

**`DISS-04-DECISION-001`, Option A, approved by Uwe Falz on 2026-09-05.** C3 is retained as the responsibility-and-preservation claim stated
above. The audit matrix was applied to the incorporated EN/DE TeX sources by
the repair package documented in
`MISSION_REPORT_DISSERTATION_MATHEMATICAL_REPAIR_005.md`.

## Incorporation gate

No audited claim should enter dissertation contribution prose until P053,
P058, P061, P064, P065 and P067 are repaired and P072, P083 and P084 are
reclassified. Normative contracts require Kernel trace and conformance
evidence, not manufactured proofs. The incorporated EN/DE sources were not
edited in this package.
