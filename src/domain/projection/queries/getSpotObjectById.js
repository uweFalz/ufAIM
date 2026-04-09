// src/domain/projection/queries/getSpotObjectById.js
//
// Resolve a canonical SPOT object by id / alias.
//
// Important:
// Preferred lookup key is the canonical SPOT object id.
// Fallbacks are allowed for meta/object aliases.

export function getSpotObjectById(spotState, focusObjectId) {
	if (!spotState || !focusObjectId) return null;

	const wanted = String(focusObjectId).trim();
	if (!wanted) return null;

	const objects = spotState?.objects ?? {};
	if (!objects || typeof objects !== "object") return null;

	// 1) direct canonical store-key hit
	if (objects[wanted]) return objects[wanted];

	// 2) search by known aliases
	for (const object of Object.values(objects)) {
		if (!object) continue;

		if (String(object?.id ?? "") === wanted) return object;
		if (String(object?.meta?.objectId ?? "") === wanted) return object;
		if (String(object?.meta?.alignmentName ?? "") === wanted) return object;
		if (String(object?.payload?.name ?? "") === wanted) return object;
	}

	return null;
}
