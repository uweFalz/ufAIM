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
 * The same turnout bent onto a curve: the main track an arc of the line's
 * curvature, the branch the arc whose curvature is the turnout's plus the
 * line's - an Innenbogenweiche where both turn the same way, an
 * Außenbogenweiche where they turn against each other (the branch may then
 * come out straighter than the line, or even curve the other way). The
 * crossing angle between the two is the turnout's, as bending keeps it; the
 * branch's arc length is what its own curvature takes to turn by the angle
 * beyond the main, which is the same length for both tracks to first order
 * and is taken as the straight turnout's here, the bending being small.
 *
 * @param {object} spec           from turnout()
 * @param {number} mainCurvature  the line's curvature at the turnout, kernel sign (left positive)
 */
export function bentOnto(spec, mainCurvature) {
	if (!spec || !Number.isFinite(spec.curvature)) error("INVALID_TURNOUT", "bentOnto needs a spec from turnout()");
	if (!Number.isFinite(mainCurvature)) error("INVALID_TURNOUT", "bentOnto needs the line's curvature");
	const branchCurvature = spec.curvature + mainCurvature;
	const sameWay = Math.sign(spec.curvature) === Math.sign(mainCurvature);
	return Object.freeze({
		...spec,
		id: `${spec.id}@${mainCurvature === 0 ? "straight" : (sameWay ? "IBW" : "ABW") + "-R" + Math.round(1 / Math.abs(mainCurvature))}`,
		bent: Object.freeze({ kind: mainCurvature === 0 ? "EW" : sameWay ? "IBW" : "ABW", mainCurvature, branchCurvature }),
		mainCurvature,
		curvature: branchCurvature,
	});
}

/**
 * The turnout as kernel elements, held: the branch an arc of the turnout's
 * curvature from the toe to the crossing angle, the main a straight of the
 * same extent - or, for a bent turnout, an arc of the line's curvature.
 * Ids are `${prefix}.branch` and `${prefix}.main`.
 */
export function turnoutElements(spec, { prefix = spec.id } = {}) {
	if (!spec || !Number.isFinite(spec.branchLength)) error("INVALID_TURNOUT", "turnoutElements needs a spec from turnout()");
	const mainCurvature = spec.mainCurvature ?? 0;
	const main = mainCurvature === 0
		? { id: `${prefix}.main`, type: "straight", length: spec.mainLength, held: true, turnout: spec.designation ?? spec.id }
		: { id: `${prefix}.main`, type: "arc", length: spec.branchLength, curvature: mainCurvature, held: true, turnout: spec.designation ?? spec.id };
	const branch = spec.curvature === 0
		? { id: `${prefix}.branch`, type: "straight", length: spec.branchLength, held: true, turnout: spec.designation ?? spec.id }
		: { id: `${prefix}.branch`, type: "arc", length: spec.branchLength, curvature: spec.curvature, held: true, turnout: spec.designation ?? spec.id };
	return Object.freeze({ branch: Object.freeze(branch), main: Object.freeze(main) });
}
