// SharedMessagingWorker.js (minimal router v1)
// Runs as SharedWorker: one instance shared by all windows/tabs of same origin.

import { startWorkerRouter } from "./worker/WorkerRouter.js";

startWorkerRouter(self);

const PORTS = new Map();         // port -> clientInfo
const CTX_TO_PORT = new Map();   // ctxId -> port

let _ctxSeq = 0;

function newCtxId() {
	_ctxSeq += 1;
	// stable enough; you can add random later
	return `ctx:${_ctxSeq}`;
}

function post(port, packet) {
	try { port.postMessage(packet); } catch (e) { /* ignore */ }
}

function broadcast(packet, exceptPort = null) {
	for (const [p] of PORTS) {
		if (p === exceptPort) continue;
		post(p, packet);
	}
}

function sendToCtx(ctxId, packet) {
	const p = CTX_TO_PORT.get(ctxId);
	if (!p) return false;
	post(p, packet);
	return true;
}

function sendToRole(role, packet) {
	for (const [p, info] of PORTS) {
		if (info?.role === role) {
			post(p, packet);
			return true;
		}
	}
	return false;
}

// --- core router ---
function route(envelope, senderPort) {
	const to = envelope?.to ?? "broadcast";

	if (to === "broadcast") {
		broadcast(envelope, senderPort);
		return;
	}

	if (typeof to === "string" && to.startsWith("ctx:")) {
		sendToCtx(to, envelope);
		return;
	}

	if (typeof to === "string" && to.startsWith("role:")) {
		const role = to.slice("role:".length);
		sendToRole(role, envelope);
		return;
	}

	// fallback: broadcast if unknown
	broadcast(envelope, senderPort);
}

onconnect = (e) => {
	const port = e.ports[0];
	const ctxId = newCtxId();

	const info = {
		ctxId,
		title: "",
		capabilities: [],
		role: "view", // default
		connectedAt: Date.now()
	};

	PORTS.set(port, info);
	CTX_TO_PORT.set(ctxId, port);

	port.onmessage = (ev) => {
		const packet = ev.data;

		// client -> router control
		if (packet?.type === "router:hello") {
			// expected payload: { title, capabilities, role? }
			info.title = String(packet.title ?? "");
			info.capabilities = Array.isArray(packet.capabilities) ? packet.capabilities.slice() : [];
			if (packet.role) info.role = String(packet.role);

			// reply with assigned ctxId
			post(port, {
				v: 1,
				type: "router:hello:ack",
				ctxId,
				role: info.role
			});

			// (optional) notify everyone
			broadcast({
				v: 1,
				type: "router:presence",
				evt: "joined",
				ctxId,
				title: info.title,
				capabilities: info.capabilities,
				role: info.role
			}, port);

			return;
		}

		// transport messages
		if (packet?.type === "msg") {
			// enforce/overwrite from
			packet.from = info.ctxId;
			route(packet, port);
			return;
		}

		// ignore unknown
	};

	port.onmessageerror = () => {};

	port.start();

	// send initial ctxId even before hello (optional)
	post(port, {
		v: 1,
		type: "router:ctx",
		ctxId
	});
};
