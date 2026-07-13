// src/shared/messaging/service/ProjectStateService.js

import { getWorkspaceSelection } from "../../runtime/workspaceSelectionAccess.js";

export function createProjectStateService({ getState, setState, router } = {}) {
	if (typeof getState !== "function") {
		throw new Error("ProjectStateService: missing getState");
	}
	if (typeof setState !== "function") {
		throw new Error("ProjectStateService: missing setState");
	}

	function cloneState() {
		return { ...getState() };
	}

	function broadcast() {
		router?.broadcastEvt?.("Project.StateChanged", cloneState());
	}

	function getProjectState() {
		return cloneState();
	}

	function setActiveRouteProject({ routeProjectId } = {}) {
		const current = getState() ?? {};
		const workspaceSelection =
			getWorkspaceSelection(current);

		const next = {
			...current,
			workspace_selection: {
				primaryId: routeProjectId ?? null,
				contextIds: workspaceSelection.contextIds,
				source: workspaceSelection.source ?? null,
				crsId: workspaceSelection.crsId ?? null,
			},
		};

		setState(next);

		broadcast();
		return cloneState();
	}

	return {
		getState: getProjectState,
		setActiveRouteProject,
	};
}
