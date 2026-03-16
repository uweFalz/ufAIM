// app/core/session/windowSessionState.js
//
// currently not yet wired into runtime;
// kept as target shape for the future session split

//
// ...
//
export function createWindowSessionState() {
	return {
		sessionMeta: {
			windowId: null,
			sessionId: null,
			projectId: null,
		},
		focus: {
			domain: null,
			objectId: null,
			subId: null,
			slot: "right",
		},
		navigation: {
			cursorS: 0,
			cameraPreset: null,
			fitMode: "auto",
		},
		ui: {
			activePanel: null,
			overlays: {
				docs: false,
				transition: false,
				bands: false,
				section: false,
				spot: false,
			},
			activeTool: null,
		},
		workingContext: {
			activeWorkingItemId: null,
			activeGroupId: null,
			giftCabinetFilter: null,
		},
		viewContext: {
			activeView: "geo",
			pinnedIds: [],
		},
	};
}
