// src/shared/messaging/worker/WorkerRouter.js

import { validateMessage } from "../CommandContract_v1.js";
import { mkCtx, mkAck, mkErr, mkEvt } from "../ccv1.js";

export function startWorkerRouter(self) {
	const ports = new Set();
	const cmdHandlers = new Map();

	function onCmd(name, fn) {
		cmdHandlers.set(name, fn);
	}

	function getClientCount() {
		return ports.size;
	}

	function broadcast(msg, exceptPort = null) {
		for (const p of [...ports]) {
			if (p === exceptPort) continue;
			try {
				p.postMessage(msg);
			} catch (err) {
				ports.delete(p);
				console.warn("[WorkerRouter] dropped dead port :: clients =", ports.size, err);
			}
		}
	}

	async function handleCmd(msg, port) {
		const fn = cmdHandlers.get(msg.name);

		if (!fn) {
			const err = new Error(`WorkerRouter: no handler for cmd ${msg.name}`);
			const reply = mkErr(msg, err, {
				src: mkCtx({ ctx: "worker:router", role: "worker" }),
			});
			port.postMessage(reply);
			return;
		}

		try {
			const result = await fn(msg.payload ?? {}, msg);
			const reply = mkAck(msg, result ?? {}, {
				src: mkCtx({ ctx: "worker:router", role: "worker" }),
			});
			port.postMessage(reply);
		} catch (e) {
			const reply = mkErr(msg, e, {
				src: mkCtx({ ctx: "worker:router", role: "worker" }),
			});
			port.postMessage(reply);
		}
	}

	self.onconnect = (ev) => {
		const port = ev.ports[0];
		ports.add(port);

		port.onmessage = async (e) => {
			const msg = e.data;

			try {
				validateMessage(msg);
			} catch (err) {
				console.warn("[WorkerRouter] invalid msg", err, msg);
				return;
			}

			if (msg.dst?.ctx === "broadcast") {
				if (msg.type === "cmd") await handleCmd(msg, port);
				if (msg.debug?.echo || msg.broadcast) broadcast(msg, null);
				return;
			}

			if (msg.type === "cmd") await handleCmd(msg, port);
			broadcast(msg, null);
		};

		port.onmessageerror = (err) => {
			console.warn("[WorkerRouter] messageerror", err);
		};

		port.start();
		port.postMessage({
			type: "worker:hello",
			ts: Date.now(),
			clients: ports.size,
		});
	};

	function broadcastEvt(name, payload, { debug } = {}) {
		const msg = mkEvt(name, payload ?? {}, {
			src: mkCtx({ ctx: "worker:router", role: "worker" }),
			dst: { ctx: "broadcast" },
			debug,
		});
		broadcast(msg, null);
	}

	return {
		onCmd,
		getClientCount,
		broadcastEvt,
		emitEvt: broadcastEvt,
	};
}
