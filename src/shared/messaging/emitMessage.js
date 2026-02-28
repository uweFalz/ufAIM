// src/shared/messaging/emitMessage.js

import { CC_SCHEMA, CC_VERSION, validateMessage } from "./CommandContract_v1.js";

function uid(){
	// minimal; replace with nanoid if you like
	return "msg_" + Math.random().toString(16).slice(2) + "_" + Date.now();
}

export function emitMessage(messaging, partial){
	const msg = {
		schema: CC_SCHEMA,
		v: CC_VERSION,
		id: partial.id ?? uid(),
		ts: partial.ts ?? Date.now(),
		...partial,
	};

	validateMessage(msg);
	messaging.send(msg);
	return msg.id;
}
