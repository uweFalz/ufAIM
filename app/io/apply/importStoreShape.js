// app/io/apply/importStoreShape.js

import { ensureObject } from "@app/utils/appHelpers.js";
import { getWorkspaceSelection } from "@src/shared/runtime/workspaceSelectionAccess.js";

//
// ...
//
export function ensureImportStoreShape(state) {
	const s = ensureObject(state);
	
	// console.log("import_tracks2d: ", Array.isArray(s.import_tracks2d) ? s.import_tracks2d : [] );

	const workspaceSelection = getWorkspaceSelection(s);

	return {
		workspace_selection: {
			primaryId: workspaceSelection.primaryId,
			contextIds: workspaceSelection.contextIds,
			source: workspaceSelection.source ?? null,
			crsId: workspaceSelection.crsId ?? null,
		},
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
		import_tracks2d: Array.isArray(s.import_tracks2d) ? s.import_tracks2d : [],

		view_pins: Array.isArray(s.view_pins) ? s.view_pins : [],
	};
}
