// src/domain/coord/CoordCompatibility.js

import { DISPLAY_COMPAT } from "./CoordTypes.js";

export function classifyDisplayCompatibility(a, b) {
	if (!a || !b) return DISPLAY_COMPAT.NOT_COMPATIBLE;

	if (a.crsId && b.crsId && a.crsId === b.crsId) {
		return DISPLAY_COMPAT.SAME_SPACE;
	}

	if (a.metricSpace === "engineering_euclidean" && b.metricSpace === "engineering_euclidean") {
		if (a.crsFamily && b.crsFamily && a.crsFamily === b.crsFamily) {
			return DISPLAY_COMPAT.SEPARATE_LOCAL_SPACE;
		}
	}

	if (a.hasApproxGeoAnchor && b.hasApproxGeoAnchor) {
		return DISPLAY_COMPAT.GLOBE_OVERVIEW_ONLY;
	}

	return DISPLAY_COMPAT.NOT_COMPATIBLE;
}

export function canComputeTogether(a, b) {
	return Boolean(a?.crsId && b?.crsId && a.crsId === b.crsId);
}
