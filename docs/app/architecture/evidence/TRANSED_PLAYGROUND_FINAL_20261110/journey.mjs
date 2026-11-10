// Visible journey through the TransEd playground with real mouse and keyboard
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

const curve = `JSON.stringify(window.__transed.state.draft.samples.filter((_, i) => i % 20 === 0).map((s) => +s.k.toFixed(6)))`;
const out = { tag };
const libraryFile = join(outDir, "transed-bibliothek.json");
if (existsSync(libraryFile)) rmSync(libraryFile);

// ---- session 1: create a function, a halfWave, a transition; save the library as a file
out.author = await session(async (ui) => {
	const r = {};
	await ui.click('[data-mode-button="0"]');
	await ui.type("#fnCoeff", "0 0 0 10 -15 6");
	await ui.type("#fnX0", "-0.25"); await ui.type("#fnX1", "1.25");
	await ui.drag("#fnPlot", (0 + 0.25) / 1.5, (0.5 + 0.25) / 1.5);
	r.mode0 = { a: await ui.value("#fnA"), b: await ui.value("#fnB"), legend: await ui.text("#fnLegend"), frame: await ui.ev(`!!document.querySelector("#fnPlot [data-frame]")`), message: await ui.text("#fnMessage") };
	await ui.type("#fnId", "MY_QUINTIC");
	await ui.click("#fnSave");
	r.mode0.saved = await ui.text("#fnSaveMessage");
	await ui.shot(`${tag}-mode0.png`);

	await ui.click('[data-mode-button="1"]');
	await ui.choose('#hwTerms select[data-term="0"]', "MY_QUINTIC");
	r.mode1 = { firstInterval: [await ui.value('#hwTerms input[data-term="0"][data-key="a"]'), await ui.value('#hwTerms input[data-term="0"][data-key="b"]')] };
	await ui.click("#hwAddTerm");
	await ui.type('#hwTerms input[data-term="1"][data-key="factor"]', "0.2");
	r.mode1.terms = await ui.ev(`document.querySelectorAll("#hwTerms tr").length - 1`);
	r.mode1.legend = await ui.text("#hwLegend"); r.mode1.message = await ui.text("#hwMessage");
	await ui.type("#hwId", "MY_MIX");
	await ui.click("#hwSave");
	r.mode1.saved = await ui.text("#hwSaveMessage");
	await ui.shot(`${tag}-mode1.png`);

	await ui.click('[data-mode-button="2"]');
	await ui.choose("#hwIn", "HW_MY_QUINTIC"); await ui.choose("#hwOut", "HW_MY_MIX");
	await ui.type("#w1", "0.4"); await ui.type("#w2", "0.6");
	await ui.drag("#plot", 0.41, 0.3);
	r.mode2 = { hwIn: await ui.value("#hwIn"), hwOut: await ui.value("#hwOut"), w1: await ui.value("#w1"), w2: await ui.value("#w2"), legend: await ui.text("#legend"), verdict: await ui.text(".verdict"), message: await ui.text("#draftMessage") };
	await ui.type("#saveId", "my_bogen"); await ui.type("#saveLabel", "Mein Bogen");
	await ui.click("#save");
	r.mode2.saved = await ui.text("#saveMessage");
	r.mode2.curve = await ui.ev(curve);
	r.library = await ui.ev(`[...document.querySelectorAll("#library tr[data-id]")].map((tr) => tr.dataset.level + "." + tr.dataset.id)`);
	await ui.shot(`${tag}-mode2.png`);
	await ui.click("#export");
	for (let i = 0; i < 40 && !existsSync(libraryFile); i++) await sleep(250);
	return r;
});
out.file = existsSync(libraryFile) ? (() => { const lib = JSON.parse(readFileSync(libraryFile, "utf8")); return { bytes: readFileSync(libraryFile).length, kind: lib.schema?.kind, levels: Object.fromEntries(["simpleFcn", "protoFcn", "halfWave", "transition"].map((l) => [l, Object.keys(lib[l] ?? {})])) }; })() : null;

// ---- session 2: a different, empty browser; load the file; use the creation
out.reader = out.file ? await session(async (ui) => {
	const r = { before: await ui.ev(`document.querySelectorAll("#library tr[data-id]").length`) };
	const doc = await ui.send("DOM.getDocument");
	const node = await ui.send("DOM.querySelector", { nodeId: doc.result.root.nodeId, selector: "#import" });
	await ui.send("DOM.setFileInputFiles", { nodeId: node.result.nodeId, files: [libraryFile] });
	await sleep(600);
	r.message = await ui.text("#libraryMessage");
	r.library = await ui.ev(`[...document.querySelectorAll("#library tr[data-id]")].map((tr) => tr.dataset.level + "." + tr.dataset.id)`);
	await ui.click('#library button[data-load="my_bogen"]');
	r.loaded = { mode: await ui.ev(`window.__transed.state.mode`), hwIn: await ui.value("#hwIn"), hwOut: await ui.value("#hwOut"), w1: await ui.value("#w1"), w2: await ui.value("#w2"), curve: await ui.ev(curve) };
	await ui.shot(`${tag}-reader.png`);
	return r;
}) : null;

out.sameCurve = Boolean(out.reader && out.reader.loaded.curve === out.author.mode2.curve);
out.problems = problems;
console.log(JSON.stringify(out, null, 1));
process.exit(out.sameCurve && problems.length === 0 ? 0 : 2);
