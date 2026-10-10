// src/import/parsers/technet/vermEsn/traAlignment.js
//
// A Verm.esn TRA file as the kernel sees it: an element sequence with a start
// pose, a family per transition, the station equations by distance, and the
// file's own end point to check the chain against. No file system here: the
// bytes come from the caller (test/axtran2/corpus/loadTraAlignment.mjs reads
// a path in Node; the app's import pipeline has the bytes already).
//
// The file is read through the production parser and then translated here
// rather than through buildSparseFromLandFAT, for two reasons. The bridge
// carries the curvature of a TRA record as 1/R, and in this format R > 0 is a
// right-hand curve: measured on the first arc of eifel/2631R139, chord against
// tangent turns -8.93 gon, which is exactly L/2R and to the right. Chained that
// way the whole alignment is mirrored and misses its own end point by 9.5 km
// on 11.3 km. And the kernel's chain infers a transition's end curvatures from
// its neighbours, which a pair of transitions meeting at a peak curvature
// defeats; the file carries R1 and R2 for every transition, and where two meet
// at a curvature that is not zero a held arc of zero length carries it.
//
// Validated against every representable file of the corpus: the moment chain
// reaches the file's recorded end point to 1e-5 m or better on alignments of
// up to 23 km (test/axtran2/corpus-validation.test.mjs). The inverse is
// tools/axtran2/traWriter.mjs.

import { parseTraGraAuto } from "./parseTRA_GRA.js";
import { decodeBinary } from "./sharedVermesn.js";

/** what this loader can express; anything else is reported, not guessed at */
// "ÜB S-Form" is the Helmert transition (also called S-Form); "S-Form (1f
// geschw.)" is another record kind and stays unsupported until named
export const FAMILIES = Object.freeze({ klothoide: "clothoid", clothoid: "clothoid", bloss: "bloss", "üb s-form": "helmert" });

const measure = (m) => (m && typeof m === "object" && "value" in m ? Number(m.value) : Number(m));
// R > 0 is a right-hand curve in Verm.esn; the kernel's heading grows to the left
const curvatureOfRadius = (r) => (r == null || !Number.isFinite(Number(r)) || Number(r) === 0 ? 0 : -1 / Number(r));
// cw from north, as the file states directions, into the kernel's frame
const headingOf = (direction) => Math.PI / 2 - measure(direction);

/**
 * The file's station equations (Kz 6, Kilometersprung), placed by the
 * distance along the records before them: a Kz 6 row sits between two
 * element records at the point where the chainage jumps, carrying the
 * station before the jump and in L the jump itself. The distance is what a
 * writer needs to put the row back, because the loader below merges the
 * two straights a jump usually splits.
 */
export function kilometreJumpsOf(bytes) {
	const { rowsRaw } = decodeBinary(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), "TRA");
	const rows = rowsRaw.slice(1, -1);
	const jumps = [];
	let distance = 0;
	for (const row of rows) {
		if (row.kindCode === 6) { jumps.push(Object.freeze({ distance, delta: row.arcLength, station: row.station })); continue; }
		if (Number.isFinite(row.arcLength)) distance += row.arcLength;
	}
	return Object.freeze(jumps);
}

/**
 * @param {Uint8Array} bytes  the file
 * @param {string} [name]
 * @returns {Promise<object>} { name, startPose, endPoint, elements, families, kilometreJumps, unsupported, stationEquations, ... }
 *   elements: [{ id, type, length, curvature?, family?, deltaDir?, held? }] in kernel terms;
 *   held marks zero-length arcs inserted at a transition-to-transition junction, and kinks
 */
export async function traAlignmentFromBytes(bytes, name = "alignment.TRA") {
	const document = await parseTraGraAuto({
		name,
		arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
	});
	return traAlignmentFromDocument(document, bytes, name);
}

/**
 * The same, from a document the production parser already produced
 * (parseTraGraAuto), plus the file's bytes for the station equations.
 */
export function traAlignmentFromDocument(document, bytes, name = "alignment.TRA") {
	const alignment = document.alignments?.[0];
	const records = alignment?.coordGeom?.elements ?? [];
	if (records.length === 0) throw new Error(`${name}: no coordGeom elements`);

	const elements = [];
	const unsupported = [];
	const families = new Set();
	let inserted = 0;
	let kinks = 0;
	for (let i = 0; i < records.length; i++) {
		const record = records[i];
		const length = measure(record.length);
		const id = `E${elements.length}`;
		if (record.type === "Line") {
			elements.push({ id, type: "straight", length });
		} else if (record.type === "Curve") {
			const curvature = curvatureOfRadius(record.radius);
			// a Kreis record with R = 0 is how some files write a straight
			if (curvature === 0) elements.push({ id, type: "straight", length });
			else elements.push({ id, type: "arc", length, curvature });
		} else if (record.type === "Spiral") {
			const family = FAMILIES[String(record.spiType ?? "").toLowerCase()];
			if (!family) unsupported.push({ index: i, type: record.type, spiType: record.spiType ?? null });
			families.add(family ?? String(record.spiType));
			elements.push({ id, type: "transition", length, family: family ?? "clothoid",
				entryCurvature: curvatureOfRadius(record.radiusStart), exitCurvature: curvatureOfRadius(record.radiusEnd) });
			// two transitions meeting at a curvature: the kernel reads a transition's
			// ends from its neighbours, so the junction needs an element that has one
			const next = records[i + 1];
			if (next?.type === "Spiral") {
				const junction = curvatureOfRadius(record.radiusEnd);
				if (Math.abs(junction) > 1e-12) {
					elements.push({ id: `E${elements.length}`, type: "arc", length: 0, curvature: junction, held: true });
					inserted += 1;
				}
			}
		} else if (record.type === "Kink") {
			// A Knick: a heading jump of zero length between two elements, which
			// station tracks have where the rule book allows a bend without a
			// transition. The file's kink record carries the interior angle
			// around 200 gon; the turn is read off the neighbours' directions
			// instead, which the parser already has in radians. Directions grow
			// clockwise in the file and the kernel's heading grows to the left,
			// so the turn changes sign; the closure test says whether that is
			// right. Measured over the 95 kinks of the corpus: all between two
			// straights or a straight and an arc, median 0.015 gon, largest
			// 0.063 gon.
			const before = records[i - 1];
			const after = records[i + 1];
			const dirIn = before ? measure(before.dirEnd ?? before.direction) : NaN;
			const dirOut = after ? measure(after.dirStart ?? after.direction) : NaN;
			if (!Number.isFinite(dirIn) || !Number.isFinite(dirOut)) {
				unsupported.push({ index: i, type: record.type, why: "a kink without a direction on both sides" });
			} else {
				const turn = Math.atan2(Math.sin(dirOut - dirIn), Math.cos(dirOut - dirIn));
				elements.push({ id, type: "kink", length: 0, deltaDir: -turn, held: true });
				kinks += 1;
			}
		} else {
			unsupported.push({ index: i, type: record.type });
		}
	}

	// A file splits an element where a kilometre marker or a station equation
	// falls, not where the geometry changes: Landshut/Gls401v carries four
	// straights of 21, 21, 17 and 6 m in a row. To the solver those are four
	// variables with one Jacobian column between them, and the reduced system
	// is singular - measured as qp_failed:reduced_system_failed at iteration
	// 197. Consecutive straights, and consecutive arcs of one curvature, are
	// one element here; the geometry is unchanged and the closure test below
	// says so.
	const merged = [];
	let mergedCount = 0;
	for (const e of elements) {
		const prev = merged[merged.length - 1];
		const same = prev && !prev.held && !e.held && prev.type === e.type
			&& (e.type === "straight" || (e.type === "arc" && Math.abs(prev.curvature - e.curvature) <= 1e-12 * Math.max(1, Math.abs(e.curvature))));
		if (same) { merged[merged.length - 1] = { ...prev, length: prev.length + e.length }; mergedCount += 1; }
		else merged.push(e);
	}
	const renumbered = merged.map((e, i) => ({ ...e, id: `E${i}` }));

	const first = records[0];
	const last = records[records.length - 1];
	return Object.freeze({
		name,
		startPose: Object.freeze({ x: first.start.easting, y: first.start.northing, theta: headingOf(first.dirStart ?? first.direction) }),
		endPoint: Object.freeze({ x: last.end?.easting ?? null, y: last.end?.northing ?? null }),
		elements: Object.freeze(renumbered.map((e) => Object.freeze(e))),
		mergedRecords: mergedCount,
		families: Object.freeze([...families]),
		insertedJunctionArcs: inserted,
		kinks,
		unsupported: Object.freeze(unsupported),
		stationEquations: alignment?.staEquations?.length ?? 0,
		kilometreJumps: kilometreJumpsOf(bytes),
		recordCount: records.length,
	});
}

