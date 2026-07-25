import { TRANSITION_SCHEMA_VERSION } from "../quantityRoles.js";

const DEFAULTS = Object.freeze({
	maxIterations: 64,
	convergenceTolerance: 1e-10,
	residualTolerance: 1e-8,
	finiteDifferenceStep: 1e-6,
	minimumStepNorm: 1e-12,
});

export function createTransitionContinuitySolver({
	model,
	options = {},
} = {}) {
	if (!model?.evaluate) throw new Error("createTransitionContinuitySolver: model.evaluate is required");
	const settings = { ...DEFAULTS, ...options };

	function solve(input = {}) {
		const immutableBefore = structuredClone(input);
		const normalized = normalizeProblem(input);
		if (!normalized.ok) return invalidCandidate(input, normalized.diagnostics, settings);
		const problem = normalized.problem;
		let parameters = Object.fromEntries([
			...Object.entries(problem.knownParameters),
			...problem.fixedParameters.map((parameter) => [parameter.id, parameter.value]),
			...problem.freeParameters.map((parameter) => [parameter.id, parameter.initialValue]),
		]);
		let iterations = 0;
		let convergenceState = "not-started";
		let evaluation = null;
		let equations = [];
		let residualVector = [];
		let residualNorm = Number.POSITIVE_INFINITY;
		const diagnostics = [];

		const initial = evaluate(parameters);
		if (!initial.ok) return invalidCandidate(problem, [diagnosticFromEvaluation(initial)], settings);
		({ evaluation, equations, residualVector, residualNorm } = initial);

		if (problem.freeParameters.length === 0) {
			convergenceState = residualNorm <= settings.residualTolerance ? "fixed-consistent" : "fixed-inconsistent";
		} else if (equations.length === 0) {
			convergenceState = "underdetermined";
		} else {
			for (iterations = 0; iterations < settings.maxIterations; iterations += 1) {
				if (residualNorm <= settings.convergenceTolerance) {
					convergenceState = "converged";
					break;
				}
				const jacobianResult = finiteDifferenceJacobian({ parameters, residualVector, freeParameters: problem.freeParameters, evaluate, settings });
				if (!jacobianResult.ok) {
					diagnostics.push(jacobianResult.diagnostic);
					convergenceState = jacobianResult.state;
					break;
				}
				const stepResult = leastSquaresStep(jacobianResult.jacobian, residualVector);
				if (!stepResult.ok) {
					diagnostics.push({ code: "CONTINUITY_SYSTEM_SINGULAR", reason: stepResult.reason, quantity: null, parameter: problem.freeParameters.map((entry) => entry.id).join(",") });
					convergenceState = "numerically-unresolved";
					break;
				}
				const stepNorm = norm(stepResult.step);
				if (stepNorm <= settings.minimumStepNorm) {
					convergenceState = residualNorm <= settings.residualTolerance ? "converged" : "stagnated";
					break;
				}
				const advanced = deterministicLineSearch({ parameters, step: stepResult.step, freeParameters: problem.freeParameters, evaluate, currentNorm: residualNorm });
				if (!advanced.ok) {
					convergenceState = "stagnated";
					diagnostics.push({ code: "CONTINUITY_LINE_SEARCH_STALLED", reason: "no deterministic bounded step reduced the residual norm", parameter: problem.freeParameters.map((entry) => entry.id).join(","), quantity: null });
					break;
				}
				parameters = advanced.parameters;
				({ evaluation, equations, residualVector, residualNorm } = advanced.result);
			}
			if (iterations >= settings.maxIterations) convergenceState = "iteration-limit";
			if (residualNorm <= settings.residualTolerance && convergenceState !== "underdetermined") convergenceState = "converged";
		}

		const equationCount = equations.length;
		const variableCount = problem.freeParameters.length;
		const rank = variableCount && equationCount ? matrixRank(numericalJacobianAt(parameters, residualVector, problem.freeParameters, evaluate, settings)) : 0;
		const state = classify({ residualNorm, equationCount, variableCount, rank, convergenceState, settings });
		if (Number.isFinite(residualNorm) && residualNorm > settings.residualTolerance) {
			const largest = [...equations].sort((left, right) => Math.abs(right.residual) - Math.abs(left.residual))[0] ?? null;
			diagnostics.push({
				code: "CONTINUITY_RESIDUAL_TOLERANCE_FAILURE",
				reason: `residual norm ${residualNorm} exceeds tolerance ${settings.residualTolerance}`,
				constraint: largest?.id ?? null,
				component: largest?.constraint?.joinId ?? largest?.constraint?.endpoint ?? null,
				parameter: problem.freeParameters.map((entry) => entry.id).join(",") || null,
				quantity: largest?.quantity ?? null,
			});
		}
		const solvedIds = state === "solved" || state === "solved-with-residual" || state === "overdetermined"
			? problem.freeParameters.map((parameter) => parameter.id)
			: [];
		const remaining = problem.freeParameters.filter((parameter) => !solvedIds.includes(parameter.id));
		const candidate = {
			candidateId: `${problem.problemId}::candidate-0001`,
			sourceProblemId: problem.problemId,
			transitionRecordId: problem.transitionRecord.id,
			schemaVersion: problem.transitionRecord.schemaVersion ?? TRANSITION_SCHEMA_VERSION,
			state,
			solvedParameters: Object.fromEntries(solvedIds.map((id) => [id, parameters[id]])),
			unchangedKnownParameters: structuredClone(problem.knownParameters),
			unchangedFixedParameters: Object.fromEntries(problem.fixedParameters.map((parameter) => [parameter.id, parameter.value])),
			remainingFreeParameters: remaining.map((parameter) => structuredClone(parameter)),
			activeConstraints: equations.map((equation) => structuredClone(equation.constraint)),
			endpointResiduals: equations.filter((equation) => equation.kind === "endpoint").map(publicResidual),
			joinResiduals: allJoinResiduals(evaluation, problem.constraints),
			convergence: {
				state: convergenceState,
				iterationCount: iterations,
				maxIterations: settings.maxIterations,
				convergenceTolerance: settings.convergenceTolerance,
				residualTolerance: settings.residualTolerance,
			},
			residualNorm: finiteOrNull(residualNorm),
			objective: { kind: "continuity-residual-l2", value: finiteOrNull(residualNorm), optimizationObjective: false },
			warnings: buildWarnings({ state, evaluation, diagnostics, equationCount, variableCount, rank }),
			diagnostics,
			provenance: {
				input: structuredClone(problem.provenance ?? null),
				transition: structuredClone(problem.transitionRecord.provenance ?? null),
			},
			evaluatorQuantities: structuredClone(evaluation?.evaluatorQuantities ?? []),
			requestedOutputQuantities: structuredClone(problem.requestedOutputQuantities),
			evaluation: structuredClone(evaluation),
			reviewStatus: "unreviewed-calculation-candidate",
			authoritative: false,
		};
		if (JSON.stringify(input) !== JSON.stringify(immutableBefore)) {
			throw new Error("solveTransitionContinuity: input mutation detected");
		}
		return candidate;

		function evaluate(candidateParameters) {
			const evaluated = model.evaluate({ transitionRecord: problem.transitionRecord, parameters: candidateParameters });
			if (!evaluated?.ok) return { ok: false, error: evaluated?.error ?? { code: "CONTINUITY_EVALUATION_FAILED", reason: "model evaluation failed" } };
			const assembled = assembleEquations(problem.constraints, evaluated);
			if (!assembled.ok) return assembled;
			return {
				ok: true,
				evaluation: evaluated,
				equations: assembled.equations,
				residualVector: assembled.equations.map((equation) => equation.residual),
				residualNorm: norm(assembled.equations.map((equation) => equation.scaledResidual)),
			};
		}
	}

	return { solve, settings: structuredClone(settings) };
}

function normalizeProblem(input) {
	const diagnostics = [];
	const transitionRecord = input?.transitionRecord;
	const problemId = String(input?.problemId ?? "").trim();
	if (!problemId) diagnostics.push({ code: "CONTINUITY_PROBLEM_ID_MISSING", reason: "problemId is required" });
	if (!transitionRecord?.id) diagnostics.push({ code: "CONTINUITY_TRANSITION_RECORD_MISSING", reason: "transitionRecord is required" });
	const knownParameters = isObject(input?.knownParameters) ? structuredClone(input.knownParameters) : {};
	const fixedParameters = normalizeParameterList(input?.fixedParameters, "fixed", diagnostics);
	const freeParameters = normalizeParameterList(input?.freeParameters, "free", diagnostics);
	const constraints = Array.isArray(input?.constraints) ? structuredClone(input.constraints) : [];
	const ids = [...fixedParameters, ...freeParameters].map((parameter) => parameter.id);
	if (new Set(ids).size !== ids.length) diagnostics.push({ code: "CONTINUITY_PARAMETER_DUPLICATE", reason: "fixed/free parameter identifiers must be unique" });
	for (const parameter of freeParameters) {
		if (!parameter.bounds || !Number.isFinite(parameter.bounds.min) || !Number.isFinite(parameter.bounds.max) || parameter.bounds.min > parameter.bounds.max) {
			diagnostics.push({ code: "CONTINUITY_PARAMETER_BOUNDS_INVALID", reason: `free parameter '${parameter.id}' requires ordered finite bounds`, parameter: parameter.id });
		} else if (parameter.initialValue < parameter.bounds.min || parameter.initialValue > parameter.bounds.max) {
			diagnostics.push({ code: "CONTINUITY_PARAMETER_INITIAL_OUT_OF_BOUNDS", reason: `initial value for '${parameter.id}' is outside bounds`, parameter: parameter.id });
		}
	}
	for (const constraint of constraints) {
		if (!constraint?.id || !["join", "endpoint"].includes(constraint.kind) || !constraint.quantity) {
			diagnostics.push({ code: "CONTINUITY_CONSTRAINT_INVALID", reason: "constraint requires id, kind and quantity", constraint: constraint?.id ?? null });
		}
	}
	return diagnostics.length ? { ok: false, diagnostics } : {
		ok: true,
		problem: {
			problemId,
			transitionRecord: structuredClone(transitionRecord),
			knownParameters,
			fixedParameters,
			freeParameters,
			constraints,
			requestedOutputQuantities: structuredClone(input?.requestedOutputQuantities ?? []),
			provenance: structuredClone(input?.provenance ?? null),
		},
	};
}

function normalizeParameterList(list, kind, diagnostics) {
	if (!Array.isArray(list)) return [];
	return list.map((entry) => {
		const id = String(entry?.id ?? "").trim();
		const value = Number(kind === "free" ? entry?.initialValue : entry?.value);
		if (!id || !Number.isFinite(value)) diagnostics.push({ code: "CONTINUITY_PARAMETER_INVALID", reason: `${kind} parameter requires id and finite value`, parameter: id || null });
		return kind === "free"
			? { id, initialValue: value, bounds: entry?.bounds ? { min: Number(entry.bounds.min), max: Number(entry.bounds.max) } : null, quantityRole: entry?.quantityRole ?? null, provenance: structuredClone(entry?.provenance ?? null) }
			: { id, value, quantityRole: entry?.quantityRole ?? null, provenance: structuredClone(entry?.provenance ?? null) };
	});
}

function assembleEquations(constraints, evaluation) {
	const equations = [];
	for (const constraint of constraints) {
		if (constraint.kind === "join") {
			const join = evaluation.joins?.find((entry) => entry.id === constraint.joinId);
			if (!join) {
				if (evaluation.inactiveJoins?.some((entry) => entry.id === constraint.joinId)) continue;
				return { ok: false, error: { code: "CONTINUITY_JOIN_UNAVAILABLE", reason: `join '${constraint.joinId}' is unavailable`, component: constraint.joinId, quantity: constraint.quantity } };
			}
			const residual = Number(join.quantities?.[constraint.quantity]?.residual);
			if (!Number.isFinite(residual)) return { ok: false, error: { code: "CONTINUITY_EVALUATION_NONFINITE", reason: "join residual is non-finite", component: constraint.joinId, quantity: constraint.quantity } };
			equations.push(makeEquation(constraint, residual, join.quantities[constraint.quantity]));
		} else {
			const endpoint = evaluation.endpoints?.[constraint.endpoint];
			const value = Number(endpoint?.quantities?.[constraint.quantity]);
			const target = Number(constraint.target);
			if (!Number.isFinite(value) || !Number.isFinite(target)) return { ok: false, error: { code: "CONTINUITY_EVALUATION_NONFINITE", reason: "endpoint value or target is non-finite", component: endpoint?.componentId ?? null, quantity: constraint.quantity } };
			equations.push(makeEquation(constraint, value - target, { value, target }));
		}
	}
	return { ok: true, equations };
}

function makeEquation(constraint, residual, values) {
	const scale = Number.isFinite(Number(constraint.scale)) && Number(constraint.scale) > 0 ? Number(constraint.scale) : 1;
	return { id: constraint.id, kind: constraint.kind, quantity: constraint.quantity, residual, scaledResidual: residual / scale, values: structuredClone(values), constraint: structuredClone(constraint) };
}

function finiteDifferenceJacobian({ parameters, residualVector, freeParameters, evaluate, settings }) {
	const jacobian = residualVector.map(() => freeParameters.map(() => 0));
	for (let column = 0; column < freeParameters.length; column += 1) {
		const parameter = freeParameters[column];
		const span = parameter.bounds.max - parameter.bounds.min;
		const h = Math.max(settings.finiteDifferenceStep * Math.max(1, Math.abs(parameters[parameter.id]), span), 1e-9);
		const plusValue = Math.min(parameter.bounds.max, parameters[parameter.id] + h);
		const minusValue = Math.max(parameter.bounds.min, parameters[parameter.id] - h);
		const denominator = plusValue - minusValue;
		if (!(denominator > 0)) return { ok: false, state: "numerically-unresolved", diagnostic: { code: "CONTINUITY_PARAMETER_IMMOBILE", reason: `parameter '${parameter.id}' has no finite-difference room`, parameter: parameter.id, quantity: null } };
		const plus = evaluate({ ...parameters, [parameter.id]: plusValue });
		const minus = evaluate({ ...parameters, [parameter.id]: minusValue });
		if (!plus.ok || !minus.ok) return { ok: false, state: "invalid-evaluation", diagnostic: diagnosticFromEvaluation(!plus.ok ? plus : minus, parameter.id) };
		for (let row = 0; row < residualVector.length; row += 1) jacobian[row][column] = (plus.residualVector[row] - minus.residualVector[row]) / denominator;
	}
	return { ok: true, jacobian };
}

function numericalJacobianAt(parameters, residualVector, freeParameters, evaluate, settings) {
	return finiteDifferenceJacobian({ parameters, residualVector, freeParameters, evaluate, settings }).jacobian ?? [];
}

function leastSquaresStep(jacobian, residuals) {
	const n = jacobian[0]?.length ?? 0;
	if (!n) return { ok: false, reason: "no variables" };
	const a = Array.from({ length: n }, () => Array(n).fill(0));
	const b = Array(n).fill(0);
	for (let row = 0; row < jacobian.length; row += 1) {
		for (let i = 0; i < n; i += 1) {
			b[i] -= jacobian[row][i] * residuals[row];
			for (let j = 0; j < n; j += 1) a[i][j] += jacobian[row][i] * jacobian[row][j];
		}
	}
	const damping = 1e-12;
	for (let i = 0; i < n; i += 1) a[i][i] += damping;
	const step = solveLinear(a, b);
	return step ? { ok: true, step } : { ok: false, reason: "normal equation is singular" };
}

function deterministicLineSearch({ parameters, step, freeParameters, evaluate, currentNorm }) {
	for (const factor of [1, 0.5, 0.25, 0.125, 0.0625, 0.03125]) {
		const next = { ...parameters };
		for (let index = 0; index < freeParameters.length; index += 1) {
			const parameter = freeParameters[index];
			next[parameter.id] = Math.max(parameter.bounds.min, Math.min(parameter.bounds.max, parameters[parameter.id] + factor * step[index]));
		}
		const result = evaluate(next);
		if (result.ok && result.residualNorm < currentNorm) return { ok: true, parameters: next, result };
	}
	return { ok: false };
}

function classify({ residualNorm, equationCount, variableCount, rank, convergenceState, settings }) {
	if (!Number.isFinite(residualNorm)) return "invalid-input";
	if (!variableCount) {
		if (!equationCount) return "underdetermined";
		if (residualNorm <= settings.convergenceTolerance) return "solved";
		if (residualNorm <= settings.residualTolerance) return "solved-with-residual";
		return "inconsistent";
	}
	if (!equationCount || rank < variableCount) return "underdetermined";
	if (equationCount > variableCount) return residualNorm <= settings.residualTolerance ? "overdetermined" : (convergenceState === "iteration-limit" ? "not-converged" : "inconsistent");
	if (residualNorm <= settings.convergenceTolerance) return "solved";
	if (residualNorm <= settings.residualTolerance) return "solved-with-residual";
	return convergenceState === "iteration-limit" || convergenceState === "stagnated" ? "not-converged" : "inconsistent";
}

function matrixRank(matrix, tolerance = 1e-9) {
	if (!matrix.length) return 0;
	const a = matrix.map((row) => [...row]);
	let rank = 0;
	for (let column = 0; column < (a[0]?.length ?? 0) && rank < a.length; column += 1) {
		let pivot = rank;
		for (let row = rank + 1; row < a.length; row += 1) if (Math.abs(a[row][column]) > Math.abs(a[pivot][column])) pivot = row;
		if (Math.abs(a[pivot][column]) <= tolerance) continue;
		[a[rank], a[pivot]] = [a[pivot], a[rank]];
		for (let row = 0; row < a.length; row += 1) {
			if (row === rank) continue;
			const factor = a[row][column] / a[rank][column];
			for (let c = column; c < a[row].length; c += 1) a[row][c] -= factor * a[rank][c];
		}
		rank += 1;
	}
	return rank;
}

function solveLinear(matrix, vector) {
	const n = vector.length;
	const a = matrix.map((row, index) => [...row, vector[index]]);
	for (let column = 0; column < n; column += 1) {
		let pivot = column;
		for (let row = column + 1; row < n; row += 1) if (Math.abs(a[row][column]) > Math.abs(a[pivot][column])) pivot = row;
		if (Math.abs(a[pivot][column]) < 1e-15) return null;
		[a[column], a[pivot]] = [a[pivot], a[column]];
		for (let row = column + 1; row < n; row += 1) {
			const factor = a[row][column] / a[column][column];
			for (let c = column; c <= n; c += 1) a[row][c] -= factor * a[column][c];
		}
	}
	const x = Array(n).fill(0);
	for (let row = n - 1; row >= 0; row -= 1) {
		let sum = a[row][n];
		for (let c = row + 1; c < n; c += 1) sum -= a[row][c] * x[c];
		x[row] = sum / a[row][row];
	}
	return x.every(Number.isFinite) ? x : null;
}

function publicResidual(equation) {
	return { constraintId: equation.id, kind: equation.kind, quantity: equation.quantity, residual: equation.residual, values: structuredClone(equation.values), tolerance: equation.constraint.tolerance ?? null };
}

function allJoinResiduals(evaluation, constraints) {
	const result = [];
	for (const join of evaluation?.joins ?? []) {
		for (const [quantity, values] of Object.entries(join.quantities ?? {})) {
			const matching = constraints.filter((constraint) => constraint.kind === "join" && constraint.joinId === join.id && constraint.quantity === quantity);
			result.push({
				joinId: join.id,
				leftComponentId: join.leftComponentId,
				rightComponentId: join.rightComponentId,
				quantity,
				left: values.left,
				right: values.right,
				residual: values.residual,
				constraintIds: matching.map((constraint) => constraint.id),
				tolerance: matching[0]?.tolerance ?? null,
			});
		}
	}
	return result;
}

function invalidCandidate(input, diagnostics, settings) {
	return {
		candidateId: `${String(input?.problemId ?? "invalid-problem")}::candidate-0001`,
		sourceProblemId: String(input?.problemId ?? ""),
		transitionRecordId: String(input?.transitionRecord?.id ?? ""),
		schemaVersion: input?.transitionRecord?.schemaVersion ?? null,
		state: "invalid-input",
		solvedParameters: {},
		unchangedKnownParameters: structuredClone(input?.knownParameters ?? {}),
		unchangedFixedParameters: {},
		remainingFreeParameters: structuredClone(input?.freeParameters ?? []),
		activeConstraints: [],
		endpointResiduals: [],
		joinResiduals: [],
		convergence: { state: "not-started", iterationCount: 0, maxIterations: settings.maxIterations, convergenceTolerance: settings.convergenceTolerance, residualTolerance: settings.residualTolerance },
		residualNorm: null,
		objective: { kind: "continuity-residual-l2", value: null, optimizationObjective: false },
		warnings: [],
		diagnostics: structuredClone(diagnostics),
		provenance: { input: structuredClone(input?.provenance ?? null), transition: structuredClone(input?.transitionRecord?.provenance ?? null) },
		evaluatorQuantities: [],
		requestedOutputQuantities: structuredClone(input?.requestedOutputQuantities ?? []),
		evaluation: null,
		reviewStatus: "unreviewed-calculation-candidate",
		authoritative: false,
	};
}

function diagnosticFromEvaluation(result, parameter = null) {
	const error = result?.error ?? {};
	return { code: error.code ?? "CONTINUITY_EVALUATION_FAILED", reason: error.reason ?? "model evaluation failed", component: error.component ?? null, parameter, quantity: error.quantity ?? null };
}

function buildWarnings({ state, evaluation, diagnostics, equationCount, variableCount, rank }) {
	const warnings = diagnostics.map((entry) => ({ code: entry.code, reason: entry.reason }));
	for (const join of evaluation?.inactiveJoins ?? []) warnings.push({ code: "CONTINUITY_JOIN_INACTIVE_ZERO_LENGTH", reason: join.reason, joinId: join.id, leftComponentId: join.leftComponentId, rightComponentId: join.rightComponentId });
	if (state === "underdetermined") warnings.push({ code: "CONTINUITY_UNDERDETERMINED", reason: `${variableCount} free parameters, ${equationCount} equations, rank ${rank}` });
	if (state === "overdetermined") warnings.push({ code: "CONTINUITY_OVERDETERMINED_CONSISTENT", reason: `${equationCount} consistent equations for ${variableCount} free parameters` });
	return warnings;
}

function norm(values) {
	return Math.sqrt(values.reduce((sum, value) => sum + value * value, 0));
}

function finiteOrNull(value) {
	return Number.isFinite(value) ? value : null;
}

function isObject(value) {
	return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
