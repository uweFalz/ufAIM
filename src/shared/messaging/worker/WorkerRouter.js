// src/shared/messaging/worker/WorkerRouter.js

import { validateMessage } from "../CommandContract_v1.js";
import { mkCtx, mkAck, mkErr } from "../ccv1.js";

export function startWorkerRouter(self) {
	const ports = new Set();
	const cmdHandlers = new Map(); // name -> async(payload, msg) => result

	function onCmd(name, fn) {
		cmdHandlers.set(name, fn);
	}

	function broadcast(msg, exceptPort = null) {
		for (const p of ports) {
			if (p === exceptPort) continue;
			try { p.postMessage(msg); } catch {}
		}
	}

	async function handleCmd(msg, port) {
		const fn = cmdHandlers.get(msg.name);
		if (!fn) {
			// unknown cmd -> err
			const err = new Error(`WorkerRouter: no handler for cmd ${msg.name}`);
			const reply = mkErr(msg, err, { src: mkCtx({ role: "worker" }) });
			port.postMessage(reply);
			return;
		}

		try {
			const result = await fn(msg.payload ?? {}, msg);
			const reply = mkAck(msg, result ?? {}, { src: mkCtx({ role: "worker" }) });
			port.postMessage(reply);
		} catch (e) {
			const reply = mkErr(msg, e, { src: mkCtx({ role: "worker" }) });
			port.postMessage(reply);
		}
	}

	self.onconnect = (ev) => {
		const port = ev.ports[0];
		ports.add(port);

		port.onmessage = async (e) => {
			const msg = e.data;

			// CCv1 validate (hart, weil debugging phase)
			try { validateMessage(msg); } catch (err) {
				// invalid msg -> ignore but log
				console.warn("[WorkerRouter] invalid msg", err, msg);
				return;
			}

			// v1: broadcast bleibt broadcast
			if (msg.dst?.ctx === "broadcast") {
				// cmd needs handling *and* distribution? -> nur handling + optional echo
				if (msg.type === "cmd") await handleCmd(msg, port);
				if (msg.debug?.echo || msg.broadcast) broadcast(msg, null);
				return;
			}

			// targeted: for now: still broadcast (wir lösen Routing später sauber)
			if (msg.type === "cmd") await handleCmd(msg, port);
			broadcast(msg, null);
		};

		port.start();
		port.postMessage({ type: "worker:hello", ts: Date.now() });
	};

	return { onCmd };
}
