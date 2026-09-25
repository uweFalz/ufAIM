// src/domain/optimization/alignment/AlignmentPointProjection.js
//
// Projecting a point onto an alignment during a solve: the foot moves little
// between evaluations, so it is found again by Newton on the longitudinal
// offset from where it was last time, on the same production geometry. The
// full scan of world2Track remains for the first time and for a foot that
// leaves its window or an end. Measured on 41 elements (#23) the scan alone
// was 84 % of a 449 s solve.

import { normalize, rot90 } from "../../../aim-core/geometry/vec2.js";

export const ALIGNMENT_POINT_PROJECTION_VERSION = "axtran2/alignment-point-projection/0.1";

/** Newton on u(s) = (X − p(s))·t(s) from a remembered station; null when it leaves the window. */
export function newtonFoot(alignment, x, y, s0, { window = 200, tolerance = 1e-9, maxSteps = 30 } = {}) {
	const L = alignment.arcLength;
	let s = s0;
	for (let step = 0; step < maxSteps; step++) {
		const pose = alignment.poseAt(s, { quality: "balanced" });
		const t = normalize(pose.t);
		const n = rot90(t);
		const d = { x: x - pose.p.x, y: y - pose.p.y };
		const u = d.x * t.x + d.y * t.y;
		const q = d.x * n.x + d.y * n.y;
		if (Math.abs(u) <= tolerance) {
			return { s, q, dist: Math.hypot(d.x, d.y), point: pose.p, tangent: t, elementIndex: null, u, clamped: s <= 0 || s >= L };
		}
		// d/ds of (X − p)·t is −(1 − q·kappa): s += u is Newton only on a
		// straight, and on a curve far from the point it contracts by q·kappa a
		// step (measured 0.32, alternating, 270 m off on R 200)
		const kappa = alignment.curvatureAt(s);
		const slope = 1 - q * kappa;
		s += Math.abs(slope) > 1e-3 ? u / slope : u;
		if (s < 0 || s > L || Math.abs(s - s0) > window) return null;
	}
	return null;
}

/**
 * A projector with memory, one per solve: `project(alignment, x, y)` answers
 * like `alignment.world2Track(x, y)` and remembers each point's foot.
 *
 * A memory is only as good as the geometry it was made on. A foot is
 * remembered with the place the alignment had at its station; when the
 * alignment has moved that place by more than staleDistance since, the
 * memory says nothing about where the foot is now and the full scan runs.
 * Measured on 2631R139: after a first attempt had collapsed the geometry,
 * a second attempt from the same start read every foot through the
 * memory of the wreck, found local feet on a 200 m window that were not
 * the nearest, and ran a thousand iterations where a fresh solve takes 63.
 * The distance is Newton's own window: a station that moved farther than
 * Newton could have followed is stale by definition. Measured on the
 * corpus, 50 m rescanned so often that the points runs took 175 s against
 * 97 without the check; at 200 m they take 105 s. (#48 documented and
 * measured 200 m and committed 50: the edit that set the default had
 * failed silently, and the runs since then carried the 50.)
 *
 * @param {{samples?: number, refineSteps?: number, staleDistance?: number}} [scan]  the full scan's resolution
 */
/**
 * The vertices of an alignment: the stations of its kinks, once per
 * alignment instance. A kink is a zero-length element that turns.
 */
const vertexCache = new WeakMap();
function verticesOf(alignment) {
	let vertices = vertexCache.get(alignment);
	if (vertices) return vertices;
	vertices = [];
	let station = 0;
	for (const element of alignment.elements ?? []) {
		const length = element.arcLength ?? 0;
		if (length === 0 && typeof element.deltaDir === "number" && element.deltaDir !== 0) vertices.push(station);
		station += length;
	}
	vertexCache.set(alignment, vertices);
	return vertices;
}

/**
 * The distance at a kink. A point in the wedge outside a bend has no
 * perpendicular on either line: its nearest point of the polyline is the
 * vertex, and its residual is the distance to that point, signed by the
 * side it lies on - not the lateral offset from one of the two lines,
 * which is what a foot returned at the vertex with u != 0 would give. The
 * derivative then runs along the direction to the vertex, which the foot
 * carries as `direction` (so that dq = -direction · dV).
 */
function atVertex(alignment, projected, x, y) {
	if (!projected || Math.abs(projected.u ?? 0) <= 1e-9) return projected;
	const vertices = verticesOf(alignment);
	if (vertices.length === 0) return projected;
	const station = vertices.find((v) => Math.abs(v - projected.s) <= 1e-6);
	if (station === undefined) return projected;
	const vertex = alignment.poseAt(station, { quality: "balanced" }).p;
	const d = { x: x - vertex.x, y: y - vertex.y };
	const dist = Math.hypot(d.x, d.y);
	if (!(dist > 0)) return { ...projected, s: station, q: 0, dist: 0, u: 0, vertex: true };
	const t = normalize(projected.tangent);
	const n = rot90(t);
	const sign = d.x * n.x + d.y * n.y >= 0 ? 1 : -1;
	return { ...projected, s: station, q: sign * dist, dist, u: 0, point: vertex, vertex: true, direction: { x: (sign * d.x) / dist, y: (sign * d.y) / dist } };
}

export function createFootMemory({ samples = 400, refineSteps = 40, staleDistance = 200 } = {}) {
	const feet = new Map();
	let scans = 0;
	return Object.freeze({
		version: ALIGNMENT_POINT_PROJECTION_VERSION,
		project(alignment, x, y) {
			const key = `${x},${y}`;
			const remembered = feet.get(key);
			let fresh = remembered !== undefined && remembered.s <= alignment.arcLength;
			if (fresh) {
				const there = alignment.poseAt(remembered.s, { quality: "balanced" }).p;
				fresh = Math.hypot(there.x - remembered.x, there.y - remembered.y) <= staleDistance;
			}
			const local = fresh ? newtonFoot(alignment, x, y, remembered.s) : null;
			if (!local) scans += 1;
			const projected = atVertex(alignment, local ?? alignment.world2Track(x, y, { samples, refineSteps }), x, y);
			// A foot farther from its point than the stale distance is a foot on
			// a wreck, and not one to remember: Newton from it stays on its
			// branch while the geometry walks back to sense. Measured on a
			// 22 km alignment: a trial step that put every curvature on its
			// bound coiled the far end next to the start, the points of km 19
			// found a foot at station 850 ten kilometres off, and the line
			// search's forty halvings back to the start carried that branch all
			// the way - a stationary point of the distance at every step, never
			// the nearest - until the fit ended at rms 19 596 a hair's breadth
			// from a point where the scan says 1.0. Forgotten instead, the next
			// evaluation resumes from the last foot worth the name.
			if (projected && projected.dist <= staleDistance) feet.set(key, { s: projected.s, x: projected.point.x, y: projected.point.y });
			else feet.delete(key);
			return projected;
		},
		forget() { feet.clear(); },
		get size() { return feet.size; },
		/** how often the full scan ran: the first time for every point, and for every foot the memory could not vouch for */
		get scans() { return scans; },
	});
}
