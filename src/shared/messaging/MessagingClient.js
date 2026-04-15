// src/shared/messaging/MessagingClient.js

import { CC_SCHEMA, CC_VERSION } from "./CommandContract_v1.js";
import { mkCtx, mkCmd, mkEvt, mkAck, mkErr } from "./ccv1.js";

function uid() {
	return "msg_" + Math.random().toString(16).slice(2) + "_" + Date.now();
}

function normalizePayload(payload) {
	return (payload == null) ? {} : payload;
}

// legacy helper
export function emitMessage(messaging, partial) {
	const msg = {
		schema: CC_SCHEMA,
		v: CC_VERSION,
		id: partial.id ?? uid(),
		ts: partial.ts ?? Date.now(),
		...partial,
	};

	messaging.send(msg);
	return msg.id;
}

export class MessagingClient {
	constructor({ transport, windowId, role = "view" }) {
		this.transport = transport; // LocalBus oder SharedWorkerClient
		this.windowId = windowId;
		this.role = role;
	}

	attachRuntime(fn) {
		return this.transport.attachRuntime?.(fn);
	}

	on(name, fn) {
		return this.transport.on(name, fn);
	}

	// ---------------------------------------------------------
	// NEW: event-only subscription by evt name
	// fn(payload, msg)
	// ---------------------------------------------------------
	onEvt(name, fn) {
		if (!name || typeof fn !== "function") return () => {};

		return this.transport.on(String(name), (msg) => {
			if (!msg || msg.type !== "evt") return;
			fn(msg.payload ?? null, msg);
		});
	}

	sendRaw(msg) {
		return this.transport.send(msg);
	}

	// legacy shim
	send(msg) {
		return this.sendRaw(msg);
	}

	// ---------------------------------------------------------
	// incoming cmd handler
	// ---------------------------------------------------------
	onCmd(name, handlerFn) {
		return this.on(name, async (msg) => {
			if (!msg || msg.type !== "cmd") return;
			try {
				const result = await handlerFn(msg.payload ?? {}, msg);
				this.replyAck(msg, result ?? {});
			} catch (e) {
				this.replyErr(msg, e);
			}
		});
	}

	// ---------------------------------------------------------
	// await ack/err correlated to reqId
	// ---------------------------------------------------------
	sendCmdAwait(name, payload, { dstCtx = "broadcast", debug, timeoutMs = 4000 } = {}) {
		const src = mkCtx({ windowId: this.windowId, role: this.role });
		const dst = { ctx: dstCtx };
		const safePayload = normalizePayload(payload);

		const cmdMsg = mkCmd(name, safePayload, { src, dst, debug });

		return new Promise((resolve, reject) => {
			let done = false;

			const offAck = this.transport.on("ack", (m) => {
				if (done) return;
				if (m?.corr?.reqId !== cmdMsg.id) return;
				done = true;
				offAck?.();
				offErr?.();
				clearTimeout(tid);
				resolve(m.payload ?? {});
			});

			const offErr = this.transport.on("err", (m) => {
				if (done) return;
				if (m?.corr?.reqId !== cmdMsg.id) return;
				done = true;
				offAck?.();
				offErr?.();
				clearTimeout(tid);
				reject(new Error(String(m?.payload?.message ?? "cmd failed")));
			});

			const tid = setTimeout(() => {
				if (done) return;
				done = true;
				offAck?.();
				offErr?.();
				reject(new Error(`sendCmdAwait timeout: ${name}`));
			}, timeoutMs);

			this.transport.send(cmdMsg);
		});
	}

	sendCmd(name, payload, { dstCtx = "broadcast", debug } = {}) {
		const src = mkCtx({ windowId: this.windowId, role: this.role });
		const dst = { ctx: dstCtx };
		const safePayload = normalizePayload(payload);

		return this.sendRaw(mkCmd(name, safePayload, { src, dst, debug }));
	}

	emitEvt(name, payload, { dstCtx = "broadcast", debug } = {}) {
		const src = mkCtx({ windowId: this.windowId, role: this.role });
		const dst = { ctx: dstCtx };
		const safePayload = normalizePayload(payload);

		return this.sendRaw(mkEvt(name, safePayload, { src, dst, debug }));
	}

	replyAck(reqMsg, payload) {
		const src = mkCtx({ windowId: this.windowId, role: this.role });
		return this.sendRaw(mkAck(reqMsg, normalizePayload(payload), { src }));
	}

	replyErr(reqMsg, err) {
		const src = mkCtx({ windowId: this.windowId, role: this.role });
		return this.sendRaw(mkErr(reqMsg, err, { src }));
	}

	broadcastRaw(msg) {
		return this.transport.broadcast(msg);
	}
}
