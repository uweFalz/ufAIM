// src/spot/mutate/promoteImportItems.js
//
// promoteImportItems
//
// Promotes canonical ImportSessionItems into canonical SPOT objects.
//
// Important:
// Works against SpotStore API, not raw state.

import { validateSparseAlignment } from "../validation/validateSparseAlignment.js";

export function promoteImportItems({
	items = [],
	spotStore,
	now = Date.now,
	idFactory = defaultSpotIdFactory,
} = {}) {
	if (!spotStore || typeof spotStore.addObject !== "function") {
		throw new Error("promoteImportItems: missing or invalid spotStore");
	}

	const addedObjects = [];
	const rejectedItems = [];

	for (const item of items) {
		const decision = promoteSingleItem({ item, now, idFactory });

		if (!decision.ok) {
			rejectedItems.push({
				itemId: item?.id ?? null,
				kind: item?.kind ?? null,
				reason: decision.reason,
				errors: decision.errors ?? [],
				warnings: decision.warnings ?? [],
			});
			continue;
		}

		const object = decision.object;
		spotStore.addObject(object);
		addedObjects.push(object);
	}

	return {
		ok: rejectedItems.length === 0,
		addedObjects,
		rejectedItems,
	};
}

function promoteSingleItem({ item, now, idFactory }) {
	if (!isObject(item)) {
		return fail("item_not_object");
	}

	if (item.kind !== "alignment") {
		return fail("kind_not_supported_yet");
	}

	if (item.status?.valid !== true) {
		return fail("item_not_valid");
	}

	if (item.status?.promotable !== true) {
		return fail("item_not_promotable");
	}

	const sparseAlignment = item?.derived?.sparseAlignment;
	if (!sparseAlignment) {
		return fail("missing_sparse_alignment");
	}

	const validation = validateSparseAlignment(sparseAlignment);
	if (!validation.ok) {
		return fail("sparse_validation_failed", {
			errors: validation.errors,
			warnings: validation.warnings,
		});
	}

	const objectId = idFactory("alignment", item);

	return {
		ok: true,
		object: {
			id: objectId,
			type: "alignment",
			spatialRef: normalizeSpatialRef(item),
			payload: {
				sparseAlignment,
			},
			meta: {
				source: normalizeSource(item.source),
				importItemId: item.id ?? null,
				importedAt: now(),
				name:
					sparseAlignment?.name ??
					item?.payload?.name ??
					item?.source?.containerId ??
					item?.source?.fileName ??
					objectId,
			},
		},
	};
}

function normalizeSpatialRef(item) {
	const spatialRef =
		item?.payload?.spatialRef ??
		item?.payload?.coordinateSystem ??
		item?.payload?.crs ??
		null;

	if (!isObject(spatialRef)) {
		return {
			horizontalCrsId: null,
			verticalCrsId: null,
			status: "unknown",
		};
	}

	return {
		horizontalCrsId: spatialRef.horizontalCrsId ?? spatialRef.crsId ?? null,
		verticalCrsId: spatialRef.verticalCrsId ?? null,
		status: spatialRef.status ?? "declared",
	};
}

function normalizeSource(source) {
	if (!isObject(source)) return {};
	return {
		fileName: source.fileName ?? null,
		parserId: source.parserId ?? null,
		containerId: source.containerId ?? null,
	};
}

function defaultSpotIdFactory(type, item) {
	const base =
		item?.id ??
		item?.source?.containerId ??
		item?.source?.fileName ??
		"item";

	return `spot_${type}_${slug(base)}`;
}

function slug(value) {
	return String(value ?? "")
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9_]+/g, "_")
		.replace(/^_+|_+$/g, "") || "unnamed";
}

function fail(reason, extra = {}) {
	return { ok: false, reason, ...extra };
}

function isObject(x) {
	return !!x && typeof x === "object" && !Array.isArray(x);
}
