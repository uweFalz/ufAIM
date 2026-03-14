// src/shared/runtime/runtimeServices.js
//
// ------------------------------------------------------------
// Minimal runtime service registry
// ------------------------------------------------------------

let messagingService = null;

export function setMessagingService(messaging) {
	if (!messaging) {
		throw new Error("setMessagingService: missing messaging instance");
	}
	messagingService = messaging;
}

export function getMessagingService() {
	if (!messagingService) {
		throw new Error("Messaging service not initialized");
	}
	return messagingService;
}

export function hasMessagingService() {
	return !!messagingService;
}
