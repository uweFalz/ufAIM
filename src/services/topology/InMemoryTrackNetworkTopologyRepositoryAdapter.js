import {
	assertTrackNetworkTopology,
} from "../../aim-core/alignment/topology/TrackNetworkTopology.js";

import {
	TrackNetworkTopologyRepositoryConflictError,
} from "./TrackNetworkTopologyRepositoryPort.js";

function clone(value) {
	return structuredClone(value);
}

function requireId(value, label) {
	const id = typeof value === "string" ? value.trim() : "";
	if (!id) throw new TypeError(`${label} must be a non-empty string`);
	return id;
}

function requireStoredRevision(value) {
	if (!Number.isSafeInteger(value) || value < 1) {
		throw new TypeError("stored revision must be a positive safe integer");
	}
	return value;
}

function result(record) {
	return {
		topology: clone(record.topology),
		revision: record.revision,
	};
}

export class InMemoryTrackNetworkTopologyRepositoryAdapter {
	#records = new Map();

	constructor({ records = [] } = {}) {
		if (!Array.isArray(records)) {
			throw new TypeError("records must be an array");
		}
		for (const record of records) {
			const topology = assertTrackNetworkTopology(
				record?.topology,
				"stored topology"
			);
			const revision = requireStoredRevision(record?.revision);
			if (this.#records.has(topology.id)) {
				throw new TypeError(`duplicate stored topology ${topology.id}`);
			}
			this.#records.set(topology.id, {
				topology: clone(topology),
				revision,
			});
		}
	}

	async loadById({ topologyId } = {}) {
		const id = requireId(topologyId, "topologyId");
		const record = this.#records.get(id);
		return record ? result(record) : null;
	}

	async saveById({
		topologyId,
		topology,
		expectedRevision,
	} = {}) {
		const id = requireId(topologyId, "topologyId");
		assertTrackNetworkTopology(topology);
		if (topology.id !== id) {
			throw new TypeError("topologyId must equal topology.id");
		}

		const current = this.#records.get(id) ?? null;
		const actualRevision = current?.revision ?? null;
		if (expectedRevision !== actualRevision) {
			throw new TrackNetworkTopologyRepositoryConflictError({
				topologyId: id,
				expectedRevision,
				actualRevision,
			});
		}

		const record = {
			topology: clone(topology),
			revision: (actualRevision ?? 0) + 1,
		};
		this.#records.set(id, record);
		return result(record);
	}

	exportRecords() {
		return [...this.#records.values()].map(result);
	}
}
