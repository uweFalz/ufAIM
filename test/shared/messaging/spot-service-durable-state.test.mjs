import assert from "node:assert/strict";
import test from "node:test";

import { createSpotStore } from "../../../src/model/spot/model/SpotStore.js";
import { createSpotService } from "../../../src/shared/messaging/service/SpotService.js";

function fixture({ restored = null, failSave = false } = {}) {
	const events = [];
	const saves = [];
	const persistence = {
		async load() { return structuredClone(restored); },
		async save(state) {
			if (failSave) throw new Error("durable write failed");
			saves.push(structuredClone(state));
		},
	};
	const service = createSpotService({
		spotStore: createSpotStore(),
		persistence,
		router: { emitEvt(name, payload) { events.push({ name, payload }); } },
	});
	return { service, events, saves };
}

const A1 = {
	id: "A1",
	type: "alignment",
	data: { name: "One", alignmentData: { id: "A1", name: "One" } },
	refs: {},
	meta: { modifiedAt: "r1" },
};

test("hydrates complete state before the first command-facing read", async () => {
	const restored = {
		meta: { revision: 4 },
		objects: { A1 },
		coordContexts: { C1: { id: "C1", type: "local" } },
	};
	const { service } = fixture({ restored });
	const hydrated = await service.hydrate();
	assert.equal(hydrated.meta.revision, 4);
	assert.equal(hydrated.objects.A1.id, "A1");
	assert.equal(hydrated.objects.A1.meta.modifiedAt, "r1");
	assert.equal(hydrated.coordContexts.C1.id, "C1");
	assert.deepEqual(service.getState(), hydrated);
});

test("add exact-ID update rename and remove persist canonical snapshots", async () => {
	const { service, saves, events } = fixture();
	await service.hydrate();
	await service.addObjects({ objects: [A1] });
	await service.addObjects({ objects: [{ ...A1, data: { ...A1.data, revision: 2 }, meta: { modifiedAt: "r2" } }] });
	assert.deepEqual(Object.keys(service.getState().objects), ["A1"]);
	assert.equal(service.getState().objects.A1.meta.modifiedAt, "r2");
	await service.renameObject({ objectId: "A1", name: "Renamed" });
	assert.equal(service.getState().objects.A1.data.alignmentData.name, "Renamed");
	await service.removeObject({ objectId: "A1" });
	assert.deepEqual(service.getState().objects, {});
	assert.equal(saves.length, 4);
	assert.equal(events.length, 4);
});

test("persistence failure rolls memory back and emits no success state", async () => {
	const { service, events } = fixture({ restored: { meta: {}, objects: { A1 }, coordContexts: {} }, failSave: true });
	await service.hydrate();
	const before = service.getState();
	await assert.rejects(service.addObjects({ objects: [{ ...A1, meta: { modifiedAt: "r2" } }] }), /durable write failed/);
	assert.deepEqual(service.getState(), before);
	assert.deepEqual(events, []);
});

test("hydration failure remains terminal and does not fabricate empty state", async () => {
	const store = createSpotStore();
	const service = createSpotService({
		spotStore: store,
		persistence: {
			async load() { throw new Error("hydrate failed"); },
			async save() {},
		},
	});
	await assert.rejects(service.hydrate(), /hydrate failed/);
	await assert.rejects(service.addObjects({ objects: [A1] }), /hydrate failed/);
	assert.deepEqual(store.getState().objects, {});
});
