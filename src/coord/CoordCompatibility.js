// src/coord/CoordCompatibility.js
//
// Decides whether coordinate contexts may be used together.
//
// Important:
// - SPOT may store everything
// - View must not blindly mix incompatible contexts
// - this is policy, not projection math

export function assessCoordCompatibility(a, b) {
	if (!a || !b) {
		return result("unknown", false, false, "missing_context");
	}

	if (a.id === b.id) {
		return result("same_context", true, true, "same_context");
	}

	if (a.crsId && b.crsId && a.crsId === b.crsId) {
		return result("same_crs", true, true, "same_crs");
	}

	if (a.family && b.family && a.family === b.family) {
		return result("same_family_review", false, true, "same_family_but_not_same_context");
	}

	return result("incompatible", false, false, "different_metric_contexts");
}

function result(mode, canMetricOperate, canOverviewTogether, reason) {
	return {
		mode,
		canMetricOperate,
		canOverviewTogether,
		reason,
	};
}
