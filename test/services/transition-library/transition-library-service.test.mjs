import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
	HALFWAVE_QUANTITIES,
	USER_LIBRARY_KIND,
	createTransitionLibraryService,
} from "../../../src/services/transition-library/createTransitionLibraryService.js";

const ROOT = new URL("../../../", import.meta.url);
const builtIn = JSON.parse(await readFile(new URL("src/domain/transition/transitionLookup.json", ROOT), "utf8"));
const pristine = JSON.stringify(builtIn);
const make = (options = {}) => createTransitionLibraryService({ catalogue: builtIn, ...options });

// A user's own quintic rise 10x^3 - 15x^4 + 6x^5, used as a whole (crop 0..1 is
// halved by the symmetric transition below).
const QUINTIC = { op: "poly", coeff: [0, 0, 0, 10, -15, 6] };
function createQuintic(service, { quantity } = {}) {
	const steps = [
		{ level: "simpleFcn", id: "MY_QUINTIC", value: QUINTIC },
		{ level: "protoFcn", id: "PROTO_MY_QUINTIC", value: { op: "ref", id: "MY_QUINTIC", crop: [0, 0.5] } },
		{ level: "halfWave", id: "HW_MY_QUINTIC", value: { proto: "PROTO_MY_QUINTIC", source: "kappa", ...(quantity ? { quantity } : {}) } },
		{ level: "transition", id: "my_quintic", value: { label: "Mein Quintic", halfWave1: "HW_MY_QUINTIC", halfWave2: "HW_MY_QUINTIC", normLengthPartition: [0.5, 0, 0.5] } },
	];
	return steps.map((step) => service.putUserRecord(step));
}

test("a user builds a transition bottom-up and it behaves like a built-in one", () => {
	const service = make();
	const results = createQuintic(service);
	assert.deepEqual(results.map((r) => r.status), ["created", "created", "created", "created"]);
	const preset = service.listPresets().find((entry) => entry.id === "my_quintic");
	assert.equal(preset.origin, "user");
	assert.equal(preset.quantity, "curvature");
	assert.equal(service.listPresets().find((entry) => entry.id === "bloss").origin, "built-in");
	const spec = service.getPresetSpec("my_quintic");
	assert.equal(spec.meta.origin, "user");
	assert.deepEqual(spec.descriptor.normLengthPartition, [0.5, 0, 0.5]);
	// Same function as the built-in Watorek polynomial -> same curve.
	const mine = service.evaluateCoupling({ presetId: "my_quintic", epsilon: 0, count: 41 }).samples.map((s) => s.curvature);
	const watorek = service.evaluateCoupling({ presetId: "watorek", epsilon: 0, count: 41 }).samples.map((s) => s.curvature);
	mine.forEach((value, index) => assert.ok(Math.abs(value - watorek[index]) < 1e-9, `sample ${index}`));
	const catalogue = service.getCatalogue();
	assert.deepEqual(catalogue.userLibrary, { simpleFcn: ["MY_QUINTIC"], protoFcn: ["PROTO_MY_QUINTIC"], halfWave: ["HW_MY_QUINTIC"], transition: ["my_quintic"] });
	assert.equal(catalogue.records.transition.find((r) => r.id === "my_quintic").origin, "user");
	assert.equal(catalogue.records.simpleFcn.find((r) => r.id === "BLOSS").origin, "built-in");
});

test("built-in records are immutable and the injected catalogue is never changed", () => {
	const service = make();
	createQuintic(service);
	assert.equal(service.putUserRecord({ level: "simpleFcn", id: "BLOSS", value: QUINTIC }).code, "USER_LIBRARY_BUILT_IN_IMMUTABLE");
	assert.equal(service.putUserRecord({ level: "transition", id: "bloss", value: { halfWave1: "HW_CLOTHO", halfWave2: "HW_CLOTHO", normLengthPartition: [0, 1, 0] } }).code, "USER_LIBRARY_BUILT_IN_IMMUTABLE");
	assert.equal(service.removeUserRecord({ level: "halfWave", id: "HW_BLOSS" }).code, "USER_LIBRARY_BUILT_IN_IMMUTABLE");
	assert.equal(JSON.stringify(builtIn), pristine);
});

test("broken creations are rejected with a reason and leave the library unchanged", () => {
	const service = make();
	const cases = [
		[{ level: "simpleFcn", id: "9bad", value: QUINTIC }, "USER_LIBRARY_ID_INVALID"],
		[{ level: "transition", id: "MyUpper", value: { halfWave1: "HW_BLOSS", halfWave2: "HW_BLOSS", normLengthPartition: [0.5, 0, 0.5] } }, "USER_LIBRARY_ID_INVALID"],
		[{ level: "constant", id: "MY_C", value: { op: "const", value: 2 } }, "USER_LIBRARY_LEVEL_UNKNOWN"],
		[{ level: "simpleFcn", id: "MY_BAD", value: { op: "tan" } }, "USER_LIBRARY_STRUCTURE_INVALID"],
		[{ level: "protoFcn", id: "PROTO_MY_BAD", value: { op: "ref", id: "NOPE", crop: [0, 1] } }, "USER_LIBRARY_REFERENCE_MISSING"],
		[{ level: "halfWave", id: "HW_MY_BAD", value: { proto: "PROTO_NOPE", source: "kappa" } }, "USER_LIBRARY_STRUCTURE_INVALID"],
		[{ level: "halfWave", id: "HW_MY_BAD", value: { proto: "PROTO_BLOSS", source: "kappa", quantity: "speed" } }, "USER_LIBRARY_QUANTITY_INVALID"],
		[{ level: "transition", id: "my_bad", value: { halfWave1: "HW_BLOSS", halfWave2: "HW_NOPE", normLengthPartition: [0.5, 0, 0.5] } }, "USER_LIBRARY_STRUCTURE_INVALID"],
		[{ level: "transition", id: "my_bad", value: { halfWave1: "HW_BLOSS", halfWave2: "HW_BLOSS", normLengthPartition: [0.5, 0.1, 0.5] } }, "TRANSITION_PARTITION_INVALID"],
	];
	for (const [payload, code] of cases) {
		const result = service.putUserRecord(payload);
		assert.equal(result.ok, false, JSON.stringify(payload));
		assert.equal(result.code, code, `${JSON.stringify(payload)} -> ${result.reason}`);
		assert.ok(result.reason.length > 0);
	}
	assert.deepEqual(service.exportUserLibrary().simpleFcn, {});
	assert.equal(service.listPresets().length, Object.keys(builtIn.transition).length);
});

test("a halfWave that cannot serve as one is rejected before use", () => {
	const service = make();
	// A constant has no rise from 0 to 1.
	assert.equal(service.putUserRecord({ level: "protoFcn", id: "PROTO_MY_FLAT", value: { op: "ref", id: "CONST1", crop: [0, 1] } }).ok, true);
	const result = service.putUserRecord({ level: "halfWave", id: "HW_MY_FLAT", value: { proto: "PROTO_MY_FLAT", source: "kappa" } });
	assert.equal(result.code, "USER_LIBRARY_HALFWAVE_UNSUITABLE");
	assert.match(result.reason, /HW_MY_FLAT/);
	assert.deepEqual(service.exportUserLibrary().halfWave, {});
});

test("records in use cannot be removed; removal works top-down", () => {
	const service = make();
	createQuintic(service);
	assert.equal(service.removeUserRecord({ level: "simpleFcn", id: "MY_QUINTIC" }).code, "USER_LIBRARY_RECORD_IN_USE");
	assert.equal(service.removeUserRecord({ level: "protoFcn", id: "PROTO_MY_QUINTIC" }).code, "USER_LIBRARY_RECORD_IN_USE");
	assert.equal(service.removeUserRecord({ level: "halfWave", id: "HW_MY_QUINTIC" }).code, "USER_LIBRARY_RECORD_IN_USE");
	assert.equal(service.removeUserRecord({ level: "halfWave", id: "HW_NOPE" }).code, "USER_LIBRARY_RECORD_UNKNOWN");
	for (const [level, id] of [["transition", "my_quintic"], ["halfWave", "HW_MY_QUINTIC"], ["protoFcn", "PROTO_MY_QUINTIC"], ["simpleFcn", "MY_QUINTIC"]]) {
		assert.equal(service.removeUserRecord({ level, id }).status, "removed");
	}
	assert.throws(() => service.getPresetSpec("my_quintic"));
});

test("changing a function re-validates everything built on it", () => {
	const service = make();
	createQuintic(service);
	const before = service.evaluateCoupling({ presetId: "my_quintic", epsilon: 0, count: 5 }).samples[1].curvature;
	// Still a valid rise: the Bloss cubic.
	assert.equal(service.putUserRecord({ level: "simpleFcn", id: "MY_QUINTIC", value: { op: "poly", coeff: [0, 0, 3, -2] } }).status, "updated");
	const after = service.evaluateCoupling({ presetId: "my_quintic", epsilon: 0, count: 5 }).samples[1].curvature;
	assert.notEqual(before, after);
	// A constant would break the halfWave built on it -> refused, old state kept.
	const refused = service.putUserRecord({ level: "simpleFcn", id: "MY_QUINTIC", value: { op: "poly", coeff: [1] } });
	assert.equal(refused.code, "USER_LIBRARY_HALFWAVE_UNSUITABLE");
	assert.equal(service.evaluateCoupling({ presetId: "my_quintic", epsilon: 0, count: 5 }).samples[1].curvature, after);
});

test("a library file travels to another AIM user", () => {
	const author = make();
	createQuintic(author);
	const file = JSON.parse(JSON.stringify(author.exportUserLibrary()));
	assert.equal(file.schema.kind, USER_LIBRARY_KIND);
	assert.equal(file.schema.name, builtIn.schema.name);
	assert.deepEqual(Object.keys(file.transition), ["my_quintic"]);
	assert.equal(Object.keys(file.simpleFcn).length, 1, "only the user's own records are exported");

	const reader = make();
	const imported = reader.importUserLibrary(file);
	assert.equal(imported.ok, true);
	assert.deepEqual(imported.imported, ["simpleFcn.MY_QUINTIC", "protoFcn.PROTO_MY_QUINTIC", "halfWave.HW_MY_QUINTIC", "transition.my_quintic"]);
	assert.deepEqual(reader.exportUserLibrary(), author.exportUserLibrary());
	assert.equal(reader.importUserLibrary(file).changed, false, "importing the same file twice changes nothing");

	const conflicting = structuredClone(file);
	conflicting.simpleFcn.MY_QUINTIC = { op: "poly", coeff: [0, 0, 3, -2] };
	assert.equal(reader.importUserLibrary(conflicting).code, "USER_LIBRARY_RECORD_EXISTS");
	assert.equal(reader.importUserLibrary(conflicting, { replace: true }).ok, true);

	const broken = structuredClone(file);
	broken.halfWave.HW_OTHER = { proto: "PROTO_NOPE", source: "kappa" };
	broken.transition.other_one = { halfWave1: "HW_BLOSS", halfWave2: "HW_BLOSS", normLengthPartition: [0.5, 0, 0.5] };
	const fresh = make();
	assert.equal(fresh.importUserLibrary(broken).ok, false);
	assert.deepEqual(fresh.exportUserLibrary().transition, {}, "a broken file is imported not at all");

	assert.equal(make({ userLibrary: file }).listPresets().some((entry) => entry.id === "my_quintic"), true);
});

test("working copies survive changes to the user library", () => {
	const service = make();
	assert.equal(service.updateWorkingCopy({ presetId: "bloss", normLengthPartition: [0.2, 0.6, 0.2] }).ok, true);
	createQuintic(service);
	assert.deepEqual(service.getPresetSpec("bloss").descriptor.normLengthPartition, [0.2, 0.6, 0.2]);
	assert.equal(service.getPresetSpec("bloss").meta.status, "working-copy");
	service.resetWorkingCopy({ presetId: "bloss" });
	service.removeUserRecord({ level: "transition", id: "my_quintic" });
	assert.deepEqual(service.getPresetSpec("bloss").descriptor.normLengthPartition, [0.5, 0, 0.5]);
});

test("the user declares a creation as curvature or as cant", () => {
	assert.deepEqual(HALFWAVE_QUANTITIES, ["curvature", "cant"]);
	const asCurvature = make();
	createQuintic(asCurvature);
	const asCant = make();
	assert.ok(createQuintic(asCant, { quantity: "cant" }).every((r) => r.ok));
	assert.equal(asCant.getPresetSpec("my_quintic").meta.quantity, "cant");

	const eps = 0.134;
	const fromCurvature = asCurvature.evaluateCoupling({ presetId: "my_quintic", epsilon: eps });
	assert.equal(fromCurvature.given, "curvature");
	assert.equal(fromCurvature.derived, "cant");
	assert.equal(fromCurvature.suitability.suitable, false, "an immediately rising curvature gives a ramp with kinked ends");
	assert.ok(fromCurvature.endSlopes.start > 0.3);
	assert.ok(Math.abs(fromCurvature.curvatureRange.min) < 1e-12);

	const fromCant = asCant.evaluateCoupling({ presetId: "my_quintic", epsilon: eps });
	assert.equal(fromCant.given, "cant");
	assert.equal(fromCant.derived, "curvature");
	assert.equal(fromCant.suitability.suitable, true, "the declared ramp runs in tangentially");
	assert.ok(fromCant.curvatureRange.min < -0.01, "the track curvature shows the counter-swerve");
	assert.ok(fromCant.curvatureRange.max > 1.01);

	// A transition mixing both quantities is refused.
	assert.equal(asCant.putUserRecord({ level: "transition", id: "my_mixed", value: { halfWave1: "HW_MY_QUINTIC", halfWave2: "HW_BLOSS", normLengthPartition: [0.5, 0, 0.5] } }).code, "USER_LIBRARY_QUANTITY_MIXED");
});

test("the default coupling assumption is reported with the result", () => {
	const result = make().evaluateCoupling({ presetId: "bloss" });
	assert.deepEqual(result.assumption, { referenceHeight: 1.8, endCant: 0.15, railBase: 1.5, radius: 1000, length: 100 });
	assert.ok(Math.abs(result.epsilon - Math.sqrt(0.018)) < 1e-12);
	assert.equal(make().evaluateCoupling({ presetId: "bloss", assumption: { length: 200 } }).epsilon, result.epsilon / 2);
	assert.equal(make().evaluateCoupling({ presetId: "bloss", epsilon: 0.2 }).assumption, null);
});

test("the library stays outside the frozen core and off browser, messaging and storage", async () => {
	const staticSpecifiers = (source) => [...source.matchAll(/(?:import|export)\s+(?:[^"'()]*?\s+from\s+)?["']([^"']+)["']/g)].map((match) => match[1]);
	const service = await readFile(new URL("src/services/transition-library/createTransitionLibraryService.js", ROOT), "utf8");
	const coupling = await readFile(new URL("src/services/transition-library/cantCurvatureCoupling.js", ROOT), "utf8");
	assert.deepEqual(staticSpecifiers(service), [
		"../../aim-core/transition/registry/RegistryResolver.js",
		"../../aim-core/transition/query/createTransitionQueryService.js",
		"../../aim-core/transition/runtime/KappaFcnBuilder.js",
		"../../domain/transition/registry/validator.js",
		"./cantCurvatureCoupling.js",
	]);
	assert.deepEqual(staticSpecifiers(coupling), []);
	for (const source of [service, coupling]) assert.doesNotMatch(source, /\.json|window|document|Worker|localStorage|indexedDB|sendCmd/);
	const barrel = await import("../../../src/services/transition-library/index.js");
	assert.deepEqual(Object.keys(barrel).sort(), ["DEFAULT_COUPLING_ASSUMPTION", "DEFAULT_END_SLOPE_TOLERANCE", "HALFWAVE_QUANTITIES", "USER_LIBRARY_KIND", "USER_LIBRARY_LEVELS", "assessCouplingSuitability", "cantFromCurvature", "couplingEpsilon", "createTransitionLibraryService", "curvatureFromCant"]);
});
