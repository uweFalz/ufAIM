import {
	appendCantElement,
	createCantConstructiveState,
	evaluateCantAt,
} from "../../../src/aim-core/alignment/profile/CantConstructiveState.js";

export class TerminalCantElementRemoveError extends Error {
	constructor(code, message, { cause } = {}) {
		super(message, cause === undefined ? undefined : { cause });
		this.name = "TerminalCantElementRemoveError";
		this.code = code;
		if (cause !== undefined) this.cause = cause;
	}
}

const fail = (code, message) => new TerminalCantElementRemoveError(code, message);

function requireId(value, label) {
	const id = typeof value === "string" ? value.trim() : "";
	if (!id) throw fail("INVALID_TERMINAL_CANT_REMOVE", `${label} must be a non-empty string`);
	return id;
}

function finite(value, label) {
	if (typeof value === "string" && value.trim() === "") throw fail("INVALID_TERMINAL_CANT_REMOVE", `${label} must be finite`);
	const number = Number(value);
	if (!Number.isFinite(number)) throw fail("INVALID_TERMINAL_CANT_REMOVE", `${label} must be finite`);
	return number;
}

function sameValue(left, right) {
	if (Object.is(left, right)) return true;
	if (Array.isArray(left) || Array.isArray(right)) return Array.isArray(left) && Array.isArray(right) && left.length === right.length && left.every((entry, index) => sameValue(entry, right[index]));
	if (!left || !right || typeof left !== "object" || typeof right !== "object") return false;
	const leftKeys = Object.keys(left), rightKeys = Object.keys(right);
	return leftKeys.length === rightKeys.length && leftKeys.every((key, index) => key === rightKeys[index] && sameValue(left[key], right[key]));
}

function validateProjection(projection, expected) {
	if (projection?.alignmentId !== expected.alignmentId || !sameValue(projection?.revision, expected.revision) || projection?.cursor?.parameterKind !== "intrinsic-s" || !Object.is(projection?.cursor?.s, expected.s)) {
		throw fail("PROFILE_READBACK_MISMATCH", "profile projection does not match the active Alignment context");
	}
	return projection;
}

function requireTarget(profileState, alignmentId, elementId) {
	if (!profileState || typeof profileState !== "object" || Array.isArray(profileState) || !profileState.cant || profileState.cant.alignmentId !== alignmentId || !Array.isArray(profileState.cant.elements) || !Array.isArray(profileState.chainageMappings)) {
		throw fail("CANT_TERMINAL_ELEMENT_UNAVAILABLE", "a canonical persisted Cant state is required");
	}
	const matches = profileState.cant.elements.filter((element) => element?.id === elementId);
	if (matches.length !== 1) throw fail("CANT_ELEMENT_IDENTITY_MISMATCH", "the exact persisted Cant element identity is unavailable or duplicated");
	const element = matches[0];
	if (!Object.is(element, profileState.cant.elements.at(-1))) throw fail("CANT_ELEMENT_NOT_TERMINAL", "only the terminal Cant element may be removed");
	if (profileState.cant.elements.length < 2) throw fail("CANT_ELEMENT_REMOVE_WOULD_EMPTY_STATE", "at least one prefix Cant element must remain");
	return { profileState, cant: profileState.cant, element };
}

function rebuildPrefix(cant, target) {
	let rebuilt = createCantConstructiveState({ id: cant.id, alignmentId: cant.alignmentId });
	const standardKeys = new Set(["contractVersion", "type", "id", "alignmentId", "longitudinalParameter", "quantity", "unit", "signConvention", "elements"]);
	const extensions = Object.fromEntries(Object.entries(cant).filter(([key]) => !standardKeys.has(key)));
	if (Object.keys(extensions).length > 0) rebuilt = Object.freeze({ ...rebuilt, ...extensions });
	for (const element of cant.elements) {
		if (!Object.is(element, target)) rebuilt = appendCantElement(rebuilt, element);
	}
	return rebuilt;
}

function snapshotMatches(snapshot, profileState) {
	return snapshot?.presence === "present" && sameValue(snapshot.vertical, profileState.vertical) && sameValue(snapshot.cant, profileState.cant) && sameValue(snapshot.chainageMappings, profileState.chainageMappings);
}

export function createTerminalCantElementRemoveController({ alignmentProfileApplicationService, projectionController } = {}) {
	if (typeof alignmentProfileApplicationService?.saveProfileState !== "function" || typeof projectionController?.projectAt !== "function") throw fail("INVALID_SERVICE", "terminal Cant removal requires profile save and projection services");
	return Object.freeze({
		async remove({ alignmentId, revision, s, profileState, elementId } = {}) {
			const normalizedAlignmentId = requireId(alignmentId, "alignmentId");
			if (revision === undefined) throw fail("INVALID_TERMINAL_CANT_REMOVE", "revision must be explicit");
			const cursorS = finite(s, "s"), normalizedElementId = requireId(elementId, "elementId");
			const persisted = requireTarget(profileState, normalizedAlignmentId, normalizedElementId);
			const context = { alignmentId: normalizedAlignmentId, revision, s: cursorS };
			validateProjection(await projectionController.projectAt(context), context);
			const cant = rebuildPrefix(persisted.cant, persisted.element);
			const retained = cant.elements.at(-1);
			const validation = evaluateCantAt(cant, { s: retained.endS });
			if (validation.elementId !== retained.id || !Object.is(validation.s, retained.endS)) throw fail("CANT_STATE_VALIDATION_FAILED", "canonical Cant evaluation did not expose the retained prefix element");
			let cursorEvaluation = null;
			try { cursorEvaluation = evaluateCantAt(cant, { s: cursorS }); }
			catch (error) { if (error?.code !== "POSITION_OUTSIDE_DOMAIN") throw error; }
			const nextProfileState = { ...persisted.profileState, vertical: persisted.profileState.vertical, cant, chainageMappings: persisted.profileState.chainageMappings };
			let snapshot;
			try { snapshot = await alignmentProfileApplicationService.saveProfileState({ alignmentId: normalizedAlignmentId, profileState: nextProfileState }); }
			catch (cause) { throw new TerminalCantElementRemoveError("TERMINAL_CANT_REMOVE_SAVE_FAILED", "terminal Cant element was not removed", { cause }); }
			if (!snapshotMatches(snapshot, nextProfileState)) throw fail("PROFILE_READBACK_MISMATCH", "removed terminal Cant element does not match repository readback");
			const savedContext = { alignmentId: normalizedAlignmentId, revision: snapshot.revision, s: cursorS };
			const projection = validateProjection(await projectionController.projectAt(savedContext), savedContext);
			return Object.freeze({ status: "removed", profileState: nextProfileState, snapshot, projection, cant, validation, cursorEvaluation });
		},
	});
}

export default createTerminalCantElementRemoveController;
