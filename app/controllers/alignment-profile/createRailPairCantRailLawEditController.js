import {
	appendRailOffsetElement,
	createRailPairCantConstructiveState,
	evaluateRailPairCantAt,
	isRailPairCantConstructiveState,
} from "../../../src/aim-core/alignment/profile/RailPairCantConstructiveState.js";

export class RailPairCantRailLawEditError extends Error {
	constructor(code, message, { cause } = {}) {
		super(message, cause === undefined ? undefined : { cause });
		this.name = "RailPairCantRailLawEditError";
		this.code = code;
		if (cause !== undefined) this.cause = cause;
	}
}

const fail = (code, message) => new RailPairCantRailLawEditError(code, message);

function id(value, label) {
	const normalized = typeof value === "string" ? value.trim() : "";
	if (!normalized) throw fail("INVALID_RAIL_LAW_EDIT", `${label} must be a non-empty string`);
	return normalized;
}

function finite(value, label) {
	if (typeof value === "string" && value.trim() === "") throw fail("INVALID_RAIL_LAW_EDIT", `${label} must be finite`);
	const number = Number(value);
	if (!Number.isFinite(number)) throw fail("INVALID_RAIL_LAW_EDIT", `${label} must be finite`);
	return number;
}

function sameValue(left, right) {
	if (Object.is(left, right)) return true;
	if (Array.isArray(left) || Array.isArray(right)) return Array.isArray(left) && Array.isArray(right) && left.length === right.length && left.every((entry, index) => sameValue(entry, right[index]));
	if (!left || !right || typeof left !== "object" || typeof right !== "object") return false;
	const leftKeys = Object.keys(left), rightKeys = Object.keys(right);
	return leftKeys.length === rightKeys.length && leftKeys.every((key, index) => key === rightKeys[index] && sameValue(left[key], right[key]));
}

function projectionMatches(projection, { alignmentId, revision, s }) {
	return projection?.alignmentId === alignmentId && sameValue(projection?.revision, revision) &&
		projection?.cursor?.parameterKind === "intrinsic-s" && Object.is(projection?.cursor?.s, s);
}

function requireTarget(profileState, alignmentId, railSide, elementId) {
	if (!profileState || typeof profileState !== "object" || Array.isArray(profileState) || !Array.isArray(profileState.chainageMappings)) {
		throw fail("RAIL_PAIR_PROFILE_STATE_UNAVAILABLE", "canonical persisted profile state is required");
	}
	const cant = profileState.cant;
	if (!isRailPairCantConstructiveState(cant) || cant.alignmentId !== alignmentId) {
		throw fail("RAIL_PAIR_CANT_REQUIRED", "editing requires exact RailPairCantConstructiveState for the active Alignment");
	}
	if (cant.coverage.status !== "complete" || cant.coverage.authority !== "admitted-construction") {
		throw fail("RAIL_PAIR_CANT_NOT_ADMITTED", "rail-pair Cant must be complete admitted construction before authoring");
	}
	if (!["left", "right"].includes(railSide)) throw fail("RAIL_SIDE_REQUIRED", "railSide must explicitly be left or right");
	const railId = railSide === "left" ? cant.railPair.leftRailId : cant.railPair.rightRailId;
	const matches = cant.elements.filter((entry) => entry.id === elementId);
	if (matches.length !== 1) throw fail("RAIL_ELEMENT_IDENTITY_MISMATCH", "the exact persisted rail element identity is unavailable or duplicated");
	if (matches[0].railId !== railId) throw fail("RAIL_SIDE_IDENTITY_MISMATCH", "selected rail side does not own the persisted element");
	return { profileState, cant, target: matches[0], railId };
}

function rebuild(cant, target, patch) {
	let next = createRailPairCantConstructiveState({
		id: cant.id,
		alignmentId: cant.alignmentId,
		coverage: cant.coverage,
		railPair: cant.railPair,
		anchorRule: cant.anchorRule,
	});
	for (const element of cant.elements) next = appendRailOffsetElement(next, Object.is(element, target) ? { ...element, ...patch } : element);
	return next;
}

export function createRailPairCantRailLawEditController({ alignmentProfileApplicationService, projectionController } = {}) {
	if (typeof alignmentProfileApplicationService?.saveProfileState !== "function" || typeof projectionController?.projectAt !== "function") {
		throw fail("INVALID_SERVICE", "rail-pair Cant editing requires profile save and projection services");
	}
	return Object.freeze({
		async update({ alignmentId, revision, s, profileState, railSide, elementId, startOffset, offsetRate } = {}) {
			const normalizedAlignmentId = id(alignmentId, "alignmentId");
			if (revision === undefined) throw fail("INVALID_RAIL_LAW_EDIT", "revision must be explicit");
			const cursorS = finite(s, "s"), normalizedElementId = id(elementId, "elementId");
			const persisted = requireTarget(profileState, normalizedAlignmentId, railSide, normalizedElementId);
			const patch = { startOffset: finite(startOffset, "startOffset") };
			if (persisted.target.type === "linear-rail-offset") patch.offsetRate = finite(offsetRate, "offsetRate");
			else if (offsetRate !== undefined) throw fail("RAIL_LAW_KIND_MISMATCH", "constant rail-offset law does not accept offsetRate");
			if (Object.entries(patch).every(([key, value]) => Object.is(persisted.target[key], value))) throw fail("RAIL_LAW_NO_CHANGE", "rail law is unchanged");
			const context = { alignmentId: normalizedAlignmentId, revision, s: cursorS };
			if (!projectionMatches(await projectionController.projectAt(context), context)) throw fail("PROFILE_READBACK_MISMATCH", "profile projection does not match the active Alignment context");
			const cant = rebuild(persisted.cant, persisted.target, patch);
			const edited = cant.elements.find((entry) => entry.id === normalizedElementId);
			const sampleS = Math.max(edited.startS, Math.min(cursorS, edited.endS));
			const evaluation = evaluateRailPairCantAt(cant, { s: sampleS });
			const railEvaluation = railSide === "left" ? evaluation.left : evaluation.right;
			if (railEvaluation.elementId !== edited.id || !Number.isFinite(railEvaluation.offset)) throw fail("RAIL_LAW_VALIDATION_FAILED", "edited rail law is not canonically evaluable");
			const nextProfileState = { ...persisted.profileState, vertical: persisted.profileState.vertical, cant, chainageMappings: persisted.profileState.chainageMappings };
			let snapshot;
			try { snapshot = await alignmentProfileApplicationService.saveProfileState({ alignmentId: normalizedAlignmentId, profileState: nextProfileState }); }
			catch (cause) { throw new RailPairCantRailLawEditError("RAIL_LAW_SAVE_FAILED", "rail-pair Cant law was not saved", { cause }); }
			if (snapshot?.presence !== "present" || !sameValue(snapshot.cant, cant) || !sameValue(snapshot.vertical, nextProfileState.vertical) || !sameValue(snapshot.chainageMappings, nextProfileState.chainageMappings)) {
				throw fail("PROFILE_READBACK_MISMATCH", "saved rail-pair Cant does not match repository readback");
			}
			const savedContext = { alignmentId: normalizedAlignmentId, revision: snapshot.revision, s: cursorS };
			const projection = await projectionController.projectAt(savedContext);
			if (!projectionMatches(projection, savedContext) || projection?.cant?.representation !== "rail-pair" || projection?.cant?.left?.railId !== cant.railPair.leftRailId || projection?.cant?.right?.railId !== cant.railPair.rightRailId) {
				throw fail("PROFILE_READBACK_MISMATCH", "saved rail-pair projection is not synchronized at the active intrinsic cursor");
			}
			return Object.freeze({ status: "saved", railSide, railId: persisted.railId, elementId: edited.id, profileState: nextProfileState, snapshot, projection, cant, evaluation });
		},
	});
}

export default createRailPairCantRailLawEditController;
