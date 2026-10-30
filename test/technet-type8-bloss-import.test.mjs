import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test from "node:test";
import { resolveTechnetType8TransitionId } from "../src/import/parsers/technet/shared/resolveTechnetType8TransitionId.js";
import { RegistryResolver } from "../src/domain/transition/registry/RegistryResolver.js";
import { KappaFcnBuilder } from "../src/aim-core/transition/runtime/KappaFcnBuilder.js";
import { createGndSourceEnvelope, encodeGndCell } from "../src/import/parsers/technet/gndEdit/gnd/gndSourceEnvelope.js";

const root = new URL("../", import.meta.url);
const aliases = { "@src/": "src/", "@kimport/": "src/import/", "@kgeom/": "src/lib/geom/",
	"@kmath/": "src/lib/math/", "@utils/": "src/lib/utils/", "@spot/": "src/model/spot/" };
registerHooks({ resolve(specifier, context, next) {
	// This suite exercises typed GND envelopes, not the external XLSX reader.
	if (specifier === "sheetjs") return next("data:text/javascript,export function read(){throw Error('XLSX reader outside this test');}", context);
	for (const [prefix, target] of Object.entries(aliases)) {
		if (specifier.startsWith(prefix)) return next(new URL(target + specifier.slice(prefix.length), root).href, context);
	}
	return next(specifier, context);
} });
const { mapTraLikeRecordToElements } = await import("../src/import/parsers/technet/shared/traLikeCoordGeom.js");
const { getTraLikeSemanticMapForTRA } = await import("../src/import/parsers/technet/shared/traLikeSemanticMaps.js");
const { parseTraGraAuto } = await import("../src/import/parsers/technet/vermEsn/parseTRA_GRA.js");
const { traAlignmentFromDocument, traAlignmentFromBytes } = await import("../src/import/parsers/technet/vermEsn/traAlignment.js");
const { parseGNDSourceEnvelope } = await import("../src/import/parsers/technet/gndEdit/parseGND_XLSX.js");
const { buildProductionAlignment } = await import("../src/domain/optimization/alignment/ProductionAlignment.js");
const { buildSparseFromLandFAT } = await import("../src/import/build/buildSparseFromLandFAT.js");
const { makeAlignment2DFromSparse } = await import("../src/aim-core/alignment/aggregate/AlignmentFactory.js");
const dependencies = { descriptorResolver: new RegistryResolver(), kappaBuilder: KappaFcnBuilder };
const semanticMap = getTraLikeSemanticMapForTRA();
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-12, `${a} != ${b}`);

const pairs = [
	[0, 500, "bloss_halfwave_in"], [1000, 500, "bloss_halfwave_in"],
	[0, -500, "bloss_halfwave_in"], [-1000, -500, "bloss_halfwave_in"],
	[500, 0, "bloss_halfwave_out"], [500, 1000, "bloss_halfwave_out"],
	[-500, 0, "bloss_halfwave_out"], [-500, -1000, "bloss_halfwave_out"],
];

function mapped(radiusA, radiusE, extra = {}) {
	const record = { kindCode: 8, easting: 100, northing: 200, station: 0,
		direction: Math.PI / 2, arcLength: 80, radiusA, radiusE, ...extra };
	const before = structuredClone(record);
	const warnings = [];
	const elements = mapTraLikeRecordToElements(record, { easting: 180, northing: 201 }, 1, { semanticMap, warnings });
	assert.deepEqual(record, before);
	assert.equal(elements.length, 1);
	return { element: elements[0], warnings };
}

for (const [radiusA, radiusE, expected] of pairs) {
	test(`type8 ${radiusA} → ${radiusE} selects ${expected} without losing source`, () => {
		assert.equal(resolveTechnetType8TransitionId({ typeCode: 8, radiusA, radiusE }), expected);
		const { element, warnings } = mapped(radiusA, radiusE);
		assert.equal(element.type, "Spiral");
		assert.equal(element.spiType, expected);
		assert.equal(element.length.value, 80);
		assert.equal(element.radiusStart, radiusA);
		assert.equal(element.radiusEnd, radiusE);
		assert.equal(element.source.kindCode, 8);
		assert.equal(element.extras.sourceSemantics.typeLabel, "Bloss (1f geschw.)");
		assert.equal(element.extras.sourceSemantics.spiType, "Bloss (1f geschw.)");
		assert.equal(element.extras.transitionResolution.transitionId, expected);
		assert.deepEqual(warnings, []);
	});
}

for (const [radiusA, radiusE] of [
	[500, -1000], [-500, 1000], [500, 500], [0, 0],
	[null, 500], [undefined, 500], ["", 500], [false, 500],
	["0", 500], [NaN, 500], [Infinity, 500], [500, null], [Number.MIN_VALUE, 500],
]) {
	test(`ambiguous/missing type8 radii remain unresolved (${String(radiusA)}, ${String(radiusE)})`, () => {
		assert.equal(resolveTechnetType8TransitionId({ typeCode: 8, radiusA, radiusE }), null);
		const { element, warnings } = mapped(radiusA, radiusE);
		assert.equal(element.type, "Spiral", "equal radii must not turn into a Curve");
		assert.equal(element.spiType, "unresolved_technet_type8");
		assert.equal(element.extras.transitionResolution.status, "unresolved");
		assert.equal(warnings[0].code, "type8-halfwave-direction-unresolved");
		if (!Number.isFinite(radiusA)) assert.equal(element.radiusStart, null);
		const sparse = buildSparseFromLandFAT({ coordGeom: { elements: [element] } });
		assert.throws(() => makeAlignment2DFromSparse({ ...dependencies,
			startPose: sparse.startPose, sparse: sparse.sparse,
		}), (error) => error.code === "ALIGNMENT_TRANSITION_BUILD_FAILED");
	});
}

test("type8 preserves matching explicit identity and refuses a contradictory explicit identity", () => {
	assert.equal(mapped(0, 500, { transitionType: "bloss_halfwave_in" }).element.spiType, "bloss_halfwave_in");
	for (const transitionType of ["bloss_halfwave_out", "bloss", "clothoid", "immediate", "not-known",
		"", " ", " bloss_halfwave_in ", 0, false, { id: "bloss_halfwave_in" }]) {
		const { element } = mapped(0, 500, { transitionType });
		assert.equal(element.spiType, "unresolved_technet_type8");
		assert.equal(element.extras.transitionResolution.sourceTransitionType, transitionType);
	}
	assert.equal(resolveTechnetType8TransitionId({ typeCode: 7, radiusA: 0, radiusE: 500 }), null);
});

// Synthetic bytes use the public TRA field offsets directly, independently of
// the decoder and the production writer. They are not a physical survey file.
function traBytes(records) {
	const bytes = new Uint8Array(78 * (records.length + 1));
	const view = new DataView(bytes.buffer);
	for (const [index, row] of records.entries()) {
		const offset = 78 * (index + 1);
		for (const [at, value] of [
			[0, row.radiusA ?? 0], [8, row.radiusE ?? 0],
			[16, 100 + index * 80], [24, 200], [32, Math.PI / 2],
			[40, index * 80], [50, row.arcLength ?? 80],
		]) view.setFloat64(offset + at, value, true);
		view.setUint16(offset + 48, row.kindCode ?? 0, true);
	}
	return bytes;
}

for (const [radiusA, radiusE, expected] of pairs) {
	test(`actual TRA decoder → loader → production runtime preserves ${radiusA}/${radiusE}`, async () => {
		const bytes = traBytes([{ kindCode: 8, radiusA, radiusE }, { arcLength: 0 }]);
		const frozen = bytes.slice();
		const source = await parseTraGraAuto({ name: "type8.TRA", arrayBuffer: async () => bytes.buffer });
		const sourceElement = source.alignments[0].coordGeom.elements[0];
		assert.equal(sourceElement.spiType, expected);
		assert.equal(sourceElement.extras.sourceSemantics.typeLabel, "Bloss (1f geschw.)");
		const model = await traAlignmentFromBytes(bytes);
		assert.deepEqual(model.unsupported, []);
		assert.equal(model.elements.find((el) => el.type === "transition").family, expected);
		assert.equal(model.insertedJunctionArcs, Number(radiusA !== 0) + Number(radiusE !== 0));
		const geometry = buildProductionAlignment({ elements: model.elements, startPose: model.startPose, deps: dependencies });
		const transition = geometry.elements.find((el) => el.arcLength === 80);
		assert.equal(geometry.arcLength, 80);
		const a = radiusA === 0 ? 0 : -1 / radiusA;
		const b = radiusE === 0 ? 0 : -1 / radiusE;
		close(transition.curvatureAt(0), a);
		close(transition.curvatureAt(80), b);
		close(transition.curvatureAt(40), a + (b - a) * (expected.endsWith("_in") ? 0.3125 : 0.6875));
		assert.deepEqual(bytes, frozen);
	});
}

test("type8 neighbor contradictions and ambiguous radii cannot be bypassed through unsupported", async () => {
	for (const rows of [
		[{ kindCode: 0 }, { kindCode: 8, radiusA: 1000, radiusE: 500 }, { kindCode: 1, radiusA: 500 }, { arcLength: 0 }],
		[{ kindCode: 8, radiusA: 0, radiusE: 500 }, { kindCode: 1, radiusA: 1000 }, { arcLength: 0 }],
		[{ kindCode: 8, radiusA: 500, radiusE: -1000 }, { arcLength: 0 }],
		[{ kindCode: 8, radiusA: 500, radiusE: 500 }, { arcLength: 0 }],
	]) {
		const model = await traAlignmentFromBytes(traBytes(rows));
		assert.ok(model.unsupported.length > 0);
		assert.ok(model.elements.some((element) => element.family?.startsWith("unresolved:")));
		assert.throws(() => buildProductionAlignment({
			elements: model.elements, startPose: model.startPose, deps: dependencies,
		}), (error) => error.code === "ALIGNMENT_TRANSITION_BUILD_FAILED");
	}
});

test("any unsupported spiral family stays unknown instead of becoming a usable clothoid", () => {
	for (const spiType of [undefined, "Bloss (1f geschw.)", "not-known", "S-Form (1f geschw.)"]) {
		const { element } = mapped(0, 500);
		element.spiType = spiType;
		const model = traAlignmentFromDocument({ alignments: [{ coordGeom: { elements: [element] } }] }, new Uint8Array(0));
		assert.equal(model.unsupported.length, 1);
		assert.ok(model.elements[0].family.startsWith("unresolved:"));
		assert.throws(() => buildProductionAlignment({
			elements: model.elements, startPose: model.startPose, deps: dependencies,
		}), (error) => error.code === "ALIGNMENT_TRANSITION_BUILD_FAILED");
	}
});

function gndEnvelope(radiusA, radiusE, typeCode = 8, family = "EL") {
	const names = ["X_ASC11_PP", "X_ASC12_PL", family === "EL" ? "X_ASC21_EL" : "X_ASC24_EK"];
	const tables = [
		[0, 1].map((i) => ({ PAD: `P${i}`, PSTRECKE: "1720", PSTRRIKZ: 1, STATION: i * 80 })),
		[0, 1].map((i) => ({ PAD: `P${i}`, LSYS: "DR0", Y: 100 + i * 80, X: 200 })),
		[{ PAD1: "P0", PAD2: "P1", [`${family}SYS`]: "DR0", [`${family}TYP`]: typeCode,
			[`${family}PAR1`]: 80, [`${family}PAR2`]: radiusA, [`${family}PAR3`]: radiusE,
			[`${family}PAR4`]: 0, [`${family}ARIWI`]: 100 }],
	].map((rows, index) => ({ name: names[index], ordinal: index, rows: rows.map((record, ordinal) => ({
		ordinal, cells: Object.entries(record).map(([columnName, value]) => ({ columnName, ...encodeGndCell(value) })),
	})) }));
	return createGndSourceEnvelope({
		source: { fileName: "synthetic.mdb", byteLength: 0, sha256: "fixture", format: "Jet 4 MDB" },
		extractor: { id: "test-typed-envelope", version: "1" },
		inventory: names.map((name, ordinal) => ({ name, ordinal, interpreted: true })), tables,
	});
}

for (const family of ["EL", "EK"]) {
	test(`GND ${family} typed source reaches exact existing halfwave IDs and preserves source`, () => {
		for (const [radiusA, radiusE, expected] of pairs) {
			const envelope = gndEnvelope(radiusA, radiusE, 8, family);
			const before = structuredClone(envelope);
			const parsed = parseGNDSourceEnvelope({ envelope });
			assert.equal(parsed.alignments.length, 1);
			const element = parsed.alignments[0].coordGeom.elements[0];
			assert.equal(element.spiType, expected);
			assert.equal(element.radiusStart, radiusA);
			assert.equal(element.radiusEnd, radiusE);
			assert.equal(element.length.value, 80);
			assert.deepEqual(envelope, before);
		}
	});
}

test("GND ambiguity retains unresolved source evidence and never constructs a type8 circle", () => {
	for (const [radiusA, radiusE] of [[500, 500], [0, 0], [500, -1000], [null, 500], [500, null], [false, 500]]) {
		const envelope = gndEnvelope(radiusA, radiusE);
		const parsed = parseGNDSourceEnvelope({ envelope });
		assert.equal(parsed.alignments.length, 0);
		assert.ok(parsed.extras.diagnostics.some((item) =>
			item.code === "type8-halfwave-direction-unresolved" && item.geometryUsable === false));
		assert.equal(parsed.extras.unresolvedSourceElements[0].typeCode, 8);
		assert.equal(parsed.extras.unresolvedSourceElements[0].decision, "not-constructed");
	}
});

test("GND type7 keeps its existing halfwave and ambiguity contract", () => {
	assert.equal(parseGNDSourceEnvelope({ envelope: gndEnvelope(0, 500, 7) })
		.alignments[0].coordGeom.elements[0].spiType, "s_form_halfwave_in");
	assert.equal(parseGNDSourceEnvelope({ envelope: gndEnvelope(500, 0, 7) })
		.alignments[0].coordGeom.elements[0].spiType, "s_form_halfwave_out");
	assert.equal(parseGNDSourceEnvelope({ envelope: gndEnvelope(500, -500, 7) }).alignments.length, 0);
});
