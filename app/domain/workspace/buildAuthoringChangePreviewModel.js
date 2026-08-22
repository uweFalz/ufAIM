function display(value, absent) {
	if (absent) return "nicht belegt";
	if (value === "") return "leer";
	return String(value);
}

function normalizedPrimitive(value) {
	if (value == null) return null;
	if (["string", "number", "boolean"].includes(typeof value)) return String(value);
	return null;
}

export function buildAuthoringChangePreviewModel({ objectId, discipline, action, elementId = null, mappingId = null, fields = [], draft = null, saving = false } = {}) {
	const exactObject = String(objectId ?? "").trim();
	if (!exactObject) return Object.freeze({ status: "unavailable", fields: Object.freeze([]), saving: Boolean(saving) });
	const hasDraft = Boolean(draft && typeof draft === "object");
	const rows = hasDraft ? fields.map(({ name, label, canonicalValue }) => {
		const draftPresent = Object.hasOwn(draft, name);
		const inputValue = draftPresent ? draft[name] : null;
		const canonicalNormalized = normalizedPrimitive(canonicalValue);
		const inputNormalized = normalizedPrimitive(inputValue);
		return Object.freeze({ name, label: label ?? name, canonical: display(canonicalValue, canonicalValue == null), input: draftPresent ? display(inputValue, false) : "nicht eingegeben", changed: draftPresent && canonicalNormalized !== inputNormalized });
	}) : [];
	return Object.freeze({ status: hasDraft ? "draft" : "empty", objectId: exactObject, discipline: String(discipline ?? ""), action: String(action ?? ""), elementId: String(elementId ?? "").trim() || null, mappingId: String(mappingId ?? "").trim() || null, saving: Boolean(saving), message: hasDraft ? null : "Noch keine Eingabe", fields: Object.freeze(rows) });
}

export default buildAuthoringChangePreviewModel;
