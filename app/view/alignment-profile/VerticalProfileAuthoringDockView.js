import { createAuthoringChangePreview } from "../workspace/renderAuthoringChangePreview.js";
function field(documentRef, labelText, name) { const label = documentRef.createElement("label"); label.textContent = labelText; const input = documentRef.createElement("input"); input.name = name; input.type = name.toLowerCase().includes("id") ? "text" : "number"; input.value = ""; label.append(input); return { label, input }; }
export class VerticalProfileAuthoringDockView {
	#host; #handlers = {};
	constructor({ host } = {}) { if (!host?.ownerDocument) throw new TypeError("VerticalProfileAuthoringDockView requires a host"); this.#host = host; }
	setHandlers(value) { this.#handlers = value ?? {}; }
	render(model, state = {}) {
		const d = this.#host.ownerDocument; const root = d.createElement("article"); root.dataset.verticalAuthoringStatus = model.status; root.dataset.objectId = model.objectId ?? "";
		const heading = d.createElement("h2"); heading.textContent = "Vertical / Gradiente bearbeiten";
		const context = d.createElement("p"); context.textContent = `${model.objectId ?? "Kein Objekt"}${model.elementId ? ` · ${model.elementId}` : ""} · ${state.status ?? "ready"}`;
		if (state.error) context.textContent += ` · ${state.error}`;
		const sequence = d.createElement("ol"); sequence.dataset.verticalSequence = ""; for (const entry of model.elements ?? []) { const li = d.createElement("li"); li.textContent = `${entry.elementId} · ${entry.type} · s ${entry.startS ?? "?"}…${entry.endS ?? "?"} · Provenienz ${entry.provenancePresent ? "vorhanden" : "nicht belegt"}`; sequence.append(li); }
		root.append(heading, context, sequence);
		if (model.canCreateInitial) root.append(this.#form(d, model, "Initiales konstantes Profil", [["Segment-ID","segmentId"],["Start s","startS"],["End s","endS"],["Starthöhe","startElevation"],["Gradiente","gradient"]], "createInitial", "submitBasicVerticalProfile", state));
		if (model.canAppendParabolic) root.append(this.#form(d, model, "Terminale Parabel anhängen", [["Element-ID","elementId"],["End s","endS"],["Gradientenrate","gradientRate"]], "appendParabolic", "appendParabolicGradientChange", state));
		if (model.canEdit) root.append(this.#form(d, model, "Terminale Parabel bearbeiten", [["Gradientenrate","gradientRate",model.edit.gradientRate],["End s","endS",model.edit.endS]], "editTerminal", "updateTerminalParabolicComposite", state, { elementId: model.elementId }));
		const note=d.createElement("small");note.dataset.authoringDraftNotice="";note.textContent="Eingaben bleiben beim Schließen in diesem Fenster erhalten.";root.append(note);
		if (model.reason) { const reason = d.createElement("p"); reason.dataset.verticalAuthoringReason = ""; reason.textContent = model.reason; root.append(reason); }
		this.#host.replaceChildren(root);
	}
	#form(d, model, titleText, specs, action, draftAction, state, fixed = {}) { const form = d.createElement("form"); form.dataset.verticalAuthoringAction = action; const title = d.createElement("h3"); title.textContent = titleText; form.append(title); const inputs = {},draft=state.readDraft?.(draftAction); for (const [label,name,value] of specs) { const pair=field(d,label,name); const restored=draft?.[name]??value;if(restored!==undefined)pair.input.value=String(restored); inputs[name]=pair.input; form.append(pair.label); } const values=()=>{const payload={...fixed};for(const[name,input]of Object.entries(inputs))payload[name]=input.value;return payload;};const preview=createAuthoringChangePreview({documentRef:d,context:{objectId:model.objectId,discipline:"vertical",action:draftAction,elementId:model.elementId},fields:specs.map(([label,name,value])=>({label,name,canonicalValue:value})),saving:state.busy});preview.update(draft);form.append(preview.element);for(const input of Object.values(inputs))input.addEventListener?.("input",()=>{const next=values();preview.update(next);this.#handlers.draftChanged?.(draftAction,next);}); const button=d.createElement("button"); button.type="submit"; button.disabled=Boolean(state.busy); button.textContent="Speichern"; form.append(button); form.onsubmit=event=>{event.preventDefault?.(); void this.#handlers[action]?.(values());}; return form; }
}
export default VerticalProfileAuthoringDockView;
