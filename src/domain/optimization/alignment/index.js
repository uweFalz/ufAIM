// src/domain/optimization/alignment/index.js
//
// AXTRAN2 Calculation Kernel - the package entry "alignment-os/axtran2":
// what a caller needs to declare an alignment problem, solve it, read the
// verdict, and bring a Verm.esn TRA in and out. Everything here is proposal-only
// and never canonical truth (docs/app/architecture/AXTRAN2_OPTIMIZATION_BOUNDARY.md).

export { solveAlignmentProblem } from "./AlignmentSQPSolver.js";
export { solveAlignmentLexicographic, tierZeroReport, tierZeroSatisfied, FEASIBILITY_TOLERANCE } from "./AlignmentLexicographicSolver.js";
export { createAlignmentOptimizationProblem } from "./AlignmentOptimizationProblem.js";
export { createAlignmentConstraintBuilder, EVIDENCE_ONLY } from "./AlignmentConstraintBuilder.js";
export { createAlignmentResidualBuilder } from "./AlignmentResidualBuilder.js";
export { createAlignmentVariableCodec } from "./AlignmentVariableCodec.js";
export { createAlignmentPoseJacobian } from "./AlignmentPoseJacobian.js";
export { createFootMemory } from "./AlignmentPointProjection.js";
export { createIntrinsicMetricContext } from "./MetricContext.js";
export { createTransitionMomentsCatalogue } from "./TransitionMomentsCatalogue.js";
export { deps, momentsFor } from "./SolverDependencies.js";
export { chooseProfile, SPEED_CANDIDATES } from "./DesignProfileChoice.js";
export { buildProductionAlignment } from "./ProductionAlignment.js";
export { hauptbahn } from "./profiles/index.js";
export * from "./TurnoutCatalogue.js";
