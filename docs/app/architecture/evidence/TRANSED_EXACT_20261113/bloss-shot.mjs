// Pictures for Uwe: Bloss with the exact expression, the patent example typed in, read as curvature and as cant. node bloss-shot.mjs <url> <outDir> <tag>
// input over CDP. node journey.mjs <url> <outDir> <tag>
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync, readFileSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const here = dirname(fileURLToPath(import.meta.url));
const [url, outDir, tag] = process.argv.slice(2);
mkdirSync(outDir, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const problems = [];

async function session(fn) {
	const port = 9300 + Math.floor(Math.random() * 500);
	const profile = mkdtempSync(join(here, "transed-profile-"));
	const chrome = spawn("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", ["--headless=new", `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, "--no-first-run", "--no-default-browser-check", "--allow-file-access-from-files", "--window-size=1200,1000", "about:blank"], { stdio: "ignore" });
	try {
		let target = null;
		for (let i = 0; i < 80 && !target; i++) { await sleep(500); try { target = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find((t) => t.type === "page"); } catch {} }
		if (!target?.webSocketDebuggerUrl) throw new Error("Chrome did not start");
		const ws = new WebSocket(target.webSocketDebuggerUrl);
		await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
		let seq = 0; const pending = new Map();
		ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } if (m.method === "Runtime.exceptionThrown") problems.push(m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text); if (m.method === "Log.entryAdded" && m.params.entry.level === "error") problems.push(m.params.entry.text); };
		const send = (method, params = {}) => new Promise((res) => { const id = ++seq; pending.set(id, res); ws.send(JSON.stringify({ id, method, params })); });
		const ev = async (expression) => { const r = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true }); if (r.result?.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description ?? JSON.stringify(r.result.exceptionDetails)); return r.result?.result?.value; };
		await send("Page.enable"); await send("Runtime.enable"); await send("Log.enable"); await send("DOM.enable");
		await send("Browser.setDownloadBehavior", { behavior: "allow", downloadPath: outDir });
		await send("Page.navigate", { url });
		for (let i = 0; i < 60 && !(await ev("!!window.__transed").catch(() => false)); i++) await sleep(250);
		const center = async (selector) => ev(`(() => { const n = document.querySelector(${JSON.stringify(selector)}); n.scrollIntoView({ block: "center" }); const r = n.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; })()`);
		const mouse = (type, x, y, extra = {}) => send("Input.dispatchMouseEvent", { type, x, y, button: "left", buttons: type === "mouseReleased" ? 0 : 1, clickCount: 1, ...extra });
		const ui = {
			ev, send,
			async click(selector) { const [x, y] = await center(selector); await mouse("mousePressed", x, y); await mouse("mouseReleased", x, y); await sleep(120); },
			async type(selector, text) { await ui.click(selector); await send("Input.dispatchKeyEvent", { type: "keyDown", key: "a", code: "KeyA", modifiers: 4, commands: ["selectAll"] }); await send("Input.dispatchKeyEvent", { type: "keyUp", key: "a", code: "KeyA", modifiers: 4 }); await send("Input.insertText", { text: String(text) }); await sleep(120); },
			// selects are set by value; a native popup cannot be operated headless
			async choose(selector, value) { await ev(`(() => { const n = document.querySelector(${JSON.stringify(selector)}); n.value = ${JSON.stringify(value)}; n.dispatchEvent(new Event("change", { bubbles: true })); })()`); await sleep(120); },
			// drag inside a plot from parameter u0 to u1 (fractions of the plotted range)
			async drag(selector, u0, u1) {
				const box = await ev(`(() => { const n = document.querySelector(${JSON.stringify(selector + " svg")}); n.scrollIntoView({ block: "center" }); const r = n.getBoundingClientRect(); return [r.left, r.top, r.width, r.height]; })()`);
				const x = (u) => box[0] + ((44 + u * (720 - 44 - 14)) / 720) * box[2]; const y = box[1] + box[3] / 2;
				await mouse("mousePressed", x(u0), y);
				for (let i = 1; i <= 8; i++) await mouse("mouseMoved", x(u0 + ((u1 - u0) * i) / 8), y);
				await mouse("mouseReleased", x(u1), y); await sleep(150);
			},
			async shot(name) { const s = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true }); writeFileSync(join(outDir, name), Buffer.from(s.result.data, "base64")); },
			text: (selector) => ev(`document.querySelector(${JSON.stringify(selector)})?.textContent ?? null`),
			value: (selector) => ev(`document.querySelector(${JSON.stringify(selector)})?.value ?? null`),
		};
		const result = await fn(ui);
		ws.close();
		return result;
	} finally { chrome.kill("SIGKILL"); await sleep(400); rmSync(profile, { recursive: true, force: true }); }
}


const out = {};
const look = `(() => { const c = window.__transed.state.draft?.coupling; const v = document.querySelector("#couplingText .verdict"); return { in: document.querySelector("#hwIn").value, given: c.given, exact: c.exact, converged: c.converged, curvature: [+c.curvatureRange.min.toFixed(5), +c.curvatureRange.max.toFixed(5)], endSlopes: [+c.endSlopes.start.toFixed(4), +c.endSlopes.end.toFixed(4)], order: c.suitability.order, verdict: v?.textContent, legend: [...document.querySelectorAll("#couplingLegend span")].map((n) => n.textContent.trim()) }; })()`;
await session(async (ui) => {
	await ui.type("#aHeight", 1.8); await ui.type("#aCant", 224); await ui.type("#aRadius", 571.428571); await ui.type("#aLength", 200);
	await ui.click("#aHeight");
	await ui.choose("#template", "bloss");
	out.curvature = await ui.ev(look);
	await ui.shot(`exact-${tag}-bloss-curvature.png`);
	await ui.choose("#readAs", "cant");
	out.cant = await ui.ev(look);
	await ui.shot(`exact-${tag}-bloss-cant.png`);
});
out.problems = problems;
console.log(JSON.stringify(out, null, 1));
