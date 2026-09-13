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
 * Within a healthy solve a station moves by metres a step; 50 m is far.
 *
 * @param {{samples?: number, refineSteps?: number, staleDistance?: number}} [scan]  the full scan's resolution
 */
export function createFootMemory({ samples = 400, refineSteps = 40, staleDistance = 50 } = {}) {
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
			const projected = local ?? alignment.world2Track(x, y, { samples, refineSteps });
			if (projected) feet.set(key, { s: projected.s, x: projected.point.x, y: projected.point.y });
			return projected;
		},
		forget() { feet.clear(); },
		get size() { return feet.size; },
		/** how often the full scan ran: the first time for every point, and for every foot the memory could not vouch for */
		get scans() { return scans; },
	});
}
