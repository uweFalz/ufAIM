import assert from "node:assert/strict";
import test from "node:test";

import {
	INDEXED_DB_SPOT_STATE_SCHEMA,
	IndexedDbSpotStateAdapter,
} from "../../../src/shared/persistence/IndexedDbSpotStateAdapter.js";

function fakeIndexedDb({ failWrite = false } = {}) {
	const values = new Map();
	const storeNames = new Set();
	const database = {
		objectStoreNames: { contains: (name) => storeNames.has(name) },
		createObjectStore(name) { storeNames.add(name); },
		transaction() {
			const transaction = {
				error: null,
				objectStore: () => ({
					get(key) { return request(() => values.get(key)); },
					put(value, key) {
						return request(() => {
							if (failWrite) throw new Error("write failed");
							values.set(key, structuredClone(value));
							queueMicrotask(() => transaction.oncomplete?.());
							return key;
						});
					},
				}),
			};
			return transaction;
		},
	};
	return {
		open() {
			const openRequest = {};
			queueMicrotask(() => {
				openRequest.result = database;
				openRequest.onupgradeneeded?.();
				openRequest.onsuccess?.();
			});
			return openRequest;
		},
	};
}

function request(action) {
	const value = {};
	queueMicrotask(() => {
		try {
			value.result = action();
			value.onsuccess?.();
		} catch (error) {
			value.error = error;
			value.onerror?.();
		}
	});
	return value;
}

function reconnectingIndexedDb() {
	const values = new Map();
	const storeNames = new Set();
	let openCount = 0;

	function database({ closeOnSecondTransaction = false } = {}) {
		let transactionCount = 0;
		return {
			objectStoreNames: { contains: (name) => storeNames.has(name) },
			createObjectStore(name) { storeNames.add(name); },
			transaction() {
				transactionCount += 1;
				if (closeOnSecondTransaction && transactionCount === 2) {
					const error = new Error("The database connection is closing.");
					error.name = "InvalidStateError";
					throw error;
				}
				const transaction = {
					error: null,
					objectStore: () => ({
						get(key) { return request(() => values.get(key)); },
						put(value, key) {
							return request(() => {
								values.set(key, structuredClone(value));
								queueMicrotask(() => transaction.oncomplete?.());
								return key;
							});
						},
					}),
				};
				return transaction;
			},
		};
	}

	return {
		indexedDB: {
			open() {
				openCount += 1;
				const current = database({ closeOnSecondTransaction: openCount === 1 });
				const openRequest = {};
				queueMicrotask(() => {
					openRequest.result = current;
					openRequest.onupgradeneeded?.();
					openRequest.onsuccess?.();
				});
				return openRequest;
			},
		},
		get openCount() { return openCount; },
	};
}

test("empty database and full canonical state roundtrip", async () => {
	const adapter = new IndexedDbSpotStateAdapter({ indexedDB: fakeIndexedDb(), dbName: "test-a" });
	assert.equal(await adapter.load(), null);
	const state = {
		meta: { revision: 7 },
		objects: { A: { id: "A", type: "alignment", data: {}, refs: {}, meta: { modifiedAt: "r7" } } },
		coordContexts: { C: { id: "C", type: "local" } },
	};
	await adapter.save(state);
	assert.deepEqual(await adapter.load(), state);
	assert.notStrictEqual(await adapter.load(), state);
});

test("same exact ID replaces one stored snapshot without duplicate authority", async () => {
	const adapter = new IndexedDbSpotStateAdapter({ indexedDB: fakeIndexedDb(), dbName: "test-b" });
	await adapter.save({ meta: {}, coordContexts: {}, objects: { A: { id: "A", type: "alignment", data: { revision: 1 }, refs: {}, meta: {} } } });
	await adapter.save({ meta: { revision: 2 }, coordContexts: {}, objects: { A: { id: "A", type: "alignment", data: { revision: 2 }, refs: {}, meta: { modifiedAt: "r2" } } } });
	const restored = await adapter.load();
	assert.deepEqual(Object.keys(restored.objects), ["A"]);
	assert.equal(restored.objects.A.data.revision, 2);
	assert.equal(restored.objects.A.meta.modifiedAt, "r2");
});

test("transaction failure rejects truthfully without replacing prior state", async () => {
	const adapter = new IndexedDbSpotStateAdapter({ indexedDB: fakeIndexedDb({ failWrite: true }), dbName: "test-c" });
	await assert.rejects(adapter.save({ meta: {}, objects: {}, coordContexts: {} }), /write failed/);
	assert.equal(await adapter.load(), null);
});

test("a closing database connection is reopened once and the exact snapshot is persisted", async () => {
	const fixture = reconnectingIndexedDb();
	const adapter = new IndexedDbSpotStateAdapter({ indexedDB: fixture.indexedDB, dbName: "test-reconnect" });
	assert.equal(await adapter.load(), null);
	const state = { meta: { revision: 1 }, objects: { A: { id: "A", type: "alignment", data: {}, refs: {}, meta: {} } }, coordContexts: {} };
	await adapter.save(state);
	assert.equal(fixture.openCount, 2);
	assert.deepEqual(await adapter.load(), state);
});

test("schema names and version are deliberate and frozen", () => {
	assert.equal(Object.isFrozen(INDEXED_DB_SPOT_STATE_SCHEMA), true);
	assert.deepEqual(Object.keys(INDEXED_DB_SPOT_STATE_SCHEMA), ["database", "store", "key", "version"]);
	assert.equal(INDEXED_DB_SPOT_STATE_SCHEMA.version, 1);
});
