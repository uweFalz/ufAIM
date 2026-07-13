// src/shared/runtime/workspaceSelectionAccess.js

function isObject(value) {
	return !!value && typeof value === "object" && !Array.isArray(value);
}

function normalizeId(value) {
	const id = String(value ?? "").trim();
	return id || null;
}

function normalizeIdList(ids) {
	if (!Array.isArray(ids)) return [];

	const out = [];
	const seen = new Set();

	for (const value of ids) {
		const id = normalizeId(value);
		if (!id || seen.has(id)) continue;
		seen.add(id);
		out.push(id);
	}

	return out;
}

export function getWorkspaceSelection(state) {
	const selection = isObject(state?.workspace_selection)
		? state.workspace_selection
		: {};

	return {
		primaryId: normalizeId(selection.primaryId),
		contextIds: normalizeIdList(selection.contextIds),
		source: selection.source != null ? String(selection.source) : null,
		crsId: normalizeId(selection.crsId),
	};
}

export function getWorkspacePrimaryId(state) {
	return getWorkspaceSelection(state).primaryId;
}

export function getWorkspaceContextIds(state) {
	return getWorkspaceSelection(state).contextIds;
}

export function getWorkspacePrimaryObject(state, objects) {
	const primaryId = getWorkspacePrimaryId(state);
	if (!primaryId) return null;

	if (Array.isArray(objects)) {
		return (
			objects.find(
				(object) => normalizeId(object?.id) === primaryId
			) ?? null
		);
	}

	if (isObject(objects)) {
		return objects[primaryId] ?? null;
	}

	return null;
}

export function getWorkspaceContextObjects(
	state,
	objects,
	{ excludePrimary = true } = {}
) {
	const contextIds = getWorkspaceContextIds(state);
	if (!contextIds.length) return [];

	const primaryId = excludePrimary ? getWorkspacePrimaryId(state) : null;
	const out = [];

	for (const id of contextIds) {
		if (excludePrimary && primaryId && id === primaryId) continue;

		const object = Array.isArray(objects)
			? objects.find((candidate) => normalizeId(candidate?.id) === id)
			: isObject(objects)
			? objects[id]
			: null;

		if (object) {
			out.push(object);
		}
	}

	return out;
}

export default {
	getWorkspaceSelection,
	getWorkspacePrimaryId,
	getWorkspaceContextIds,
	getWorkspacePrimaryObject,
	getWorkspaceContextObjects,
};
