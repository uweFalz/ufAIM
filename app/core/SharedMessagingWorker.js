// app/core/SharedMessagingWorker.js

const ports = new Set();
const winByPort = new Map();     // port -> windowId
const portByWin = new Map();     // windowId -> port

function safePost(port, msg) {
	try { port.postMessage(msg); } catch {}
}

function broadcast(msg, exceptPort = null) {
	for (const p of ports) {
		if (p === exceptPort) continue;
		safePost(p, msg);
	}
}

function route(msg, fromPort) {
	const dst = msg?.dst?.ctx;

	// broadcast default
	if (!dst || dst === "broadcast") {
		broadcast(msg, null);
		return;
	}

	// direct window target: "win:<id>"
	if (typeof dst === "string" && dst.startsWith("win:")) {
		const winId = dst.slice(4);
		const p = portByWin.get(winId);
		if (p) safePost(p, msg);
		return;
	}

	// role:master etc. später – vorerst broadcast als fallback
	broadcast(msg, null);
}

self.onconnect = (ev) => {
	const port = ev.ports[0];
	ports.add(port);

	port.onmessage = (e) => {
		const msg = e.data;

		// minimal windowId capture on Window.Register
		if (msg?.name === "Window.Register" && msg?.src?.ctx?.startsWith("win:")) {
			const winId = msg.src.ctx.slice(4);
			winByPort.set(port, winId);
			portByWin.set(winId, port);
		}

		route(msg, port);

		// echo (debug) bleibt: wenn msg.debug?.echo oder global pref später
		// fürs Erste: immer ok, weil du’s willst
		// (nur: keine Endlosschleife, wir echoen nicht extra, wir routen msg selbst)
	};

	port.start();
	safePost(port, {
		schema: "ufCCv1",
		v: 1,
		id: `m_${Date.now()}_workerhello`,
		ts: Date.now(),
		type: "evt",
		name: "System.Ping",
		src: { ctx: "worker:router", role: "worker" },
		dst: { ctx: "broadcast" },
		payload: { nonce: "hello" }
	});
};
