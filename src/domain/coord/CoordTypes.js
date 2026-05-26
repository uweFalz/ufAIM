// src/domain/coord/CoordTypes.js

export const CRS_STATUS = {
	DECLARED: "declared",
	INFERRED: "inferred",
	UNKNOWN: "unknown",
	LOCAL: "local",
};

export const METRIC_SPACE = {
	ENGINEERING_EUCLIDEAN: "engineering_euclidean",
	PROJECTED_CRS: "projected_crs",
	GLOBE_APPROX: "globe_approx",
	LOCAL_UNKNOWN: "local_unknown",
};

export const DISPLAY_COMPAT = {
	SAME_SPACE: "same_space",
	SEPARATE_LOCAL_SPACE: "separate_local_space",
	GLOBE_OVERVIEW_ONLY: "globe_overview_only",
	NOT_COMPATIBLE: "not_compatible",
};
