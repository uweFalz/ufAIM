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
// The lengths a catalogue prints between Weichenanfang and Weichenende are
// read from Ril 800.0120A01 (Regelbauarten, table below) since 2026-10-18:
// a designation the annex lists carries its row and the status
// "catalogue", any other stays a "candidate" built from R and 1:n alone,
// and says so in its source.

export const TURNOUT_CATALOGUE_VERSION = "axtran2/turnout-catalogue/0.2";

export const TURNOUT_SIDES = Object.freeze(["left", "right"]);

/** designations in common use; the numbers are the designation's own */
export const STANDARD_TURNOUTS = Object.freeze([
	"EW 49-190-1:7.5", "EW 49-190-1:9",
	"EW 60-300-1:9", "EW 60-500-1:12", "EW 60-760-1:14", "EW 60-1200-1:18.5", "EW 60-2500-1:26.5",
]);

/** crossing turnouts in common use: one curved diagonal (EKW) or both (DKW) */
export const STANDARD_CROSSINGS = Object.freeze([
	"EKW 49-190-1:9", "DKW 49-190-1:9", "EKW 60-190-1:9", "DKW 60-190-1:9", "DKW 60-500-1:12",
]);
export const CROSSING_KINDS = Object.freeze(["EKW", "DKW"]);
export const CROSSING_ROUTES = Object.freeze(["straight", "curved"]);

export class TurnoutCatalogueError extends Error {
	constructor(code, message, detail = null) {
		super(message);
		this.name = "TurnoutCatalogueError";
		this.code = code;
		this.detail = detail;
	}
}

const error = (code, message, detail) => { throw new TurnoutCatalogueError(code, message, detail); };


/**
 * The Regelbauarten of Ril 800.0120A01 "Zusammenstellung der Weichen und
 * Kreuzungen" V3.0 (gültig ab 15.02.2018), read on 2026-10-18 from the
 * knowledge folder. Lengths in metres, speeds in km/h, as the annex prints
 * them; the figures define the names:
 *
 *     lt    Tangentenlänge, Weichenanfang to the tangent intersection (the
 *           branch's tangent point to the crossing centre in an EKW/DKW)
 *     b     tangent intersection to Weichenende along the main
 *     d     end of the branch arc to the Weichenende along the branch
 *     lw    Weichenlänge, Weichenanfang to Weichenende (lKr, lKW for crossings)
 *     c     the branch's offset from the main at the Weichenende
 *     s     the last through sleeper to the Weichenende (construction, not
 *           geometry; per rail profile where the annex differs)
 *     v     zul. v, branch / main (main per rail profile where it differs)
 *
 * Measured against the geometry below: lt = R·tan(α/2) to 1e-4 m on every
 * row with one radius, c = R·(1 − cos α) to 3 mm. Rows with two radii
 * (6000/3700, 7000/6000) are compound branches this catalogue cannot hold
 * as one arc; they are listed and refused.
 */
export const RIL_800_0120_A01 = Object.freeze({
	source: "Ril 800.0120A01 V3.0, Zusammenstellung der Weichen und Kreuzungen, Regelbauarten, gültig ab 15.02.2018",
	rows: Object.freeze([
		// (2) Einfache Weichen mit geradem Herzstück, Bild 1, Seite 4
		{ kind: "EW", rails: [49, 54], radius: 190, ratio: 9, form: "gerades Herzstück", lt: 10.5232, b: 16.6149, d: 6.0917, lw: 27.1381, c: 1.8376, s: 3.90, vBranch: 40, vMain: { 49: 120, 54: 160 }, page: 4 },
		// (3) Einfache Weichen mit Bogenherzstück, Bild 2, Seite 5
		{ kind: "EW", rails: [49, 54, 60], radius: 300, ratio: 9, form: "Bogenherzstück", lt: 16.6155, lw: 33.2310, c: 1.8377, s: 3.90, vBranch: 50, vMain: { 49: 120, 54: 160, 60: 230 }, page: 5 },
		{ kind: "EW", rails: [49, 54, 60], radius: 500, ratio: 12, form: "Bogenherzstück", lt: 20.7973, lw: 41.5946, c: 1.7286, s: { 49: 6.30, 54: 6.30, 60: 6.31 }, vBranch: 60, vMain: { 49: 120, 54: 160, 60: 230 }, page: 5 },
		{ kind: "EW", rails: [54, 60], radius: 760, ratio: 14, form: "Bogenherzstück", lt: 27.1083, lw: 54.2166, c: 1.9326, s: 5.10, vBranch: 80, vMain: { 54: 160, 60: 230 }, page: 5 },
		{ kind: "EW", rails: [60], radius: 760, ratio: 14, form: "Bogenherzstück, fb", suffix: "fb", lt: 27.1083, lw: 54.2166, c: 1.9326, s: 5.10, vBranch: 80, vMain: 230, vMainOver: true, page: 5 },
		{ kind: "EW", rails: [54, 60], radius: 1200, ratio: 18.5, form: "Bogenherzstück", lt: 32.4088, lw: 64.8176, c: 1.7499, s: 9.90, vBranch: 100, vMain: { 54: 160, 60: 230 }, page: 5 },
		{ kind: "EW", rails: [60], radius: 2500, ratio: 26.5, form: "Bogenherzstück, fb", suffix: "fb", lt: 47.1530, lw: 94.3060, c: 1.7784, s: 13.50, vBranch: 130, vMain: 230, vMainOver: true, page: 5 },
		{ kind: "EW", rails: [60], radius: 6000, radiusEnd: 3700, ratio: 32.5, form: "Bogenherzstück, fb, compound", suffix: "fb", lt: 64.5688, lt2: 57.6841, lw: 122.2529, c: 1.7743, s: 16.50, vBranch: 160, vMain: 230, vMainOver: true, page: 5 },
		{ kind: "EW", rails: [60], radius: 7000, radiusEnd: 6000, ratio: 42, form: "Bogenherzstück, fb, compound", suffix: "fb", lt: 80.1040, lt2: 74.1620, lw: 154.2660, c: 1.7653, s: 19.50, vBranch: 200, vMain: 230, vMainOver: true, page: 5 },
		// (4) Einfache Weichen mit Bogenherzstück und gerader Verlängerung des Zweiggleises, Bild 3, Seite 6
		{ kind: "EW", rails: [49, 54], radius: 190, ratio: 7.5, form: "Bogenherzstück, gerade Verlängerung", lt: 12.6108, b: 13.2509, d: 0.6400, lw: 25.8617, c: 1.7552, s: 3.30, vBranch: 40, vMain: 80, page: 6 },
		{ kind: "EW", rails: [60], radius: 500, ratio: 12, form: "Bogenherzstück, gerade Verlängerung, fb", suffix: "fb", lt: 20.7973, b: 24.5637, d: 3.7664, lw: 45.3610, c: 2.0417, s: 2.70, vBranch: 60, vMain: 230, vMainOver: true, page: 6 },
		{ kind: "EW", rails: [54, 60], radius: 760, ratio: 15, form: "Bogenherzstück, gerade Verlängerung", lt: 25.3052, b: 28.9114, d: 3.6062, lw: 54.2166, c: 1.9242, s: 5.10, vBranch: 80, vMain: { 54: 160, 60: 230 }, page: 6 },
		{ kind: "EW", rails: [60], radius: 760, ratio: 15, form: "Bogenherzstück, gerade Verlängerung, fb", suffix: "fb", lt: 25.3052, b: 28.9114, d: 3.6062, lw: 54.2166, c: 1.9242, s: 5.10, vBranch: 80, vMain: 230, vMainOver: true, page: 6 },
		{ kind: "EW", rails: [60], radius: 1200, ratio: 18.5, form: "Bogenherzstück, gerade Verlängerung, fb", suffix: "fb", lt: 32.4088, b: 34.2065, d: 1.7977, lw: 66.6153, c: 1.8470, s: 8.10, vBranch: 100, vMain: 230, vMainOver: true, page: 6 },
		// (5) Symmetrische Außenbogenweiche, Bild 4, Seite 6
		{ kind: "SymABW", rails: [49, 54], radius: 215, ratio: 4.8, form: "symmetrisch", lt: 11.0497, lw: 22.0412, c: 2.2656, s: -0.24, vBranch: 40, vMain: 40, page: 6 },
		// 2 (2) Kreuzungen mit starren Doppelten Herzstücken, Bild 5, Seite 7
		{ kind: "Kr", rails: [54], radius: null, ratio: 9, form: "starres Doppelherzstück", lt: 16.6150, lw: 33.2300, c: 1.8376, s: 3.90, vBranch: null, vMain: 100, page: 7 },
		{ kind: "Kr", rails: [54], radius: null, ratio: 7.5, form: "starres Doppelherzstück", lt: 13.2510, lw: 26.5020, c: 1.7552, s: 3.30, vBranch: null, vMain: 80, page: 7 },
		// 3 (2) Kreuzungsweichen der Grundform 190-1:9 mit innenliegenden Zungenvorrichtungen, Bild 6/7, Seite 9/10
		{ kind: "EKW", rails: [49, 54], radius: 190, ratio: 9, form: "innenliegende Zungen", lt: 10.5232, b: 16.6150, d: 6.0918, lw: 33.2300, c: 1.8376, s: 3.90, vBranch: 40, vMain: 100, page: 9 },
		{ kind: "DKW", rails: [49, 54], radius: 190, ratio: 9, form: "innenliegende Zungen", lt: 10.5232, b: 16.6150, d: 6.0918, lw: 33.2300, c: 1.8376, s: { 49: 4.04, 54: 3.90 }, vBranch: 40, vMain: 100, page: 10 },
		// 3 (3) Kreuzungsweichen der Grundform 500-1:9 mit außenliegenden Zungenvorrichtungen, Bild 8/9, Seite 10/11
		{ kind: "EKW", rails: [49, 54], radius: 500, ratio: 9, form: "außenliegende Zungen", lt: 27.6926, b: 16.6150, lw: 44.3076, c: 3.0581, s: { 49: 3.19, 54: 3.40 }, vBranch: 60, vMain: 100, page: 10 },
		{ kind: "DKW", rails: [49, 54], radius: 500, ratio: 9, form: "außenliegende Zungen", lt: 27.6926, lw: 55.3852, c: 3.0628, s: 2.65, vBranch: 60, vMain: 100, page: 11 },
	].map((row) => Object.freeze(row))),
});

const perRail = (value, rail) => (value && typeof value === "object" ? (value[rail] ?? null) : value ?? null);

/**
 * The annex row for a designation, with the per-rail values resolved:
 * null where the annex lists no such Regelbauart (a candidate, then).
 * The "fb" suffix (federnd bewegliche Herzstückspitze) selects its own row.
 */
export function catalogueRow({ kind, rail = null, radius = null, ratio, suffix = null }) {
	const wanted = String(kind ?? "").toUpperCase();
	const row = RIL_800_0120_A01.rows.find((r) => r.kind.toUpperCase() === wanted
		&& (r.radius === null ? radius === null : Number(r.radius) === Number(radius))
		&& Number(r.ratio) === Number(ratio)
		&& (rail === null || r.rails.includes(Number(rail)))
		&& ((r.suffix ?? null) === (suffix ?? null)));
	if (!row) return null;
	const railUsed = rail ?? row.rails[0];
	return Object.freeze({
		...row,
		rail: railUsed,
		s: perRail(row.s, railUsed),
		vMain: perRail(row.vMain, railUsed),
		compound: Number.isFinite(row.radiusEnd),
		source: `${RIL_800_0120_A01.source}, Seite ${row.page}`,
	});
}

/** "EW 60-500-1:12" -> { kind, rail, radius, ratio }; a decimal comma is a decimal point */
export function parseTurnoutDesignation(designation) {
	if (typeof designation !== "string") error("INVALID_DESIGNATION", "a turnout designation is a string");
	const text = designation.trim().replace(/,/g, ".");
	const match = /^([A-Za-z]+)\s*(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)\s*-\s*1\s*:\s*(\d+(?:\.\d+)?)(?:\s*-\s*(fb))?$/i.exec(text);
	if (!match) error("INVALID_DESIGNATION", `cannot read "${designation}" as <kind> <rail>-<radius>-1:<n>[-fb]`);
	const [, kind, rail, radius, ratio, suffix] = match;
	return Object.freeze({ kind: kind.toUpperCase(), rail: Number(rail), radius: Number(radius), ratio: Number(ratio), suffix: suffix ? suffix.toLowerCase() : null });
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
	const row = catalogueRow({ kind: parsed?.kind ?? "EW", rail: parsed?.rail ?? null, radius: R, ratio: n, suffix: parsed?.suffix ?? null });
	if (row?.compound) error("COMPOUND_BRANCH", `${designation}: a branch of two radii (${row.radius}/${row.radiusEnd}) is not one arc; the catalogue lists it and cannot hold it`);
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
		// the main is the catalogue's Weichenlänge where the annex has the
		// Regelbauart; the branch end's projection onto the main otherwise
		mainLength: row ? row.lw : R * Math.sin(angle),
		catalogue: row,
		status: row ? "catalogue" : "candidate",
		source: row
			? `${row.source}: lt ${row.lt} m, lw ${row.lw} m, c ${row.c} m, zul. v ${row.vBranch}/${row.vMain}${row.vMainOver ? "+" : ""} km/h (${row.form}); the branch arc to the crossing angle is geometry`
			: "R and 1:n as designated; the branch arc to the crossing angle and its projection onto the main are geometry. No Regelbauart of this designation in Ril 800.0120A01.",
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

/**
 * A crossing turnout - Kreuzungsweiche - as the route a train takes through
 * it. Two straight tracks cross at the crossing angle alpha = atan(1/n); the
 * connecting curves of radius R lie inside the crossing, tangent to both
 * tracks, and so turn through alpha themselves. The geometry is symmetric
 * about the crossing centre, which fixes everything from R and n:
 *
 *     centre       R * tan(alpha / 2)   from the curve's tangent point on the
 *                                       entering track to the centre
 *     straight     2 R * tan(alpha / 2) the entering track between the two
 *                                       tangent points, the crossing centre
 *                                       in its middle
 *     curved       R * alpha            the connecting arc, from the tangent
 *                                       point on the entering track to the
 *                                       one on the crossing track
 *
 * From one entry there are two routes: straight along the entering track, or
 * curved onto the crossing track. The side says which way the crossing
 * track lies, seen in the direction of travel, and that is the way the
 * curve turns. An EKW has a curve on one diagonal only, a DKW on both; which
 * diagonal that is in an EKW is the declarer's knowledge of the layout, not
 * the designation's, and the route from one entry reads the same for both.
 *
 * As with turnout(), the catalogue's lengths between the Weichenanfänge
 * (Ril 800.0120) are not derived here; the status is "candidate".
 *
 * @param {object} input
 * @param {string} [input.designation]   e.g. "DKW 60-190-1:9"; or kind, radius and ratio
 * @param {"EKW"|"DKW"} [input.kind]
 * @param {number} [input.radius]
 * @param {number} [input.ratio]
 * @param {"left"|"right"} input.side    which way the crossing track lies, in the direction of travel
 * @param {string} [input.id]
 */
export function crossing({ designation = null, kind = null, radius = null, ratio = null, side, id = null } = {}) {
	const parsed = designation !== null ? parseTurnoutDesignation(designation) : null;
	const K = parsed?.kind ?? kind;
	const R = parsed?.radius ?? radius;
	const n = parsed?.ratio ?? ratio;
	if (!CROSSING_KINDS.includes(K)) error("INVALID_CROSSING", `a crossing turnout is one of ${CROSSING_KINDS.join(", ")}, not "${K}"`);
	if (!(Number.isFinite(R) && R > 0)) error("INVALID_CROSSING", "a crossing turnout needs a positive radius");
	if (!(Number.isFinite(n) && n > 0)) error("INVALID_CROSSING", "a crossing turnout needs a positive crossing ratio 1:n");
	if (!TURNOUT_SIDES.includes(side)) error("INVALID_CROSSING", `side must be one of ${TURNOUT_SIDES.join(", ")}`);
	const angle = Math.atan(1 / n);
	const centreOffset = R * Math.tan(angle / 2);
	const row = catalogueRow({ kind: K, rail: parsed?.rail ?? null, radius: R, ratio: n });
	return Object.freeze({
		version: TURNOUT_CATALOGUE_VERSION,
		id: id ?? (designation ?? `${K}-R${R}-1:${n}`),
		designation: designation ?? null,
		kind: K,
		rail: parsed?.rail ?? null,
		radius: R,
		ratio: n,
		side,
		angle,
		curvature: (side === "left" ? 1 : -1) / R,
		centreOffset,
		straightLength: 2 * centreOffset,
		curvedLength: R * angle,
		catalogue: row,
		status: row ? "catalogue" : "candidate",
		source: row
			? `${row.source}: lt ${row.lt} m${row.b ? `, b ${row.b} m` : ""}, lKW ${row.lw} m, c ${row.c} m, zul. v ${row.vBranch}/${row.vMain} km/h (${row.form}); centre, straight and arc are geometry`
			: "R and 1:n as designated; the crossing centre, the straight between the tangent points and the "
				+ "connecting arc are geometry of two tracks crossing at the angle. No Regelbauart of this designation in Ril 800.0120A01.",
	});
}

/**
 * One route through the crossing turnout as a held kernel element: the
 * straight along the entering track, or the connecting arc onto the crossing
 * track. Id is `${prefix}.${route}`.
 */
export function crossingElement(spec, { route, prefix = spec.id } = {}) {
	if (!spec || !Number.isFinite(spec.centreOffset)) error("INVALID_CROSSING", "crossingElement needs a spec from crossing()");
	if (!CROSSING_ROUTES.includes(route)) error("INVALID_CROSSING", `route must be one of ${CROSSING_ROUTES.join(", ")}`);
	const turnout = spec.designation ?? spec.id;
	return Object.freeze(route === "straight"
		? { id: `${prefix}.straight`, type: "straight", length: spec.straightLength, held: true, turnout }
		: { id: `${prefix}.curved`, type: "arc", length: spec.curvedLength, curvature: spec.curvature, held: true, turnout });
}
