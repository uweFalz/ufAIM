function part(value) { return String(value ?? "").trim(); }

export function authoringDraftKey({ objectId, discipline, action, elementId = null, mappingId = null } = {}) {
	const required = [objectId, discipline, action].map(part);
	if (required.some((value) => !value)) return null;
	return JSON.stringify([...required, part(elementId), part(mappingId)]);
}

export function isConfirmedAuthoringSaveResult(result) {
	return result?.status === "saved" || result?.status === "projected";
}

export async function clearDraftAfterCanonicalRefresh({ refresh, clear } = {}) {
	if (typeof refresh !== "function" || typeof clear !== "function") return false;
	const refreshed = await refresh();
	if (!refreshed) return false;
	clear();
	return true;
}

export function createAuthoringDraftStore() {
	const drafts = new Map();
	return Object.freeze({
		read(identity) { const key = authoringDraftKey(identity); return key ? structuredClone(drafts.get(key) ?? null) : null; },
		write(identity, values) { const key = authoringDraftKey(identity); if (!key || !values || typeof values !== "object") return false; drafts.set(key, structuredClone(values)); return true; },
		clear(identity) { const key = authoringDraftKey(identity); return key ? drafts.delete(key) : false; },
		clearAll() { drafts.clear(); },
	});
}

export default createAuthoringDraftStore;
