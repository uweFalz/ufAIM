function format(value) {
	if (value == null) return "not-covered";
	if (typeof value === "object") return `p(${value.x}, ${value.y}) · t(${value.tx}, ${value.ty})`;
	return String(value);
}

export function renderHorizontalRealizationChangeReceipt(container, receipt) {
	if (!container) return false;
	container.replaceChildren();
	container.dataset.realizationReceiptStatus = receipt?.status === "verified" ? "verified" : "unavailable";
	if (receipt?.status !== "verified") {
		container.textContent = "Kein verifizierter Konsequenzbeleg verfügbar.";
		return false;
	}
	const heading = document.createElement("strong");
	heading.textContent = "Observed persisted realization changes";
	const identity = document.createElement("div");
	identity.textContent = `Alignment ${receipt.objectId} · Element ${receipt.elementId} · Revision ${receipt.revision}`;
	const list = document.createElement("ul");
	for (const change of receipt.changes) {
		for (const field of change.fields) {
			const item = document.createElement("li");
			item.textContent = `${change.target ? "Target" : "Downstream"} ${change.elementId} · ${field.field}: ${format(field.before)} → ${format(field.after)}`;
			list.append(item);
		}
	}
	const boundary = document.createElement("p");
	boundary.textContent = receipt.diagnostics.message;
	container.append(heading, identity, list, boundary);
	return true;
}
