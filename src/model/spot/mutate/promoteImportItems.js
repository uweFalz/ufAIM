// src/model/spot/mutate/promoteImportItems.js
//
// promoteImportItems
//
// Purpose:
// - evaluate canonical ImportSessionItems for SPOT admission
// - promote only safe items into SpotStore
// - keep review/reject decisions explicit and machine-readable
// - convert import items into canonical SPOT entries
//
// Rule:
// import items are NOT promoted just because they exist.
// import items must pass assessSpotAdmission().
//
// SPOT target shape v0.1:
// {
//   id,
//   type,
//   crsId,
//   data,   // type-specific, validated
//   refs,   // IDs only
//   meta
// }
//
// Important:
// - SPOT remains canonical truth
// - review items stay outside SPOT
// - reject items stay outside SPOT
// - no geometry recomputation here except using already-derived sparseAlignment

import { assessSpotAdmission } from "../../../import/spot/assessSpotAdmission.js";

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

		if (decision?.admission === "safe") {
			const promoted = promoteOneItemToSpotEntry(item);

			if (!promoted) {
				reviewItems.push({
					id: item.id ?? null,
					kind: item.kind ?? null,
					reason: "promotion_builder_returned_null",
				});
				continue;
			}

			registerCrsIfPossible(spotStore, promoted.crs, promoted.entry);

			spotStore.addObjects([promoted.entry]);
			addedObjects.push(promoted.entry);
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
// item -> SPOT entry
// -----------------------------------------------------------------------------

function promoteOneItemToSpotEntry(item) {
	switch (item?.kind) {
		case "alignment":
			return buildSpotAlignmentEntry(item);

		case "profile":
			return buildSpotProfileEntry(item);

		case "cant":
			return buildSpotCantEntry(item);

		case "staEq":
			return buildSpotStaEqEntry(item);

		case "relation":
			return buildSpotRelationEntry(item);

		default:
			return null;
	}
}

function buildSpotAlignmentEntry(item) {
	const sparseAlignment = item?.derived?.sparseAlignment ?? null;
	if (!isObject(sparseAlignment)) return null;

	const payload = item?.payload ?? {};
	const crs = normalizeSpotCrs(item);
	if (!crs?.crsId) return null;

	return {
		crs,
		entry: {
			id: String(item.id),
			type: "alignment",
			crsId: crs.crsId,

			data: {
				name: payload.name ?? payload.id ?? item.id ?? null,
				kernel: normalizeAlignmentKernel(sparseAlignment),
				meta: clonePlainObject(payload.meta),
				extended: clonePlainObject(payload.extended),
			},

			refs: {
				profileRelationIds: [],
				cantRelationIds: [],
				staEquationRelationIds: [],
			},

			meta: buildSpotMeta(item),
		},
	};
}

function buildSpotProfileEntry(item) {
	const payload = item?.payload ?? {};
	const crs = normalizeSpotCrs(item);
	if (!crs?.crsId) return null;

	return {
		crs,
		entry: {
			id: String(item.id),
			type: "profile",
			crsId: crs.crsId,

			data: {
				name: payload.name ?? payload.id ?? item.id ?? null,
				points: normalizeProfilePoints(payload.points),
				stationReference: payload.stationReference ?? null,
				meta: clonePlainObject(payload.meta),
				extended: clonePlainObject(payload.extended),
			},

			refs: {},

			meta: buildSpotMeta(item),
		},
	};
}

function buildSpotCantEntry(item) {
	const payload = item?.payload ?? {};
	const crs = normalizeSpotCrs(item);
	if (!crs?.crsId) return null;

	return {
		crs,
		entry: {
			id: String(item.id),
			type: "cant",
			crsId: crs.crsId,

			data: {
				name: payload.name ?? payload.id ?? item.id ?? null,
				values: normalizeCantValues(payload.points),
				stationReference: payload.stationReference ?? null,
				meta: clonePlainObject(payload.meta),
				extended: clonePlainObject(payload.extended),
			},

			refs: {},

			meta: buildSpotMeta(item),
		},
	};
}

function buildSpotStaEqEntry(item) {
	const payload = item?.payload ?? {};
	const crs = normalizeSpotCrs(item);
	if (!crs?.crsId) return null;

	return {
		crs,
		entry: {
			id: String(item.id),
			type: "staEquation",
			crsId: crs.crsId,

			data: {
				name: payload.name ?? payload.id ?? item.id ?? null,
				equations: Array.isArray(payload.equations) ? payload.equations : [],
				meta: clonePlainObject(payload.meta),
				extended: clonePlainObject(payload.extended),
			},

			refs: {},

			meta: buildSpotMeta(item),
		},
	};
}

function buildSpotRelationEntry(item) {
	const payload = item?.payload ?? {};
	const crs = normalizeSpotCrs(item);

	return {
		crs,
		entry: {
			id: String(item.id),
			type: "relation",
			crsId: crs?.crsId ?? null,

			data: {
				name: payload.name ?? payload.id ?? item.id ?? null,
				relationType: payload.relationType ?? null,
				from: normalizeRelationEndpoint(payload.fromRef ?? payload.from),
				to: normalizeRelationEndpoint(payload.toRef ?? payload.to),
				scope: normalizeRelationScope(payload.scope),
				status: payload.status ?? "declared",
				meta: clonePlainObject(payload.meta),
				extended: clonePlainObject(payload.extended),
			},

			refs: {},

			meta: buildSpotMeta(item),
		},
	};
}

// -----------------------------------------------------------------------------
// canonical data normalization
// -----------------------------------------------------------------------------

function normalizeAlignmentKernel(sparseAlignment) {
	if (!isObject(sparseAlignment)) {
		return {
			startPose: null,
			elements: [],
			sparse: [],
			version: "sparse_v1",
		};
	}

	const elements = Array.isArray(sparseAlignment.elements)
		? sparseAlignment.elements
		: Array.isArray(sparseAlignment.sparse)
			? sparseAlignment.sparse
			: [];

	return {
		// 🔥 WICHTIG: nichts verlieren
		...sparseAlignment,

		// stabile Zugriffspfade für Projection
		startPose: sparseAlignment.startPose ?? null,
		elements,
		sparse: elements,

		version: sparseAlignment.version ?? "sparse_v1",
	};
}

function normalizeProfilePoints(points) {
	const out = [];

	for (const p of asArray(points)) {
		const s = readMeasureValue(p?.s ?? p?.station ?? p?.sta ?? p?.chainage);
		const z = readMeasureValue(p?.z ?? p?.elevation ?? p?.height);

		if (!Number.isFinite(s) || !Number.isFinite(z)) continue;

		out.push({
			s,
			z,
			meta: clonePlainObject(p?.meta),
		});
	}

	return out;
}

function normalizeCantValues(points) {
	const out = [];

	for (const p of asArray(points)) {
		const s = readMeasureValue(p?.s ?? p?.station ?? p?.sta ?? p?.chainage);
		const cant = readMeasureValue(
			p?.cant ??
			p?.appliedCant ??
			p?.value ??
			p?.deltaH
		);

		if (!Number.isFinite(s) || !Number.isFinite(cant)) continue;

		out.push({
			s,
			cant,
			meta: clonePlainObject(p?.meta),
		});
	}

	return out;
}

function normalizeRelationEndpoint(value) {
	if (isObject(value)) {
		return {
			kind: value.kind ?? value.type ?? null,
			id: value.id ?? value.objectId ?? null,
		};
	}

	if (typeof value === "string" && value.trim()) {
		return {
			kind: null,
			id: value.trim(),
		};
	}

	return {
		kind: null,
		id: null,
	};
}

function normalizeRelationScope(scope) {
	if (!isObject(scope)) {
		return {
			sMin: null,
			sMax: null,
		};
	}

	return {
		sMin: Number.isFinite(Number(scope.sMin)) ? Number(scope.sMin) : null,
		sMax: Number.isFinite(Number(scope.sMax)) ? Number(scope.sMax) : null,
	};
}

// -----------------------------------------------------------------------------
// CRS
// -----------------------------------------------------------------------------

function normalizeSpotCrs(item) {
	const sr = item?.derived?.spatialRef ?? null;

	if (!isObject(sr)) {
		return {
			crsId: null,
			status: "unknown",
			source: item?.source?.parserId ?? null,
		};
	}

	const horizontal =
		firstNonEmptyString(
			sr.crsId,
			sr.horizontalCrsId,
			sr.horizontal,
			sr.horizontalCoordinateSystemName,
			null
		);

	if (!horizontal) {
		return {
			crsId: null,
			status: sr.status ?? "unknown",
			source: sr.source ?? item?.source?.parserId ?? null,
		};
	}

	const crsId = normalizeCrsId(horizontal);

	return {
		id: crsId,
		crsId,
		status: sr.status ?? "declared",

		horizontalCrsId: crsId,
		horizontalCoordinateSystemName:
			sr.horizontalCoordinateSystemName ??
			sr.horizontal ??
			horizontal,

		verticalCrsId: sr.verticalCrsId ?? null,
		verticalCoordinateSystemName: sr.verticalCoordinateSystemName ?? null,

		source: sr.source ?? item?.source?.parserId ?? null,
		raw: clonePlainObject(sr),
	};
}

function normalizeCrsId(value) {
	const s = String(value ?? "").trim();
	if (!s) return null;

	if (/^EPSG:/i.test(s)) return `EPSG:${s.split(":")[1]}`;
	if (/^DB:/i.test(s)) return `DB:${s.split(":")[1]}`;

	// Deutsche-Bahn-/Technet-Kurzcodes wie DR0, DA0 usw.
	if (/^[A-Z]{2}\d$/i.test(s)) return `DB:${s.toUpperCase()}`;

	return s;
}

function registerCrsIfPossible(spotStore, crs, entry) {
	if (!crs?.crsId) return;

	if (typeof spotStore.addCrs === "function") {
		spotStore.addCrs(crs);
		return;
	}

	if (typeof spotStore.upsertCrs === "function") {
		spotStore.upsertCrs(crs);
		return;
	}

	if (isObject(entry)) {
		entry.meta = {
			...(entry.meta ?? {}),
			crsSnapshot: crs,
		};
	}
}

// -----------------------------------------------------------------------------
// meta
// -----------------------------------------------------------------------------

function buildSpotMeta(item) {
	return {
		importItemId: item?.id ?? null,
		source: clonePlainObject(item?.source),
		importMeta: clonePlainObject(item?.meta),
		importAssessment: clonePlainObject(item?.derived?.importAssessment),
		interpretation: isObject(item?.derived?.interpretation)
			? { ...item.derived.interpretation }
			: null,
	};
}

// -----------------------------------------------------------------------------
// helpers
// -----------------------------------------------------------------------------

function readMeasureValue(value) {
	if (isObject(value) && Number.isFinite(Number(value.value))) {
		return Number(value.value);
	}

	const n = Number(value);
	return Number.isFinite(n) ? n : null;
}

function clonePlainObject(value) {
	return isObject(value) ? { ...value } : {};
}

function asArray(value) {
	return Array.isArray(value) ? value : [];
}

function firstNonEmptyString(...values) {
	for (const value of values) {
		if (typeof value === "string" && value.trim()) return value.trim();
	}
	return null;
}

function isObject(x) {
	return !!x && typeof x === "object" && !Array.isArray(x);
}
