import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test from "node:test";

const rootUrl = new URL("../../../", import.meta.url);
registerHooks({
	resolve(specifier, context, nextResolve) {
		const aliases = {
			"@src/": "src/",
			"@spot/": "src/model/spot/",
		};
		for (const [prefix, target] of Object.entries(aliases)) {
			if (specifier.startsWith(prefix)) {
				return nextResolve(
					new URL(target + specifier.slice(prefix.length), rootUrl).href,
					context
				);
			}
		}
		return nextResolve(specifier, context);
	},
});

const { SpotGateway } = await import(
	"../../../src/services/alignment/SpotGateway.js"
);
const { SpotAlignmentRepositoryAdapter } = await import(
	"../../../src/services/alignment/SpotAlignmentRepositoryAdapter.js"
);
const { AlignmentMapper } = await import(
	"../../../src/model/spot/model/AlignmentSpotObjectMapper.js"
);

function alignmentObject({
	id = "alignment-1",
	revision = "2026-07-28T00:00:00.001Z",
	curvature = 0.004,
} = {}) {
	const alignmentData = {
		type: "AlignmentData",
		id,
		name: "Acknowledged",
		source: { kind: "native", native: true },
		editModel: {
			startPose: { p: { x: 0, y: 0 }, t: { x: 1, y: 0 } },
			elements: [{
				id: "arc-1",
				type: "arc",
				parameters: { length: 100, curvature },
			}],
		},
		sparseAlignment: {
			startPose: { p: { x: 0, y: 0 }, t: { x: 1, y: 0 } },
			sparse: [{ id: "arc-1", type: "fixed", arcLength: 100, curvature }],
		},
		meta: { modifiedAt: revision, dirty: true },
	};
	return {
		type: "alignment",
		id,
		data: {
			name: alignmentData.name,
			alignmentData,
			kernel: alignmentData.sparseAlignment,
			extended: {},
		},
		refs: {},
		meta: { modifiedAt: revision },
	};
}

function gatewayFixture({ acknowledge = true, canonicalTransform = null } = {}) {
	let state = { objects: {} };
	let addCount = 0;
	const messaging = {
		async sendCmdAwait(command, payload) {
			if (command === "Spot.AddObjects") {
				addCount += 1;
				if (acknowledge) {
					const requested = structuredClone(payload.objects[0]);
					const stored = canonicalTransform
						? canonicalTransform(requested)
						: requested;
					state.objects[stored.id] = stored;
				}
				return { ok: true };
			}
			if (command === "Spot.GetState") {
				return { state: structuredClone(state) };
			}
			throw new Error(`unexpected command ${command}`);
		},
	};
	const store = {
		getState: () => ({ workspace_selection: {} }),
		actions: {},
	};
	return {
		gateway: new SpotGateway({ store, messaging }),
		setObject(object) {
			state.objects[object.id] = structuredClone(object);
		},
		get addCount() {
			return addCount;
		},
	};
}

test("SpotGateway returns only canonical read-after-write state", async () => {
	const fixture = gatewayFixture({
		canonicalTransform(requested) {
			return {
				...requested,
				meta: { ...requested.meta, canonical: true },
			};
		},
	});
	const requested = alignmentObject();
	const saved = await fixture.gateway.saveObject(requested);

	assert.equal(fixture.addCount, 1);
	assert.notStrictEqual(saved.spotObject, requested);
	assert.equal(saved.spotObject.meta.canonical, true);
	assert.deepEqual(saved.spotObject.data.alignmentData, requested.data.alignmentData);
});

test("SpotGateway rejects missing, wrong-identity and stale Alignment acknowledgements", async () => {
	const missing = gatewayFixture({ acknowledge: false });
	await assert.rejects(
		() => missing.gateway.saveObject(alignmentObject()),
		/persisted object acknowledgement missing/
	);

	const wrongIdentity = gatewayFixture({
		canonicalTransform(requested) {
			return { ...requested, id: "other-alignment" };
		},
	});
	await assert.rejects(
		() => wrongIdentity.gateway.saveObject(alignmentObject()),
		/persisted object acknowledgement missing/
	);

	const stale = gatewayFixture({
		canonicalTransform(requested) {
			const stored = structuredClone(requested);
			stored.data.alignmentData.editModel.elements[0].parameters.curvature = 0.002;
			return stored;
		},
	});
	await assert.rejects(
		() => stale.gateway.saveObject(alignmentObject()),
		/persisted Alignment acknowledgement mismatch/
	);
});

test("repository returns verified mapper readback and rejects stale state", async () => {
	const mapper = new AlignmentMapper();
	const fixture = gatewayFixture();
	const original = alignmentObject({
		revision: "2026-07-28T00:00:00.000Z",
		curvature: 0.002,
	});
	fixture.setObject(original);
	const repository = new SpotAlignmentRepositoryAdapter({
		spotGateway: fixture.gateway,
		mapper,
	});
	const loaded = await repository.loadById(original.id);
	const requested = structuredClone(loaded);
	requested.editModel.elements[0].parameters.curvature = 0.004;
	requested.sparseAlignment.sparse[0].curvature = 0.004;
	requested.meta.modifiedAt = "2026-07-28T00:00:00.001Z";

	const stored = await repository.saveById(original.id, requested);
	assert.deepEqual(stored, requested);
	assert.notStrictEqual(stored, requested);
	assert.equal(fixture.addCount, 1);

	const staleGateway = {
		async getObjectById() {
			return structuredClone(original);
		},
		async saveObject() {
			return { spotObject: structuredClone(original) };
		},
	};
	const staleRepository = new SpotAlignmentRepositoryAdapter({
		spotGateway: staleGateway,
		mapper,
	});
	await assert.rejects(
		() => staleRepository.saveById(original.id, requested),
		/persisted Alignment state mismatch/
	);
});
