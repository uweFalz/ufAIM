// src/alignment/registry/RegistryResolver.js

import transitionLookup from "@src/alignment/transition/transitionLookup.json" with { type:"json" };

export class RegistryResolver {
	constructor(db = transitionLookup) {
		this.db = db;
		this._cache = new Map();
	}

	listTransitionIds() {
		return Object.keys(this.db?.transition ?? {});
	}

	getTransitionMeta(id) {
		const key = String(id ?? "").toLowerCase();
		const tr = this.db?.transition?.[key];
		if (!tr) return null;

		return {
			id: key,
			label: tr.label ?? key,
		};
	}

	resolveTransitionDescriptor(transType) {
		const key = String(transType ?? "").toLowerCase();
		const cacheKey = `D:${key}`;
		if (this._cache.has(cacheKey)) return this._cache.get(cacheKey);

		const db = this.db;
		const tr = db?.transition?.[key];
		if (!tr) {
			throw new Error(`RegistryResolver: unknown transition "${key}"`);
		}

		const hw1Id = tr.halfWave1;
		const hw2Id = tr.halfWave2;
		if (!hw1Id || !hw2Id) {
			throw new Error(`RegistryResolver: transition "${key}" missing halfWave1/2`);
		}

		const hw1 = db?.halfWave?.[hw1Id];
		const hw2 = db?.halfWave?.[hw2Id];
		if (!hw1 || !hw2) {
			throw new Error(`RegistryResolver: missing halfWave def for transition "${key}"`);
		}

		const proto1 = db?.protoFcn?.[hw1.proto];
		const proto2 = db?.protoFcn?.[hw2.proto];
		const protoCore = db?.protoFcn?.clothoCore;

		if (!proto1) throw new Error(`RegistryResolver: missing protoFcn "${hw1.proto}"`);
		if (!proto2) throw new Error(`RegistryResolver: missing protoFcn "${hw2.proto}"`);
		if (!protoCore) throw new Error(`RegistryResolver: missing protoFcn "clothoCore"`);

		const out = {
			id: key,
			label: tr.label ?? key,

			normLengthPartition: tr.normLengthPartition ?? [0, 1, 0],

			halfWave1: {
				id: hw1Id,
				protoId: hw1.proto,
				protoDef: proto1,
				source: hw1.source ?? "kappa",
			},

			halfWave2: {
				id: hw2Id,
				protoId: hw2.proto,
				protoDef: proto2,
				source: hw2.source ?? "kappa",
			},

			core: {
				id: "clothoCore",
				protoId: "clothoCore",
				protoDef: protoCore,
				source: "kappa",
			},

			simpleFcn: db?.simpleFcn ?? {},

			meta: {
				kind: "transitionDescriptor",
			},
		};

		this._cache.set(cacheKey, out);
		return out;
	}

	// optional compat alias for UI callers
	resolvePresetDescriptor(presetId) {
		return this.resolveTransitionDescriptor(presetId);
	}
}
