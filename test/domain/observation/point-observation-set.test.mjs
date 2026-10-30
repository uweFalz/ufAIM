import test from "node:test";
import assert from "node:assert/strict";
import { createMetricContext } from "../../../src/domain/optimization/alignment/MetricContext.js";
import { createPointObservationSet } from "../../../src/domain/observation/PointObservationSet.js";

function fixture() {
	return {
		id: "survey:1", revision: "revision:1",
		source: { kind: "survey-import", reference: "fixture:093", fileRevision: "r7", originalAxes: ["easting", "northing"] },
		metricContext: createMetricContext({
			id: "survey:local", lengthAuthority: "ground", unit: "m", referenceFrame: "local-survey-plane",
			distanceOperator: "euclidean", angleConvention: "mathematical",
			provenance: { source: "fixture:093" }, tolerancePolicy: { unit: "m" },
		}),
		points: [{ id: "P1", x: 25, y: 2, source: { line: 2 }, quality: { declaredSigma: 0.03, flags: ["source-value"] } }],
		remarks: { epoch: "2026-10-20", unrecognizedSourceField: [1, null, true] },
	};
}

test("source evidence retains all JSON provenance and quality, independent of any solver assignment", () => {
	const input = fixture();
	const original = structuredClone(input);
	const set = createPointObservationSet(input);
	assert.deepEqual(set, { ...original, version: "point-observation-set/1" });
	assert.deepEqual(JSON.parse(JSON.stringify(set)), set);
	assert.deepEqual(createPointObservationSet(JSON.parse(JSON.stringify(set))), set);
	for (const value of [set, set.source, set.source.originalAxes, set.metricContext, set.metricContext.provenance, set.points, set.points[0], set.points[0].quality, set.points[0].quality.flags]) {
		assert.equal(Object.isFrozen(value), true);
	}
	input.source.reference = "changed";
	input.points[0].quality.flags.push("changed");
	input.points[0].x = 999;
	assert.deepEqual(set, { ...original, version: "point-observation-set/1" });
	assert.throws(() => { set.points[0].x = 999; }, TypeError);
	assert.equal(Object.hasOwn(set.points[0], "target"), false);
	assert.equal(Object.hasOwn(set.points[0], "enforcement"), false);
});

for (const [name, change] of [
	["missing identity", (x) => { delete x.id; }],
	["padded point identity", (x) => { x.points[0].id = " P1 "; }],
	["numeric revision", (x) => { x.revision = 1; }],
	["wrong version", (x) => { x.version = "point-observation-set/99"; }],
	["empty source", (x) => { x.source = {}; }],
	["missing source reference", (x) => { delete x.source.reference; }],
	["empty points", (x) => { x.points = []; }],
	["duplicate point", (x) => { x.points.push({ ...x.points[0] }); }],
	["string coordinate", (x) => { x.points[0].x = "25"; }],
	["NaN coordinate", (x) => { x.points[0].x = NaN; }],
	["infinite coordinate", (x) => { x.points[0].y = Infinity; }],
	["undefined metadata", (x) => { x.points[0].quality.missing = undefined; }],
	["Date metadata", (x) => { x.remarks.date = new Date("2026-10-20"); }],
	["function metadata", (x) => { x.remarks.f = () => 1; }],
	["negative-zero JSON loss", (x) => { x.points[0].x = -0; }],
	["sparse metadata array", (x) => { x.remarks.values = new Array(2); }],
	["extra array property", (x) => { x.points.extra = 1; }],
	["symbol metadata", (x) => { x.source[Symbol("hidden")] = 1; }],
	["nonenumerable metadata", (x) => { Object.defineProperty(x.source, "hidden", { value: 1 }); }],
	["cycle", (x) => { x.remarks.cycle = x; }],
	["foreign point context under the same ID", (x) => { x.points[0].metricContext = { ...x.metricContext, referenceFrame: "other-plane" }; }],
	["nonmetre context", (x) => { x.metricContext = { ...x.metricContext, unit: "ft" }; }],
	["nonplanar authority", (x) => { x.metricContext = { ...x.metricContext, lengthAuthority: "ellipsoid" }; }],
	["undeclared context version", (x) => { x.metricContext = { ...x.metricContext }; delete x.metricContext.version; }],
	["implicit operator", (x) => { x.metricContext = { ...x.metricContext }; delete x.metricContext.distanceOperator; }],
	["arc-length operator", (x) => { x.metricContext = { ...x.metricContext, distanceOperator: "arc-length" }; }],
	["bearing angles", (x) => { x.metricContext = { ...x.metricContext, angleConvention: "bearing" }; }],
	["empty context provenance", (x) => { x.metricContext = { ...x.metricContext, provenance: {} }; }],
	["missing tolerance policy declaration", (x) => { x.metricContext = { ...x.metricContext }; delete x.metricContext.tolerancePolicy; }],
]) {
	test(`source evidence refuses ${name}`, () => {
		const input = fixture();
		change(input);
		assert.throws(() => createPointObservationSet(input));
	});
}

test("accessors are refused without being evaluated", () => {
	const input = fixture();
	let reads = 0;
	Object.defineProperty(input.source, "secret", { enumerable: true, get() { reads++; return "should not read"; } });
	assert.throws(() => createPointObservationSet(input), /enumerable data property/);
	assert.equal(reads, 0);
});

test("JSON property names do not mutate object prototypes", () => {
	const input = fixture();
	input.source = JSON.parse('{"kind":"survey-import","reference":"fixture:093","__proto__":{"origin":"data"}}');
	const set = createPointObservationSet(input);
	assert.deepEqual(set.source, input.source);
	assert.equal(Object.getPrototypeOf(set.source), Object.prototype);
	assert.equal(Object.hasOwn(set.source, "__proto__"), true);
});
