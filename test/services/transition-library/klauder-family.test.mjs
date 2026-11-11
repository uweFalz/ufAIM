import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import { createTransitionLibraryService, klauderName, klauderPrototype, klauderRecords, klauderTerms } from "../../../src/services/transition-library/index.js";

const catalogue = JSON.parse(fs.readFileSync(new URL("../../../src/domain/transition/transitionLookup.json", import.meta.url), "utf8"));
const BUILT_IN = Object.keys(catalogue.protoFcn).filter((id) => id.startsWith("PROTO_KLAU_")).map((id) => id.split("_").slice(2).map(Number));

test("the generator reproduces every built-in Klauder record", () => {
	assert.ok(BUILT_IN.length >= 7);
	const service = createTransitionLibraryService({ catalogue });
	for (const [m, n] of BUILT_IN) {
		const built = klauderPrototype({ m, n });
		assert.deepEqual(built.proto, catalogue.protoFcn[`PROTO_KLAU_${m}_${n}`], `prototype ${m}_${n}`);
		assert.equal(built.source, catalogue.halfWave[`HW_KLAU_${m}_${n}`].source);
		const generated = service.describeDraft({ halfWave1: `HW_KLAU_${m}_${n}`, halfWave2: `HW_KLAU_${m}_${n}`, normLengthPartition: [0.5, 0, 0.5] });
		assert.ok(generated.ok);
	}
});

test("a member outside the built-in set becomes a usable halfWave", () => {
	const service = createTransitionLibraryService({ catalogue });
	assert.ok(!BUILT_IN.some(([m, n]) => m === 3 && n === 4));
	const built = klauderRecords({ m: 3, n: 4 });
	assert.deepEqual(built.records.map((record) => record.id), ["PROTO_KLAUDER_3_4", "HW_KLAUDER_3_4"]);
	const draft = service.describeHalfWave({ proto: built.records[0].value, source: built.records[1].value.source });
	assert.ok(draft.ok);
	assert.ok(Math.abs(draft.samples[0].k) < 1e-9 && Math.abs(draft.samples.at(-1).k - 1) < 1e-9);
	for (let i = 1; i < draft.samples.length; i += 1) assert.ok(draft.samples[i].k >= draft.samples[i - 1].k - 1e-9, "monotone");
	assert.ok(Math.abs(draft.endSlopes.start) < 1e-9);
	assert.ok(service.putUserRecords(built.records).ok);
	const transition = service.describeDraft({ halfWave1: "HW_KLAUDER_3_4", halfWave2: "HW_KLAU_2_3", normLengthPartition: [0.4, 0.2, 0.4] });
	assert.ok(transition.ok);
	const file = service.exportUserLibrary();
	const other = createTransitionLibraryService({ catalogue });
	assert.ok(other.importUserLibrary(file).ok);
	assert.ok(other.listHalfWaves().some((hw) => hw.id === "HW_KLAUDER_3_4"));
});

test("the terms fit the composer and the name avoids the built-in ids", () => {
	const built = klauderTerms({ m: "2", n: "5" });
	assert.equal(built.combine, "mul");
	assert.deepEqual(built.terms.map((term) => [term.fn, term.a, term.b, term.power]), [["ROOTp1", -1, 0, 2], ["IDENT", -1, 0, 5], ["ROOTm1", -1, 0, 2]]);
	assert.equal(klauderName({ m: 2, n: 5 }), "KLAUDER_2_5");
	assert.equal(catalogue.halfWave.HW_KLAUDER_2_5, undefined);
	assert.equal(klauderRecords({ m: 1, n: 1, quantity: "cant" }).records[1].value.quantity, "cant");
});

test("exponents that are not whole numbers from 0 to 24 are refused", () => {
	for (const bad of [{ m: -1, n: 1 }, { m: 1.5, n: 1 }, { m: 2, n: "" }, { m: 2, n: 25 }, { m: "x", n: 1 }, {}]) {
		for (const fn of [klauderTerms, klauderPrototype, klauderRecords]) {
			const result = fn(bad);
			assert.equal(result.ok, false);
			assert.equal(result.code, "KLAUDER_EXPONENT_INVALID");
		}
		assert.equal(klauderName(bad), null);
	}
});
