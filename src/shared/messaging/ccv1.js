// src/shared/messaging/ccv1.js

import { CC_SCHEMA, CC_VERSION, validateMessage } from "./CommandContract_v1.js";

let _seq = 0;
function newId() {
	_seq += 1;
	return `m_${Date.now()}_${_seq}`;
}

function now() { return Date.now(); }

// ctx helper
export function mkCtx({ windowId, role = "view" } = {}) {
	return {
		ctx: windowId ? `win:${windowId}` : "broadcast",
		role
	};
}

// build message
export function mkMsg({
	type,          // "cmd"|"evt"|"ack"|"err"
	name,          // e.g. "Alignment.CompilePreset"
	payload = {},
	src,           // {ctx, role}
	dst,           // {ctx}
	corr,          // {reqId}
	debug
}) {
	const msg = {
		schema: CC_SCHEMA,
		v: CC_VERSION,
		id: newId(),
		ts: now(),
		type,
		name,
		src,
		dst,
		payload
	};
	if (corr) msg.corr = corr;
	if (debug) msg.debug = debug;

	// hard validate in dev (optional – du kannst später an prefs hängen)
	validateMessage(msg);

	return msg;
}

// convenience
export function mkCmd(name, payload, { src, dst = { ctx: "broadcast" }, debug } = {}) {
	return mkMsg({ type: "cmd", name, payload, src, dst, debug });
}

export function mkEvt(name, payload, { src, dst = { ctx: "broadcast" }, debug } = {}) {
	return mkMsg({ type: "evt", name, payload, src, dst, debug });
}

export function mkAck(reqMsg, payload, { src, dst } = {}) {
	return mkMsg({
		type: "ack",
		name: reqMsg.name,
		payload,
		src,
		dst: dst ?? { ctx: reqMsg.src?.ctx ?? "broadcast" },
		corr: { reqId: reqMsg.id }
	});
}

export function mkErr(reqMsg, error, { src, dst } = {}) {
	const payload = {
		message: String(error?.message ?? error),
		stack: error?.stack ? String(error.stack) : undefined
	};
	return mkMsg({
		type: "err",
		name: reqMsg.name,
		payload,
		src,
		dst: dst ?? { ctx: reqMsg.src?.ctx ?? "broadcast" },
		corr: { reqId: reqMsg.id }
	});
}
