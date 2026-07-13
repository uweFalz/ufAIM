// app/io/import/importRegistryApply.js
//
// Registry mutation layer for import apply.
// Responsible ONLY for:
//  - routeProject creation
//  - artifact registration
//  - slot attachment
//  - patch generation
//
// No preview logic, no UI logic.

import { nowIso, ensureObject } from "@app/utils/appHelpers.js";
import { getWorkspaceSelection } from "@src/shared/runtime/workspaceSelectionAccess.js";

function makeArtifactId({ baseId, slot, domain, kind }) {
	return `${baseId}::${slot}::${domain}::${kind}::${Date.now()}`;
}

//
// ...
//
export function applyImportRegistry({
	state,
	baseId,
	slot,
	source,
	artifacts,
	normalizePayload,
}) {
	const prevArtifacts = ensureObject(state.artifacts);
	const prevRouteProjects = ensureObject(state.routeProjects);

	const nextArtifacts = { ...prevArtifacts };
	const nextRouteProjects = { ...prevRouteProjects };

	// ---- ensure RouteProject

	let rp = nextRouteProjects[baseId];

	if (!rp) {
		rp = {
			id: baseId,
			createdAt: nowIso(),
			updatedAt: nowIso(),

			slots: {
				right: {},
				left: {},
				km: {},
			},

			meta: {},
		};

		nextRouteProjects[baseId] = rp;
	}

	const effects = [];

	// ---- register artifacts

	for (const inArt of artifacts ?? []) {
		if (!inArt) continue;

		const domain = inArt.domain ?? "unknown";
		const kind = inArt.kind ?? "unknown";

		const id =
			inArt.id ??
			makeArtifactId({ baseId, slot, domain, kind });

		const artifact = {
			id,
			baseId,
			slot,
			domain,
			kind,
			createdAt: nowIso(),
			source: inArt.source ?? source ?? null,
			meta: inArt.meta ?? null,
			payload: normalizePayload
				? normalizePayload({ domain, payload: inArt.payload })
				: inArt.payload ?? null,
		};

		nextArtifacts[id] = artifact;

		const s = rp.slots[slot] ?? (rp.slots[slot] = {});

		if (domain === "alignment2d") {
			s.alignmentArtifactId = id;
		} else if (domain === "profile1d") {
			s.profileArtifactId = id;
		} else if (domain === "cant1d") {
			s.cantArtifactId = id;
		}

		rp.updatedAt = nowIso();

		effects.push({
			type: "log",
			level: "info",
			message: `artifact: + ${id}`,
		});
	}

	const selection = getWorkspaceSelection(state);

	const patch = {
		workspace_selection: {
			primaryId: baseId,
			contextIds: selection.contextIds,
			source: "import-registry",
			crsId: selection.crsId,
		},
		routeProjects: nextRouteProjects,
		artifacts: nextArtifacts,
		import_meta: {
			base: baseId,
			slot,
			at: nowIso(),
			source,
		},
	};

	return { patch, effects };
}
