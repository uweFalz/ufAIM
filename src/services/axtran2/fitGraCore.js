// src/services/axtran2/fitGraCore.js
//
// The gradient adjusted to measured heights, from the files: a GRA, the
// axis its stations run along, and a point list that carries heights.
//
// A measured point is an easting, a northing and a height. Its place on
// the gradient is its foot point on the stationing line - the kilometre
// line where the gradient's stations are kilometres, the track's own axis
// otherwise - counted along that line from where the gradient begins. The
// heights of the grade breaks are then adjusted (gradientProfile.js), and
// the GRA goes back out with the new heights and everything else as it
// was.
//
// The stationing line is read with the reader the axis fit uses and
// realised by the same production geometry; nothing here is fitted on it.

import { traAlignmentFromBytes } from "../../import/parsers/technet/vermEsn/traAlignment.js";
import { decodeBinary } from "../../import/parsers/technet/vermEsn/sharedVermesn.js";
import { buildProductionAlignment } from "../../domain/optimization/alignment/ProductionAlignment.js";
import { createFootMemory } from "../../domain/optimization/alignment/AlignmentPointProjection.js";
import { deps } from "../../domain/optimization/alignment/SolverDependencies.js";
import { parsePointList } from "./pointLists.js";
import { readGra, fitGradient, writeGraHeights, stationAt } from "./gradientProfile.js";

export const FIT_GRA_VERSION = "axtran2/fit-gra/0.1";

export class FitGraError extends Error {
	constructor(code, message, detail = null) {
		super(message);
		this.name = "FitGraError";
		this.code = code;
		this.detail = detail;
	}
}
const error = (code, message, detail) => { throw new FitGraError(code, message, detail); };

/**
 * Where a station lies along a line that carries kilometre jumps: the
 * distance from the line's start, or null where the line never has that
 * station.
 * @param {number} station
 * @param {{ startStation: number, length: number, jumps: Array<{distance, delta}> }} line
 */
export function distanceOfStation(station, line) {
	const jumps = [...line.jumps].sort((a, b) => a.distance - b.distance);
	let offset = 0;
	for (let k = 0; k <= jumps.length; k++) {
		const from = k === 0 ? 0 : jumps[k - 1].distance;
		const to = k === jumps.length ? line.length : jumps[k].distance;
		const distance = station - line.startStation - offset;
		if (distance >= from - 1e-6 && distance <= to + 1e-6) return Math.min(Math.max(distance, 0), line.length);
		if (k < jumps.length) offset += jumps[k].delta;
	}
	return null;
}

/**
 * @param {object} input
 * @param {Uint8Array} input.graBytes        the gradient
 * @param {string} [input.graName]
 * @param {Uint8Array} input.lineBytes       the TRA the gradient's stations run along
 * @param {string} [input.lineName]
 * @param {string|Array} input.points        a point list with heights (.pt, or CSV with a height column), or [{ name, x, y, height }]
 * @param {number} [input.tolerance]         of the heights, metres (0.02)
 * @param {string|Array|Set} [input.hold]    grade breaks to keep at their height, by number: "1, 5-7"
 * @param {boolean} [input.holdEnds]         keep the first and the last grade break (true)
 * @param {number} [input.heightOffset]      what the measured heights lie above the gradient, metres (0)
 * @param {"en"|"ne"} [input.axes]           coordinate order of header-less lists
 * @returns {Promise<{ report: object, gra: Uint8Array, csv: string }>}
 */
export async function fitGraFromBytes({ graBytes, graName = "gradient.GRA", lineBytes, lineName = "line.TRA", points, tolerance = 0.02, hold = null, holdEnds = true, heightOffset = 0, axes = "en" } = {}) {
	if (!(graBytes instanceof Uint8Array)) error("NO_GRA", "fitGraFromBytes needs the GRA's bytes as a Uint8Array");
	if (!(lineBytes instanceof Uint8Array)) error("NO_LINE", "fitGraFromBytes needs the bytes of the TRA the gradient is stationed along");
	const gra = readGra(graBytes);

	const loaded = await traAlignmentFromBytes(lineBytes, lineName);
	if (loaded.unsupported.length) error("UNSUPPORTED_RECORDS", `${lineName}: records this adapter cannot carry: ${loaded.unsupported.map((u) => u.spiType ?? u.why ?? u.type).join(", ")}`);
	const rows = decodeBinary(lineBytes.buffer.slice(lineBytes.byteOffset, lineBytes.byteOffset + lineBytes.byteLength), "TRA").rowsRaw;
	const startStation = Number.isFinite(rows[1]?.station) ? rows[1].station : 0;
	const origin = { x: loaded.startPose.x, y: loaded.startPose.y };
	const alignment = buildProductionAlignment({ elements: loaded.elements, startPose: { x: 0, y: 0, theta: loaded.startPose.theta }, deps });
	const line = { startStation, length: alignment.arcLength, jumps: loaded.kilometreJumps };
	// where the gradient begins on the line, and where it ends
	const first = gra.breaks[0], last = gra.breaks[gra.breaks.length - 1];
	const begins = distanceOfStation(first.station, line);
	if (begins === null || begins + last.u > line.length + 0.5) {
		error("GRADIENT_OFF_LINE", `${graName} runs from station ${first.station.toFixed(3)} over ${last.u.toFixed(3)} m; ${lineName} runs from ${startStation.toFixed(3)} over ${line.length.toFixed(3)} m and does not carry it`,
			{ gradient: { station: first.station, length: last.u }, line: { startStation, length: line.length } });
	}

	const listed = typeof points === "string" ? parsePointList(points, { kind: "points", axes, tolerance: null }) : points;
	if (!Array.isArray(listed) || listed.length === 0) error("NO_POINTS", "the gradient needs measured points");
	const feet = createFootMemory({ samples: 400, refineSteps: 40 });
	const placed = [];
	const excluded = [];
	for (const p of listed) {
		if (!Number.isFinite(p.height)) { excluded.push({ name: p.name, why: "keine Höhe" }); continue; }
		const foot = feet.project(alignment, p.x - origin.x, p.y - origin.y);
		if (foot.clamped && Math.abs(foot.u ?? 0) > 1e-3) { excluded.push({ name: p.name, why: "kein Fußpunkt auf der Stationierungsachse" }); continue; }
		placed.push({ name: p.name, u: foot.s - begins, height: p.height, lateral: foot.q });
	}
	if (placed.length === 0) error("NO_HEIGHTS", `none of the ${listed.length} points carries a height: a .pt listing has them, a CSV needs a column headed H or Höhe`);

	const result = fitGradient({ gra, points: placed, tolerance, hold, holdEnds, heightOffset });
	const lateralOf = new Map(placed.map((p) => [p.name, p.lateral]));
	const report = Object.freeze({
		version: FIT_GRA_VERSION,
		input: Object.freeze({
			gra: graName, breaks: gra.breaks.length, free: result.breaks.filter((b) => b.free).length,
			held: Object.freeze(result.breaks.filter((b) => !b.free).map((b) => Object.freeze({ number: b.number, why: b.why }))),
			points: result.points.length, listed: listed.length,
			excluded: Object.freeze([...excluded, ...result.excluded].map(Object.freeze)),
			tolerance, heightOffset,
			// the line the stations run along, and where on it the gradient begins
			stationing: Object.freeze({ line: lineName, startStation, length: line.length, jumps: line.jumps.length, gradientBeginsAt: begins }),
			kilometreJumps: gra.jumps.length, carriedRecords: gra.trailing,
		}),
		verdict: result.verdict,
		fit: result.fit,
		breaks: result.breaks,
		points: Object.freeze(result.points.map((p) => Object.freeze({ ...p, lateral: lateralOf.get(p.name) ?? null }))),
		checks: result.checks,
	});
	const cell = (value, digits) => (Number.isFinite(value) ? value.toFixed(digits) : "");
	const csv = ["Punkt;Station;Hoehe;vorher;nachher;innerhalb", ...report.points.map((p) => [p.name, cell(p.station, 3), cell(p.height, 4), cell(p.before, 4), cell(p.after, 4), p.within ? "ja" : "nein"].join(";"))].join("\n") + "\n";
	return Object.freeze({ report, gra: writeGraHeights(graBytes, gra, result.heights), csv });
}

export { stationAt };
