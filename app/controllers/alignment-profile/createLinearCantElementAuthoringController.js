import {
	appendCantElement,
	evaluateCantAt,
} from "../../../src/aim-core/alignment/profile/CantConstructiveState.js";

export class LinearCantElementAuthoringError extends Error {
	constructor(code, message, { cause } = {}) {
		super(message, cause === undefined ? undefined : { cause });
		this.name = "LinearCantElementAuthoringError";
		this.code = code;
		if (cause !== undefined) this.cause = cause;
	}
}

function requireId(value, label) {
	const id = typeof value === "string" ? value.trim() : "";
	if (!id) {
		throw new LinearCantElementAuthoringError(
			"INVALID_LINEAR_CANT_ELEMENT",
			`${label} must be a non-empty string`
		);
	}
	return id;
}

function finite(value, label) {
	if (typeof value === "string" && value.trim() === "") {
		throw new LinearCantElementAuthoringError(
			"INVALID_LINEAR_CANT_ELEMENT",
			`${label} must be finite`
		);
	}
	const number = Number(value);
	if (!Number.isFinite(number)) {
		throw new LinearCantElementAuthoringError(
			"INVALID_LINEAR_CANT_ELEMENT",
			`${label} must be finite`
		);
	}
	return number;
}

function sameValue(left, right) {
	if (Object.is(left, right)) return true;
	if (Array.isArray(left) || Array.isArray(right)) {
		return Array.isArray(left) && Array.isArray(right) &&
			left.length === right.length &&
			left.every((entry, index) => sameValue(entry, right[index]));
	}
	if (!left || !right || typeof left !== "object" || typeof right !== "object") return false;
	const leftKeys = Object.keys(left);
	const rightKeys = Object.keys(right);
	return leftKeys.length === rightKeys.length && leftKeys.every(
		(key, index) => key === rightKeys[index] && sameValue(left[key], right[key])
	);
}

function validateProjection(projection, expected) {
	if (
		projection?.alignmentId !== expected.alignmentId ||
		!sameValue(projection?.revision, expected.revision) ||
		projection?.cursor?.parameterKind !== "intrinsic-s" ||
		!Object.is(projection?.cursor?.s, expected.s)
	) {
		throw new LinearCantElementAuthoringError(
			"PROFILE_READBACK_MISMATCH",
			"profile projection does not match the active Alignment context"
		);
	}
	return projection;
}

function requireProfileState(profileState, alignmentId) {
	if (
		!profileState ||
		typeof profileState !== "object" ||
		Array.isArray(profileState) ||
		!Object.prototype.hasOwnProperty.call(profileState, "vertical") ||
		!profileState.cant ||
		profileState.cant.alignmentId !== alignmentId ||
		!Array.isArray(profileState.cant.elements) ||
		profileState.cant.elements.length === 0 ||
		!Array.isArray(profileState.chainageMappings) ||
		(profileState.vertical !== null && profileState.vertical?.alignmentId !== alignmentId) ||
		profileState.chainageMappings.some((mapping) => mapping?.alignmentId !== alignmentId)
	) {
		throw new LinearCantElementAuthoringError(
			"CANT_TERMINAL_ELEMENT_UNAVAILABLE",
			"a canonical persisted Cant state with a terminal element is required"
		);
	}
	return profileState;
}

function snapshotMatches(snapshot, profileState) {
	return snapshot?.presence === "present" &&
		sameValue(snapshot.vertical, profileState.vertical) &&
		sameValue(snapshot.cant, profileState.cant) &&
		sameValue(snapshot.chainageMappings, profileState.chainageMappings);
}

export function createLinearCantElementAuthoringController({
	alignmentProfileApplicationService,
	projectionController,
} = {}) {
	if (
		typeof alignmentProfileApplicationService?.saveProfileState !== "function" ||
		typeof projectionController?.projectAt !== "function"
	) {
		throw new LinearCantElementAuthoringError(
			"INVALID_SERVICE",
			"linear Cant authoring requires profile save and projection services"
		);
	}

	return Object.freeze({
		async append({
			alignmentId,
			revision,
			s,
			profileState,
			elementId,
			endS,
			crossLevelRate,
		} = {}) {
			const normalizedAlignmentId = requireId(alignmentId, "alignmentId");
			if (revision === undefined) {
				throw new LinearCantElementAuthoringError(
					"INVALID_LINEAR_CANT_ELEMENT",
					"revision must be explicit"
				);
			}
			const cursorS = finite(s, "s");
			const normalizedElementId = requireId(elementId, "elementId");
			const numericEndS = finite(endS, "endS");
			const numericRate = finite(crossLevelRate, "crossLevelRate");
			if (Object.is(numericRate, 0) || Object.is(numericRate, -0)) {
				throw new LinearCantElementAuthoringError(
					"LINEAR_CANT_NO_CHANGE",
					"crossLevelRate must be non-zero"
				);
			}
			const persisted = requireProfileState(profileState, normalizedAlignmentId);
			const context = { alignmentId: normalizedAlignmentId, revision, s: cursorS };
			validateProjection(await projectionController.projectAt(context), context);
			const terminal = persisted.cant.elements.at(-1);
			const terminalEvaluation = evaluateCantAt(persisted.cant, { s: terminal.endS });
			if (numericEndS <= terminal.endS) {
				throw new LinearCantElementAuthoringError(
					"INVALID_LINEAR_CANT_DOMAIN",
					"endS must be greater than the terminal Cant endS"
				);
			}
			const cant = appendCantElement(persisted.cant, {
				id: normalizedElementId,
				type: "linear-cross-level",
				startS: terminal.endS,
				endS: numericEndS,
				startCrossLevel: terminalEvaluation.crossLevel,
				crossLevelRate: numericRate,
			});
			let evaluation = null;
			try {
				evaluation = evaluateCantAt(cant, { s: cursorS });
			} catch (error) {
				if (error?.code !== "POSITION_OUTSIDE_DOMAIN") throw error;
			}
			const nextProfileState = {
				vertical: persisted.vertical,
				cant,
				chainageMappings: persisted.chainageMappings,
			};
			let snapshot;
			try {
				snapshot = await alignmentProfileApplicationService.saveProfileState({
					alignmentId: normalizedAlignmentId,
					profileState: nextProfileState,
				});
			} catch (cause) {
				throw new LinearCantElementAuthoringError(
					"LINEAR_CANT_SAVE_FAILED",
					"linear Cant element was not saved",
					{ cause }
				);
			}
			if (!snapshotMatches(snapshot, nextProfileState)) {
				throw new LinearCantElementAuthoringError(
					"PROFILE_READBACK_MISMATCH",
					"saved linear Cant element does not match repository readback"
				);
			}
			const savedContext = { alignmentId: normalizedAlignmentId, revision: snapshot.revision, s: cursorS };
			const projection = validateProjection(
				await projectionController.projectAt(savedContext),
				savedContext
			);
			return Object.freeze({
				status: "saved",
				profileState: nextProfileState,
				snapshot,
				projection,
				terminalEvaluation,
				evaluation,
			});
		},
	});
}

export default createLinearCantElementAuthoringController;
