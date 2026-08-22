import { buildFutureAxtranInputContract } from "../../aim-core/transition/axtran/buildFutureAxtranInputContract.js";
import { createVersionedContinuityModel } from "../../aim-core/transition/continuity/createVersionedContinuityModel.js";
import { createTransitionContinuitySolver } from "../../aim-core/transition/continuity/solveTransitionContinuity.js";
import { validateContinuityCandidate } from "../../aim-core/transition/continuity/validateContinuityCandidate.js";
import { createVersionedTransitionEvaluator } from "../../aim-core/transition/versioned/VersionedTransitionEvaluator.js";

/**
 * Browser-independent application use cases over the standing Transition Core.
 *
 * The service owns orchestration only. Catalogue data and all mathematical
 * behavior remain in injected adapters and canonical Core collaborators.
 */
export class TransitionAxtranApplicationService {
	constructor({
		catalogueAdapter,
		evaluatorFactory = createVersionedTransitionEvaluator,
		continuityModelFactory = createVersionedContinuityModel,
		continuitySolverFactory = createTransitionContinuitySolver,
		candidateValidator = validateContinuityCandidate,
		axtranContractBuilder = buildFutureAxtranInputContract,
	} = {}) {
		assertCatalogueAdapter(catalogueAdapter);
		this.catalogueAdapter = catalogueAdapter;
		this.evaluator = evaluatorFactory({
			registryResolver: catalogueAdapter,
		});
		this.continuityModel = continuityModelFactory({
			registryResolver: catalogueAdapter,
		});
		this.continuitySolverFactory = continuitySolverFactory;
		this.candidateValidator = candidateValidator;
		this.axtranContractBuilder = axtranContractBuilder;
	}

	listTransitions() {
		return this.catalogueAdapter
			.listTransitionIds()
			.map((recordId) => this.catalogueAdapter.getTransitionMeta(recordId));
	}

	resolveTransition(recordId) {
		return {
			descriptor:
				this.catalogueAdapter.resolveTransitionDescriptor(recordId),
			record:
				this.catalogueAdapter.resolveVersionedTransitionRecord(recordId),
		};
	}

	evaluate(request = {}) {
		return this.evaluator.evaluate(request);
	}

	evaluateBatch(request = {}) {
		return this.evaluator.evaluateBatch(request);
	}

	evaluateContinuity({
		recordId,
		parameters = {},
	} = {}) {
		return this.continuityModel.evaluate({
			transitionRecord:
				this.catalogueAdapter.resolveVersionedTransitionRecord(recordId),
			parameters,
		});
	}

	solveContinuity({
		recordId,
		transitionRecord,
		solverOptions,
		...problem
	} = {}) {
		const record =
			transitionRecord ??
			this.catalogueAdapter.resolveVersionedTransitionRecord(recordId);
		const solver = this.continuitySolverFactory({
			model: this.continuityModel,
			options: solverOptions,
		});
		const candidate = solver.solve({
			...problem,
			transitionRecord: record,
		});
		return {
			candidate,
			validation: this.candidateValidator(candidate),
		};
	}

	prepareAxtranInput({
		recordId,
		transitionId,
		...input
	} = {}) {
		return this.axtranContractBuilder({
			...input,
			transitionId: transitionId ?? recordId,
		});
	}
}

function assertCatalogueAdapter(adapter) {
	for (const method of [
		"listTransitionIds",
		"getTransitionMeta",
		"resolveTransitionDescriptor",
		"resolveVersionedTransitionRecord",
	]) {
		if (typeof adapter?.[method] !== "function") {
			throw new Error(
				`TransitionAxtranApplicationService: catalogueAdapter.${method} is required`
			);
		}
	}
}
