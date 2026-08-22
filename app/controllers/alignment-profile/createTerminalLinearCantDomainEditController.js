import {
	appendCantElement,
	createCantConstructiveState,
	evaluateCantAt,
} from "../../../src/aim-core/alignment/profile/CantConstructiveState.js";

export class TerminalLinearCantDomainEditError extends Error {
	constructor(code, message, { cause } = {}) {
		super(message, cause === undefined ? undefined : { cause });
		this.name = "TerminalLinearCantDomainEditError";
		this.code = code;
		if (cause !== undefined) this.cause = cause;
	}
}

const fail = (code, message) => new TerminalLinearCantDomainEditError(code, message);

function requireId(value, label) {
	const id = typeof value === "string" ? value.trim() : "";
	if (!id) throw fail("INVALID_TERMINAL_LINEAR_CANT_DOMAIN_EDIT", `${label} must be a non-empty string`);
	return id;
}

function finite(value, label) {
	if (typeof value === "string" && value.trim() === "") throw fail("INVALID_TERMINAL_LINEAR_CANT_DOMAIN_EDIT", `${label} must be finite`);
	const number = Number(value);
	if (!Number.isFinite(number)) throw fail("INVALID_TERMINAL_LINEAR_CANT_DOMAIN_EDIT", `${label} must be finite`);
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
	if (projection?.alignmentId !== expected.alignmentId || !sameValue(projection?.revision, expected.revision) || projection?.cursor?.parameterKind !== "intrinsic-s" || !Object.is(projection?.cursor?.s, expected.s)) throw fail("PROFILE_READBACK_MISMATCH", "profile projection does not match the active Alignment context");
	return projection;
}

function requireTarget(profileState, alignmentId, elementId) {
	if (!profileState || typeof profileState !== "object" || Array.isArray(profileState) || !profileState.cant || profileState.cant.alignmentId !== alignmentId || !Array.isArray(profileState.cant.elements) || profileState.cant.elements.length === 0 || !Array.isArray(profileState.chainageMappings)) throw fail("CANT_TERMINAL_ELEMENT_UNAVAILABLE", "a canonical persisted Cant state with a terminal element is required");
	const matches = profileState.cant.elements.filter((element) => element?.id === elementId);
	if (matches.length !== 1) throw fail("CANT_ELEMENT_IDENTITY_MISMATCH", "the exact persisted Cant element identity is unavailable or duplicated");
	const target = matches[0];
	if (target.type !== "linear-cross-level") throw fail("CANT_ELEMENT_NOT_LINEAR", "the selected Cant element is not linear-cross-level");
	if (!Object.is(target, profileState.cant.elements.at(-1))) throw fail("CANT_ELEMENT_NOT_TERMINAL", "only the terminal linear Cant element may be edited");
	return { profileState, cant: profileState.cant, target };
}

function rebuildCantState(cant, target, endS) {
	let rebuilt = createCantConstructiveState({ id: cant.id, alignmentId: cant.alignmentId });
	const standardKeys = new Set(["contractVersion", "type", "id", "alignmentId", "longitudinalParameter", "quantity", "unit", "signConvention", "elements"]);
	const extensions = Object.fromEntries(Object.entries(cant).filter(([key]) => !standardKeys.has(key)));
	if (Object.keys(extensions).length > 0) rebuilt = Object.freeze({ ...rebuilt, ...extensions });
	for (const element of cant.elements) rebuilt = appendCantElement(rebuilt, Object.is(element, target) ? { ...element, endS } : element);
	return rebuilt;
}

function snapshotMatches(snapshot, profileState) {
	return snapshot?.presence === "present" && sameValue(snapshot.vertical, profileState.vertical) && sameValue(snapshot.cant, profileState.cant) && sameValue(snapshot.chainageMappings, profileState.chainageMappings);
}

export function createTerminalLinearCantDomainEditController({ alignmentProfileApplicationService, projectionController } = {}) {
	if (typeof alignmentProfileApplicationService?.saveProfileState !== "function" || typeof projectionController?.projectAt !== "function") throw fail("INVALID_SERVICE", "terminal linear Cant domain editing requires profile save and projection services");
	return Object.freeze({
		async update({ alignmentId, revision, s, profileState, elementId, endS } = {}) {
			const normalizedAlignmentId = requireId(alignmentId, "alignmentId");
			if (revision === undefined) throw fail("INVALID_TERMINAL_LINEAR_CANT_DOMAIN_EDIT", "revision must be explicit");
			const cursorS = finite(s, "s"), normalizedElementId = requireId(elementId, "elementId"), numericEndS = finite(endS, "endS");
			const persisted = requireTarget(profileState, normalizedAlignmentId, normalizedElementId);
			if (Object.is(numericEndS, persisted.target.endS)) throw fail("TERMINAL_LINEAR_CANT_DOMAIN_NO_CHANGE", "endS is unchanged");
			if (numericEndS <= persisted.target.startS) throw fail("INVALID_TERMINAL_LINEAR_CANT_DOMAIN", "endS must be greater than the persisted startS");
			const context = { alignmentId: normalizedAlignmentId, revision, s: cursorS };
			validateProjection(await projectionController.projectAt(context), context);
			const cant = rebuildCantState(persisted.cant, persisted.target, numericEndS);
			const target = cant.elements.at(-1);
			const evaluation = Object.freeze({ start: evaluateCantAt(cant, { s: target.startS }), interior: evaluateCantAt(cant, { s: target.startS + (target.endS - target.startS) / 2 }), end: evaluateCantAt(cant, { s: target.endS }) });
			if (evaluation.start.elementId !== target.id || !Object.is(evaluation.start.crossLevel, target.startCrossLevel) || ![evaluation.start, evaluation.interior, evaluation.end].every((entry) => entry.elementId === target.id && Object.is(entry.twist, target.crossLevelRate) && Number.isFinite(entry.crossLevel))) throw fail("CANT_STATE_VALIDATION_FAILED", "canonical Cant evaluation does not match the edited linear domain");
			const nextProfileState = { ...persisted.profileState, vertical: persisted.profileState.vertical, cant, chainageMappings: persisted.profileState.chainageMappings };
			let snapshot;
			try { snapshot = await alignmentProfileApplicationService.saveProfileState({ alignmentId: normalizedAlignmentId, profileState: nextProfileState }); }
			catch (cause) { throw new TerminalLinearCantDomainEditError("TERMINAL_LINEAR_CANT_DOMAIN_SAVE_FAILED", "terminal linear Cant domain was not saved", { cause }); }
			if (!snapshotMatches(snapshot, nextProfileState)) throw fail("PROFILE_READBACK_MISMATCH", "saved terminal linear Cant domain does not match repository readback");
			const savedContext = { alignmentId: normalizedAlignmentId, revision: snapshot.revision, s: cursorS };
			const projection = validateProjection(await projectionController.projectAt(savedContext), savedContext);
			return Object.freeze({ status: "saved", profileState: nextProfileState, snapshot, projection, cant, evaluation });
		},
	});
}

export default createTerminalLinearCantDomainEditController;
