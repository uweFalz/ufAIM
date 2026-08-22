import assert from "node:assert/strict";
import test from "node:test";

import transitionLookup from "../../../src/domain/transition/transitionLookup.json" with { type: "json" };
import { RegistryResolver } from "../../../src/aim-core/transition/registry/RegistryResolver.js";
import { TransitionCatalogueAdapter } from "../../../src/services/transition/TransitionCatalogueAdapter.js";

test("concrete catalogue adapter delegates to one canonical resolver authority", () => {
	const adapter = new TransitionCatalogueAdapter();
	assert.ok(adapter.resolver instanceof RegistryResolver);
	assert.strictEqual(adapter.catalogue, transitionLookup);
	assert.deepEqual(adapter.listTransitionIds(), adapter.resolver.listTransitionIds());
	assert.strictEqual(
		adapter.resolveTransitionDescriptor("bloss"),
		adapter.resolver.resolveTransitionDescriptor("bloss")
	);
	assert.strictEqual(
		adapter.resolveVersionedTransitionRecord("bloss"),
		adapter.resolver.resolveVersionedTransitionRecord("bloss")
	);
});

test("catalogue identity provenance validation and unknown errors are retained", () => {
	const adapter = new TransitionCatalogueAdapter();
	const record = adapter.resolveVersionedTransitionRecord("bloss");

	assert.equal(record.provenance.sourceFile, "src/domain/transition/transitionLookup.json");
	assert.strictEqual(
		adapter.getVersionedRegistry(),
		adapter.resolver.getVersionedRegistry()
	);
	assert.strictEqual(
		adapter.getVersionedValidationReport(),
		adapter.resolver.getVersionedValidationReport()
	);
	assert.equal(adapter.getVersionedValidationReport().ok, true);
	assert.throws(
		() => adapter.resolveVersionedTransitionRecord("missing"),
		/RegistryResolver: unknown transition "missing"/
	);
});

test("an injected catalogue and Resolver remain explicit adapter dependencies", () => {
	const calls = [];
	class ResolverDouble {
		constructor(catalogue) {
			calls.push(catalogue);
		}
		listTransitionIds() { return []; }
		getTransitionMeta() { return null; }
		resolveTransitionDescriptor() { return null; }
		resolveVersionedTransitionRecord() { return null; }
		getVersionedRegistry() { return null; }
		getVersionedValidationReport() { return null; }
	}
	const catalogue = { transition: {} };
	const adapter = new TransitionCatalogueAdapter({
		catalogue,
		Resolver: ResolverDouble,
	});

	assert.strictEqual(adapter.catalogue, catalogue);
	assert.deepEqual(calls, [catalogue]);
});
