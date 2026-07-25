import {
	createSubjectReference,
	isGlobalEngineeringSubject,
	isToolLocalSubject,
	subjectKey,
	SUBJECT_KINDS,
} from "./subjectReference.js";
import {
	readSemanticSelectionFromWorkspace,
	writeSemanticSelectionToWorkspace,
} from "./workspaceSelectionCompatibility.js";

export function createSemanticSelectionContract({
	store,
	resolvePrimaryKind,
	now = () => new Date().toISOString(),
	maxDiagnostics = 40,
} = {}) {
	if (!store?.getState || !store?.actions?.setWorkspaceSelection) {
		throw new TypeError("Semantic selection requires the authoritative workspace store");
	}

	const local = {
		hover: null,
		preview: null,
		uiFocus: null,
		toolLocal: new Map(),
		lastCause: null,
		synchronizationChain: [],
		rejectedEvents: [],
	};

	function read() {
		const global = readSemanticSelectionFromWorkspace(store.getState(), { resolvePrimaryKind });
		return {
			...global,
			hover: local.hover,
			preview: local.preview,
			uiFocus: local.uiFocus,
			toolLocalSelections: Object.fromEntries(local.toolLocal),
			lastCause: local.lastCause,
		};
	}

	function selectPrimary(reference, cause) {
		const subject = createSubjectReference(reference);
		if (!isGlobalEngineeringSubject(subject)) {
			return reject("tool-local-subject-cannot-become-primary", subject, cause);
		}
		if (
			subject.kind === SUBJECT_KINDS.ALIGNMENT_ELEMENT ||
			subject.kind === SUBJECT_KINDS.ALIGNMENT_POSITION
		) {
			const parent = createSubjectReference(subject.parent);
			return commit(
				{ primary: parent, intrinsicFocus: subject },
				normalizeCause(cause, "global")
			);
		}
		return commit({ primary: subject, intrinsicFocus: null }, normalizeCause(cause, "global"));
	}

	function selectContext(references, cause) {
		const context = references.map(createSubjectReference);
		if (context.some((subject) =>
			!isGlobalEngineeringSubject(subject) ||
			subject.kind === SUBJECT_KINDS.ALIGNMENT_ELEMENT ||
			subject.kind === SUBJECT_KINDS.ALIGNMENT_POSITION
		)) {
			return reject("subject-cannot-enter-global-context", context, cause);
		}
		return commit({ context }, normalizeCause(cause, "contextual"));
	}

	function focusElement({ alignment, element }, cause) {
		const parent = createSubjectReference(alignment);
		const focus = createSubjectReference({
			...element,
			kind: SUBJECT_KINDS.ALIGNMENT_ELEMENT,
			parent: { kind: parent.kind, id: parent.id },
		});
		const current = read();
		const primary = current.primary && current.primary.id === parent.id ? current.primary : parent;
		return commit({ primary, intrinsicFocus: focus }, normalizeCause(cause, "global"));
	}

	function focusStation({ alignment, station, id }, cause) {
		const parent = createSubjectReference(alignment);
		const focus = createSubjectReference({
			kind: SUBJECT_KINDS.ALIGNMENT_POSITION,
			id: id ?? `${parent.id}@${Number(station)}`,
			station,
			parent: { kind: parent.kind, id: parent.id },
		});
		return commit({ primary: parent, intrinsicFocus: focus }, normalizeCause(cause, "global"));
	}

	function setToolLocal(tool, reference, cause) {
		const name = required(tool, "tool");
		const subject = reference == null ? null : createSubjectReference(reference);
		if (subject && !isToolLocalSubject(subject)) {
			return reject("global-subject-requires-explicit-activation", subject, cause);
		}
		if (subject) local.toolLocal.set(name, subject);
		else local.toolLocal.delete(name);
		recordCause(normalizeCause(cause, "tool-local"), subject);
		return { changed: true, state: read() };
	}

	function setHover(reference, cause) {
		local.hover = reference == null ? null : createSubjectReference(reference);
		recordCause(normalizeCause(cause, "hover"), local.hover);
		return { changed: true, state: read() };
	}

	function setPreview(reference, cause) {
		local.preview = reference == null ? null : createSubjectReference(reference);
		recordCause(normalizeCause(cause, "preview"), local.preview);
		return { changed: true, state: read() };
	}

	function setUiFocus(reference, cause) {
		local.uiFocus = reference == null ? null : createSubjectReference(reference);
		recordCause(normalizeCause(cause, "ui-focus"), local.uiFocus);
		return { changed: true, state: read() };
	}

	function synchronize(surface, chainId, apply) {
		const target = required(surface, "surface");
		const chain = required(chainId, "chainId");
		const marker = `${chain}:${target}`;
		if (local.synchronizationChain.includes(marker)) {
			return reject("selection-synchronization-loop", null, { surface: target, action: "synchronize", chainId: chain, synchronizing: true });
		}
		local.synchronizationChain.push(marker);
		local.synchronizationChain = local.synchronizationChain.slice(-maxDiagnostics);
		return apply({ surface: target, action: "synchronize", chainId: chain, synchronizing: true });
	}

	function commit(patch, cause) {
		const current = read();
		const next = {
			primary: patch.primary === undefined ? current.primary : patch.primary,
			context: patch.context === undefined ? current.context : patch.context,
			intrinsicFocus: patch.intrinsicFocus === undefined ? current.intrinsicFocus : patch.intrinsicFocus,
		};
		if (next.intrinsicFocus?.parent && next.primary?.id !== next.intrinsicFocus.parent.id) {
			return reject("stale-element-parent", next.intrinsicFocus, cause);
		}
		const nextLegacy = writeSemanticSelectionToWorkspace({
			...next,
			cause,
			previous: current.legacy,
		});
		const unchanged = JSON.stringify(nextLegacy) === JSON.stringify(current.legacy);
		recordCause(cause, next.intrinsicFocus ?? next.primary);
		if (!unchanged) store.actions.setWorkspaceSelection(nextLegacy);
		return { changed: !unchanged, state: read() };
	}

	function normalizeCause(cause = {}, mode) {
		return Object.freeze({
			surface: required(cause.surface, "cause.surface"),
			action: required(cause.action, "cause.action"),
			mode,
			synchronizing: Boolean(cause.synchronizing),
			chainId: cause.chainId == null ? null : String(cause.chainId),
			at: now(),
		});
	}

	function recordCause(cause, subject) {
		local.lastCause = { ...cause, subjectKey: subject ? subjectKey(subject) : null };
	}

	function reject(reason, subject, cause) {
		const event = { reason, subject: subject ?? null, cause: cause ?? null, at: now() };
		local.rejectedEvents.push(event);
		local.rejectedEvents = local.rejectedEvents.slice(-maxDiagnostics);
		return { changed: false, rejected: true, reason, state: read() };
	}

	function diagnostics() {
		const state = read();
		return {
			primarySubject: state.primary,
			contextSubjects: state.context,
			intrinsicFocus: state.intrinsicFocus,
			toolLocalSelections: state.toolLocalSelections,
			initiatingSource: state.lastCause,
			lastSynchronizationChain: [...local.synchronizationChain],
			rejectedEvents: [...local.rejectedEvents],
		};
	}

	return Object.freeze({
		read,
		selectPrimary,
		selectContext,
		focusElement,
		focusStation,
		setToolLocal,
		setHover,
		setPreview,
		setUiFocus,
		synchronize,
		diagnostics,
	});
}

function required(value, field) {
	const normalized = String(value ?? "").trim();
	if (!normalized) throw new TypeError(`${field} is required`);
	return normalized;
}
