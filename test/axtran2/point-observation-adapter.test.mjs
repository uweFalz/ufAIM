import test from "node:test";
import assert from "node:assert/strict";
import { createMetricContext } from "../../src/domain/optimization/alignment/MetricContext.js";
import {
	importPointObservationList,
	preparePointListEvidenceInput,
	POINT_OBSERVATION_ADAPTER_VERSION,
} from "../../tools/axtran2/pointObservationAdapter.mjs";

function fixture(text = "name;easting;northing;tolerance\nP1;25;2;0.1\nP2;50;1;0.05\n") {
	return {
		text, id: "survey:095", revision: "revision:1",
		source: { kind: "survey-file", reference: "fixture:095", fileName: "points.csv", declaredEncoding: "UTF-8" },
		metricContext: createMetricContext({
			id: "survey:local", lengthAuthority: "ground", unit: "m", referenceFrame: "local-survey-plane",
			distanceOperator: "euclidean", angleConvention: "mathematical",
			provenance: { source: "fixture:095" }, tolerancePolicy: { unit: "m" },
		}),
		kind: "points", decimal: "dot",
	};
}

function assignmentsFor(set) {
	return set.points.map((point) => ({ pointId: point.id, role: "axis", target: 0, tolerance: 0.2, enforcement: "soft" }));
}

function prepare(set, assignments = assignmentsFor(set)) {
	return preparePointListEvidenceInput({ observationSet: set, alignmentMetricContext: set.metricContext, assignments });
}

test("imports source evidence without roles, preserving exact text, physical lines, raw cells and numeric IDs", () => {
	const text = "# survey 'comment' remains\r\n\r\nnorthing;name;tolerance;easting\r\n 2.0 ;001;0.03; 25.000 \r\n// between rows\r\n1;P2;0.05;50\r\n";
	const input = fixture(text);
	const before = structuredClone(input);
	const set = importPointObservationList(input);
	assert.deepEqual(input, before);
	assert.equal(set.version, "point-observation-set/1");
	assert.deepEqual(set.points, [
		{ id: "001", x: 25, y: 2, source: { line: 4, cells: { northing: " 2.0 ", name: "001", tolerance: "0.03", easting: " 25.000 " }, declaredTolerance: 0.03 } },
		{ id: "P2", x: 50, y: 1, source: { line: 6, cells: { northing: "1", name: "P2", tolerance: "0.05", easting: "50" }, declaredTolerance: 0.05 } },
	]);
	assert.deepEqual(set.source.pointList, {
		version: POINT_OBSERVATION_ADAPTER_VERSION, parser: "src/services/axtran2/pointLists.js#parsePointList",
		kind: "points", decimal: "dot", originalText: text,
	});
	assert.equal(Object.hasOwn(set.points[0], "enforcement"), false);
	assert.equal(Object.hasOwn(set.points[0], "target"), false);
	assert.equal(Object.hasOwn(set.points[0], "tolerance"), false);
	assert.equal(Object.isFrozen(set.points[0].source.cells), true);
	assert.equal(Object.isFrozen(set.source.pointList), true);
	assert.deepEqual(JSON.parse(JSON.stringify(set)), set);
	input.source.reference = "mutated";
	assert.equal(set.source.reference, "fixture:095");
});

test("explicit comma notation and source selectors preserve their original declarations", () => {
	const input = { ...fixture("name;distance;northing;easting;tolerance\nZ1;-2,5;8,2;10,5;0,01\n"), kind: "zwang", decimal: "comma" };
	const set = importPointObservationList(input);
	const result = prepare(set, [{ pointId: "Z1", role: "offset", target: "source-distance", tolerance: "source-tolerance", enforcement: "hard", reason: "explicit caller decision" }]);
	assert.equal(result.points[0].x, 10.5);
	assert.equal(result.points[0].y, 8.2);
	assert.equal(result.points[0].target, -2.5);
	assert.equal(result.points[0].tolerance, 0.01);
	assert.deepEqual(result.hardPoints, [{ name: "Z1" }]);
	assert.deepEqual(result.assignments[0], {
		pointId: "Z1", role: "offset", target: -2.5, tolerance: 0.01, enforcement: "hard", reason: "explicit caller decision",
		declaration: { role: "offset", target: "source-distance", tolerance: "source-tolerance", enforcement: "hard" },
	});
	assert.equal(Object.isFrozen(result.assignments[0].declaration), true);
	assert.deepEqual(result.observationSet, set);
	const restored = JSON.parse(JSON.stringify(set));
	assert.deepEqual(prepare(restored, [{ pointId: "Z1", role: "offset", target: "source-distance", tolerance: "source-tolerance", enforcement: "hard" }]).points, result.points);
});

test("source distance and file kind never choose roles or enforcement", () => {
	const set = importPointObservationList({ ...fixture("name;easting;northing;distance;tolerance\nZ1;25;2;9;0.01"), kind: "zwang" });
	const result = prepare(set, [{ pointId: "Z1", role: "axis", target: 0, tolerance: 0.4, enforcement: "soft" }]);
	assert.equal(result.points[0].target, 0);
	assert.equal(result.points[0].tolerance, 0.4);
	assert.equal(result.points[0].enforcement, "soft");
	assert.deepEqual(result.hardPoints, []);
	assert.equal(result.observationSet.points[0].source.declaredDistance, 9);
	assert.deepEqual(result.assignments[0].declaration, { role: "axis", target: 0, tolerance: 0.4, enforcement: "soft" });
});

test("a source without tolerance is importable, but its request must declare a numeric tolerance", () => {
	const set = importPointObservationList(fixture("name;easting;northing\nP1;25;2\n"));
	assert.equal(Object.hasOwn(set.points[0].source, "declaredTolerance"), false);
	assert.equal(prepare(set).points[0].tolerance, 0.2);
	assert.throws(() => prepare(set, [{ pointId: "P1", role: "axis", target: 0, tolerance: "source-tolerance", enforcement: "soft" }]), { code: "MISSING_SOURCE_COLUMN" });
	assert.throws(() => prepare(set, [{ pointId: "P1", role: "offset", target: "source-distance", tolerance: 0.2, enforcement: "soft" }]), { code: "MISSING_SOURCE_COLUMN" });
});

test("the declared decimal profile accepts exponent notation without changing raw coordinates", () => {
	const set = importPointObservationList({ ...fixture("name;easting;northing\nP1;2,5e1;+2e0"), decimal: "comma" });
	assert.equal(set.points[0].x, 25);
	assert.equal(set.points[0].y, 2);
	assert.equal(set.points[0].source.cells.easting, "2,5e1");
	assert.equal(set.points[0].source.cells.northing, "+2e0");
});

for (const [name, text, change = () => {}] of [
	["no header", "P1;25;2"],
	["headerless numeric identity", "001;25;2"],
	["X Y ambiguity", "name;X;Y\nP1;25;2"],
	["Y X ambiguity", "name;Y;X\nP1;2;25"],
	["unknown header", "name;easting;northing;quality\nP1;25;2;ok"],
	["duplicate header", "name;easting;northing;easting\nP1;25;2;25"],
	["uppercase header", "Name;easting;northing\nP1;25;2"],
	["padded header", "name; easting;northing\nP1;25;2"],
	["missing northing", "name;easting\nP1;25"],
	["header only", "name;easting;northing\n# no observations"],
	["empty input", ""],
	["only comments", "# nothing\n\n// nothing"],
	["empty identity", "name;easting;northing\n;25;2"],
	["padded identity", "name;easting;northing\n P1 ;25;2"],
	["duplicate identity", "name;easting;northing\nP1;25;2\nP1;50;1"],
	["extra cell", "name;easting;northing\nP1;25;2;extra"],
	["missing cell", "name;easting;northing\nP1;25"],
	["comma separator", "name,easting,northing\nP1,25,2"],
	["tab separator", "name\teasting\tnorthing\nP1\t25\t2"],
	["double quote", 'name;easting;northing\n"P1";25;2'],
	["single quote", "name;easting;northing\n'P1';25;2"],
	["inline hash comment", "name;easting;northing\nP1;25;2 # note"],
	["inline slash comment", "name;easting;northing\nP1;25;2 // note"],
	["bare carriage return", "name;easting;northing\rP1;25;2"],
	["hexadecimal coercion", "name;easting;northing\nP1;0x19;2"],
	["internal numeric whitespace", "name;easting;northing\nP1;2 5;2"],
	["nonfinite coordinate", "name;easting;northing\nP1;Infinity;2"],
	["overflow coordinate", "name;easting;northing\nP1;1e309;2"],
	["negative zero", "name;easting;northing\nP1;-0;2"],
	["missing numeric cell", "name;easting;northing\nP1;;2"],
	["comma under dot declaration", "name;easting;northing\nP1;2,5;2"],
	["dot under comma declaration", "name;easting;northing\nP1;2.5;2", (x) => { x.decimal = "comma"; }],
	["thousands grouping", "name;easting;northing\nP1;1.234,5;2", (x) => { x.decimal = "comma"; }],
	["invalid tolerance fallback", "name;easting;northing;tolerance\nP1;25;2;abc"],
	["blank tolerance fallback", "name;easting;northing;tolerance\nP1;25;2;"],
	["NaN tolerance fallback", "name;easting;northing;tolerance\nP1;25;2;NaN"],
	["Infinity tolerance fallback", "name;easting;northing;tolerance\nP1;25;2;Infinity"],
	["zero tolerance", "name;easting;northing;tolerance\nP1;25;2;0"],
	["negative tolerance", "name;easting;northing;tolerance\nP1;25;2;-1"],
	["undeclared distance in points", "name;easting;northing;distance\nP1;25;2;1"],
	["missing distance in zwang", "name;easting;northing\nP1;25;2", (x) => { x.kind = "zwang"; }],
	["unreadable distance", "name;easting;northing;distance\nP1;25;2;bad", (x) => { x.kind = "zwang"; }],
]) {
	test(`strict import refuses ${name}`, () => {
		const input = fixture(text);
		change(input);
		assert.throws(() => importPointObservationList(input));
	});
}

for (const [name, change] of [
	["missing kind", (x) => { delete x.kind; }],
	["unknown kind", (x) => { x.kind = "survey"; }],
	["missing decimal", (x) => { delete x.decimal; }],
	["unknown decimal", (x) => { x.decimal = "automatic"; }],
	["reserved source metadata", (x) => { x.source.pointList = {}; }],
	["implicit axes option", (x) => { x.axes = "en"; }],
	["implicit default tolerance", (x) => { x.tolerance = 0.15; }],
	["missing metric context", (x) => { delete x.metricContext; }],
]) {
	test(`import refuses ${name}`, () => {
		const input = fixture();
		change(input);
		assert.throws(() => importPointObservationList(input));
	});
}

test("error location uses physical source lines, not filtered parser line indexes", () => {
	assert.throws(
		() => importPointObservationList(fixture("# comment\n\nname;easting;northing;tolerance\n// another\nP1;25;2;bad")),
		{ code: "INVALID_NUMBER", line: 5, column: "tolerance" },
	);
});

for (const [name, change] of [
	["missing role", (x) => { delete x[0].role; }],
	["unknown role", (x) => { x[0].role = "rail"; }],
	["missing target", (x) => { delete x[0].target; }],
	["missing tolerance", (x) => { delete x[0].tolerance; }],
	["missing enforcement", (x) => { delete x[0].enforcement; }],
	["unknown enforcement", (x) => { x[0].enforcement = "measured"; }],
	["nonzero axis target", (x) => { x[0].target = 1; }],
	["wrong target selector", (x) => { x[0].target = "source-tolerance"; }],
	["wrong tolerance selector", (x) => { x[0].tolerance = "source-distance"; }],
	["numeric string target", (x) => { x[0].target = "0"; }],
	["numeric string tolerance", (x) => { x[0].tolerance = "0.1"; }],
	["infinite target", (x) => { x[0].target = Infinity; }],
	["zero tolerance", (x) => { x[0].tolerance = 0; }],
	["orphan assignment", (x) => { x[0].pointId = "missing"; }],
	["duplicate assignment", (x) => { x[1].pointId = "P1"; }],
	["missing assignment", (x) => { x.pop(); }],
	["reserved declaration metadata", (x) => { x[0].declaration = {}; }],
]) {
	test(`explicit request refuses ${name}`, () => {
		const set = importPointObservationList(fixture());
		const assignments = assignmentsFor(set);
		change(assignments);
		assert.throws(() => prepare(set, assignments));
	});
}

for (const [name, change] of [
	["unknown adapter version", (x) => { x.source.pointList.version = "other"; }],
	["unknown parser", (x) => { x.source.pointList.parser = "other"; }],
	["modified original data", (x) => { x.source.pointList.originalText = x.source.pointList.originalText.replace("25;2", "26;2"); }],
	["modified coordinate", (x) => { x.points[0].x = 26; }],
	["modified original cell", (x) => { x.points[0].source.cells.easting = "26"; }],
	["modified line", (x) => { x.points[0].source.line = 99; }],
	["modified declared tolerance", (x) => { x.points[0].source.declaredTolerance = 0.2; }],
	["invented declared distance", (x) => { x.points[0].source.declaredDistance = 1; }],
	["deleted raw cell", (x) => { delete x.points[0].source.cells.tolerance; }],
	["extra adapter metadata", (x) => { x.source.pointList.extra = "not emitted"; }],
	["missing adapter metadata", (x) => { delete x.source.pointList; }],
]) {
	test(`reimport consistency refuses ${name}`, () => {
		const set = structuredClone(importPointObservationList(fixture()));
		change(set);
		assert.throws(() => prepare(set));
	});
}

test("source-distance is checked against raw text, and cannot turn a nonzero offset into an axis target", () => {
	const set = importPointObservationList({ ...fixture("name;easting;northing;distance;tolerance\nZ1;25;2;3;0.1"), kind: "zwang" });
	const assignment = { pointId: "Z1", role: "axis", target: "source-distance", tolerance: "source-tolerance", enforcement: "soft" };
	assert.throws(() => prepare(set, [assignment]), { code: "INVALID_AXIS_TARGET" });
	const altered = structuredClone(set);
	altered.points[0].source.declaredDistance = 0;
	assert.throws(() => prepare(altered, [assignment]), { code: "SOURCE_REIMPORT_MISMATCH" });
});

test("request context must still match the complete source context, even under the same ID", () => {
	const set = importPointObservationList(fixture());
	assert.throws(() => preparePointListEvidenceInput({
		observationSet: set, assignments: assignmentsFor(set),
		alignmentMetricContext: { ...set.metricContext, referenceFrame: "other-plane" },
	}), { code: "INCOMPARABLE_METRIC_CONTEXT" });
});
