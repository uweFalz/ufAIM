import {
	appendCantElement,
	createCantConstructiveState,
	evaluateCantAt,
} from "../../../src/aim-core/alignment/profile/CantConstructiveState.js";

export class TerminalLinearCantRateEditError extends Error {
	constructor(code, message, { cause } = {}) {
		super(message, cause === undefined ? undefined : { cause });
		this.name = "TerminalLinearCantRateEditError";
		this.code = code;
		if (cause !== undefined) this.cause = cause;
	}
}

function requireId(value, label) {
	const id = typeof value === "string" ? value.trim() : "";
	if (!id) {
		throw new TerminalLinearCantRateEditError(
			"INVALID_TERMINAL_LINEAR_CANT_EDIT",
			`${label} must be a non-empty string`
		);
	}
	return id;
}

function finite(value, label) {
	if (typeof value === "string" && value.trim() === "") {
		throw new TerminalLinearCantRateEditError(
			"INVALID_TERMINAL_LINEAR_CANT_EDIT",
			`${label} must be finite`
		);
	}
	const number = Number(value);
	if (!Number.isFinite(number)) {
		throw new TerminalLinearCantRateEditError(
			"INVALID_TERMINAL_LINEAR_CANT_EDIT",
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

function requireProfileState(profileState, alignmentId) {
	if (
		!profileState ||
		typeof profileState !== "object" ||
		Array.isArray(profileState) ||
		!profileState.cant ||
		profileState.cant.alignmentId !== alignmentId ||
		!Array.isArray(profileState.cant.elements) ||
		profileState.cant.elements.length === 0 ||
		!Array.isArray(profileState.chainageMappings)
	) {
		throw new TerminalLinearCantRateEditError(
			"CANT_TERMINAL_ELEMENT_UNAVAILABLE",
			"a canonical persisted Cant state with a terminal element is required"
		);
	}
	return profileState;
}

function validateProjection(projection, expected) {
	if (
		projection?.alignmentId !== expected.alignmentId ||
		!sameValue(projection?.revision, expected.revision) ||
		projection?.cursor?.parameterKind !== "intrinsic-s" ||
		!Object.is(projection?.cursor?.s, expected.s)
	) {
		throw new TerminalLinearCantRateEditError(
			"PROFILE_READBACK_MISMATCH",
			"profile projection does not match the active Alignment context"
		);
	}
	return projection;
}

function rebuildCantState(persisted, target, crossLevelRate) {
	let rebuilt = createCantConstructiveState({
		id: persisted.id,
		alignmentId: persisted.alignmentId,
	});
	const standardKeys = new Set([
		"contractVersion",
		"type",
		"id",
		"alignmentId",
		"longitudinalParameter",
		"quantity",
		"unit",
		"signConvention",
		"elements",
	]);
	const extensions = Object.fromEntries(
		Object.entries(persisted).filter(([key]) => !standardKeys.has(key))
	);
	if (Object.keys(extensions).length > 0) {
		rebuilt = Object.freeze({ ...rebuilt, ...extensions });
	}
	for (const element of persisted.elements) {
		rebuilt = appendCantElement(
			rebuilt,
			Object.is(element, target)
				? { ...element, crossLevelRate }
				: element
		);
	}
	return rebuilt;
}

function snapshotMatches(snapshot, profileState) {
	return snapshot?.presence === "present" &&
		sameValue(snapshot.vertical, profileState.vertical) &&
		sameValue(snapshot.cant, profileState.cant) &&
		sameValue(snapshot.chainageMappings, profileState.chainageMappings);
}

export function createTerminalLinearCantRateEditController({
	alignmentProfileApplicationService,
	projectionController,
} = {}) {
	if (
		typeof alignmentProfileApplicationService?.saveProfileState !== "function" ||
		typeof projectionController?.projectAt !== "function"
	) {
		throw new TerminalLinearCantRateEditError(
			"INVALID_SERVICE",
			"terminal linear Cant editing requires profile save and projection services"
		);
	}

	return Object.freeze({
		async update({
			alignmentId,
			revision,
			s,
			profileState,
			elementId,
			crossLevelRate,
		} = {}) {
			const normalizedAlignmentId = requireId(alignmentId, "alignmentId");
			if (revision === undefined) {
				throw new TerminalLinearCantRateEditError(
					"INVALID_TERMINAL_LINEAR_CANT_EDIT",
					"revision must be explicit"
				);
			}
			const cursorS = finite(s, "s");
			const normalizedElementId = requireId(elementId, "elementId");
			const numericRate = finite(crossLevelRate, "crossLevelRate");
			const persisted = requireProfileState(profileState, normalizedAlignmentId);
			const matches = persisted.cant.elements.filter(
				(element) => element?.id === normalizedElementId
			);
			if (matches.length !== 1) {
				throw new TerminalLinearCantRateEditError(
					"CANT_ELEMENT_IDENTITY_MISMATCH",
					"the exact persisted Cant element identity is unavailable or duplicated"
				);
			}
			const target = matches[0];
			if (target.type !== "linear-cross-level") {
				throw new TerminalLinearCantRateEditError(
					"CANT_ELEMENT_NOT_LINEAR",
					"the selected Cant element is not linear-cross-level"
				);
			}
			if (!Object.is(target, persisted.cant.elements.at(-1))) {
				throw new TerminalLinearCantRateEditError(
					"CANT_ELEMENT_NOT_TERMINAL",
					"only the terminal linear Cant element may be edited"
				);
			}
			if (Object.is(numericRate, target.crossLevelRate)) {
				throw new TerminalLinearCantRateEditError(
					"TERMINAL_LINEAR_CANT_NO_CHANGE",
					"crossLevelRate is unchanged"
				);
			}
			const context = { alignmentId: normalizedAlignmentId, revision, s: cursorS };
			validateProjection(await projectionController.projectAt(context), context);
			const cant = rebuildCantState(persisted.cant, target, numericRate);
			const evaluation = evaluateCantAt(cant, { s: cursorS });
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
				throw new TerminalLinearCantRateEditError(
					"TERMINAL_LINEAR_CANT_SAVE_FAILED",
					"terminal linear Cant rate was not saved",
					{ cause }
				);
			}
			if (!snapshotMatches(snapshot, nextProfileState)) {
				throw new TerminalLinearCantRateEditError(
					"PROFILE_READBACK_MISMATCH",
					"saved terminal linear Cant rate does not match repository readback"
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

export default createTerminalLinearCantRateEditController;
