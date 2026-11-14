import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import { createTransitionLibraryService } from "../../../src/services/transition-library/index.js";

const catalogue = JSON.parse(fs.readFileSync(new URL("../../../src/domain/transition/transitionLookup.json", import.meta.url), "utf8"));
const before = JSON.stringify(catalogue);

test("a built-in halfWave is read as cant through a user copy on the same prototype", () => {
	const service = createTransitionLibraryService({ catalogue });
	const made = service.declareHalfWaveAs({ id: "HW_VIEN2", quantity: "cant" });
	assert.deepEqual(made, { ok: true, id: "HW_VIEN2_CANT", changed: true, status: "created" });
	assert.deepEqual(service.listHalfWaves().find((hw) => hw.id === "HW_VIEN2_CANT"), { id: "HW_VIEN2_CANT", proto: "PROTO_VIEN2", source: "kappa", quantity: "cant", origin: "user" });
	assert.equal(service.listHalfWaves().find((hw) => hw.id === "HW_VIEN2").quantity, "curvature");
	assert.equal(JSON.stringify(catalogue), before, "the built-in database is untouched");
	// asking again finds the copy, asking for what it already is changes nothing
	assert.deepEqual(service.declareHalfWaveAs({ id: "HW_VIEN2", quantity: "cant" }), { ok: true, id: "HW_VIEN2_CANT", changed: false, status: "existing" });
	assert.deepEqual(service.declareHalfWaveAs({ id: "HW_VIEN2", quantity: "curvature" }), { ok: true, id: "HW_VIEN2", changed: false, status: "unchanged" });
	// and the way back leads to the built-in entry
	assert.deepEqual(service.declareHalfWaveAs({ id: "HW_VIEN2_CANT", quantity: "curvature" }), { ok: true, id: "HW_VIEN2", changed: false, status: "existing" });
	// the copy travels with the library file
	const other = createTransitionLibraryService({ catalogue, userLibrary: service.exportUserLibrary() });
	assert.equal(other.listHalfWaves().find((hw) => hw.id === "HW_VIEN2_CANT").quantity, "cant");
});

test("vienna2 read as cant gives the swerving curvature of the patent's example", () => {
	const service = createTransitionLibraryService({ catalogue });
	const { id } = service.declareHalfWaveAs({ id: "HW_VIEN2", quantity: "cant" });
	// AT 412 975 B, table: h 1.8 m, cant difference 224 mm on 1.5 m, curvature difference 1.75/km, l 200 m
	const assumption = { referenceHeight: 1.8, endCant: 0.224, railBase: 1.5, radius: 1 / 1.75e-3, length: 200 };
	const draft = service.describeDraft({ halfWave1: id, halfWave2: id, normLengthPartition: [0.5, 0, 0.5], assumption, count: 1001 });
	assert.ok(draft.ok);
	const c = draft.coupling;
	assert.equal(c.given, "cant");
	assert.equal(c.derived, "curvature");
	// exact expression: psiE = asin(224/1500); the patent's own 0.00384 is the small-angle value
	assert.equal(c.exact, true);
	assert.ok(Math.abs(c.epsilon ** 2 - (1.8 * Math.asin(0.224 / 1.5)) / (1.75e-3 * 200 ** 2)) < 1e-12);
	assert.ok(Math.abs(c.epsilon ** 2 - 0.00384) < 2e-5);
	assert.ok(Math.abs(c.curvatureRange.min + 0.0083) < 2e-4 && Math.abs(c.curvatureRange.max - 1.0083) < 2e-4, JSON.stringify(c.curvatureRange));
	assert.equal(c.suitability.suitable, true);
	assert.equal(c.suitability.order, 3, "vienna2 as cant is smooth up to f‴");
	assert.equal(c.suitability.requiredOrder, 2);
	assert.ok(Math.abs(c.endDerivatives.second.start) < 1e-9);
	// read as curvature the same function has no swerve
	const plain = service.describeDraft({ halfWave1: "HW_VIEN2", halfWave2: "HW_VIEN2", normLengthPartition: [0.5, 0, 0.5], assumption });
	assert.equal(plain.coupling.given, "curvature");
	assert.equal(plain.coupling.suitability.suitable, false);
});

test("refusals", () => {
	const service = createTransitionLibraryService({ catalogue });
	assert.equal(service.declareHalfWaveAs({ id: "HW_NOPE", quantity: "cant" }).code, "USER_LIBRARY_REFERENCE_MISSING");
	assert.equal(service.declareHalfWaveAs({ id: "HW_VIEN2", quantity: "speed" }).code, "USER_LIBRARY_QUANTITY_INVALID");
	assert.equal(service.declareHalfWaveAs({ id: "toString", quantity: "cant" }).code, "USER_LIBRARY_REFERENCE_MISSING");
});
