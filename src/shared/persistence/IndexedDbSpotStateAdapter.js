const DEFAULT_DB_NAME = "ufaim-spot-state-v1";
const DEFAULT_STORE_NAME = "canonical-state-v1";
const STATE_KEY = "spot";

export class IndexedDbSpotStateAdapter {
	constructor({
		indexedDB = globalThis.indexedDB,
		dbName = DEFAULT_DB_NAME,
		storeName = DEFAULT_STORE_NAME,
	} = {}) {
		if (!indexedDB?.open) {
			throw new Error("IndexedDbSpotStateAdapter: IndexedDB is unavailable");
		}
		this.indexedDB = indexedDB;
		this.dbName = String(dbName);
		this.storeName = String(storeName);
		this.databasePromise = null;
	}

	async load() {
		const database = await this.open();
		return runRequest(
			database
				.transaction(this.storeName, "readonly")
				.objectStore(this.storeName)
				.get(STATE_KEY)
		).then((value) => value == null ? null : structuredClone(value));
	}

	async save(state) {
		const snapshot = structuredClone(state);
		const database = await this.open();
		const transaction = database.transaction(this.storeName, "readwrite");
		const request = transaction.objectStore(this.storeName).put(snapshot, STATE_KEY);
		await Promise.all([runRequest(request), runTransaction(transaction)]);
		return structuredClone(snapshot);
	}

	open() {
		if (!this.databasePromise) {
			this.databasePromise = new Promise((resolve, reject) => {
				const request = this.indexedDB.open(this.dbName, 1);
				request.onupgradeneeded = () => {
					const database = request.result;
					if (!database.objectStoreNames.contains(this.storeName)) {
						database.createObjectStore(this.storeName);
					}
				};
				request.onsuccess = () => resolve(request.result);
				request.onerror = () => reject(request.error ?? new Error("IndexedDbSpotStateAdapter: database open failed"));
				request.onblocked = () => reject(new Error("IndexedDbSpotStateAdapter: database open blocked"));
			});
		}
		return this.databasePromise;
	}
}

function runRequest(request) {
	return new Promise((resolve, reject) => {
		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error ?? new Error("IndexedDbSpotStateAdapter: request failed"));
	});
}

function runTransaction(transaction) {
	return new Promise((resolve, reject) => {
		transaction.oncomplete = () => resolve();
		transaction.onerror = () => reject(transaction.error ?? new Error("IndexedDbSpotStateAdapter: transaction failed"));
		transaction.onabort = () => reject(transaction.error ?? new Error("IndexedDbSpotStateAdapter: transaction aborted"));
	});
}

export const INDEXED_DB_SPOT_STATE_SCHEMA = Object.freeze({
	database: DEFAULT_DB_NAME,
	store: DEFAULT_STORE_NAME,
	key: STATE_KEY,
	version: 1,
});
