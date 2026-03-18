// app/core/session/windowSessionState.js
//
// currently not yet wired into runtime;
// kept as target shape for the future session split
//
// Ziel später
//
// windowSessionState wird die klare Wahrheit für:
// 	•	Fokus
// 	•	Slot
// 	•	Navigation / Cursor
// 	•	ggf. aktive Panels / Tools
//
// und windowStore verliert diese Reste.
// 
// Bewertung
//
// Das ist der wichtigste mittelfristige Architekturpunkt, aber kein akuter Fehler.

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
