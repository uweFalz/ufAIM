// src/import/spot/assessSpotAdmission.js

export function assessSpotAdmission(item) {
	if (!item || item.status?.valid !== true) {
		return reject("invalid_item");
	}

	const kind = item.kind ?? null;
	const spatialRef = item.derived?.spatialRef ?? null;
	const sourceTrustClass =
		item.derived?.importAssessment?.sourceTrustClass ?? "unknown";

	// ------------------------------------------------------------
	// alignment
	// ------------------------------------------------------------
	if (kind === "alignment") {
		if (!item.derived?.sparseAlignment) {
			return review("missing_sparse");
		}

		if (sourceTrustClass === "authoritative_context") {
			if (!spatialRef || spatialRef.status === "missing") {
				return review("missing_crs_for_gnd");
			}
			return safe();
		}

		if (sourceTrustClass === "conditional_container") {
			if (
				spatialRef?.status === "declared" ||
				spatialRef?.status === "resolved"
			) {
				return safe();
			}
			return review("landxml_crs_insufficient");
		}

		if (sourceTrustClass === "geometry_only") {
			return review("no_crs_context");
		}

		return review("unknown_source_policy");
	}

	// ------------------------------------------------------------
	// profile / cant / staEq
	// ------------------------------------------------------------
	if (kind === "profile" || kind === "cant" || kind === "staEq") {
		const truthLevel =
			item.derived?.attachmentAssessment?.truthLevel ?? "suggested";

		if (truthLevel === "declared" || truthLevel === "resolved") {
			return safe();
		}

		return review("attachment_not_resolved");
	}

	// ------------------------------------------------------------
	// relation
	// ------------------------------------------------------------
	if (kind === "relation") {
		const truthLevel =
			item.derived?.relationAssessment?.truthLevel ?? "suggested";

		if (truthLevel === "declared" || truthLevel === "resolved") {
			return safe();
		}

		return review("relation_suggested_only");
	}

	// ------------------------------------------------------------
	// fallback
	// ------------------------------------------------------------
	return reject("unsupported_kind");
}

// ------------------------------------------------------------
// helpers
// ------------------------------------------------------------

function safe() {
	return { admission: "safe", reason: null };
}

function review(reason) {
	return { admission: "review", reason };
}

function reject(reason) {
	return { admission: "reject", reason };
}
