import {
	appendCantElement,
	createCantConstructiveState,
	evaluateCantAt,
} from "../../../src/aim-core/alignment/profile/CantConstructiveState.js";

export class BasicCantCrossLevelAuthoringError extends Error {
	constructor(code, message, { cause } = {}) {
		super(message, cause === undefined ? undefined : { cause });
		this.name = "BasicCantCrossLevelAuthoringError";
		this.code = code;
		if (cause !== undefined) this.cause = cause;
	}
}

function requireId(value, label) {
	const id = typeof value === "string" ? value.trim() : "";
	if (!id) {
		throw new BasicCantCrossLevelAuthoringError(
			"INVALID_CANT_STATE",
			`${label} must be a non-empty string`
		);
	}
	return id;
}

function finite(value, label) {
	if (typeof value === "string" && value.trim() === "") {
		throw new BasicCantCrossLevelAuthoringError(
			"INVALID_CANT_STATE",
			`${label} must be finite`
		);
	}
	const number = Number(value);
	if (!Number.isFinite(number)) {
		throw new BasicCantCrossLevelAuthoringError(
			"INVALID_CANT_STATE",
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
	if (!left || !right || typeof left !== "object" || typeof right !== "object") {
		return false;
	}
	const leftKeys = Object.keys(left);
	const rightKeys = Object.keys(right);
	return leftKeys.length === rightKeys.length && leftKeys.every(
		(key, index) => key === rightKeys[index] && sameValue(left[key], right[key])
	);
}

function validateProjection(projection, expected) {
	if (
		!projection ||
		projection.alignmentId !== expected.alignmentId ||
		!sameValue(projection.revision, expected.revision) ||
		projection.cursor?.parameterKind !== "intrinsic-s" ||
		!Object.is(projection.cursor?.s, expected.s)
	) {
		throw new BasicCantCrossLevelAuthoringError(
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
		!Object.prototype.hasOwnProperty.call(profileState, "cant") ||
		!Array.isArray(profileState.chainageMappings) ||
		(profileState.vertical !== null && profileState.vertical?.alignmentId !== alignmentId) ||
		profileState.chainageMappings.some((mapping) => mapping?.alignmentId !== alignmentId)
	) {
		throw new BasicCantCrossLevelAuthoringError(
			"INVALID_CANT_STATE",
			"a canonical profileState for the active Alignment is required"
		);
	}
	if (profileState.cant !== null) {
		throw new BasicCantCrossLevelAuthoringError(
			"CANT_STATE_ALREADY_PRESENT",
			"the active Alignment already has a Cant state"
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

export function createBasicCantCrossLevelAuthoringController({
	alignmentProfileApplicationService,
	projectionController,
} = {}) {
	if (
		typeof alignmentProfileApplicationService?.saveProfileState !== "function" ||
		typeof projectionController?.projectAt !== "function"
	) {
		throw new BasicCantCrossLevelAuthoringError(
			"INVALID_SERVICE",
			"Cant authoring requires profile save and projection services"
		);
	}

	return Object.freeze({
		async submit({
			alignmentId,
			revision,
			s,
			profileState,
			cantStateId,
			elementId,
			startS,
			endS,
			startCrossLevel,
		} = {}) {
			const normalizedAlignmentId = requireId(alignmentId, "alignmentId");
			if (revision === undefined) {
				throw new BasicCantCrossLevelAuthoringError(
					"INVALID_CANT_STATE",
					"revision must be explicit"
				);
			}
			const cursorS = finite(s, "s");
			const persisted = requireProfileState(profileState, normalizedAlignmentId);
			const context = { alignmentId: normalizedAlignmentId, revision, s: cursorS };
			validateProjection(await projectionController.projectAt(context), context);

			let cant = createCantConstructiveState({
				id: requireId(cantStateId, "cantStateId"),
				alignmentId: normalizedAlignmentId,
			});
			cant = appendCantElement(cant, {
				id: requireId(elementId, "elementId"),
				type: "constant-cross-level",
				startS: finite(startS, "startS"),
				endS: finite(endS, "endS"),
				startCrossLevel: finite(startCrossLevel, "startCrossLevel"),
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
				throw new BasicCantCrossLevelAuthoringError(
					"CANT_STATE_SAVE_FAILED",
					"Cant state was not saved",
					{ cause }
				);
			}
			if (!snapshotMatches(snapshot, nextProfileState)) {
				throw new BasicCantCrossLevelAuthoringError(
					"PROFILE_READBACK_MISMATCH",
					"saved Cant state does not match repository readback"
				);
			}
			const savedContext = {
				alignmentId: normalizedAlignmentId,
				revision: snapshot.revision,
				s: cursorS,
			};
			const projection = validateProjection(
				await projectionController.projectAt(savedContext),
				savedContext
			);
			return Object.freeze({
				status: "saved",
				profileState: nextProfileState,
				snapshot,
				projection,
				evaluation,
			});
		},
	});
}

export default createBasicCantCrossLevelAuthoringController;
