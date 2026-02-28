// src/shared/messaging/CommandContract_v1.js

export const CC_SCHEMA = "ufCCv1";
export const CC_VERSION = 1;

const ALLOWED_TYPES = new Set(["cmd", "evt", "ack", "err"]);
const ALLOWED_ROLES = new Set(["view", "master", "worker", "sys"]);

const REQUIRED = {
	"Window.Register": ["title", "capabilities"],
	"System.Ping": ["nonce"],

	"Alignment.CompilePreset": ["presetId"],
	"Alignment.SampleKappa": ["presetId", "what", "n"],
	"Alignment.BuildSegment": ["elementId", "presetId", "L", "kappaIn", "kappaOut"],

	"Import.DropFiles": ["files"],
	"Grabbeltisch.SetStructure": ["importSessionId", "mapping"],

	"Project.Open": ["projectId"],
	"Project.CommitAlignments": ["projectId", "routeProjectDraft"]
};

export function validatePayload(name, payload) {
	const req = REQUIRED[name];
	if (!req) return true; // allow unknown evt in v1

	for(const key of req) {
		if (!(key in payload)) {
			throw new Error(`CCv1: missing payload field '${key}' for ${name}`);
		}
	}
	return true;
}

function isObj(x) { return x && typeof x === "object" && !Array.isArray(x); }
function isStr(x) { return typeof x === "string" && x.length > 0; }

function isValidCtx(ctx) {
	if (!isStr(ctx)) return false;
	return (
	ctx === "broadcast" ||
	ctx === "worker:router" ||
	ctx === "role:master" ||
	ctx.startsWith("win:")
	);
}

export function validateMessage(msg) {
	if (!isObj(msg)) throw new Error("CCv1: message must be object");

	if (msg.schema !== CC_SCHEMA) throw new Error(`CCv1: schema must be "${CC_SCHEMA}"`);
	if (msg.v !== CC_VERSION) throw new Error(`CCv1: v must be ${CC_VERSION}`);

	if (!isStr(msg.id)) throw new Error("CCv1: id required");
	if (!Number.isFinite(msg.ts)) throw new Error("CCv1: ts must be number");

	if (!ALLOWED_TYPES.has(msg.type)) throw new Error("CCv1: invalid type");

	if (!isObj(msg.src)) throw new Error("CCv1: src required");
	if (!isValidCtx(msg.src.ctx)) throw new Error("CCv1: src.ctx invalid");
	if (!ALLOWED_ROLES.has(msg.src.role)) throw new Error("CCv1: src.role invalid");

	if (!isObj(msg.dst)) throw new Error("CCv1: dst required");
	if (!isValidCtx(msg.dst.ctx)) throw new Error("CCv1: dst.ctx invalid");

	if (!isStr(msg.name)) throw new Error("CCv1: name required");

	// payload rules
	if (msg.type === "cmd" || msg.type === "evt") {
		if (!("payload" in msg)) throw new Error("CCv1: payload required for cmd/evt");
		if (msg.payload !== null && !isObj(msg.payload)) throw new Error("CCv1: payload must be object or null");
	}
	
	if (msg.type === "cmd") {
		validatePayload(msg.name, msg.payload);
	}

	// correlation rules
	if (msg.type === "ack" || msg.type === "err") {
		if (!isObj(msg.corr) || !isStr(msg.corr.reqId)) {
			throw new Error("CCv1: ack/err must include corr.reqId");
		}
	}

	// optional debug
	if ("debug" in msg && msg.debug != null && !isObj(msg.debug)) {
		throw new Error("CCv1: debug must be object");
	}

	return true;
}

// CommandContract_v1.js (minimal helpers)
let _seq = 0;

export function makeMsg({ type, name, payload, replyTo }){
	_seq += 1;
	const id = `m_${Date.now()}_${_seq}`;
	const msg = { v: 1, type, name, id, ts: Date.now(), payload: payload ?? {} };
	if (replyTo) msg.replyTo = replyTo;
	return msg;
}

export function makeCC({
	type, name, payload,
	srcCtx, srcRole = "view",
	dstCtx = "broadcast",
	corr
}) {
	_seq += 1;
	const id = `m_${Date.now()}_${_seq}`;
	const msg = {
		schema: CC_SCHEMA,
		v: CC_VERSION,
		id,
		ts: Date.now(),
		type,              // cmd|evt|ack|err
		name,              // e.g. "Alignment.CompilePreset"
		src: { ctx: srcCtx, role: srcRole },
		dst: { ctx: dstCtx },
		payload: payload ?? {}
	};
	if (corr) msg.corr = corr;
	return msg;
}
