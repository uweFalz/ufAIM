import test from "node:test";
import assert from "node:assert/strict";

import transitionLookup from "../../src/domain/transition/transitionLookup.json" with { type: "json" };
import { RegistryResolver } from "../../src/domain/transition/registry/RegistryResolver.js";
import { createTransitionQueryService } from "../../src/aim-core/transition/query/createTransitionQueryService.js";

test("TransitionQueryService preserves catalogue and cuts semantics", () => {
	const resolver = new RegistryResolver(transitionLookup);
	const service = createTransitionQueryService({
		db: transitionLookup,
		registryResolver: resolver,
	});

	const catalogue = service.getCatalogue();
	assert.equal(catalogue.levels.find((x) => x.id === "constant")?.count, 5);
	assert.equal(catalogue.levels.find((x) => x.id === "simpleFcn")?.count, 20);
	assert.equal(catalogue.levels.find((x) => x.id === "protoFcn")?.count, 28);
	assert.equal(catalogue.levels.find((x) => x.id === "halfWave")?.count, 28);
	assert.equal(catalogue.levels.find((x) => x.id === "transition")?.count, 31);

	const bloss = service.getPresetSpec("bloss");
	assert.equal(bloss.cuts01.w1, 0.5);
	assert.equal(bloss.cuts01.w2, 0.5);

	const gubar = service.getPresetSpec("gubar");
	assert.equal(gubar.cuts01.w1, 0.25);
	assert.equal(gubar.cuts01.w2, 0.75);
});

test("TransitionQueryService working-copy semantics remain unchanged", () => {
	const resolver = new RegistryResolver(transitionLookup);
	const service = createTransitionQueryService({
		db: transitionLookup,
		registryResolver: resolver,
	});

	const update = service.updateWorkingCopy({
		presetId: "bloss",
		normLengthPartition: [0.2, 0.6, 0.2],
	});

	assert.equal(update.ok, true);
	assert.equal(update.status, "working-copy");

	const spec = service.getPresetSpec("bloss");
	assert.equal(spec.cuts01.w1, 0.2);
	assert.equal(spec.cuts01.w2, 0.8);

	const reset = service.resetWorkingCopy({ presetId: "bloss" });
	assert.equal(reset.ok, true);
	assert.equal(reset.status, "persisted-read-only");

	const specReset = service.getPresetSpec("bloss");
	assert.equal(specReset.cuts01.w1, 0.5);
	assert.equal(specReset.cuts01.w2, 0.5);
});
