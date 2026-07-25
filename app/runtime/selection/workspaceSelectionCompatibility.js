import { createSubjectReference, SUBJECT_KINDS } from "./subjectReference.js";

export function readSemanticSelectionFromWorkspace(state, { resolvePrimaryKind } = {}) {
	const legacy = state?.workspace_selection ?? {};
	const primaryId = normalized(legacy.primaryId);
	const primaryKind = primaryId
		? resolvePrimaryKind?.(primaryId, state) ?? SUBJECT_KINDS.SPOT_OBJECT
		: null;
	const primary = primaryId ? createSubjectReference({ kind: primaryKind, id: primaryId }) : null;
	const context = unique(legacy.contextIds).map((id) =>
		createSubjectReference({ kind: resolvePrimaryKind?.(id, state) ?? SUBJECT_KINDS.SPOT_OBJECT, id })
	);
	const elementId = normalized(legacy.elementId);
	const intrinsicFocus = elementId && primary
		? createSubjectReference({
			kind: SUBJECT_KINDS.ALIGNMENT_ELEMENT,
			id: elementId,
			parent: { kind: primary.kind === SUBJECT_KINDS.ALIGNMENT ? SUBJECT_KINDS.ALIGNMENT : SUBJECT_KINDS.SPOT_OBJECT, id: primary.id },
		})
		: null;

	return {
		primary,
		context,
		intrinsicFocus,
		legacy: {
			primaryId,
			contextIds: context.map((subject) => subject.id),
			elementId,
			source: legacy.source == null ? null : String(legacy.source),
			crsId: normalized(legacy.crsId),
		},
	};
}

export function writeSemanticSelectionToWorkspace({ primary, context = [], intrinsicFocus = null, cause = {}, previous = {} } = {}) {
	return {
		primaryId: primary?.id ?? null,
		contextIds: unique(context.map((subject) => subject?.id)),
		elementId: intrinsicFocus?.kind === SUBJECT_KINDS.ALIGNMENT_ELEMENT ? intrinsicFocus.id : null,
		source: serializeLegacySource(cause, previous.source),
		crsId: cause.crsId == null ? previous.crsId ?? null : String(cause.crsId),
	};
}

export function serializeLegacySource(cause = {}, fallback = null) {
	if (cause.synchronizing) return fallback == null ? null : String(fallback);
	const surface = normalized(cause.surface);
	const action = normalized(cause.action);
	if (!surface && !action) return fallback == null ? null : String(fallback);
	return [surface ?? "application", action ?? "selection"].join(":");
}

function normalized(value) {
	const result = String(value ?? "").trim();
	return result || null;
}

function unique(values) {
	return [...new Set((Array.isArray(values) ? values : []).map(normalized).filter(Boolean))];
}
