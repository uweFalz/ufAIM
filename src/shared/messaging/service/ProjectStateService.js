// src/shared/messaging/service/ProjectStateService.js

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
		const next = {
			...getState(),
			activeRouteProjectId: routeProjectId ?? null,
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
