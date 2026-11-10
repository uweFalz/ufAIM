// src/services/axtran2/gradientProfile.js
//
// The gradient of a track: its grade breaks, the profile they make, and the
// adjustment of their heights to measured heights.
//
// A Verm.esn GRA is 36-byte records: station, height, radius and tangent
// length as doubles, a point number. The first record is the head: its
// station is the number of grade breaks that follow; records behind those
// are cant ramp constructions and are carried, not read. A record with
// R = 0 and T = 1000 is a kilometre jump: the same point follows with the
// station after the jump (all 38 jumps of the corpus read that way, every
// one with the height repeated). The profile therefore runs over a
// distance of its own, `u`, counted from the first grade break with the
// jumps taken out; a station is only a name for a place on it.
//
// Between two grade breaks the profile is a straight; at a break with a
// rounding it is a parabola over the tangent length T on either side,
// T = |R| |dn| / 2 with dn the change of grade. The file carries both R
// and T; which of them the designer chose shows in which is a round number
// (R -16000 with T 22.084, or T 10.000 with R 14453.5), and that one is
// held when the heights move.
//
// The adjustment moves heights only: stations, and the held R or T, stay.
// With the tangent lengths fixed the profile is linear in the heights, so
// each step is a linear least squares; where R is held the tangent lengths
// follow the new grades and the step is repeated until they stand. A height
// no measurement reaches stays at the plan: every free height carries a
// weak prior to its plan value (sigma 1 m against tolerances of
// centimetres), and the report says which heights the points determine.
//
// Pure. No kernel: this is a least squares of its own, beside the axis fit.

import { decodeBinary } from "../../import/parsers/technet/vermEsn/sharedVermesn.js";

export const GRADIENT_PROFILE_VERSION = "axtran2/gradient-profile/0.1";

export const GRA_RECORD_BYTES = 36;
/** T of a record that marks a kilometre jump (R = 0): the same point follows with the station after it */
export const GRA_JUMP_MARKER = 1000;
/** the prior that keeps an unmeasured height at the plan, metres */
export const HEIGHT_PRIOR_SIGMA = 1;

export class GradientProfileError extends Error {
	constructor(code, message, detail = null) {
		super(message);
		this.name = "GradientProfileError";
		this.code = code;
		this.detail = detail;
	}
}
const error = (code, message, detail) => { throw new GradientProfileError(code, message, detail); };

const toBuffer = (bytes) => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
const isRound = (value) => Math.abs(value - Math.round(value)) <= 1e-6;

/**
 * The grade breaks of a GRA, in the file's order, on the profile's own
 * distance.
 * @param {Uint8Array} bytes
 * @returns {{ breaks: Array<{number, cycles, station, u, height, radius, tangentLength, holds}>,
 *            jumps: Array<{u, stationBefore, stationAfter, delta}>, records: number, trailing: number }}
 *   number: 1-based, as a listing counts them (a jump's two records are one break);
 *   cycles: the file's records that carry this break (two at a jump);
 *   holds: "radius" or "tangent" for a rounded break - the one the file writes as a round number - else null
 */
export function readGra(bytes) {
	if (!(bytes instanceof Uint8Array) || bytes.length < 2 * GRA_RECORD_BYTES) error("NO_GRA", "a GRA needs at least its head and one record");
	const rows = decodeBinary(toBuffer(bytes), "GRA").rowsRaw;
	const count = Math.round(rows[0].station);
	if (!(count >= 2 && count <= rows.length - 1)) error("NO_GRA", `the head announces ${rows[0].station} grade breaks, the file has ${rows.length - 1} records behind it`);
	const breaks = [];
	const jumps = [];
	let offset = 0;        // stations after the jumps so far are this much behind the running distance
	const origin = rows[1].station;
	for (let k = 1; k <= count; k++) {
		const row = rows[k];
		if (![row.station, row.height, row.radius, row.tangentL].every(Number.isFinite)) error("NO_GRA", `record ${k} is not a grade break: ${row.station}, ${row.height}`);
		const marker = row.radius === 0 && row.tangentL === GRA_JUMP_MARKER;
		if (marker) {
			const next = rows[k + 1];
			if (k === count || Math.abs(next.height - row.height) > 1e-6) error("NO_GRA", `record ${k} marks a kilometre jump, and the record behind it is not the same point`);
			const u = row.station - origin + offset;
			jumps.push(Object.freeze({ u, stationBefore: row.station, stationAfter: next.station, delta: next.station - row.station }));
			offset += row.station - next.station;
			breaks.push({ cycles: [k, k + 1], station: row.station, u, height: row.height, radius: next.radius, tangentLength: next.tangentL === GRA_JUMP_MARKER ? 0 : next.tangentL });
			k += 1;
			continue;
		}
		breaks.push({ cycles: [k], station: row.station, u: row.station - origin + offset, height: row.height, radius: row.radius, tangentLength: row.tangentL });
	}
	for (let i = 1; i < breaks.length; i++) {
		if (!(breaks[i].u > breaks[i - 1].u)) error("NO_GRA", `the grade breaks do not run forward: ${breaks[i - 1].station.toFixed(3)} then ${breaks[i].station.toFixed(3)} without a kilometre jump between them`);
	}
	return Object.freeze({
		breaks: Object.freeze(breaks.map((b, i) => Object.freeze({
			number: i + 1, cycles: Object.freeze(b.cycles), station: b.station, u: b.u, height: b.height, radius: b.radius, tangentLength: b.tangentLength,
			// what the designer chose: the round one; R where both or neither are
			holds: !(Math.abs(b.radius) > 0) || i === 0 || i === breaks.length - 1 ? null : isRound(b.tangentLength) && !isRound(b.radius) ? "tangent" : "radius",
		}))),
		jumps: Object.freeze(jumps), records: rows.length - 1, trailing: rows.length - 1 - count,
	});
}

/** the station a place of the profile is called, with the jumps before it applied */
export function stationAt(gra, u) {
	const origin = gra.breaks[0].station;
	return origin + u + gra.jumps.filter((j) => j.u <= u + 1e-9).reduce((sum, j) => sum + j.delta, 0);
}

/**
 * The grades and tangent lengths a set of heights makes.
 * @param {Array<{u, radius, tangentLength, holds}>} breaks
 * @param {number[]} heights
 * @returns {{ grades: number[], tangents: number[], radii: number[] }} grades[i] between break i and i+1;
 *          tangents and radii per break as they stand with these heights (the held one kept, the other following)
 */
export function shapeOf(breaks, heights) {
	const grades = breaks.slice(1).map((b, i) => (heights[i + 1] - heights[i]) / (b.u - breaks[i].u));
	const tangents = breaks.map(() => 0);
	const radii = breaks.map(() => 0);
	for (let i = 1; i < breaks.length - 1; i++) {
		const b = breaks[i];
		if (b.holds === null) continue;
		const change = grades[i] - grades[i - 1];
		if (b.holds === "tangent") { tangents[i] = b.tangentLength; radii[i] = Math.abs(change) > 1e-15 ? (2 * b.tangentLength) / change : 0; }
		else { tangents[i] = (Math.abs(b.radius) * Math.abs(change)) / 2; radii[i] = Math.abs(b.radius) * (Math.sign(change) || Math.sign(b.radius) || 1); }
	}
	return { grades, tangents, radii };
}

/**
 * How the height at a place depends on the breaks' heights, the tangent
 * lengths taken as they are: weights w with z(u) = sum w[j] z[j].
 * @returns {number[]|null} null outside the profile
 */
export function heightWeights(breaks, tangents, u) {
	const n = breaks.length;
	if (!(u >= breaks[0].u - 1e-9 && u <= breaks[n - 1].u + 1e-9)) return null;
	let i = 0;
	while (i < n - 2 && u > breaks[i + 1].u) i++;
	const w = new Array(n).fill(0);
	const span = breaks[i + 1].u - breaks[i].u;
	const t = (u - breaks[i].u) / span;
	w[i] += 1 - t; w[i + 1] += t;
	// a rounding adds, on its tangent length either side of the break, a parabola times the change of grade there;
	// the change of grade at break k is itself linear in the heights of k-1, k and k+1
	const round = (k, factor) => {
		const before = breaks[k].u - breaks[k - 1].u, after = breaks[k + 1].u - breaks[k].u;
		w[k - 1] += factor / before; w[k] -= factor * (1 / before + 1 / after); w[k + 1] += factor / after;
	};
	const d = u - breaks[i].u;
	if (i > 0 && tangents[i] > 0 && d < tangents[i]) round(i, (tangents[i] - d) ** 2 / (4 * tangents[i]));
	const e = u - breaks[i + 1].u;
	if (i + 1 < n - 1 && tangents[i + 1] > 0 && e > -tangents[i + 1]) round(i + 1, (e + tangents[i + 1]) ** 2 / (4 * tangents[i + 1]));
	return w;
}

/** the height of the profile at a place, null outside it */
export function heightAt(breaks, heights, u) {
	const w = heightWeights(breaks, shapeOf(breaks, heights).tangents, u);
	return w === null ? null : w.reduce((sum, value, j) => sum + value * heights[j], 0);
}

/** A x = b for a symmetric positive definite A, by Cholesky; null where it is not */
function solveSpd(A, b) {
	const n = b.length;
	const L = A.map((row) => row.slice());
	for (let j = 0; j < n; j++) {
		for (let k = 0; k < j; k++) for (let i = j; i < n; i++) L[i][j] -= L[i][k] * L[j][k];
		if (!(L[j][j] > 0)) return null;
		const root = Math.sqrt(L[j][j]);
		for (let i = j; i < n; i++) L[i][j] /= root;
	}
	const y = new Array(n).fill(0);
	for (let i = 0; i < n; i++) { let sum = b[i]; for (let k = 0; k < i; k++) sum -= L[i][k] * y[k]; y[i] = sum / L[i][i]; }
	const x = new Array(n).fill(0);
	for (let i = n - 1; i >= 0; i--) { let sum = y[i]; for (let k = i + 1; k < n; k++) sum -= L[k][i] * x[k]; x[i] = sum / L[i][i]; }
	return x;
}

/** numbers and ranges of grade breaks to hold: "1, 5-7", a list, or a Set */
export function parseBreakHold(hold) {
	if (hold instanceof Set) return hold;
	const out = new Set();
	const items = Array.isArray(hold) ? hold.map(String) : String(hold ?? "").split(/[\s,;]+/);
	for (const item of items.map((t) => t.trim()).filter(Boolean)) {
		const m = /^(\d+)(?:\s*[-–]\s*(\d+))?$/.exec(item);
		if (!m) error("INVALID_HOLD", `cannot read "${item}" as a grade break's number or a range of them`);
		const from = Number(m[1]), to = Number(m[2] ?? m[1]);
		if (!(from >= 1 && to >= from)) error("INVALID_HOLD", `"${item}" is not a range of grade breaks`);
		for (let k = from; k <= to; k++) out.add(k);
	}
	return out;
}

/**
 * The heights of the grade breaks adjusted to measured heights.
 *
 * @param {object} input
 * @param {object} input.gra                  from readGra
 * @param {Array<{name, u, height, tolerance?}>} input.points  measured heights at their place on the profile
 * @param {number} [input.tolerance]          metres, where a point carries none (default 0.02)
 * @param {Set|Array|string} [input.hold]     grade breaks to keep at their height, by number
 * @param {boolean} [input.holdEnds]          keep the first and the last (default true: the profile joins what lies beyond)
 * @param {number} [input.heightOffset]       what the measured heights lie above the profile, metres (default 0)
 * @param {number} [input.maxIterations]
 * @returns {object} { verdict, fit, breaks, points, excluded, checks, heights }
 */
export function fitGradient({ gra, points, tolerance = 0.02, hold = null, holdEnds = true, heightOffset = 0, maxIterations = 30 }) {
	const breaks = gra.breaks;
	const n = breaks.length;
	if (!(tolerance > 0)) error("INVALID_TOLERANCE", "the tolerance of the heights has to be positive");
	const held = parseBreakHold(hold);
	for (const k of held) if (k > n) error("INVALID_HOLD", `grade break ${k} does not exist: the gradient has ${n}`);
	if (holdEnds) { held.add(1); held.add(n); }
	const freeIndex = breaks.map((b, i) => (held.has(b.number) ? -1 : i)).filter((i) => i >= 0);
	if (freeIndex.length === 0) error("NOTHING_FREE", "every grade break is held: nothing is left to adjust");
	const column = new Map(freeIndex.map((i, c) => [i, c]));

	const usable = [];
	const excluded = [];
	for (const p of points) {
		if (!Number.isFinite(p.height)) { excluded.push({ name: p.name, why: "keine Höhe" }); continue; }
		if (!Number.isFinite(p.u) || p.u < breaks[0].u - 1e-9 || p.u > breaks[n - 1].u + 1e-9) { excluded.push({ name: p.name, why: "außerhalb der Gradiente" }); continue; }
		usable.push({ name: p.name, u: p.u, height: p.height - heightOffset, tolerance: p.tolerance > 0 ? p.tolerance : tolerance });
	}
	if (usable.length === 0) error("NO_POINTS", "no measured height lies on the gradient");

	const plan = breaks.map((b) => b.height);
	let heights = plan.slice();
	const residualsOf = (z) => { const { tangents } = shapeOf(breaks, z); return usable.map((p) => p.height - heightWeights(breaks, tangents, p.u).reduce((sum, w, j) => sum + w * z[j], 0)); };
	const before = residualsOf(plan);
	const priorWeight = 1 / (HEIGHT_PRIOR_SIGMA * HEIGHT_PRIOR_SIGMA);
	let iterations = 0;
	let status = "max_iterations";
	let information = new Array(freeIndex.length).fill(0);
	for (; iterations < maxIterations; iterations++) {
		const { tangents } = shapeOf(breaks, heights);
		const m = freeIndex.length;
		const N = Array.from({ length: m }, () => new Array(m).fill(0));
		const rhs = new Array(m).fill(0);
		information = new Array(m).fill(0);
		for (const p of usable) {
			const w = heightWeights(breaks, tangents, p.u);
			const weight = 1 / (p.tolerance * p.tolerance);
			// what the held heights contribute is known; the free ones are solved for
			let known = 0;
			const row = [];
			for (let j = 0; j < n; j++) { if (w[j] === 0) continue; const c = column.get(j); if (c === undefined) known += w[j] * heights[j]; else row.push([c, w[j]]); }
			const value = p.height - known;
			for (const [a, wa] of row) { rhs[a] += weight * wa * value; information[a] += weight * wa * wa; for (const [b, wb] of row) N[a][b] += weight * wa * wb; }
		}
		freeIndex.forEach((i, c) => { N[c][c] += priorWeight; rhs[c] += priorWeight * plan[i]; });
		const solved = solveSpd(N, rhs);
		if (!solved) error("SINGULAR", "the heights cannot be solved for: the normal equations are not positive definite");
		const next = heights.slice();
		freeIndex.forEach((i, c) => { next[i] = solved[c]; });
		const moved = Math.max(...next.map((z, j) => Math.abs(z - heights[j])));
		heights = next;
		// with every rounding's tangent length held the step is exact; where a radius is held it is repeated until the lengths stand
		if (moved < 1e-9) { iterations += 1; status = "converged"; break; }
	}
	const after = residualsOf(heights);
	const rms = (r) => Math.sqrt(r.reduce((sum, v) => sum + v * v, 0) / r.length);
	const shape = shapeOf(breaks, heights);
	const planShape = shapeOf(breaks, plan);
	const seen = breaks.map((b, i) => usable.filter((p) => p.u >= (breaks[i - 1]?.u ?? b.u) && p.u <= (breaks[i + 1]?.u ?? b.u)).length);
	const overlaps = [];
	for (let i = 0; i < n - 1; i++) if (shape.tangents[i] + shape.tangents[i + 1] > breaks[i + 1].u - breaks[i].u + 1e-9) overlaps.push(Object.freeze({ between: [breaks[i].number, breaks[i + 1].number], by: shape.tangents[i] + shape.tangents[i + 1] - (breaks[i + 1].u - breaks[i].u) }));
	return Object.freeze({
		version: GRADIENT_PROFILE_VERSION,
		verdict: Object.freeze({ status, ok: status === "converged", iterations }),
		fit: Object.freeze({
			rmsBefore: rms(before), rmsAfter: rms(after), maxBefore: Math.max(...before.map(Math.abs)), maxAfter: Math.max(...after.map(Math.abs)),
			outsideBefore: before.filter((r, k) => Math.abs(r) > usable[k].tolerance).length, outsideAfter: after.filter((r, k) => Math.abs(r) > usable[k].tolerance).length,
		}),
		breaks: Object.freeze(breaks.map((b, i) => {
			const c = column.get(i);
			return Object.freeze({
				number: b.number, station: b.station, u: b.u, heightBefore: plan[i], heightAfter: heights[i], change: heights[i] - plan[i],
				free: c !== undefined, why: c !== undefined ? null : holdEnds && (i === 0 || i === n - 1) ? "Anschluss" : "gehalten",
				holds: b.holds, radiusBefore: b.radius, radiusAfter: b.holds === null ? 0 : shape.radii[i], tangentBefore: b.holds === null ? 0 : planShape.tangents[i], tangentAfter: shape.tangents[i],
				gradeBefore: i < n - 1 ? planShape.grades[i] : null, gradeAfter: i < n - 1 ? shape.grades[i] : null,
				points: seen[i],
				// the points weigh more than a hundred times the prior: the height is the measurement's, not the plan's
				determined: c === undefined ? null : information[c] > 100 * priorWeight,
			});
		})),
		points: Object.freeze(usable.map((p, k) => Object.freeze({ name: p.name, u: p.u, station: stationAt(gra, p.u), height: p.height, tolerance: p.tolerance, before: before[k], after: after[k], within: Math.abs(after[k]) <= p.tolerance }))),
		excluded: Object.freeze(excluded.map(Object.freeze)),
		checks: Object.freeze({ steepestPermille: Math.max(...shape.grades.map((g) => Math.abs(g) * 1000)), overlaps: Object.freeze(overlaps) }),
		heights: Object.freeze(heights),
	});
}

/**
 * The GRA with other heights: the file's bytes, the heights of the grade
 * breaks replaced and, at a rounded break, the quantity that follows the
 * grades (T where R is held, R where T is) written as it now stands.
 * Everything else is the file's - the head, the jumps, the ramp
 * constructions behind the grade breaks.
 * @param {Uint8Array} bytes
 * @param {object} gra            from readGra(bytes)
 * @param {ArrayLike<number>} heights  one per grade break
 * @returns {Uint8Array}
 */
export function writeGraHeights(bytes, gra, heights) {
	if (heights.length !== gra.breaks.length) error("INVALID_HEIGHTS", `${gra.breaks.length} grade breaks, ${heights.length} heights`);
	const out = bytes.slice();
	const view = new DataView(out.buffer, out.byteOffset, out.byteLength);
	const shape = shapeOf(gra.breaks, Array.from(heights));
	const moved = (i) => i >= 0 && i < gra.breaks.length && Math.abs(heights[i] - gra.breaks[i].height) > 1e-9;
	gra.breaks.forEach((b, i) => {
		if (!Number.isFinite(heights[i])) error("INVALID_HEIGHTS", `grade break ${b.number} has no height`);
		for (const cycle of b.cycles) view.setFloat64(cycle * GRA_RECORD_BYTES + 8, heights[i], true);
		// a rounding whose grades did not change keeps the numbers the file has: its T comes from the
		// designer's unrounded heights and is not this module's to recompute
		if (b.holds === null || !(moved(i - 1) || moved(i) || moved(i + 1))) return;
		// the rounding stands on the record behind a jump's marker
		const cycle = b.cycles[b.cycles.length - 1];
		if (b.holds === "radius") view.setFloat64(cycle * GRA_RECORD_BYTES + 24, shape.tangents[i], true);
		else view.setFloat64(cycle * GRA_RECORD_BYTES + 16, shape.radii[i], true);
	});
	return out;
}
