// src/domain/coord/CoordAgent.js

import {
	CRS_STATUS,
	METRIC_SPACE,
	DISPLAY_COMPAT,
} from "./CoordTypes.js";

import {
	classifyDisplayCompatibility,
	canComputeTogether,
} from "./CoordCompatibility.js";

export function inspectCoordContext(objects = []) {
	const contexts = objects.map(classifyObjectCoordContext);

	const displayGroups = buildDisplayGroups(contexts);

	return {
		contexts,
		displayGroups,
		hasMixedCrs: new Set(contexts.map((c) => c.crsId).filter(Boolean)).size > 1,
		hasUnknownCrs: contexts.some((c) => c.status === CRS_STATUS.UNKNOWN),
		hasLocalOnly: contexts.some((c) => c.metricSpace === METRIC_SPACE.LOCAL_UNKNOWN),
	};
}

export function classifyObjectCoordContext(object) {
	const crsId = object?.crsId ?? object?.spatialRef?.crsId ?? null;
	const raw = object?.spatialRef ?? object?.meta?.crsSnapshot ?? null;

	if (crsId) {
		return {
			objectId: object.id,
			crsId,
			status: CRS_STATUS.DECLARED,
			metricSpace: classifyMetricSpaceFromCrsId(crsId),
			crsFamily: classifyCrsFamily(crsId),
			hasApproxGeoAnchor: false,
			raw,
		};
	}

	const guessed = guessFromCoordinates(object);

	if (guessed) {
		return {
			objectId: object.id,
			crsId: guessed.crsId,
			status: CRS_STATUS.INFERRED,
			metricSpace: METRIC_SPACE.ENGINEERING_EUCLIDEAN,
			crsFamily: guessed.family,
			hasApproxGeoAnchor: false,
			raw,
		};
	}

	return {
		objectId: object.id,
		crsId: null,
		status: CRS_STATUS.UNKNOWN,
		metricSpace: METRIC_SPACE.LOCAL_UNKNOWN,
		crsFamily: null,
		hasApproxGeoAnchor: false,
		raw,
	};
}

function classifyMetricSpaceFromCrsId(crsId) {
	if (/^EPSG:/i.test(crsId)) return METRIC_SPACE.PROJECTED_CRS;
	if (/^DB:/i.test(crsId)) return METRIC_SPACE.ENGINEERING_EUCLIDEAN;
	return METRIC_SPACE.ENGINEERING_EUCLIDEAN;
}

function classifyCrsFamily(crsId) {
	const s = String(crsId ?? "").toUpperCase();

	if (s.includes("GK") || s.includes("GAUSS") || /^EPSG:314/.test(s)) return "gauss_krueger";
	if (s.includes("UTM") || /^EPSG:258/.test(s) || /^EPSG:32/.test(s)) return "utm";
	if (s.startsWith("DB:DR")) return "dbref";
	if (s.startsWith("DB:DA")) return "db_landessystem";

	return "unknown";
}

function guessFromCoordinates(object) {
	const p = readFirstPoint(object);
	if (!p) return null;

	const x = Number(p.x);
	const y = Number(p.y);

	if (!Number.isFinite(x) || !Number.isFinite(y)) return null;

	// sehr grobe Heuristik: GK-Rechtswert mit Streifenkennung
	if (x > 2_000_000 && x < 6_000_000 && y > 5_000_000 && y < 6_500_000) {
		const strip = Math.floor(x / 1_000_000);
		return {
			crsId: `unknown_gk_strip_${strip}`,
			family: "gauss_krueger",
		};
	}

	return null;
}

function readFirstPoint(object) {
	const kernel = object?.data?.kernel ?? object?.kernel ?? null;
	const pose = kernel?.startPose ?? null;

	if (pose?.pnt) return pose.pnt;
	if (pose?.point) return pose.point;

	return null;
}

function buildDisplayGroups(contexts) {
	const groups = [];

	for (const ctx of contexts) {
		let placed = false;

		for (const group of groups) {
			const compat = classifyDisplayCompatibility(group.anchor, ctx);

			if (
				compat === DISPLAY_COMPAT.SAME_SPACE ||
				compat === DISPLAY_COMPAT.SEPARATE_LOCAL_SPACE
			) {
				group.items.push(ctx);
				group.compatibility = compat;
				placed = true;
				break;
			}
		}

		if (!placed) {
			groups.push({
				id: `coord_group_${groups.length + 1}`,
				anchor: ctx,
				items: [ctx],
				compatibility: DISPLAY_COMPAT.SAME_SPACE,
			});
		}
	}

	return groups.map((g) => ({
		id: g.id,
		compatibility: g.compatibility,
		objectIds: g.items.map((x) => x.objectId),
		crsIds: [...new Set(g.items.map((x) => x.crsId).filter(Boolean))],
		canComputeTogether: g.items.every((x) => canComputeTogether(g.anchor, x)),
	}));
}
