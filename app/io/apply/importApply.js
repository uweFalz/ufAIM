// app/io/apply/importApply.js
//
// Import apply orchestration.
//
// Responsible ONLY for:
// - registry apply orchestration
// - optional preview quickhook mirror
// - optional props effect emission
// - batch wrapper for ingest results
//
// deliberately NO:
// - parser logic
// - format-specific logic
// - preview artifact construction
// - routeProject mutation details
//
// note:
// preview quickhook mirroring still lives here temporarily.
// later this should move into controller/runtime focus-sync.

import { ensureImportStoreShape } from "./importStoreShape.js";
import { applyImportRegistry } from "./importRegistryApply.js";
import {
	applyImportPreview,
	getActiveArtifactIds,
	mirrorImportPreview,
} from "./importPreviewApply.js";

// Re-export for convenience / compatibility.
export { getActiveArtifactIds };

export function applyImportToProject({
	store,
	baseId,
	slot = "right",
	source = null,
	artifacts = [],
	ui,
	emitProps = false,
} = {}) {
	if (!store?.getState || !store?.setState) {
		return [{ type: "log", level: "error", message: "importApply: missing store" }];
	}

	if (!baseId) {
		return [{ type: "log", level: "error", message: "importApply: missing baseId" }];
	}

	const prev = ensureImportStoreShape(store.getState());

	const { patch, effects: registryEffects } = applyImportRegistry({
		state: prev,
		baseId,
		slot,
		source,
		artifacts,
	});

	const nextBaseState = ensureImportStoreShape({
		...store.getState(),
		...patch,
	});

	// TEMP:
	// quick preview hooks still mirrored into state here
	const previewPatch = applyImportPreview(nextBaseState);

	store.setState({
		...patch,
		...previewPatch,
	});

	const effects = [...registryEffects];

	if (emitProps) {
		const finalState = ensureImportStoreShape(store.getState());

		effects.push({
			type: "props",
			object: {
				active: finalState.activeRouteProjectId,
				base: baseId,
				slot,
				activeArtifacts: finalState.import_activeArtifacts ?? null,
				artifactCount: Object.keys(finalState.artifacts ?? {}).length,
				rpCount: Object.keys(finalState.routeProjects ?? {}).length,
			},
		});
	}

	return effects;
}

export function mirrorQuickHooksFromActive({ getState, setState } = {}) {
	mirrorImportPreview({ getState, setState });
}

// single entry wrapper for controllers
export function applyIngestResult({ store, ui, ingest, emitProps } = {}) {
	if (!store?.getState || !store?.setState || !ingest) {
		return [{ type: "log", level: "error", message: "applyIngestResult: missing store/ingest" }];
	}

	const ingests = Array.isArray(ingest?.ingests)
		? ingest.ingests
		: [ingest].filter(Boolean);

	const effects = [];

	for (const one of ingests) {
		effects.push(
			...applyImportToProject({
				store,
				baseId: one.baseId,
				slot: one.slot,
				source: one.source,
				artifacts: one.artifacts,
				ui,
				emitProps: Boolean(emitProps),
			})
		);
	}

	return effects;
}
