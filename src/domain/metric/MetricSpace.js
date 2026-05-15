// src/domain/metric/MetricSpace.js
//
// Abstract metric operator interface.
//
// Purpose:
// - separate alignment semantics from metric realization
// - keep Euclidean engineering CRS as default and fast path
// - allow later projection-aware / differential-geometry backends
//
// Rule:
// Alignment code should depend on metric operators, not on CRS math directly.

export class MetricSpace {
	constructor({ id = "metric:abstract", label = "Abstract Metric Space" } = {}) {
		this.id = id;
		this.label = label;
	}

	distance(_a, _b) {
		throw new Error(`${this.constructor.name}.distance() not implemented`);
	}

	squaredDistance(_a, _b) {
		throw new Error(`${this.constructor.name}.squaredDistance() not implemented`);
	}

	dot(_u, _v) {
		throw new Error(`${this.constructor.name}.dot() not implemented`);
	}

	norm(v) {
		return Math.sqrt(this.dot(v, v));
	}

	normalize(v) {
		const n = this.norm(v);
		if (!Number.isFinite(n) || n === 0) return { dx: 1, dy: 0 };
		return { dx: v.dx / n, dy: v.dy / n };
	}

	headingOf(v) {
		return Math.atan2(v.dy, v.dx);
	}

	vector(a, b) {
		return {
			dx: b.x - a.x,
			dy: b.y - a.y,
		};
	}

	pointPlusVector(p, v, scale = 1) {
		return {
			x: p.x + scale * v.dx,
			y: p.y + scale * v.dy,
		};
	}

	// For now: operator hook.
	// Later: may use local metric tensor, projection Jacobian, ellipsoid adapter, etc.
	localContextAt(_p) {
		return {
			type: "localMetricContext",
			metricSpaceId: this.id,
		};
	}
}
