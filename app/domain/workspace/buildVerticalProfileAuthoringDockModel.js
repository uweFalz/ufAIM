const id = value => String(value ?? "").trim();

export function buildVerticalProfileAuthoringDockModel({ projection = null, activeObjectId = null, requestedObjectId = null, requestedElementId = null } = {}) {
	const objectId = id(activeObjectId);
	const requestedObject = id(requestedObjectId);
	const elementId = id(requestedElementId);
	if (!objectId || (requestedObject && requestedObject !== objectId) || id(projection?.alignmentId) !== objectId) {
		return Object.freeze({ status: "unavailable", objectId: objectId || null, elementId: elementId || null, canCreateInitial: false, canAppendParabolic: false, canEdit: false, reason: "exact canonical Vertical context unavailable" });
	}
	const elements = projection?.selectableElements?.vertical ?? [];
	const exact = elementId ? elements.filter(entry => id(entry?.elementId ?? entry?.id) === elementId) : [];
	if (elementId && exact.length !== 1) return Object.freeze({ status: "target-missing", objectId, elementId, canCreateInitial: false, canAppendParabolic: false, canEdit: false, reason: "exact Vertical element unavailable" });
	const selected = exact[0] ?? null;
	const terminal = projection?.terminalParabolicVerticalElement ?? null;
	const terminalExact = Boolean(selected && terminal && id(terminal.id) === elementId && selected.type === "parabolic");
	const count = elements.length;
	return Object.freeze({
		status: selected ? "selected" : "active",
		objectId, elementId: selected ? elementId : null,
		elements: Object.freeze(elements.map(entry => Object.freeze({ elementId: id(entry.elementId ?? entry.id), type: entry.type ?? "unknown", startS: entry.startS ?? null, endS: entry.endS ?? null, provenancePresent: Boolean(entry.provenance ?? entry.sourceRefs ?? entry.evidenceId) }))),
		selected: selected ? Object.freeze({ ...selected }) : null,
		canCreateInitial: count === 0,
		canAppendParabolic: count > 0 && !elementId,
		canEdit: terminalExact,
		edit: terminalExact ? Object.freeze({ gradientRate: terminal.gradientRate, endS: terminal.endS }) : null,
		reason: selected && !terminalExact ? "only the exact terminal parabolic element is editable" : null,
	});
}

export default buildVerticalProfileAuthoringDockModel;
