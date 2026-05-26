//
// src/coord/inferEngineeringContext.js
//

export function inferEngineeringContext({
	x,
	y,
} = {}) {

	if (
		!Number.isFinite(x) ||
		!Number.isFinite(y)
	) {
		return null;
	}

	if (
		x > 2000000 &&
		x < 6000000 &&
		y > 5000000 &&
		y < 7000000
	) {
		const strip = Math.floor(x / 1000000);

		return {
			status: "inferred",
			family: "gauss_krueger",
			crsId: `INFERRED:GK:${strip}`,
			confidence: 0.75,
			meta: {
				strip,
				heuristic: "rechtswert_zone",
			},
		};
	}

	if (
		x > 100000 &&
		x < 1000000 &&
		y > 100000 &&
		y < 10000000
	) {
		return {
			status: "inferred",
			family: "dbref",
			crsId: "INFERRED:DBREF",
			confidence: 0.55,
			meta: {
				heuristic: "dbref_range",
			},
		};
	}

	return {
		status: "unknown",
		family: "local_unknown",
		crsId: null,
		confidence: 0.0,
		meta: {
			heuristic: "no_match",
		},
	};
}
