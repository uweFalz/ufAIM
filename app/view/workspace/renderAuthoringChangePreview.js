import { buildAuthoringChangePreviewModel } from "../../domain/workspace/buildAuthoringChangePreviewModel.js";

export function createAuthoringChangePreview({ documentRef, context, fields, saving = false } = {}) {
	const root = documentRef.createElement("section");
	root.dataset.authoringChangePreview = "";
	const heading = documentRef.createElement("h4"); heading.textContent = "Änderungsvorschau"; root.append(heading);
	function update(draft) {
		const model = buildAuthoringChangePreviewModel({ ...context, fields, draft, saving });
		root.dataset.previewStatus = model.status; root.dataset.previewReadonly = String(model.saving);
		root.replaceChildren(heading);
		if (model.status !== "draft") { const message = documentRef.createElement("p"); message.textContent = model.message ?? "Vorschau nicht verfügbar"; root.append(message); return model; }
		const table = documentRef.createElement("table"); const head = documentRef.createElement("tr");
		for (const text of ["Feld", "Kanonischer Stand", "Eingabe in diesem Fenster"]) { const cell = documentRef.createElement("th"); cell.textContent = text; head.append(cell); } table.append(head);
		for (const field of model.fields) { const row = documentRef.createElement("tr"); row.dataset.previewField = field.name; row.dataset.previewChanged = String(field.changed); for (const text of [field.label, field.canonical, field.input]) { const cell = documentRef.createElement("td"); cell.textContent = text; row.append(cell); } table.append(row); }
		root.append(table); return model;
	}
	update(null);
	return Object.freeze({ element: root, update });
}
