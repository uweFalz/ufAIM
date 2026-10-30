import { buildSparseFromEditModel } from "../../aim-core/alignment/aggregate/SparseAlignmentBuilder.js";
import { makeAlignment2DFromSparse } from "../../aim-core/alignment/aggregate/AlignmentFactory.js";
import { createAlignmentVariableCodec } from "../../domain/optimization/alignment/AlignmentVariableCodec.js";
import { createAlignmentConstraintBuilder, EVIDENCE_ONLY } from "../../domain/optimization/alignment/AlignmentConstraintBuilder.js";
import { createAlignmentResidualBuilder } from "../../domain/optimization/alignment/AlignmentResidualBuilder.js";
import { createAlignmentOptimizationProblem } from "../../domain/optimization/alignment/AlignmentOptimizationProblem.js";
import { createIntrinsicMetricContext } from "../../domain/optimization/alignment/MetricContext.js";
import { solveAlignmentProblem } from "../../domain/optimization/alignment/AlignmentSQPSolver.js";
import { createAlignmentPoseJacobian } from "../../domain/optimization/alignment/AlignmentPoseJacobian.js";
import { createFootMemory } from "../../domain/optimization/alignment/AlignmentPointProjection.js";
import { deps as dependencies, momentsFor } from "../../domain/optimization/alignment/SolverDependencies.js";
import { preparePointObservationInput } from "./AlignmentPointEvidenceRequest.js";
import { freezeObservationJson } from "../../domain/observation/PointObservationSet.js";

export const ALIGNMENT_AXTRAN_EVIDENCE_VERSION = "alignment-axtran-evidence/0.4";
export const HOLDABLE_COMPONENTS = Object.freeze(["x", "y", "theta"]);
export const FIT_MODES = Object.freeze(["keep-plan", "measurements-only"]);
// Decided for the app's main journey (AXTRAN2_LENGTH_PRIOR_PROPOSAL.md, A):
// the edited plan is kept where the samples are indifferent, with sigma 5 %.
export const DEFAULT_PLAN_SIGMA = 0.05;

const MAX_INTERACTIVE_SOLVER_VARIABLES = 96;


function startPoseOf(alignmentData) {
	const pose = alignmentData?.editModel?.startPose ?? {};
	const x = Number(pose?.p?.x ?? 0), y = Number(pose?.p?.y ?? 0);
	const tx = Number(pose?.t?.x ?? 1), ty = Number(pose?.t?.y ?? 0);
	return Object.freeze({ x, y, theta: Math.atan2(ty, tx) });
}

/** The declared elements as the pose Jacobian's chain wants them, the overlay applied. */
function chainElements(alignmentData, declaredIds, overlay = {}) {
	return alignmentData.editModel.elements
		.filter((element) => declaredIds.has(String(element.id)))
		.map((element) => {
			const kind = kindOf(element);
			const patch = overlay[element.id] ?? {};
			const length = Number.isFinite(patch.length) ? patch.length : lengthOf(element);
			if (kind === "arc") return { id: String(element.id), type: "arc", length, curvature: Number.isFinite(patch.curvature) ? patch.curvature : curvatureOf(element) };
			if (kind === "transition") return { id: String(element.id), type: "transition", length, family: String(element?.parameters?.transitionType ?? element?.transitionType ?? "clothoid") };
			return { id: String(element.id), type: "straight", length };
		});
}

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
				// The sparse builder reads a radius before a curvature wherever both
				// are present, and the editor stores both. A curvature patch that
				// left parameters.radius at the old value changed nothing in the
				// geometry: the curvature variable moved, the residuals did not, the
				// chain contradicted them, and every browser edit's evidence ended
				// in a failed line search. Both are kept consistent.
				const radius = patch.curvature === undefined ? {} : { radius: patch.curvature ? 1 / patch.curvature : null };
				return {
					...element,
					parameters: { ...element.parameters, ...patch, ...radius },
					...(patch.length === undefined ? {} : { length: patch.length }),
					...(patch.curvature === undefined ? {} : { curvature: patch.curvature, ...radius }),
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

function declaredElements(alignmentData, heldElements = new Set()) {
	return alignmentData.editModel.elements.flatMap((element) => {
		const kind = kindOf(element);
		const length = lengthOf(element);
		const curvature = kind === "arc" ? curvatureOf(element) : null;
		if (kind === "transition" && String(element?.parameters?.transitionType ?? element?.transitionType ?? "").trim().toLowerCase() === "immediate" && length === 0) {
			return [];
		}
		if (!String(element?.id ?? "").trim() || !Number.isFinite(length) || length <= 0 || (kind === "arc" && !Number.isFinite(curvature))) {
			throw new Error("AXTRAN evidence requires finite native horizontal elements");
		}
		const role = heldElements.has(String(element.id)) ? "held" : "free";
		return [{
			id: String(element.id),
			quantities: {
				length: role,
				...(kind === "arc" ? { curvature: role } : {}),
			},
			values: { length, ...(kind === "arc" ? { curvature } : {}) },
		}];
	});
}

export class AlignmentAxtranEvidenceService {
	/**
	 * @param {Array} [input.heldPoses]     [{ afterElement, x?, y?, theta? }] explicit, or
	 *        [{ afterElement, hold: ["theta"] | ["x", "y", "theta"] }] to hold the pose the
	 *        pre-edit realization has at that joint - the turnout's tangent, as the editor declares it
	 * @param {string[]} [input.heldElements]  element ids whose length and curvature are not free
	 * @param {object|null} [input.turnout]    { elementId, designation, side } carried as provenance of a held branch
	 * @param {object} [input.pointObservationInput] explicit source set, assignments and
	 *        alignment metric context; only an omitted property uses pre-edit samples
	 */
	evaluateChange(input = {}) {
		const { beforeAlignmentData, afterAlignmentData, sampleCount = 12, maxIterations = 200, hessian = "gauss-newton", fitMode = "keep-plan", planSigma = DEFAULT_PLAN_SIGMA, heldPoses = [], heldElements = [], turnout = null } = input;
		const pointInput = Object.hasOwn(input, "pointObservationInput") ? preparePointObservationInput(input.pointObservationInput) : null;
		const evaluatedInput = pointInput ? freezeObservationJson(structuredClone({
			beforeAlignmentData,
			afterAlignmentData,
			pointObservationInput: { observationSet: pointInput.observationSet, assignments: pointInput.assignments, alignmentMetricContext: pointInput.alignmentMetricContext },
			options: { maxIterations, hessian, fitMode, planSigma, heldPoses, heldElements, turnout },
		})) : null;
		if (!beforeAlignmentData?.editModel?.elements || !afterAlignmentData?.editModel?.elements) {
			throw new Error("AXTRAN evidence requires before and after native AlignmentData");
		}
		if (!FIT_MODES.includes(fitMode)) throw new Error(`AXTRAN evidence fit mode must be one of ${FIT_MODES.join(", ")}`);
		if (!(planSigma > 0)) throw new Error("AXTRAN evidence plan sigma must be positive");
		const before = alignmentFromData(beforeAlignmentData);
		if (!Array.isArray(heldElements) || heldElements.some((id) => typeof id !== "string")) throw new Error("AXTRAN evidence heldElements must be an array of element ids");
		const held = new Set(heldElements.map((id) => id.trim()));
		const declarations = declaredElements(afterAlignmentData, held);
		const declaredIds = new Set(declarations.map((element) => element.id));
		for (const id of held) if (!declaredIds.has(id)) throw new Error(`AXTRAN evidence cannot hold "${id}": not a declared element`);
		const codec = createAlignmentVariableCodec({ elements: declarations });
		if (codec.freeCount < 3) throw new Error("AXTRAN evidence requires at least three free quantities");
		const kinds = Object.fromEntries(afterAlignmentData.editModel.elements.map((element) => [String(element.id), kindOf(element)]));
		// Poses held at element joints, in the alignment's own frame - a
		// turnout's tangent or pose at its start or end - as the constraint
		// builder takes them ({ afterElement, x?, y?, theta? }). The editor
		// declares them by component only ({ afterElement, hold }): the values
		// are the pre-edit realization's at that joint, which is what "hold the
		// turnout's tangent" means to the user.
		if (!Array.isArray(heldPoses)) throw new Error("AXTRAN evidence heldPoses must be an array");
		const beforeStationAfter = (elementId) => {
			let station = 0;
			let found = false;
			for (const element of beforeAlignmentData.editModel.elements) {
				if (!declaredIds.has(String(element.id))) continue;
				station += lengthOf(element);
				if (String(element.id) === elementId) { found = true; break; }
			}
			if (!found) throw new Error(`AXTRAN evidence cannot hold the pose after "${elementId}": not an element of the pre-edit alignment`);
			return station;
		};
		const resolvedPoses = heldPoses.map((entry) => {
			if (!entry || typeof entry.afterElement !== "string") return entry;
			if (!Array.isArray(entry.hold)) return entry;
			const components = entry.hold.map(String);
			if (components.length === 0 || components.some((key) => !HOLDABLE_COMPONENTS.includes(key))) {
				throw new Error(`AXTRAN evidence hold must name components among ${HOLDABLE_COMPONENTS.join(", ")}`);
			}
			const pose = before.poseAt(beforeStationAfter(entry.afterElement), { quality: "exact" });
			const values = { x: pose.p.x, y: pose.p.y, theta: Math.atan2(pose.t.y, pose.t.x) };
			return { afterElement: entry.afterElement, ...Object.fromEntries(components.map((key) => [key, values[key]])) };
		});
		if (turnout !== null && (typeof turnout?.elementId !== "string" || typeof turnout?.designation !== "string")) {
			throw new Error("AXTRAN evidence turnout must carry elementId and designation");
		}
		const constraints = createAlignmentConstraintBuilder({
			endPose: poseOf(before),
			elementSequence: codec.elementSequence,
			minimumElementLength: 0.001,
			elementKinds: kinds,
			design: {},
			admitUnconfirmedDesign: EVIDENCE_ONLY,
			heldPoses: resolvedPoses,
			...(pointInput ? { hardPoints: pointInput.hardPoints } : {}),
		});
		const residuals = createAlignmentResidualBuilder({
			metricContext: pointInput ? pointInput.alignmentMetricContext : createIntrinsicMetricContext(),
			points: pointInput ? pointInput.points : sampleReference(before, sampleCount),
		});
		const problem = createAlignmentOptimizationProblem({ codec, constraints, residuals });
		const observationOnly = codec.freeCount > MAX_INTERACTIVE_SOLVER_VARIABLES;
		const effectiveMaxIterations = observationOnly ? 0 : maxIterations;
		// The residuals come from the production geometry; the derivatives from
		// the moment chain on the same elements, exact where a finite difference
		// cost one alignment build per free quantity. The samples' feet are
		// remembered between evaluations (#23). Measured on 21 elements, 26
		// free: 53 s -> under a second for a converged fit.
		const feet = createFootMemory({ samples: 240, refineSteps: 32 });
		const startPose = startPoseOf(afterAlignmentData);
		const buildAlignment = (overlay) => {
			const alignment = alignmentFromData(withOverlay(afterAlignmentData, overlay));
			return {
				endPose: poseOf(alignment),
				lengths: afterAlignmentData.editModel.elements
					.filter((element) => declaredIds.has(String(element.id)))
					.map((element) => Number(overlay[element.id]?.length ?? lengthOf(element))),
				worldToTrack: (x, y) => feet.project(alignment, x, y),
			};
		};
		const analyticJacobian = (overlay) => createAlignmentPoseJacobian({ elements: chainElements(afterAlignmentData, declaredIds, overlay), startPose, momentsFor });
		// The editor needs the consequence proposal, not the global weak-direction
		// eigendecomposition.  On a real imported alignment that report is cubic in
		// the number of free variables and can block the browser for minutes.
		// Keep that diagnostic for normal-sized fits while making the large-import
		// editor path explicitly bounded.
		const proposal = solveAlignmentProblem({
			problem,
			buildAlignment,
			analyticJacobian,
			objective: "points",
			hessian,
			maxIterations: effectiveMaxIterations,
			// keep-plan: a weak pseudo-observation on every free length toward the
			// edited value, the geodetic answer to lengths the samples cannot see
			...(fitMode === "keep-plan" ? { lengthPrior: { sigma: planSigma } } : {}),
			...(observationOnly ? { determinacy: "off" } : {}),
		});
		const diagnostics = Object.freeze({
			...proposal.diagnostics,
			interactiveBudget: Object.freeze({
				mode: observationOnly ? "observation-only" : "iterative",
				freeVariables: codec.freeCount,
				threshold: MAX_INTERACTIVE_SOLVER_VARIABLES,
				requestedMaxIterations: maxIterations,
				effectiveMaxIterations,
			}),
		});
		const determinacy = diagnostics.determinacy ?? null;
		// the lengths the samples did not determine, by element, with the play
		// of the direction each one leads
		const undetermined = Object.freeze((determinacy?.directions ?? [])
			.filter((direction) => direction.components?.[0]?.name?.endsWith(".length"))
			.map((direction) => Object.freeze({
				elementId: direction.components[0].name.slice(0, -".length".length),
				play: direction.play,
			}))
			.filter((entry, index, all) => all.findIndex((other) => other.elementId === entry.elementId) === index));
		return Object.freeze({
			version: ALIGNMENT_AXTRAN_EVIDENCE_VERSION,
			type: "axtran2-consequence-evidence",
			status: EVIDENCE_ONLY,
			admission: proposal.admission,
			admissible: false,
			proposalStatus: proposal.status,
			ok: proposal.ok,
			objective: proposal.objective,
			fitMode,
			planSigma: fitMode === "keep-plan" ? planSigma : null,
			undetermined,
			heldPoses: constraints.heldPoses,
			heldElements: Object.freeze([...held]),
			turnout: turnout === null ? null : Object.freeze({ elementId: turnout.elementId, designation: turnout.designation, side: turnout.side ?? null }),
			candidate: proposal.candidate,
			diagnostics,
			...(pointInput ? { pointObservation: Object.freeze({
				mode: "external-observations",
				setId: pointInput.observationSet.id,
				setRevision: pointInput.observationSet.revision,
				pointIds: Object.freeze(pointInput.points.map((point) => point.name)),
				metricContext: pointInput.alignmentMetricContext,
				evaluatedInput,
			}) } : {}),
			note: pointInput
				? `Evaluated against explicitly supplied external point observations in their declared shared planar frame; ${observationOnly ? "observation-only, " : ""}proposal-only and never applied automatically.`
				: observationOnly
				? "Derived from the pre-edit canonical realization at the edited point; observation-only, proposal-only, and never applied automatically."
				: "Derived from the pre-edit canonical realization; proposal-only and never applied automatically.",
		});
	}
}

export default AlignmentAxtranEvidenceService;
