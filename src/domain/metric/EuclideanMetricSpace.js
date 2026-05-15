// src/domain/metric/EuclideanMetricSpace.js
//
// Fast default metric backend.
//
// This is the current engineering-CRS behavior:
// flat, Cartesian, Euclidean, performant.
//
// Important:
// This class must stay boring and fast.

import { MetricSpace } from "./MetricSpace.js";

export class EuclideanMetricSpace extends MetricSpace {
	constructor(options = {}) {
		super({
			id: options.id ?? "metric:euclidean",
			label: options.label ?? "Euclidean Engineering Metric",
		});
	}

	squaredDistance(a, b) {
		const dx = b.x - a.x;
		const dy = b.y - a.y;
		return dx * dx + dy * dy;
	}

	distance(a, b) {
		return Math.sqrt(this.squaredDistance(a, b));
	}

	dot(u, v) {
		return u.dx * v.dx + u.dy * v.dy;
	}

	cross(u, v) {
		return u.dx * v.dy - u.dy * v.dx;
	}

	rotate90Left(v) {
		return { dx: -v.dy, dy: v.dx };
	}

	rotate90Right(v) {
		return { dx: v.dy, dy: -v.dx };
	}
}
