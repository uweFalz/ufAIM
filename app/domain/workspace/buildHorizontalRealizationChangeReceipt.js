function text(value) {
	return String(value ?? "").trim();
}

function sparseElements(alignmentData) {
	const sparse = alignmentData?.sparseAlignment;
	const elements = Array.isArray(sparse?.elements) ? sparse.elements : Array.isArray(sparse?.sparse) ? sparse.sparse : null;
	if (!elements?.length) throw new Error("verified sparse realization unavailable");
	const ids = elements.map((entry) => text(entry?.id));
	if (ids.some((id) => !id) || new Set(ids).size !== ids.length) throw new Error("verified sparse realization identities are malformed");
	return elements;
}

function exactNumber(value) {
	return Number.isFinite(value) ? value : null;
}

function exactPose(value) {
	const x = exactNumber(value?.p?.x), y = exactNumber(value?.p?.y);
	const tx = exactNumber(value?.t?.x), ty = exactNumber(value?.t?.y);
	return [x, y, tx, ty].every((entry) => entry !== null) ? Object.freeze({ x, y, tx, ty }) : null;
}

function observedFields(element) {
	return Object.freeze({
		curvature: exactNumber(element?.curvature),
		sStart: exactNumber(element?.sStart),
		sEnd: exactNumber(element?.sEnd),
		arcLength: exactNumber(element?.arcLength),
		poseA: exactPose(element?.poseA),
	});
}

function equal(left, right) {
	return JSON.stringify(left) === JSON.stringify(right);
}

export function buildHorizontalRealizationChangeReceipt({ beforeAlignmentData, alignmentChange, activeObjectId, activeElementId } = {}) {
	const objectId = text(alignmentChange?.objectId);
	const elementId = text(alignmentChange?.elementId);
	const revision = alignmentChange?.revision;
	const afterAlignmentData = alignmentChange?.alignmentData;
	const spotObject = alignmentChange?.spotObject;
	if (!objectId || !elementId || revision == null || text(activeObjectId) !== objectId || text(activeElementId) !== elementId) throw new Error("verified change identity mismatch");
	if (text(spotObject?.id) !== objectId) throw new Error("verified readback object mismatch");
	const beforeId = text(beforeAlignmentData?.id ?? objectId), afterId = text(afterAlignmentData?.id ?? objectId);
	if (beforeId !== objectId || afterId !== objectId) throw new Error("alignment identity mismatch");
	const before = sparseElements(beforeAlignmentData), after = sparseElements(afterAlignmentData);
	const beforeById = new Map(before.map((entry) => [text(entry.id), entry]));
	const afterById = new Map(after.map((entry) => [text(entry.id), entry]));
	if (!beforeById.has(elementId) || !afterById.has(elementId)) throw new Error("exact changed element is unavailable");
	const changes = [];
	for (const entry of after) {
		const id = text(entry.id), previous = beforeById.get(id);
		if (!previous) continue;
		const beforeFields = observedFields(previous), afterFields = observedFields(entry);
		const fields = Object.keys(beforeFields).filter((field) => !equal(beforeFields[field], afterFields[field])).map((field) => Object.freeze({ field, before: beforeFields[field], after: afterFields[field] }));
		if (fields.length) changes.push(Object.freeze({ elementId: id, target: id === elementId, fields: Object.freeze(fields) }));
	}
	if (!changes.length || !changes.some((entry) => entry.target)) throw new Error("no verified target realization change observed");
	return Object.freeze({
		status: "verified",
		objectId,
		elementId,
		revision,
		changes: Object.freeze(changes),
		diagnostics: Object.freeze({ status: "not-available", message: "AXTRAN diagnostics are not available in the current result contract." }),
	});
}
