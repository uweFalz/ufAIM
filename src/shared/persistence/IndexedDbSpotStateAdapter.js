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
		this.database = null;
	}

	async load() {
		return this.withConnectionRetry(async (database) => {
			const value = await runRequest(
				database
					.transaction(this.storeName, "readonly")
					.objectStore(this.storeName)
					.get(STATE_KEY)
			);
			return value == null ? null : structuredClone(value);
		});
	}

	async save(state) {
		const snapshot = structuredClone(state);
		return this.withConnectionRetry(async (database) => {
			const transaction = database.transaction(this.storeName, "readwrite");
			const request = transaction.objectStore(this.storeName).put(snapshot, STATE_KEY);
			await Promise.all([runRequest(request), runTransaction(transaction)]);
			return structuredClone(snapshot);
		});
	}

	open() {
		if (!this.databasePromise) {
			const opening = new Promise((resolve, reject) => {
				const request = this.indexedDB.open(this.dbName, 1);
				request.onupgradeneeded = () => {
					const database = request.result;
					if (!database.objectStoreNames.contains(this.storeName)) {
						database.createObjectStore(this.storeName);
					}
				};
				request.onsuccess = () => {
					const database = request.result;
					this.database = database;
					const release = () => this.releaseDatabase(database);
					database.onclose = release;
					database.onversionchange = () => {
						database.close?.();
						release();
					};
					resolve(database);
				};
				request.onerror = () => reject(request.error ?? new Error("IndexedDbSpotStateAdapter: database open failed"));
				request.onblocked = () => reject(new Error("IndexedDbSpotStateAdapter: database open blocked"));
			});
			this.databasePromise = opening;
			opening.catch(() => {
				if (this.databasePromise === opening) this.databasePromise = null;
			});
		}
		return this.databasePromise;
	}

	async withConnectionRetry(operation) {
		for (let attempt = 0; attempt < 2; attempt += 1) {
			const database = await this.open();
			try {
				return await operation(database);
			} catch (error) {
				if (attempt > 0 || !isRetryableConnectionError(error)) throw error;
				this.releaseDatabase(database);
			}
		}
		throw new Error("IndexedDbSpotStateAdapter: connection retry exhausted");
	}

	releaseDatabase(database) {
		if (database !== this.database) return;
		this.database = null;
		this.databasePromise = null;
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

function isRetryableConnectionError(error) {
	const name = String(error?.name ?? "");
	const message = String(error?.message ?? error ?? "").toLowerCase();
	return name === "InvalidStateError" || name === "AbortError" || message.includes("connection is closing") || message.includes("transaction was aborted");
}

export const INDEXED_DB_SPOT_STATE_SCHEMA = Object.freeze({
	database: DEFAULT_DB_NAME,
	store: DEFAULT_STORE_NAME,
	key: STATE_KEY,
	version: 1,
});
