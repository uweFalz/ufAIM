// src/shared/messaging/MessagingPort.js

export class MessagingPort {
	constructor(portLike) {
		this.port = portLike;
		this._onMessage = null;
		this._handler = (e) => this._onMessage?.(e.data);
		this.port.addEventListener("message", this._handler);
		this.port.start?.();
	}

	onMessage(fn) {
		this._onMessage = fn;
	}

	send(msg) {
		this.port.postMessage(msg);
	}

	dispose() {
		this.port.removeEventListener?.("message", this._handler);
	}
}
