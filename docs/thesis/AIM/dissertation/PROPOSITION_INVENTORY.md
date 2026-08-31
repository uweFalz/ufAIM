# AIM Proposition Inventory for Dissertation Readiness

## Scope and method

This inventory records the 92 canonical English proposition environments and
their 92 German counterparts in the current working tree. It is an editorial
and evidential classification, not a judgment on Kernel validity and not a
change to proposition meaning.

Observed source facts:

- 184 proposition environments exist across EN and DE.
- 92 canonical EN propositions were paired by relative file and ordinal with 92
  DE counterparts.
- One canonical proposition is immediately followed by a proof.
- No canonical proposition contains a citation command inside its environment.
- A missing inline citation does not by itself prove that surrounding prose
  lacks support; it marks the proposition-level audit obligation.

Classification contract:

- **SCI-MATH** — mathematical claim; retain as proposition only with proof,
  bounded derivation or cited established result.
- **SCI-EMP** — falsifiable scientific, methodological or empirical claim;
  requires related-work positioning and validation evidence.
- **CONTRACT** — normative Kernel/engineering invariant or responsibility
  separation; trace to approved Kernel meaning and show conformance rather than
  manufacturing a mathematical proof.
- **REFERENCE** — catalogue or summary statement; normally relabel or move to
  reference prose unless it is reformulated as a scientific claim.

## Inventory

| ID | EN source | DE counterpart | Class | Current proposition-level support | Short claim |
|---|---|---|---|---|---|
| P001 | `docs/thesis/AIM/analysis/design_principles.tex:19` | `docs/thesis/AIM/analysis/design_principles-DE.tex:9` | SCI-EMP | literature + validation required | Railway alignments should be modelled primarily through curvature functions \((s)\), not through point-based geomet |
| P002 | `docs/thesis/AIM/analysis/design_principles.tex:36` | `docs/thesis/AIM/analysis/design_principles-DE.tex:17` | SCI-EMP | literature + validation required | The theoretical alignment model must be separated from its physical realization. |
| P003 | `docs/thesis/AIM/analysis/design_principles.tex:55` | `docs/thesis/AIM/analysis/design_principles-DE.tex:26` | SCI-EMP | literature + validation required | Alignment models should combine parametric structure with local correction terms. |
| P004 | `docs/thesis/AIM/analysis/design_principles.tex:72` | `docs/thesis/AIM/analysis/design_principles-DE.tex:34` | SCI-EMP | literature + validation required | Alignment modelling should be formulated as a composition of operators: \[ P = W^-1 R M W C. \] |
| P005 | `docs/thesis/AIM/analysis/design_principles.tex:102` | `docs/thesis/AIM/analysis/design_principles-DE.tex:44` | SCI-EMP | literature + validation required | Optimization objectives must be evaluated on realized geometry, not on theoretical models. |
| P006 | `docs/thesis/AIM/analysis/design_principles.tex:121` | `docs/thesis/AIM/analysis/design_principles-DE.tex:55` | SCI-EMP | literature + validation required | The intrinsic block and sparsity structure of the problem must be exploited for efficient computation. |
| P007 | `docs/thesis/AIM/analysis/design_principles.tex:138` | `docs/thesis/AIM/analysis/design_principles-DE.tex:63` | SCI-EMP | literature + validation required | Different components of the pipeline must be evaluated at appropriate scales. |
| P008 | `docs/thesis/AIM/analysis/design_principles.tex:154` | `docs/thesis/AIM/analysis/design_principles-DE.tex:71` | SCI-EMP | literature + validation required | Measured data must be integrated through the world-to-track transformation, not directly in world space. |
| P009 | `docs/thesis/AIM/analysis/design_principles.tex:166` | `docs/thesis/AIM/analysis/design_principles-DE.tex:78` | SCI-EMP | literature + validation required | Regularization is an essential component of alignment modelling and optimization. |
| P010 | `docs/thesis/AIM/analysis/design_principles.tex:183` | `docs/thesis/AIM/analysis/design_principles-DE.tex:86` | SCI-EMP | literature + validation required | Alignment solutions are not unique and must be evaluated based on engineering criteria. |
| P011 | `docs/thesis/AIM/analysis/failure_modes.tex:32` | `docs/thesis/AIM/analysis/failure_modes-DE.tex:12` | SCI-EMP | literature + validation required | CRS inconsistencies lead to systematic spatial distortions that cannot be corrected by local alignment optimization |
| P012 | `docs/thesis/AIM/analysis/failure_modes.tex:49` | `docs/thesis/AIM/analysis/failure_modes-DE.tex:21` | SCI-EMP | literature + validation required | Projection errors introduce nonlocal distortions in the intrinsic coordinate \(s\), affecting all downstream comput |
| P013 | `docs/thesis/AIM/analysis/failure_modes.tex:79` | `docs/thesis/AIM/analysis/failure_modes-DE.tex:36` | SCI-EMP | literature + validation required | Regularization is required to balance model fidelity and stability. |
| P014 | `docs/thesis/AIM/analysis/failure_modes.tex:95` | `docs/thesis/AIM/analysis/failure_modes-DE.tex:43` | SCI-EMP | literature + validation required | Certain features of the target alignment are not physically realizable and will be systematically suppressed. |
| P015 | `docs/thesis/AIM/analysis/failure_modes.tex:111` | `docs/thesis/AIM/analysis/failure_modes-DE.tex:52` | SCI-EMP | literature + validation required | Regularization and prior knowledge are essential for stable solutions. |
| P016 | `docs/thesis/AIM/analysis/failure_modes.tex:141` | `docs/thesis/AIM/analysis/failure_modes-DE.tex:64` | SCI-EMP | literature + validation required | Loss of block separability reduces computational efficiency and interpretability. |
| P017 | `docs/thesis/AIM/analysis/failure_modes.tex:158` | `docs/thesis/AIM/analysis/failure_modes-DE.tex:72` | SCI-EMP | literature + validation required | Noise propagates through the pipeline and may be amplified by inverse operations. |
| P018 | `docs/thesis/AIM/analysis/failure_modes.tex:183` | `docs/thesis/AIM/analysis/failure_modes-DE.tex:88` | SCI-EMP | literature + validation required | The mapping \[ _target \;\; _real \] is not injective. |
| P019 | `docs/thesis/AIM/analysis/failure_modes.tex:212` | `docs/thesis/AIM/analysis/failure_modes-DE.tex:102` | SCI-EMP | literature + validation required | The AIM pipeline is inherently approximate and limited by both physical and computational constraints. |
| P020 | `docs/thesis/AIM/analysis/pipeline.tex:193` | `docs/thesis/AIM/analysis/pipeline-DE.tex:97` | SCI-EMP | literature + validation required | Alignment modelling is not a single mapping, but a composition of geometric, physical, and computational operators. |
| P021 | `docs/thesis/AIM/analysis/pipeline_story.tex:124` | `docs/thesis/AIM/analysis/pipeline_story-DE.tex:68` | CONTRACT | Kernel trace + conformance required | A measured point is not directly part of the alignment. It becomes part of the alignment only after passing through |
| P022 | `docs/thesis/AIM/dynamics/realization_aware_dynamics.tex:49` | `docs/thesis/AIM/dynamics/realization_aware_dynamics-DE.tex:50` | CONTRACT | Kernel trace + conformance required | Realization-filter principle: Changing the qualified model input can change a prediction while preserving Alignment identity. The change must not |
| P023 | `docs/thesis/AIM/dynamics/vehicle_space.tex:14` | `docs/thesis/AIM/dynamics/vehicle_space-DE.tex:14` | CONTRACT | Kernel trace + conformance required | State hierarchy: \[ vehicleState_M(t) = V_M( S_rail(s(t)),Q_M ), \] but the railway state is not derived from \(vehicleState_M\). Th |
| P024 | `docs/thesis/AIM/foundations/axioms.tex:102` | `docs/thesis/AIM/foundations/axioms-DE.tex:106` | SCI-MATH | proof present | Curvature-driven reconstruction: Given an initial position \((s_0)\), an initial heading \((s_0)\), and a sufficiently regular curvature function \( |
| P025 | `docs/thesis/AIM/foundations/ontology.tex:122` | `docs/thesis/AIM/foundations/ontology-DE.tex:139` | CONTRACT | Kernel trace + conformance required | Engineering objects, states, realizations, representations, observations, engineering knowledge, evaluations, and d |
| P026 | `docs/thesis/AIM/foundations/operators.tex:30` | `docs/thesis/AIM/foundations/operators-DE.tex:31` | CONTRACT | Kernel trace + conformance required | Engineering dependencies that change the meaning, domain, or status of a state shall be represented explicitly thro |
| P027 | `docs/thesis/AIM/foundations/system_layers.tex:100` | `docs/thesis/AIM/foundations/system_layers-DE.tex:102` | CONTRACT | Kernel trace + conformance required | A coordinate transformation may change metric properties of a representation under projection; it does not change i |
| P028 | `docs/thesis/AIM/foundations/system_layers.tex:107` | `docs/thesis/AIM/foundations/system_layers-DE.tex:109` | CONTRACT | Kernel trace + conformance required | An alignment consequence is trustworthy only when the constructive, metric, representational, physical, observation |
| P029 | `docs/thesis/AIM/foundations/system_layers.tex:114` | `docs/thesis/AIM/foundations/system_layers-DE.tex:116` | CONTRACT | Kernel trace + conformance required | Operational consequences arise from declared compositions of state, context, operators, and applicable engineering  |
| P030 | `docs/thesis/AIM/geometry/curvature_classes.tex:407` | `docs/thesis/AIM/geometry/curvature_classes-DE.tex:253` | SCI-EMP | literature + validation required | Spectral realization principle: High-frequency curvature components are attenuated by realization. |
| P031 | `docs/thesis/AIM/geometry/curvature_classes.tex:467` | `docs/thesis/AIM/geometry/curvature_classes-DE.tex:286` | SCI-EMP | literature + validation required | Different curvature classes correspond to fundamentally different geometric, operational, runtime, and realization  |
| P032 | `docs/thesis/AIM/geometry/curvature_classes.tex:472` | `docs/thesis/AIM/geometry/curvature_classes-DE.tex:291` | SCI-EMP | literature + validation required | Within AIM, railway alignment quality is primarily characterized in curvature space rather than position space. |
| P033 | `docs/thesis/AIM/geometry/curvature_classes.tex:477` | `docs/thesis/AIM/geometry/curvature_classes-DE.tex:295` | SCI-EMP | literature + validation required | Transition families are interpreted as structured subsets of curvature classes. |
| P034 | `docs/thesis/AIM/geometry/curvature_classes.tex:482` | `docs/thesis/AIM/geometry/curvature_classes-DE.tex:299` | SCI-EMP | literature + validation required | Admissibility is not a purely geometric property, but a combined geometric, dynamic, runtime, and realization prope |
| P035 | `docs/thesis/AIM/geometry/curvature_classification.tex:303` | `docs/thesis/AIM/geometry/curvature_classification-DE.tex:195` | SCI-EMP | literature + validation required | Spectral realization principle: Realization suppresses high-frequency curvature components. |
| P036 | `docs/thesis/AIM/geometry/curvature_classification.tex:474` | `docs/thesis/AIM/geometry/curvature_classification-DE.tex:305` | SCI-EMP | literature + validation required | Within AIM, curvature classification is fundamentally intrinsic rather than coordinate-based. |
| P037 | `docs/thesis/AIM/geometry/curvature_classification.tex:479` | `docs/thesis/AIM/geometry/curvature_classification-DE.tex:309` | SCI-EMP | literature + validation required | Transition quality cannot be characterized sufficiently by position geometry alone. |
| P038 | `docs/thesis/AIM/geometry/curvature_classification.tex:484` | `docs/thesis/AIM/geometry/curvature_classification-DE.tex:313` | SCI-EMP | literature + validation required | Realization, runtime stability, dynamics, and optimization require classification directly in curvature space. |
| P039 | `docs/thesis/AIM/geometry/curvature_classification.tex:489` | `docs/thesis/AIM/geometry/curvature_classification-DE.tex:317` | SCI-EMP | literature + validation required | Transition taxonomy in AIM is multidimensional and context-dependent. |
| P040 | `docs/thesis/AIM/geometry/curvature_space.tex:278` | `docs/thesis/AIM/geometry/curvature_space-DE.tex:227` | SCI-EMP | literature + validation required | Spectral realization principle: Realization acts approximately as a low-pass filter on curvature space. |
| P041 | `docs/thesis/AIM/geometry/curvature_space.tex:345` | `docs/thesis/AIM/geometry/curvature_space-DE.tex:268` | SCI-EMP | literature + validation required | Within AIM, railway alignment geometry is fundamentally a curvature-space problem. |
| P042 | `docs/thesis/AIM/geometry/curvature_space.tex:350` | `docs/thesis/AIM/geometry/curvature_space-DE.tex:272` | SCI-EMP | literature + validation required | Position-space geometry is interpreted as reconstructed geometry derived from curvature evolution. |
| P043 | `docs/thesis/AIM/geometry/curvature_space.tex:355` | `docs/thesis/AIM/geometry/curvature_space-DE.tex:276` | SCI-EMP | literature + validation required | Transition curves are interpreted as controlled transitions within curvature space. |
| P044 | `docs/thesis/AIM/geometry/curvature_space.tex:360` | `docs/thesis/AIM/geometry/curvature_space-DE.tex:280` | SCI-EMP | literature + validation required | Realization, runtime evaluation, and optimization act on curvature-space structures before they act on visualized p |
| P045 | `docs/thesis/AIM/geometry/curvature_transitions.tex:522` | `docs/thesis/AIM/geometry/curvature_transitions-DE.tex:368` | SCI-EMP | literature + validation required | Spectral transition principle: Transition quality depends not only on curvature continuity, but also on spectral behaviour within curvature space. |
| P046 | `docs/thesis/AIM/geometry/curvature_transitions.tex:584` | `docs/thesis/AIM/geometry/curvature_transitions-DE.tex:405` | SCI-EMP | literature + validation required | Transition curves are fundamentally curvature-transition laws. |
| P047 | `docs/thesis/AIM/geometry/curvature_transitions.tex:588` | `docs/thesis/AIM/geometry/curvature_transitions-DE.tex:408` | SCI-EMP | literature + validation required | Within AIM, transition geometry is interpreted intrinsically within curvature space. |
| P048 | `docs/thesis/AIM/geometry/curvature_transitions.tex:593` | `docs/thesis/AIM/geometry/curvature_transitions-DE.tex:412` | SCI-EMP | literature + validation required | Sparse transition models represent compact transition operators rather than explicit geometric curves. |
| P049 | `docs/thesis/AIM/geometry/curvature_transitions.tex:598` | `docs/thesis/AIM/geometry/curvature_transitions-DE.tex:416` | SCI-EMP | literature + validation required | Transition quality depends on curvature evolution, derivative behaviour, spectral content, runtime stability, and r |
| P050 | `docs/thesis/AIM/introduction.tex:137` | `docs/thesis/AIM/introduction-DE.tex:149` | SCI-EMP | literature + validation required | Central thesis: An alignment can be treated coherently across design, realization, observation, evaluation, and change when its int |
| P051 | `docs/thesis/AIM/modeling/sparse.tex:153` | `docs/thesis/AIM/modeling/sparse-DE.tex:144` | SCI-MATH | proof/derivation required | The planar alignment is reconstructed by successive integration of the curvature law: \[ (s) (s) (s). \] |
| P052 | `docs/thesis/AIM/modeling/sparse.tex:257` | `docs/thesis/AIM/modeling/sparse-DE.tex:225` | CONTRACT | Kernel trace + conformance required | Pose3 is not treated as persistent truth within the sparse model. |
| P053 | `docs/thesis/AIM/modeling/transition_classification.tex:15` | `docs/thesis/AIM/modeling/transition_classification-DE.tex:10` | SCI-MATH | proof/derivation required | Any transition curve can be represented by a curvature function \[ : [0,L] . \] |
| P054 | `docs/thesis/AIM/modeling/transition_classification.tex:149` | `docs/thesis/AIM/modeling/transition_classification-DE.tex:107` | SCI-EMP | literature + validation required | Transition curves can be interpreted as control functions acting on system dynamics through curvature evolution. |
| P055 | `docs/thesis/AIM/modeling/transitions.tex:205` | `docs/thesis/AIM/modeling/transitions-DE.tex:101` | SCI-MATH | proof/derivation required | Let \kappa be a normalized transition law. Then a physical transition is given by \[ (s) = _0 + (_1-_0) \, \kappa \ |
| P056 | `docs/thesis/AIM/optimization/alignment/10_continuous_curvature_optimization.tex:62` | `docs/thesis/AIM/optimization/alignment/10_continuous_curvature_optimization-DE.tex:42` | SCI-MATH | proof/derivation required | If \(^\) is a minimizer, then \[ ^(s)=0. \] |
| P057 | `docs/thesis/AIM/optimization/alignment/10_continuous_curvature_optimization.tex:71` | `docs/thesis/AIM/optimization/alignment/10_continuous_curvature_optimization-DE.tex:50` | SCI-MATH | proof/derivation required | The minimizer is \[ ^(s)=\kappa_1Ls . \] |
| P058 | `docs/thesis/AIM/optimization/alignment/10_continuous_curvature_optimization.tex:94` | `docs/thesis/AIM/optimization/alignment/10_continuous_curvature_optimization-DE.tex:68` | SCI-MATH | proof/derivation required | Minimizers satisfy \[ ^(4)(s)=0. \] |
| P059 | `docs/thesis/AIM/optimization/alignment/10_continuous_curvature_optimization.tex:304` | `docs/thesis/AIM/optimization/alignment/10_continuous_curvature_optimization-DE.tex:213` | SCI-MATH | proof/derivation required | If \((s) 0\), the coupled problem reduces to a pure curvature optimization problem. |
| P060 | `docs/thesis/AIM/optimization/alignment/10_continuous_curvature_optimization.tex:309` | `docs/thesis/AIM/optimization/alignment/10_continuous_curvature_optimization-DE.tex:217` | SCI-MATH | proof/derivation required | If \(a_eff(s)=0\) for all \(s\), then \[ v^2 (s)=g(s), \] and the design is perfectly balanced. |
| P061 | `docs/thesis/AIM/optimization/alignment/50_sqp_analytic_structure.tex:19` | `docs/thesis/AIM/optimization/alignment/50_sqp_analytic_structure-DE.tex:9` | SCI-MATH | proof/derivation required | All state variables are obtained via arc-length integration: \[ (s) = _0 + _0^s ()\,, \] \[ (s) = _0 + _0^s (,)\,.  |
| P062 | `docs/thesis/AIM/optimization/alignment/50_sqp_analytic_structure.tex:46` | `docs/thesis/AIM/optimization/alignment/50_sqp_analytic_structure-DE.tex:26` | SCI-MATH | proof/derivation required | \[ \partial \theta(s) p = _0^s \partial \kappa p\,. \] |
| P063 | `docs/thesis/AIM/optimization/alignment/50_sqp_analytic_structure.tex:55` | `docs/thesis/AIM/optimization/alignment/50_sqp_analytic_structure-DE.tex:32` | SCI-MATH | proof/derivation required | \[ \partial \gamma(s) p = _0^s - \\ \partial \theta p\,. \] |
| P064 | `docs/thesis/AIM/optimization/alignment/50_sqp_analytic_structure.tex:74` | `docs/thesis/AIM/optimization/alignment/50_sqp_analytic_structure-DE.tex:43` | SCI-MATH | proof/derivation required | The optimization problem admits exact Jacobians without numerical approximation. |
| P065 | `docs/thesis/AIM/optimization/alignment/60_parametric_and_hybrid.tex:82` | `docs/thesis/AIM/optimization/alignment/60_parametric_and_hybrid-DE.tex:41` | SCI-MATH | proof/derivation required | Derivatives reduce to: \[ \partial \kappa p = (_1 - _0) \partial \widehat\kappa p. \] |
| P066 | `docs/thesis/AIM/optimization/hybrid_block_structure.tex:175` | `docs/thesis/AIM/optimization/hybrid_block_structure-DE.tex:85` | SCI-EMP | literature + validation required | The hybrid formulation separates structural modelling from data fitting while preserving a sparse and well-conditio |
| P067 | `docs/thesis/AIM/reality/construction_and_realization.tex:112` | `docs/thesis/AIM/reality/construction_and_realization-DE.tex:107` | SCI-MATH | proof/derivation required | Fixed point interpretation: If iterative realization converges, \[ _real= A__target(_real). \] |
| P068 | `docs/thesis/AIM/reality/construction_and_realization.tex:134` | `docs/thesis/AIM/reality/construction_and_realization-DE.tex:128` | SCI-EMP | literature + validation required | Adaptive sampling principle: Sampling density should increase in regions with strong curvature variation. |
| P069 | `docs/thesis/AIM/reality/construction_and_realization.tex:150` | `docs/thesis/AIM/reality/construction_and_realization-DE.tex:143` | SCI-EMP | literature + validation required | Locality: Adjustment depends on local neighbourhood context rather than global alignment state. |
| P070 | `docs/thesis/AIM/reality/construction_and_realization.tex:180` | `docs/thesis/AIM/reality/construction_and_realization-DE.tex:173` | SCI-EMP | literature + validation required | Physical realization acts approximately as a low-pass filter on curvature and related high-frequency components. |
| P071 | `docs/thesis/AIM/reality/construction_and_realization.tex:218` | `docs/thesis/AIM/reality/construction_and_realization-DE.tex:210` | SCI-EMP | literature + validation required | Realization-aware design principle: The relevant design criterion is performance of realized state, not only analytic smoothness of target state. |
| P072 | `docs/thesis/AIM/reality/construction_and_realization.tex:224` | `docs/thesis/AIM/reality/construction_and_realization-DE.tex:216` | SCI-MATH | proof/derivation required | The physical design space is the image of the realization operator. |
| P073 | `docs/thesis/AIM/reality/km_line_and_stationing.tex:54` | `docs/thesis/AIM/reality/km_line_and_stationing-DE.tex:41` | CONTRACT | Kernel trace + conformance required | Railway modelling requires separation of \[ spatial embedding geometric alignment stationing reference. \] |
| P074 | `docs/thesis/AIM/runtime/runtime_operators.tex:174` | `docs/thesis/AIM/runtime/runtime_operators-DE.tex:132` | REFERENCE | relabel/move review required | Within AIM, runtime interpretation is operator-based. |
| P075 | `docs/thesis/AIM/runtime/runtime_operators.tex:178` | `docs/thesis/AIM/runtime/runtime_operators-DE.tex:135` | REFERENCE | relabel/move review required | The realization operator \( R\) maps target states to realized states. |
| P076 | `docs/thesis/AIM/runtime/runtime_operators.tex:183` | `docs/thesis/AIM/runtime/runtime_operators-DE.tex:138` | REFERENCE | relabel/move review required | The dynamics operator \( D\) maps railway runtime states to operational dynamic state trajectories. |
| P077 | `docs/thesis/AIM/runtime/runtime_operators.tex:188` | `docs/thesis/AIM/runtime/runtime_operators-DE.tex:142` | REFERENCE | relabel/move review required | The vehicle operator \( V\) maps railway runtime states to vehicle-relative interpretation states. |
| P078 | `docs/thesis/AIM/runtime/runtime_operators.tex:193` | `docs/thesis/AIM/runtime/runtime_operators-DE.tex:146` | REFERENCE | relabel/move review required | The operational operator \( O\) maps operational states to evaluation and admissibility states. |
| P079 | `docs/thesis/AIM/runtime/runtime_services.tex:471` | `docs/thesis/AIM/runtime/runtime_services-DE.tex:399` | REFERENCE | relabel/move review required | Within AIM, runtime services are operator-based evaluation systems acting on established engineering and state conc |
| P080 | `docs/thesis/AIM/runtime/runtime_services.tex:476` | `docs/thesis/AIM/runtime/runtime_services-DE.tex:404` | REFERENCE | relabel/move review required | Derived runtime quantities are evaluation results and are not persistent engineering identity. |
| P081 | `docs/thesis/AIM/runtime/runtime_services.tex:481` | `docs/thesis/AIM/runtime/runtime_services-DE.tex:409` | REFERENCE | relabel/move review required | Projection, frame construction, metric realization, and runtime dynamics form a coupled service architecture. |
| P082 | `docs/thesis/AIM/runtime/runtime_services.tex:486` | `docs/thesis/AIM/runtime/runtime_services-DE.tex:414` | REFERENCE | relabel/move review required | Representation remains downstream of runtime evaluation. |
| P083 | `docs/thesis/AIM/state/pose2.tex:68` | `docs/thesis/AIM/state/pose2-DE.tex:71` | SCI-MATH | proof/derivation required | The Alignment's intrinsic curvature construction is persistent engineering information; pose2 is its planar state u |
| P084 | `docs/thesis/AIM/state/pose3_and_cant.tex:122` | `docs/thesis/AIM/state/pose3_and_cant-DE.tex:128` | SCI-MATH | proof/derivation required | pose3 reconstruction principle: Given \((s)\), \(h(s)\), and \(u(s)\), together with a starting pose, metric realization, gauge, orientation and fr |
| P085 | `docs/thesis/AIM/state/pose3_and_cant.tex:161` | `docs/thesis/AIM/state/pose3_and_cant-DE.tex:170` | CONTRACT | Kernel trace + conformance required | Track state principle: Pose3 describes a qualified railway pose. Vehicle states require additional vehicle-space operators and models. |
| P086 | `docs/thesis/AIM/state/world_to_track.tex:336` | `docs/thesis/AIM/state/world_to_track-DE.tex:268` | SCI-EMP | literature + validation required | Selective projection principle: Exact projection should only be evaluated where high precision is required. |
| P087 | `docs/thesis/AIM/state/world_to_track.tex:382` | `docs/thesis/AIM/state/world_to_track-DE.tex:298` | CONTRACT | Kernel trace + conformance required | World--track transformation is an inverse runtime service rather than a static coordinate conversion. |
| P088 | `docs/thesis/AIM/state/world_to_track.tex:387` | `docs/thesis/AIM/state/world_to_track-DE.tex:302` | CONTRACT | Kernel trace + conformance required | Within AIM, intrinsic alignment space is primary, whereas world coordinates are interpreted as external embeddings  |
| P089 | `docs/thesis/AIM/state/world_to_track.tex:392` | `docs/thesis/AIM/state/world_to_track-DE.tex:306` | CONTRACT | Kernel trace + conformance required | Projection is generally: nonlinear, ambiguous, topology-dependent, runtime-dependent, and context-sensitive. |
| P090 | `docs/thesis/AIM/why/sections/alignment_is_not_a_curve.tex:73` | `docs/thesis/AIM/why/sections/alignment_is_not_a_curve-DE.tex:75` | SCI-EMP | literature + validation required | An alignment is a low-dimensional structured object, even though its realization may involve high-dimensional data. |
| P091 | `docs/thesis/AIM/why/sections/alignment_is_not_a_curve.tex:106` | `docs/thesis/AIM/why/sections/alignment_is_not_a_curve-DE.tex:108` | SCI-EMP | literature + validation required | An alignment is not a curve, but a curvature-driven generative model of a curve. |
| P092 | `docs/thesis/AIM/why/vision.tex:22` | `docs/thesis/AIM/why/vision-DE.tex:24` | SCI-EMP | literature + validation required | AIM proposition: Alignment-Based Information Modelling is an alignment-specific engineering environment in which durable object iden |

## Classification result

| Class | Count | Dissertation obligation |
|---|---:|---|
| SCI-MATH | 18 | Prove, derive, cite or reformulate. |
| SCI-EMP | 51 | Position in research state and validate or bound. |
| CONTRACT | 14 | Trace to approved Kernel/engineering authority and test conformance. |
| REFERENCE | 9 | Relabel or move unless promoted through a separate scientific argument. |
| **Total** | **92** | Every EN item retains its paired DE review obligation. |

## Immediate implications

1. The observed “92 propositions, one proof” ratio must not be answered by
   writing 91 artificial proofs. The inventory separates mathematical proof
   obligations from empirical validation, normative conformance and reference
   editing.
2. The classes are working dispositions. Reclassification is allowed only with
   a recorded rationale and does not itself approve or alter Kernel meaning.
3. DISS-04 should begin with SCI-MATH. SCI-EMP should be linked to research
   questions and the real validation case before final wording. CONTRACT items
   should be renamed only after traceability against the architectural
   authority. REFERENCE items can be consolidated independently.
4. EN/DE wording parity remains a separate semantic audit; this package confirms
   presence and ordinal pairing, not translation equivalence.

