// tools/axtran2/traWriter.mjs
//
// A kernel element sequence back into a Verm.esn TRA file: the inverse of
// test/axtran2/corpus/loadTraAlignment.mjs, so that a fitted alignment can
// go back to where it came from.
//
// The file is 78-byte records (src/import/parsers/technet/vermEsn/
// sharedVermesn.js): R1 R2 Y X T S as f64, Kz as u16, L U1 U2 as f64, C as
// f32. Record 0 is the header and carries the number of element records in
// its Kz field; the last record is the end point with L = 0. Every element
// record holds its START: Y the easting, X the northing, T the direction
// clockwise from north in radians, S the station.
//
// Conventions on the way back, each the loader's read in reverse:
//   - R > 0 is a right-hand curve, so R = -1/kappa for the kernel's
//     left-positive curvature;
//   - a transition carries R1 and R2, the radii it joins, read off the
//     fitted neighbours - which is what the chain computed with, so a record
//     that disagreed with its own neighbour comes back repaired;
//   - a Kz 5 record is a straight with a kink at its END: the straight's
//     direction and length, and in R1 the interior angle 200 gon plus the
//     clockwise turn in gon (measured on the corpus: R1 = 200 + turn for
//     every kink). The kernel's kink turns left-positive, so the clockwise
//     turn is -deltaDir;
//   - the zero-length junction arcs the loader inserts between two
//     transitions are not records and are dropped;
//   - cants U1/U2 are copied from the source record whose station range held
//     the element's original start; the fit does not touch cant.
//
// What this writer cannot carry it says: station equations (Kz 6) are not
// written, and the report lists them.

export const TRA_RECORD_BYTES = 78;

export const KZ = Object.freeze({ straight: 0, arc: 1, clothoid: 2, helmert: 3, bloss: 4, kink: 5, stationEquation: 6 });
const FAMILY_KZ = Object.freeze({ clothoid: KZ.clothoid, helmert: KZ.helmert, bloss: KZ.bloss });

export class TraWriterError extends Error {
	constructor(code, message, detail = null) {
		super(message);
		this.name = "TraWriterError";
		this.code = code;
		this.detail = detail;
	}
}

const error = (code, message, detail) => { throw new TraWriterError(code, message, detail); };

/** heading in the kernel's frame (counter-clockwise from east) to the file's (clockwise from north), in [0, 2pi) */
export function directionOfHeading(theta) {
	const t = Math.PI / 2 - theta;
	const wrapped = t - 2 * Math.PI * Math.floor(t / (2 * Math.PI));
	return wrapped >= 2 * Math.PI ? 0 : wrapped;
}

const radiusOfCurvature = (kappa) => (!Number.isFinite(kappa) || Math.abs(kappa) < 1e-15 ? 0 : -1 / kappa);

function writeRecord(view, index, row) {
	const at = index * TRA_RECORD_BYTES;
	view.setFloat64(at + 0, row.radiusA ?? 0, true);
	view.setFloat64(at + 8, row.radiusE ?? 0, true);
	view.setFloat64(at + 16, row.easting ?? 0, true);
	view.setFloat64(at + 24, row.northing ?? 0, true);
	view.setFloat64(at + 32, row.direction ?? 0, true);
	view.setFloat64(at + 40, row.station ?? 0, true);
	view.setUint16(at + 48, row.kindCode ?? 0, true);
	view.setFloat64(at + 50, row.arcLength ?? 0, true);
	view.setFloat64(at + 58, row.cantA ?? 0, true);
	view.setFloat64(at + 66, row.cantE ?? 0, true);
	view.setFloat32(at + 74, row.fieldC ?? 0, true);
}

/** the curvature an element meets its neighbour with, for a transition's R1/R2 */
function curvatureBeside(elements, index, step) {
	for (let j = index + step; j >= 0 && j < elements.length; j += step) {
		const e = elements[j];
		if (e.type === "arc") return e.curvature;
		if (e.type === "straight") return 0;
		if (e.type === "kink") continue;
		if (e.type === "transition") return step < 0 ? e.exitCurvature ?? 0 : e.entryCurvature ?? 0;
	}
	return 0;
}

/**
 * @param {object} input
 * @param {Array} input.elements         kernel elements in order: { id, type, length, curvature?, family?, deltaDir?, held? }
 * @param {Function} input.poseOfElement  element index -> { x, y, theta } it starts with, in world coordinates
 * @param {{x,y,theta}} input.endPose       the pose after the last element, in world coordinates
 * @param {number} input.startStation    the file's station at the first element
 * @param {ArrayBuffer|Uint8Array|null} [input.header]  the source file's header record, copied; a blank one otherwise
 * @param {Function} [input.cantAt]       original start station of an element -> { cantA, cantE }
 * @returns {{ bytes: Uint8Array, records: number, dropped: Array }}
 */
export function writeTra({ elements, poseOfElement, endPose, startStation = 0, header = null, cantAt = null }) {
	if (!Array.isArray(elements) || elements.length === 0) error("NO_ELEMENTS", "writeTra needs elements");
	if (typeof poseOfElement !== "function") error("NO_POSES", "writeTra needs poseOfElement(index)");
	if (!endPose || ![endPose.x, endPose.y, endPose.theta].every(Number.isFinite)) error("NO_END_POSE", "writeTra needs the end pose");
	const rows = [];
	const dropped = [];
	let station = 0;
	let originalStation = 0;
	for (let i = 0; i < elements.length; i++) {
		const e = elements[i];
		const originalLength = e.originalLength ?? e.length;
		if (e.type === "kink") {
			// folded into the straight before it; a kink without one is a
			// zero-length Kz 5 record so the turn is not lost
			if (rows.length && rows[rows.length - 1].kindCode === KZ.straight && rows[rows.length - 1].element === elements[i - 1]) {
				rows[rows.length - 1].kindCode = KZ.kink;
				rows[rows.length - 1].radiusA = 200 - (e.deltaDir ?? 0) * (200 / Math.PI);
			} else {
				const pose = poseOfElement(i);
				rows.push({ element: e, kindCode: KZ.kink, radiusA: 200 - (e.deltaDir ?? 0) * (200 / Math.PI), radiusE: 0,
					easting: pose.x, northing: pose.y, direction: directionOfHeading(pose.theta), station: startStation + station, arcLength: 0,
					...(cantAt ? cantAt(originalStation) : {}) });
			}
			continue;
		}
		if (!(e.length > 0)) {
			if (e.held) { dropped.push({ id: e.id, why: "zero-length junction arc" }); continue; }
			dropped.push({ id: e.id, why: "zero length" });
			continue;
		}
		const pose = poseOfElement(i);
		const row = {
			element: e,
			easting: pose.x, northing: pose.y, direction: directionOfHeading(pose.theta),
			station: startStation + station, arcLength: e.length,
			...(cantAt ? cantAt(originalStation) : {}),
		};
		if (e.type === "straight") { row.kindCode = KZ.straight; row.radiusA = 0; row.radiusE = 0; }
		else if (e.type === "arc") { row.kindCode = KZ.arc; row.radiusA = radiusOfCurvature(e.curvature); row.radiusE = row.radiusA; }
		else if (e.type === "transition") {
			const kz = FAMILY_KZ[e.family];
			if (kz === undefined) error("UNKNOWN_FAMILY", `no Kz for the transition family "${e.family}" of ${e.id}`);
			row.kindCode = kz;
			row.radiusA = radiusOfCurvature(curvatureBeside(elements, i, -1));
			row.radiusE = radiusOfCurvature(curvatureBeside(elements, i, +1));
		} else error("UNKNOWN_ELEMENT", `cannot write an element of type "${e.type}" (${e.id})`);
		rows.push(row);
		station += e.length;
		originalStation += originalLength;
	}
	const end = endPose;
	const last = rows[rows.length - 1];
	rows.push({ kindCode: last.kindCode === KZ.kink ? KZ.straight : last.kindCode, radiusA: last.kindCode === KZ.kink ? 0 : last.radiusE, radiusE: last.kindCode === KZ.kink ? 0 : last.radiusE,
		easting: end.x, northing: end.y, direction: directionOfHeading(end.theta), station: startStation + station, arcLength: 0,
		cantA: last.cantE ?? 0, cantE: last.cantE ?? 0 });

	const bytes = new Uint8Array((rows.length + 1) * TRA_RECORD_BYTES);
	if (header) {
		const source = header instanceof Uint8Array ? header : new Uint8Array(header);
		if (source.byteLength < TRA_RECORD_BYTES) error("SHORT_HEADER", "a TRA header record is 78 bytes");
		bytes.set(source.subarray(0, TRA_RECORD_BYTES), 0);
	}
	const view = new DataView(bytes.buffer);
	// the header's Kz field counts the element records
	view.setUint16(48, rows.length - 1, true);
	rows.forEach((row, i) => writeRecord(view, i + 1, row));
	return Object.freeze({ bytes, records: rows.length - 1, dropped: Object.freeze(dropped) });
}

/** the source rows' cant, looked up by the station an element started at in the source */
export function cantLookup(sourceRows, startStation) {
	const rows = sourceRows.filter((r) => r.kindCode !== KZ.stationEquation && Number.isFinite(r.station));
	return (originalStation) => {
		const s = startStation + originalStation;
		let best = null;
		for (const r of rows) {
			if (r.station <= s + 1e-6 && (best === null || r.station >= best.station)) best = r;
		}
		return best ? { cantA: best.cantA ?? 0, cantE: best.cantE ?? 0 } : { cantA: 0, cantE: 0 };
	};
}
