// app/runtime/session/windowSessionState.js
//
//
// windowSessionState
//
// Window-local session/view context.
//
// Responsibilities:
// - local focus (objectId, optional slot)
// - local viewport / selection context
// - window-specific UI state
//
// NOT:
// - not canonical project truth
// - not shared across windows
//
// Rule:
// Each window has its own focus,
// even when all windows look at the same canonical objects.
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
