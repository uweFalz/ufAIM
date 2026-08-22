export class CanonicalObjectQuickSwitcherView {
	constructor({ documentRef = globalThis.document, root } = {}) {
		this.document = documentRef;
		this.root = root;
		this.handlers = {};
		root?.addEventListener?.("keydown", (event) => {
			if (event.key !== "Escape") return;
			event.preventDefault?.();
			this.handlers.close?.();
		});
	}
	setHandlers(value) { this.handlers = value ?? {}; }
	render(model) {
		const d = this.document, r = this.root;
		r.replaceChildren(); r.dataset.quickSwitcherPhase = model.phase;
		if (model.phase === "loading") { const p = d.createElement("p"); p.textContent = "Objekte werden geladen …"; r.append(p); return; }
		if (model.phase === "error") { const p = d.createElement("p"), retry = d.createElement("button"); p.textContent = model.error ?? "Objekte konnten nicht geladen werden"; retry.textContent = "Erneut versuchen"; retry.addEventListener("click", () => this.handlers.retry?.()); r.append(p, retry); return; }
		const input = d.createElement("input"); input.type = "search"; input.placeholder = "ID, Name oder Strecke"; input.value = model.query; input.addEventListener("input", () => this.handlers.search?.(input.value));
		const count = d.createElement("p"); count.textContent = `${model.total} ${model.total === 1 ? "Objekt" : "Objekte"}`;
		const list = d.createElement("ul");
		for (const row of model.rows) {
			const item = d.createElement("li"), button = d.createElement("button"), summary = d.createElement("small");
			button.type = "button"; button.dataset.quickSwitchObjectId = row.objectId; button.setAttribute?.("aria-current", row.objectId === model.activeObjectId ? "true" : "false"); button.textContent = `${row.label} · ${row.objectId}`;
			summary.textContent = [row.route ? `Strecke ${row.route}` : null, row.role ? `Rolle ${row.role}` : null, row.reviewStatus, row.spaceStatus].filter(Boolean).join(" · ");
			button.addEventListener("click", () => this.handlers.activate?.(row.objectId)); item.append(button, summary); list.append(item);
		}
		if (!model.rows.length) { const empty = d.createElement("p"); empty.textContent = model.total ? "Keine Treffer" : "Noch keine Objekte"; r.append(input, count, empty); return; }
		r.append(input, count, list); input.focus?.();
	}
}
export default CanonicalObjectQuickSwitcherView;
