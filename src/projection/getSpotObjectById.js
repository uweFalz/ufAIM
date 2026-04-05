// src/projection/getSpotObjectById.js
//
// Canonical SPOT object lookup
//
// Role:
// - resolves one canonical SPOT object by id
// - no projection
// - no view logic
// - no focus logic
//
// Input:
// - spotState or plain spots map
// - objectId / spotId
//
// Output:
// - canonical spot object or null

export function getSpotObjectById(source, objectId) {
	if (!objectId) return null;

	const id = String(objectId);

	const spots =
		source?.spots && typeof source.spots === "object"
			? source.spots
			: source && typeof source === "object"
				? source
				: null;

	if (!spots) return null;

	if (spots[id]) return spots[id];

	for (const obj of Object.values(spots)) {
		if (String(obj?.id ?? "") === id) return obj;
	}

	return null;
}
