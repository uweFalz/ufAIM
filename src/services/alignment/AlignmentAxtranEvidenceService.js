import transitionLookup from "../../domain/transition/transitionLookup.json" with { type: "json" };
import { buildSparseFromEditModel } from "../../aim-core/alignment/aggregate/SparseAlignmentBuilder.js";
import { makeAlignment2DFromSparse } from "../../aim-core/alignment/aggregate/AlignmentFactory.js";
import { RegistryResolver } from "../../domain/transition/registry/RegistryResolver.js";
import { KappaFcnBuilder } from "../../domain/transition/build/KappaFcnBuilder.js";
import { createAlignmentVariableCodec } from "../../domain/optimization/alignment/AlignmentVariableCodec.js";
import { createAlignmentConstraintBuilder, EVIDENCE_ONLY } from "../../domain/optimization/alignment/AlignmentConstraintBuilder.js";
import { createAlignmentResidualBuilder } from "../../domain/optimization/alignment/AlignmentResidualBuilder.js";
import { createAlignmentOptimizationProblem } from "../../domain/optimization/alignment/AlignmentOptimizationProblem.js";
import { createIntrinsicMetricContext } from "../../domain/optimization/alignment/MetricContext.js";
import { solveAlignmentProblem } from "../../domain/optimization/alignment/AlignmentSQPSolver.js";

export const ALIGNMENT_AXTRAN_EVIDENCE_VERSION = "alignment-axtran-evidence/0.1";

const resolver = new RegistryResolver(transitionLookup);
const dependencies = Object.freeze({ descriptorResolver: resolver, kappaBuilder: KappaFcnBuilder });

function kindOf(element) {
	return String(element?.type ?? element?.kind ?? "").trim().toLowerCase();
}

function lengthOf(element) {
	return Number(element?.parameters?.length ?? element?.length ?? element?.arcLength);
}

function curvatureOf(element) {
	const curvature = Number(element?.parameters?.curvature ?? element?.curvature);
	if (Number.isFinite(curvature)) return curvature;
	const radius = Number(element?.parameters?.radius ?? element?.radius);
	return Number.isFinite(radius) && radius !== 0 ? 1 / radius : Number.NaN;
}

function poseOf(alignment) {
	const pose = alignment.poseAt(alignment.arcLength, { quality: "exact" });
	return Object.freeze({ x: pose.p.x, y: pose.p.y, theta: Math.atan2(pose.t.y, pose.t.x) });
}

function alignmentFromData(alignmentData) {
	const sparse = buildSparseFromEditModel(alignmentData, dependencies);
	return makeAlignment2DFromSparse({ startPose: sparse.startPose, sparse: sparse.sparse, ...dependencies }).alignment;
}

function withOverlay(alignmentData, overlay) {
	return {
		...alignmentData,
		editModel: {
			...alignmentData.editModel,
			elements: alignmentData.editModel.elements.map((element) => {
				const patch = overlay[element.id];
				if (!patch) return element;
				return {
					...element,
					parameters: { ...element.parameters, ...patch },
					...(patch.length === undefined ? {} : { length: patch.length }),
					...(patch.curvature === undefined ? {} : { curvature: patch.curvature, radius: null }),
				};
			}),
		},
	};
}

function sampleReference(alignment, count) {
	return Array.from({ length: count }, (_, index) => {
		const s = alignment.arcLength * (index + 0.5) / count;
		const pose = alignment.poseAt(s, { quality: "exact" });
		return Object.freeze({ name: `before-${index + 1}`, x: pose.p.x, y: pose.p.y, tolerance: 0.01, kind: "derived-before-edit" });
	});
}

function declaredElements(alignmentData) {
	return alignmentData.editModel.elements.map((element) => {
		const kind = kindOf(element);
		const length = lengthOf(element);
		const curvature = kind === "arc" ? curvatureOf(element) : null;
		if (!String(element?.id ?? "").trim() || !Number.isFinite(length) || length <= 0 || (kind === "arc" && !Number.isFinite(curvature))) {
			throw new Error("AXTRAN evidence requires finite native horizontal elements");
		}
		return {
			id: String(element.id),
			quantities: {
				length: "free",
				...(kind === "arc" ? { curvature: "free" } : {}),
			},
			values: { length, ...(kind === "arc" ? { curvature } : {}) },
		};
	});
}

export class AlignmentAxtranEvidenceService {
	evaluateChange({ beforeAlignmentData, afterAlignmentData, sampleCount = 12, maxIterations = 12 } = {}) {
		if (!beforeAlignmentData?.editModel?.elements || !afterAlignmentData?.editModel?.elements) {
			throw new Error("AXTRAN evidence requires before and after native AlignmentData");
		}
		const before = alignmentFromData(beforeAlignmentData);
		const declarations = declaredElements(afterAlignmentData);
		const codec = createAlignmentVariableCodec({ elements: declarations });
		if (codec.freeCount < 3) throw new Error("AXTRAN evidence requires at least three free quantities");
		const kinds = Object.fromEntries(afterAlignmentData.editModel.elements.map((element) => [String(element.id), kindOf(element)]));
		const constraints = createAlignmentConstraintBuilder({
			endPose: poseOf(before),
			elementSequence: codec.elementSequence,
			minimumElementLength: 0.001,
			elementKinds: kinds,
			design: {},
			admitUnconfirmedDesign: EVIDENCE_ONLY,
		});
		const residuals = createAlignmentResidualBuilder({
			metricContext: createIntrinsicMetricContext(),
			points: sampleReference(before, sampleCount),
		});
		const problem = createAlignmentOptimizationProblem({ codec, constraints, residuals });
		const buildAlignment = (overlay) => {
			const alignment = alignmentFromData(withOverlay(afterAlignmentData, overlay));
			return {
				endPose: poseOf(alignment),
				lengths: afterAlignmentData.editModel.elements.map((element) => Number(overlay[element.id]?.length ?? lengthOf(element))),
				worldToTrack: (x, y) => alignment.world2Track(x, y, { samples: 240, refineSteps: 32 }),
			};
		};
		const proposal = solveAlignmentProblem({ problem, buildAlignment, objective: "points", maxIterations });
		return Object.freeze({
			version: ALIGNMENT_AXTRAN_EVIDENCE_VERSION,
			type: "axtran2-consequence-evidence",
			status: EVIDENCE_ONLY,
			admission: proposal.admission,
			admissible: false,
			proposalStatus: proposal.status,
			ok: proposal.ok,
			objective: proposal.objective,
			candidate: proposal.candidate,
			diagnostics: proposal.diagnostics,
			note: "Derived from the pre-edit canonical realization; proposal-only and never applied automatically.",
		});
	}
}

export default AlignmentAxtranEvidenceService;
