// app/io/apply/importApply.js
// Registry Apply (format-agnostisch)
//
// Input: { baseId, slot, source, artifacts[] }
// Output: store.patch + effects (log/props)
//
// NOTE:
// - Registry / slot apply lives here.
// - Preview quickhooks live in importPreviewApply.js
// - No format-specific parsing logic here.
//
// Ziel später
//
// Wahrscheinlich eine sauberere Aufteilung in:
// 
// import/apply = reine State-/Artifact-Übernahme
// preview/focus sync = controller/runtime responsibility
//
// Also weniger „apply macht alles“.
//

import { applyImportRegistry } from "./importRegistryApply.js";
import {
	applyImportPreview,
	getActiveArtifactIds,
	mirrorImportPreview,
} from "./importPreviewApply.js";

//
function nowIso() {
	return new Date().toISOString();
}

function makeArtifactId({ baseId, slot, domain, kind }) {
	return `${baseId}::${slot}::${domain}::${kind}::${Date.now()}`;
}

function ensureObject(x) {
	return (x && typeof x === "object") ? x : {};
}

function ensureStoreShape(state) {
	const s = ensureObject(state);
	return {
		activeRouteProjectId: s.activeRouteProjectId ?? null,
		activeSlot: s.activeSlot ?? "right",
		cursor: ensureObject(s.cursor),

		routeProjects: ensureObject(s.routeProjects),
		artifacts: ensureObject(s.artifacts),

		import_polyline2d: s.import_polyline2d ?? null,
		import_marker2d: s.import_marker2d ?? null,
		import_profile1d: s.import_profile1d ?? null,
		import_cant1d: s.import_cant1d ?? null,
		import_meta: s.import_meta ?? null,
		import_activeArtifacts: s.import_activeArtifacts ?? null,

		view_pins: Array.isArray(s.view_pins) ? s.view_pins : [],
	};
}

function computeBbox2d(polyline2d) {
	let minX = Infinity;
	let minY = Infinity;
	let maxX = -Infinity;
	let maxY = -Infinity;

	for (const p of (polyline2d ?? [])) {
		const x = Number(p?.x);
		const y = Number(p?.y);
		if (!Number.isFinite(x) || !Number.isFinite(y)) continue;

		if (x < minX) minX = x;
		if (y < minY) minY = y;
		if (x > maxX) maxX = x;
		if (y > maxY) maxY = y;
	}

	if (!Number.isFinite(minX)) return null;
	return { minX, minY, maxX, maxY };
}

function bboxCenter2d(bbox) {
	if (!bbox) return null;

	const cx = (Number(bbox.minX) + Number(bbox.maxX)) * 0.5;
	const cy = (Number(bbox.minY) + Number(bbox.maxY)) * 0.5;

	if (!Number.isFinite(cx) || !Number.isFinite(cy)) return null;
	return { x: cx, y: cy };
}

function pickMarkerFromPolyline(polyline2d) {
	if (!Array.isArray(polyline2d) || polyline2d.length < 1) return null;
	return polyline2d[0];
}

/**
* Normalize + enrich artifact payloads so downstream preview hooks are stable.
* - alignment2d: ensures payload.polyline2d, payload.bbox, payload.bboxCenter
* - profile1d / cant1d: kept as-is for now
*/
function normalizeArtifactPayload({ domain, payload }) {
	const p = ensureObject(payload);

	if (domain === "alignment2d") {
		const polyline2d =
		p.polyline2d ??
		p.pts ??
		p.geometry?.pts ??
		null;

		const bbox = p.bbox ?? computeBbox2d(polyline2d);
		const center = p.bboxCenter ?? bboxCenter2d(bbox) ?? pickMarkerFromPolyline(polyline2d);

		return {
			...p,
			polyline2d,
			bbox,
			bboxCenter: center,
		};
	}

	if (domain === "profile1d") return p;
	if (domain === "cant1d") return p;

	return p;
}

function upsertRouteProject(routeProjects, baseId) {
	const existing = routeProjects[baseId];
	if (existing) return existing;

	const created = {
		id: baseId,
		createdAt: nowIso(),
		updatedAt: nowIso(),

		// minimal 7-line-ready slot scaffold
		slots: {
			right: {},
			left: {},
			km: {},
		},

		meta: {},
	};

	routeProjects[baseId] = created;
	return created;
}

function attachArtifactToSlot({ rp, slot, artifact }) {
	rp.updatedAt = nowIso();

	const s = rp.slots?.[slot] ?? (rp.slots[slot] = {});

	if (artifact.domain === "alignment2d") {
		s.alignmentArtifactId = artifact.id;
	}
	else if (artifact.domain === "profile1d") {
		s.profileArtifactId = artifact.id;
	}
	else if (artifact.domain === "cant1d") {
		s.cantArtifactId = artifact.id;
	}
	else {
		if (!Array.isArray(s.otherArtifactIds)) s.otherArtifactIds = [];
		s.otherArtifactIds.push(artifact.id);
	}

	rp.meta.lastDomain = artifact.domain;
	rp.meta.lastKind = artifact.kind;
}

// Re-export for convenience / compatibility.
export { getActiveArtifactIds };

//
// ...
//
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

	const prev = ensureStoreShape(store.getState());
	const effects = [];

	const { patch, effects: registryEffects } =
	applyImportRegistry({
		state: prev,
		baseId,
		slot,
		source,
		artifacts,
		normalizePayload: normalizeArtifactPayload,
	});

	store.setState(patch);
	/*
	const afterRegistry = ensureStoreShape(store.getState());

	// local preview fallback:
	// if nothing is active yet, activate the just imported route project locally
	if (!afterRegistry.activeRouteProjectId && baseId) {
	store.setState({
	activeRouteProjectId: baseId,
	activeSlot: slot ?? afterRegistry.activeSlot ?? "right",
	});
	}
	*/
	const previewPatch = applyImportPreview(ensureStoreShape(store.getState()));
	store.setState(previewPatch);

	effects.push(...registryEffects);

	if (emitProps) {
		const finalState = ensureStoreShape(store.getState());

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

//
// ...
//
export function mirrorQuickHooksFromActive({ getState, setState } = {}) {
	mirrorImportPreview({ getState, setState });
}

// single entry wrapper for controllers
export function applyIngestResult({ store, ui, ingest, emitProps } = {}) {
	if (!store?.getState || !store?.setState || !ingest) {
		return [{ type: "log", level: "error", message: "applyIngestResult: missing store/ingest" }];
	}

	const ingests = Array.isArray(ingest?.ingests) ? ingest.ingests : [ingest].filter(Boolean);

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
