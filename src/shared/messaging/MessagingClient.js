// src/shared/messaging/MessagingClient.js

import { mkCtx, mkCmd, mkEvt, mkAck, mkErr } from "./ccv1.js";

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

	sendRaw(msg) {
		return this.transport.send(msg);
	}

	broadcastRaw(msg) {
		return this.transport.broadcast(msg);
	}

	sendCmd(name, payload, { dstCtx = "broadcast", debug } = {}) {
		const src = mkCtx({ windowId: this.windowId, role: this.role });
		const dst = { ctx: dstCtx };
		return this.sendRaw(mkCmd(name, payload, { src, dst, debug }));
	}

	emitEvt(name, payload, { dstCtx = "broadcast", debug } = {}) {
		const src = mkCtx({ windowId: this.windowId, role: this.role });
		const dst = { ctx: dstCtx };
		return this.sendRaw(mkEvt(name, payload, { src, dst, debug }));
	}

	replyAck(reqMsg, payload) {
		const src = mkCtx({ windowId: this.windowId, role: this.role });
		return this.sendRaw(mkAck(reqMsg, payload, { src }));
	}

	replyErr(reqMsg, err) {
		const src = mkCtx({ windowId: this.windowId, role: this.role });
		return this.sendRaw(mkErr(reqMsg, err, { src }));
	}
}
