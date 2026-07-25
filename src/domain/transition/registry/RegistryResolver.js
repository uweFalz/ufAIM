// src/domain/transition/registry/RegistryResolver.js

import transitionLookup from "../transitionLookup.json" with { type:"json" };
import {
	upgradeLegacyTransitionLookup,
	toLegacyTransitionDescriptor,
	validateVersionedTransitionRegistry,
} from "../versioned/index.js";

export class RegistryResolver {
	constructor(db = transitionLookup) {
		this.db = db;
		this.versionedRegistry = upgradeLegacyTransitionLookup(db);
		this.versionedValidation = validateVersionedTransitionRegistry({
			versionedRegistry: this.versionedRegistry,
			legacyDb: this.db,
		});
		this._cache = new Map();
	}

	listTransitionIds() {
		return Object.keys(this.versionedRegistry?.records?.transition ?? {});
	}

	getTransitionMeta(id) {
		const key = String(id ?? "").toLowerCase();
		const tr = this.versionedRegistry?.records?.transition?.[key];
		if (!tr) return null;

		return {
			id: key,
			label: tr.label ?? key,
			kind: tr.kind ?? "transition",
			schemaVersion: tr.schemaVersion ?? null,
		};
	}

	resolveTransitionDescriptor(transType) {
		const key = String(transType ?? "").toLowerCase();
		const cacheKey = `D:${key}`;
		if (this._cache.has(cacheKey)) return this._cache.get(cacheKey);

		const transitionRecord = this.versionedRegistry?.records?.transition?.[key];
		if (!transitionRecord) {
			throw new Error(`RegistryResolver: unknown transition "${key}"`);
		}

		const out = toLegacyTransitionDescriptor({
			legacyDb: this.db,
			versionedTransitionId: key,
		});

		out.meta = {
			...(out.meta ?? {}),
			kind: "transitionDescriptor",
			schemaVersion: transitionRecord.schemaVersion,
			berlinishComposition: transitionRecord.componentOrdering,
		};

		this._cache.set(cacheKey, out);
		return out;
	}

	resolveVersionedTransitionRecord(transType) {
		const key = String(transType ?? "").toLowerCase();
		const tr = this.versionedRegistry?.records?.transition?.[key];
		if (!tr) {
			throw new Error(`RegistryResolver: unknown transition "${key}"`);
		}
		return tr;
	}

	getVersionedRegistry() {
		return this.versionedRegistry;
	}

	getVersionedValidationReport() {
		return this.versionedValidation;
	}

	// optional compat alias for UI callers
	resolvePresetDescriptor(presetId) {
		return this.resolveTransitionDescriptor(presetId);
	}
}
