// test/axtran2/corpus/loadTraAlignment.mjs
//
// A Verm.esn TRA file as the kernel sees it: an element sequence with a start
// pose, a family per transition, and the file's own end point to check the
// chain against.
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
// up to 23 km (see corpus-validation.test.mjs).

import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import { registerHooks } from "node:module";

const ROOT = new URL("../../../", import.meta.url);

// The importers address each other by the aliases the browser's import map
// provides; Node needs the same map.
const ALIASES = {
	"@src/": "src/", "@kimport/": "src/import/", "@spot/": "src/model/spot/",
	"@kgeom/": "src/lib/geom/", "@kmath/": "src/lib/math/", "@utils/": "src/lib/utils/",
};
registerHooks({
	resolve(specifier, context, next) {
		for (const [prefix, target] of Object.entries(ALIASES)) {
			if (specifier.startsWith(prefix)) return next(new URL(target + specifier.slice(prefix.length), ROOT).href, context);
		}
		return next(specifier, context);
	},
});

const { parseTraGraAuto } = await import(new URL("src/import/parsers/technet/vermEsn/parseTRA_GRA.js", ROOT));

/** what this loader can express; anything else is reported, not guessed at */
export const FAMILIES = Object.freeze({ klothoide: "clothoid", clothoid: "clothoid", bloss: "bloss" });

const measure = (m) => (m && typeof m === "object" && "value" in m ? Number(m.value) : Number(m));
// R > 0 is a right-hand curve in Verm.esn; the kernel's heading grows to the left
const curvatureOfRadius = (r) => (r == null || !Number.isFinite(Number(r)) || Number(r) === 0 ? 0 : -1 / Number(r));
// cw from north, as the file states directions, into the kernel's frame
const headingOf = (direction) => Math.PI / 2 - measure(direction);

/**
 * @param {string|URL} file  a .TRA
 * @returns {Promise<object>} { name, startPose, endPose, elements, families, held, unsupported, stationEquations }
 *   elements: [{ id, type, length, curvature?, family?, held? }] in kernel terms;
 *   held marks zero-length arcs inserted at a transition-to-transition junction
 */
export async function loadTraAlignment(file) {
	const bytes = await readFile(file);
	const name = basename(typeof file === "string" ? file : file.pathname);
	const document = await parseTraGraAuto({
		name,
		arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
	});
	const alignment = document.alignments?.[0];
	const records = alignment?.coordGeom?.elements ?? [];
	if (records.length === 0) throw new Error(`${name}: no coordGeom elements`);

	const elements = [];
	const unsupported = [];
	const families = new Set();
	let inserted = 0;
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
		unsupported: Object.freeze(unsupported),
		stationEquations: alignment?.staEquations?.length ?? 0,
		recordCount: records.length,
	});
}

/** every .TRA under a directory, sorted, as paths */
export async function listTraFiles(root) {
	const { readdir } = await import("node:fs/promises");
	const { join } = await import("node:path");
	const out = [];
	async function walk(dir) {
		for (const entry of await readdir(dir, { withFileTypes: true })) {
			const path = join(dir, entry.name);
			if (entry.isDirectory()) await walk(path);
			else if (/\.tra$/i.test(entry.name)) out.push(path);
		}
	}
	await walk(root);
	return out.sort();
}

// ---------------------------------------------------------------------------
// production geometry, for the foot-point projector

const { makeAlignment2DFromSparse } = await import(new URL("src/aim-core/alignment/aggregate/AlignmentFactory.js", ROOT));
const sw = await import(new URL("src/import/build/sparseWriter.js", ROOT));

/**
 * The same element sequence as an Alignment2D, which is what the residual
 * builder needs for world2Track. The editor path cannot express it - it wants
 * strictly alternating fixed/transition elements of positive length, and a
 * real alignment has compound curves, curves meeting straights without a
 * transition, and the held junction arcs above - so the sparse is written the
 * way the LandFAT bridge writes it, with enforceAlternation filling the gaps
 * with zero-length immediates. The factory chains from startPose and reads a
 * transition's exit curvature from the next fixed stub; per-element anchors
 * are not needed.
 *
 * @param {object} input
 * @param {Array} input.elements   kernel elements, as loadTraAlignment returns them
 * @param {{x,y,theta}} input.startPose
 * @param {object} input.deps      { descriptorResolver, kappaBuilder }
 */
export function buildProductionAlignment({ elements, startPose, deps }) {
	const raw = elements.map((e) => {
		if (e.type === "transition") return sw.transition({ poseA: null, arcLength: e.length, transType: e.family });
		const curvature = e.type === "arc" ? e.curvature : 0;
		return e.length > 0
			? sw.fixed({ poseA: null, arcLength: e.length, curvature })
			: sw.zeroFixed({ poseA: null, curvature });
	});
	const sparse = sw.enforceAlternation(raw).map((el, i) => ({ id: el.id ?? `S${i}`, ...el }));
	const pose = { p: { x: startPose.x, y: startPose.y }, t: { x: Math.cos(startPose.theta), y: Math.sin(startPose.theta) } };
	return makeAlignment2DFromSparse({ startPose: pose, sparse, ...deps }).alignment;
}

