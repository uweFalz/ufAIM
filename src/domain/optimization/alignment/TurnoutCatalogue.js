// src/domain/optimization/alignment/TurnoutCatalogue.js
//
// AXTRAN2 Calculation Kernel - a turnout as held elements.
//
// A standard turnout is designated by its rail profile, its radius and its
// crossing ratio: "EW 60-500-1:12" is a simple turnout on 60 kg/m rail, the
// branch on a radius of 500 m, the crossing at 1:12. The designation is
// definitional; what the kernel needs follows from it by geometry alone:
//
//     angle         alpha = atan(1 / n)              the crossing angle
//     branch arc    R * alpha                        from the toe to the point
//                                                    where the branch runs at
//                                                    the crossing angle
//     main          R * sin(alpha)                   the same point projected
//                                                    onto the main track
//
// Both are held elements: the branch an arc of the turnout's curvature, the
// main a straight, neither with a free quantity. What the calculation does
// with them is the caller's declaration - hold the toe's pose from the main
// track (heldPoses), or the tangent at the branch's end, and fit what lies
// on either side.
//
// The lengths a catalogue prints between Weichenanfang and Weichenende
// include the straight through the crossing and are not derived here; Ril
// 800.0120 was not read for this file. Every spec says so in its source and
// carries the status "candidate", as a design profile does.

export const TURNOUT_CATALOGUE_VERSION = "axtran2/turnout-catalogue/0.1";

export const TURNOUT_SIDES = Object.freeze(["left", "right"]);

/** designations in common use; the numbers are the designation's own */
export const STANDARD_TURNOUTS = Object.freeze([
	"EW 49-190-1:7.5", "EW 49-190-1:9",
	"EW 60-300-1:9", "EW 60-500-1:12", "EW 60-760-1:14", "EW 60-1200-1:18.5", "EW 60-2500-1:26.5",
]);

export class TurnoutCatalogueError extends Error {
	constructor(code, message, detail = null) {
		super(message);
		this.name = "TurnoutCatalogueError";
		this.code = code;
		this.detail = detail;
	}
}

const error = (code, message, detail) => { throw new TurnoutCatalogueError(code, message, detail); };

/** "EW 60-500-1:12" -> { kind, rail, radius, ratio }; a decimal comma is a decimal point */
export function parseTurnoutDesignation(designation) {
	if (typeof designation !== "string") error("INVALID_DESIGNATION", "a turnout designation is a string");
	const text = designation.trim().replace(/,/g, ".");
	const match = /^([A-Za-z]+)\s*(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)\s*-\s*1\s*:\s*(\d+(?:\.\d+)?)$/.exec(text);
	if (!match) error("INVALID_DESIGNATION", `cannot read "${designation}" as <kind> <rail>-<radius>-1:<n>`);
	const [, kind, rail, radius, ratio] = match;
	return Object.freeze({ kind: kind.toUpperCase(), rail: Number(rail), radius: Number(radius), ratio: Number(ratio) });
}

/**
 * @param {object} input
 * @param {string} [input.designation]   e.g. "EW 60-500-1:12"; or radius and ratio
 * @param {number} [input.radius]
 * @param {number} [input.ratio]         n of 1:n
 * @param {"left"|"right"} input.side    which way the branch turns, seen in the direction of travel
 * @param {string} [input.id]
 */
export function turnout({ designation = null, radius = null, ratio = null, side, id = null } = {}) {
	const parsed = designation !== null ? parseTurnoutDesignation(designation) : null;
	const R = parsed?.radius ?? radius;
	const n = parsed?.ratio ?? ratio;
	if (!(Number.isFinite(R) && R > 0)) error("INVALID_TURNOUT", "a turnout needs a positive radius");
	if (!(Number.isFinite(n) && n > 0)) error("INVALID_TURNOUT", "a turnout needs a positive crossing ratio 1:n");
	if (!TURNOUT_SIDES.includes(side)) error("INVALID_TURNOUT", `side must be one of ${TURNOUT_SIDES.join(", ")}`);
	const angle = Math.atan(1 / n);
	// the kernel's heading grows to the left: a left-hand branch has positive curvature
	const curvature = (side === "left" ? 1 : -1) / R;
	return Object.freeze({
		version: TURNOUT_CATALOGUE_VERSION,
		id: id ?? (designation ?? `R${R}-1:${n}`),
		designation: designation ?? null,
		kind: parsed?.kind ?? null,
		rail: parsed?.rail ?? null,
		radius: R,
		ratio: n,
		side,
		angle,
		curvature,
		branchLength: R * angle,
		mainLength: R * Math.sin(angle),
		status: "candidate",
		source: "R and 1:n as designated; the branch arc to the crossing angle and its projection onto the main are geometry. "
			+ "The catalogue's Weichenanfang-Weichenende lengths (Ril 800.0120) were not read.",
	});
}

/**
 * The turnout as kernel elements, held: the branch an arc of the turnout's
 * curvature from the toe to the crossing angle, the main a straight of the
 * same extent. Ids are `${prefix}.branch` and `${prefix}.main`.
 */
export function turnoutElements(spec, { prefix = spec.id } = {}) {
	if (!spec || !Number.isFinite(spec.branchLength)) error("INVALID_TURNOUT", "turnoutElements needs a spec from turnout()");
	return Object.freeze({
		branch: Object.freeze({ id: `${prefix}.branch`, type: "arc", length: spec.branchLength, curvature: spec.curvature, held: true, turnout: spec.designation ?? spec.id }),
		main: Object.freeze({ id: `${prefix}.main`, type: "straight", length: spec.mainLength, held: true, turnout: spec.designation ?? spec.id }),
	});
}
