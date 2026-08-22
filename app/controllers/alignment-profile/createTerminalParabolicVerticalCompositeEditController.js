import {
	appendVerticalElement,
	createVerticalConstructiveState,
	evaluateVerticalAt,
} from "../../../src/aim-core/alignment/profile/VerticalConstructiveState.js";

export class TerminalParabolicVerticalCompositeEditError extends Error {
	constructor(code, message, { cause } = {}) {
		super(message, cause === undefined ? undefined : { cause });
		this.name = "TerminalParabolicVerticalCompositeEditError";
		this.code = code;
		if (cause !== undefined) this.cause = cause;
	}
}

const fail = (code, message) => new TerminalParabolicVerticalCompositeEditError(code, message);

function requireId(value, label) {
	const id = typeof value === "string" ? value.trim() : "";
	if (!id) throw fail("INVALID_TERMINAL_PARABOLIC_COMPOSITE_EDIT", `${label} must be a non-empty string`);
	return id;
}

function finite(value, label) {
	if (typeof value === "string" && value.trim() === "") {
		throw fail("INVALID_TERMINAL_PARABOLIC_COMPOSITE_EDIT", `${label} must be finite`);
	}
	const number = Number(value);
	if (!Number.isFinite(number)) throw fail("INVALID_TERMINAL_PARABOLIC_COMPOSITE_EDIT", `${label} must be finite`);
	return number;
}

function sameValue(left, right) {
	if (Object.is(left, right)) return true;
	if (Array.isArray(left) || Array.isArray(right)) return Array.isArray(left) && Array.isArray(right) &&
		left.length === right.length && left.every((entry, index) => sameValue(entry, right[index]));
	if (!left || !right || typeof left !== "object" || typeof right !== "object") return false;
	const leftKeys = Object.keys(left);
	const rightKeys = Object.keys(right);
	return leftKeys.length === rightKeys.length && leftKeys.every(
		(key, index) => key === rightKeys[index] && sameValue(left[key], right[key])
	);
}

function validateProjection(projection, expected) {
	if (projection?.alignmentId !== expected.alignmentId || !sameValue(projection?.revision, expected.revision) ||
		projection?.cursor?.parameterKind !== "intrinsic-s" || !Object.is(projection?.cursor?.s, expected.s)) {
		throw fail("PROFILE_READBACK_MISMATCH", "profile projection does not match the active Alignment context");
	}
	return projection;
}

function requireTarget(profileState, alignmentId, elementId) {
	if (!profileState || typeof profileState !== "object" || Array.isArray(profileState) ||
		!profileState.vertical || profileState.vertical.alignmentId !== alignmentId ||
		!Array.isArray(profileState.vertical.elements) || !Object.hasOwn(profileState, "cant") ||
		!Array.isArray(profileState.chainageMappings)) {
		throw fail("INVALID_TERMINAL_PARABOLIC_COMPOSITE_EDIT", "canonical persisted profileState is required");
	}
	const matches = profileState.vertical.elements.filter((element) => element?.id === elementId);
	if (matches.length !== 1) {
		throw fail("VERTICAL_PROFILE_ELEMENT_IDENTITY_MISMATCH", "the exact persisted vertical element identity is unavailable or duplicated");
	}
	const target = matches[0];
	if (target.type !== "parabolic") throw fail("VERTICAL_PROFILE_ELEMENT_NOT_PARABOLIC", "the exact vertical element is not parabolic");
	if (!Object.is(target, profileState.vertical.elements.at(-1))) {
		throw fail("VERTICAL_PROFILE_ELEMENT_NOT_TERMINAL", "only the terminal parabolic element may be edited");
	}
	return { profileState, vertical: profileState.vertical, target };
}

function rebuildVertical(vertical, target, replacement) {
	let rebuilt = createVerticalConstructiveState({ id: vertical.id, alignmentId: vertical.alignmentId });
	const standardKeys = new Set(["contractVersion", "type", "id", "alignmentId", "longitudinalParameter", "elements"]);
	const extensions = Object.fromEntries(Object.entries(vertical).filter(([key]) => !standardKeys.has(key)));
	if (Object.keys(extensions).length > 0) rebuilt = Object.freeze({ ...rebuilt, ...extensions });
	for (const element of vertical.elements) {
		rebuilt = appendVerticalElement(rebuilt, Object.is(element, target) ? { ...element, ...replacement } : element);
	}
	return rebuilt;
}

function snapshotMatches(snapshot, profileState) {
	return snapshot?.presence === "present" && sameValue(snapshot.vertical, profileState.vertical) &&
		sameValue(snapshot.cant, profileState.cant) && sameValue(snapshot.chainageMappings, profileState.chainageMappings);
}

export function createTerminalParabolicVerticalCompositeEditController({
	alignmentProfileApplicationService,
	projectionController,
} = {}) {
	if (typeof alignmentProfileApplicationService?.saveProfileState !== "function" ||
		typeof projectionController?.projectAt !== "function") {
		throw fail("INVALID_SERVICE", "terminal parabolic composite editing requires profile save and projection services");
	}
	return Object.freeze({
		async update({ alignmentId, revision, s, profileState, elementId, gradientRate, endS } = {}) {
			const normalizedAlignmentId = requireId(alignmentId, "alignmentId");
			if (revision === undefined) throw fail("INVALID_TERMINAL_PARABOLIC_COMPOSITE_EDIT", "revision must be explicit");
			const cursorS = finite(s, "s");
			const normalizedElementId = requireId(elementId, "elementId");
			const numericGradientRate = finite(gradientRate, "gradientRate");
			const numericEndS = finite(endS, "endS");
			const persisted = requireTarget(profileState, normalizedAlignmentId, normalizedElementId);
			if (Object.is(numericGradientRate, persisted.target.gradientRate) && Object.is(numericEndS, persisted.target.endS)) {
				throw fail("VERTICAL_PROFILE_COMPOSITE_NO_CHANGE", "gradientRate and endS are unchanged");
			}
			if (numericEndS <= persisted.target.startS) {
				throw fail("INVALID_TERMINAL_PARABOLIC_COMPOSITE_EDIT", "endS must be greater than the terminal parabolic startS");
			}
			const context = { alignmentId: normalizedAlignmentId, revision, s: cursorS };
			validateProjection(await projectionController.projectAt(context), context);
			let vertical;
			try {
				vertical = rebuildVertical(persisted.vertical, persisted.target, { gradientRate: numericGradientRate, endS: numericEndS });
			} catch (cause) {
				throw new TerminalParabolicVerticalCompositeEditError(
					"INVALID_TERMINAL_PARABOLIC_COMPOSITE_EDIT", "terminal parabolic composite values are invalid", { cause }
				);
			}
			const evaluation = Object.freeze({
				start: evaluateVerticalAt(vertical, { s: persisted.target.startS }),
				interior: evaluateVerticalAt(vertical, { s: persisted.target.startS + (numericEndS - persisted.target.startS) / 2 }),
				end: evaluateVerticalAt(vertical, { s: numericEndS }),
			});
			if (![evaluation.start, evaluation.interior, evaluation.end].every((value) => value?.elementId === normalizedElementId)) {
				throw fail("VERTICAL_PROFILE_VALIDATION_FAILED", "canonical evaluation did not expose the edited terminal parabolic element");
			}
			const nextProfileState = {
				...persisted.profileState,
				vertical,
				cant: persisted.profileState.cant,
				chainageMappings: persisted.profileState.chainageMappings,
			};
			let snapshot;
			try {
				snapshot = await alignmentProfileApplicationService.saveProfileState({ alignmentId: normalizedAlignmentId, profileState: nextProfileState });
			} catch (cause) {
				throw new TerminalParabolicVerticalCompositeEditError(
					"VERTICAL_PROFILE_COMPOSITE_SAVE_FAILED", "terminal parabolic composite edit was not saved", { cause }
				);
			}
			if (!snapshotMatches(snapshot, nextProfileState)) {
				throw fail("PROFILE_READBACK_MISMATCH", "saved terminal parabolic composite edit does not match repository readback");
			}
			const savedContext = { alignmentId: normalizedAlignmentId, revision: snapshot.revision, s: cursorS };
			const projection = validateProjection(await projectionController.projectAt(savedContext), savedContext);
			return Object.freeze({ status: "saved", elementId: normalizedElementId, profileState: nextProfileState,
				snapshot, projection, vertical, evaluation });
		},
	});
}

export default createTerminalParabolicVerticalCompositeEditController;
