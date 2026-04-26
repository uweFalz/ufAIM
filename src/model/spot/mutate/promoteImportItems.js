// src/model/spot/mutate/promoteImportItems.js
//
// promoteImportItems
//
// Purpose:
// - evaluate canonical ImportSessionItems for SPOT admission
// - promote only safe items into SpotStore
// - keep review/reject decisions explicit and machine-readable
//
// Rule:
// import items are NOT promoted just because they exist
// import items must pass assessSpotAdmission()
//
// Important:
// - SPOT remains canonical truth
// - review items stay outside SPOT
// - reject items stay outside SPOT
// - no geometry recomputation here except using already-derived sparseAlignment

import { assessSpotAdmission } from "../../../import/spot/assessSpotAdmission.js";

console.log("[promoteImportItems] MODULE LOADED v2");

export function promoteImportItems({
	items = [],
	spotStore,
} = {}) {
	if (!spotStore || typeof spotStore.addObjects !== "function") {
		throw new Error("promoteImportItems: missing spotStore.addObjects");
	}

	const sourceItems = Array.isArray(items) ? items : [];

	const addedObjects = [];
	const reviewItems = [];
	const rejectedItems = [];

	for (const item of sourceItems) {
		if (!isObject(item)) {
			rejectedItems.push({
				id: null,
				kind: null,
				reason: "invalid_item",
			});
			continue;
		}

		const decision = assessSpotAdmission(item);

console.log("[promoteImportItems] decision", {
	id: item?.id ?? null,
	kind: item?.kind ?? null,
	admission: decision?.admission ?? null,
	reason: decision?.reason ?? null,
	sourceTrustClass: item?.derived?.importAssessment?.sourceTrustClass ?? null,
	spatialRefStatus: item?.derived?.spatialRef?.status ?? null,
	spatialRef: item?.derived?.spatialRef ?? null,
	hasSparse: Boolean(item?.derived?.sparseAlignment),
	hasProfile:
		Boolean(item?.payload?.profileRef) ||
		Boolean(item?.derived?.interpretation?.hasProfile),
	hasCant:
		Boolean(item?.payload?.cantRef) ||
		Boolean(item?.derived?.interpretation?.hasCant),
	hasStaEq:
		Boolean(item?.payload?.staEqRef) ||
		Boolean(item?.derived?.interpretation?.hasStaEq),
	importAssessment: item?.derived?.importAssessment ?? null,
	interpretation: item?.derived?.interpretation ?? null,
});

		if (decision?.admission === "safe") {
			const promoted = promoteOneItemToSpotObject(item);

			if (!promoted) {
				reviewItems.push({
					id: item.id ?? null,
					kind: item.kind ?? null,
					reason: "promotion_builder_returned_null",
				});
				continue;
			}

			spotStore.addObjects([promoted]);
			addedObjects.push(promoted);
			continue;
		}

		if (decision?.admission === "review") {
			reviewItems.push({
				id: item.id ?? null,
				kind: item.kind ?? null,
				reason: decision.reason ?? "review_required",
			});
			continue;
		}

		rejectedItems.push({
			id: item.id ?? null,
			kind: item.kind ?? null,
			reason: decision?.reason ?? "rejected",
		});
	}

	return {
		ok: true,
		addedObjects,
		reviewItems,
		rejectedItems,
		count: {
			addedObjects: addedObjects.length,
			reviewItems: reviewItems.length,
			rejectedItems: rejectedItems.length,
		},
	};
}

// -----------------------------------------------------------------------------
// item -> SpotObject
// -----------------------------------------------------------------------------

function promoteOneItemToSpotObject(item) {
	switch (item?.kind) {
		case "alignment":
			return buildSpotAlignmentObject(item);

		case "profile":
			return buildSpotProfileObject(item);

		case "cant":
			return buildSpotCantObject(item);

		case "staEq":
			return buildSpotStaEqObject(item);

		case "relation":
			return buildSpotRelationObject(item);

		default:
			return null;
	}
}

function buildSpotAlignmentObject(item) {
	const sparseAlignment = item?.derived?.sparseAlignment ?? null;
	if (!isObject(sparseAlignment)) return null;

	const payload = item?.payload ?? {};
	const spatialRef = normalizeSpotSpatialRef(item);

	return {
		id: String(item.id),
		type: "alignment",
		spatialRef,
		payload: {
			name: payload.name ?? payload.id ?? item.id ?? null,
			sparseAlignment,
			meta: isObject(payload.meta) ? payload.meta : {},
			extended: isObject(payload.extended) ? payload.extended : {},
		},
		meta: buildSpotMeta(item),
	};
}

function buildSpotProfileObject(item) {
	const payload = item?.payload ?? {};
	const spatialRef = normalizeSpotSpatialRef(item);

	return {
		id: String(item.id),
		type: "profile",
		spatialRef,
		payload: {
			name: payload.name ?? payload.id ?? item.id ?? null,
			points: Array.isArray(payload.points) ? payload.points : [],
			stationReference: payload.stationReference ?? null,
			meta: isObject(payload.meta) ? payload.meta : {},
			extended: isObject(payload.extended) ? payload.extended : {},
		},
		meta: buildSpotMeta(item),
	};
}

function buildSpotCantObject(item) {
	const payload = item?.payload ?? {};
	const spatialRef = normalizeSpotSpatialRef(item);

	return {
		id: String(item.id),
		type: "cant",
		spatialRef,
		payload: {
			name: payload.name ?? payload.id ?? item.id ?? null,
			points: Array.isArray(payload.points) ? payload.points : [],
			stationReference: payload.stationReference ?? null,
			meta: isObject(payload.meta) ? payload.meta : {},
			extended: isObject(payload.extended) ? payload.extended : {},
		},
		meta: buildSpotMeta(item),
	};
}

function buildSpotStaEqObject(item) {
	const payload = item?.payload ?? {};
	const spatialRef = normalizeSpotSpatialRef(item);

	return {
		id: String(item.id),
		type: "staEq",
		spatialRef,
		payload: {
			name: payload.name ?? payload.id ?? item.id ?? null,
			equations: Array.isArray(payload.equations) ? payload.equations : [],
			meta: isObject(payload.meta) ? payload.meta : {},
			extended: isObject(payload.extended) ? payload.extended : {},
		},
		meta: buildSpotMeta(item),
	};
}

function buildSpotRelationObject(item) {
	const payload = item?.payload ?? {};
	const spatialRef = normalizeSpotSpatialRef(item);

	return {
		id: String(item.id),
		type: "relation",
		spatialRef,
		payload: {
			name: payload.name ?? payload.id ?? item.id ?? null,
			relationType: payload.relationType ?? null,
			fromRef: payload.fromRef ?? null,
			toRef: payload.toRef ?? null,
			meta: isObject(payload.meta) ? payload.meta : {},
			extended: isObject(payload.extended) ? payload.extended : {},
		},
		meta: buildSpotMeta(item),
	};
}

// -----------------------------------------------------------------------------
// shared helpers
// -----------------------------------------------------------------------------

function buildSpotMeta(item) {
	return {
		importItemId: item?.id ?? null,
		source: isObject(item?.source) ? { ...item.source } : {},
		importMeta: isObject(item?.meta) ? { ...item.meta } : {},
		importAssessment: isObject(item?.derived?.importAssessment)
			? { ...item.derived.importAssessment }
			: {},
		interpretation: isObject(item?.derived?.interpretation)
			? { ...item.derived.interpretation }
			: null,
	};
}

function normalizeSpotSpatialRef(item) {
	const sr = item?.derived?.spatialRef;

	if (isObject(sr)) {
		return {
			...sr,
			status: sr.status ?? "unknown",
		};
	}

	return {
		status: "unknown",
	};
}

function isObject(x) {
	return !!x && typeof x === "object" && !Array.isArray(x);
}
