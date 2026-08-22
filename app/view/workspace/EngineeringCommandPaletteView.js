export class EngineeringCommandPaletteView {
	constructor({ documentRef = globalThis.document, root } = {}) { this.document = documentRef; this.root = root; this.handlers = {}; }
	setHandlers(value) { this.handlers = value ?? {}; }
	render(model) {
		const d = this.document, root = this.root; root.replaceChildren(); root.dataset.commandPaletteStatus = model.status;
		if (model.error) { const error = d.createElement("p"); error.dataset.commandPaletteError = ""; error.textContent = model.error; root.append(error); }
		const input = d.createElement("input"); input.type = "search"; input.placeholder = "Befehl suchen"; input.value = model.query; input.disabled = model.busy; input.dataset.commandPaletteSearch = ""; input.addEventListener("input", () => this.handlers.search?.(input.value));
		const list = d.createElement("ul"); list.dataset.commandPaletteList = "";
		for (const command of model.commands) { const item = d.createElement("li"), button = d.createElement("button"); button.type = "button"; button.dataset.commandId = command.id; button.disabled = model.busy || !command.enabled; button.setAttribute?.("aria-selected", String(command.id === model.selectedId)); button.textContent = command.label; if (command.reason) { const reason = d.createElement("small"); reason.textContent = command.reason; item.append(button, reason); } else item.append(button); button.addEventListener("click", () => this.handlers.execute?.(command.id)); list.append(item); }
		root.append(input, list); input.focus?.();
	}
}
export default EngineeringCommandPaletteView;
