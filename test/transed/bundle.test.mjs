import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

// The single-file TransEd playground: the bundle builds reproducibly, carries
// no outside reference, records what it was made from, and its script runs
// against a minimal document through all three modes with the same service the
// served page uses. The root artifact transed.html must match its sources.

const { bundleTransEd } = await import(new URL("../../tools/transed/bundle.mjs", import.meta.url));
const ROOT = new URL("../../", import.meta.url);

function fakeDocument() {
	const nodes = new Map();
	const make = (id = "") => {
		const node = {
			id, value: "", textContent: "", innerHTML: "", dataset: {}, style: {}, files: [], checked: false, hidden: false, disabled: false, children: [], options: [], attributes: {}, listeners: {},
			addEventListener(type, fn) { (node.listeners[type] ??= []).push(fn); },
			setAttribute(name, value) { node.attributes[name] = String(value); },
			setPointerCapture() {}, click() { for (const fn of node.listeners.click ?? []) fn({ target: node, preventDefault() {} }); },
			append(...items) { node.children.push(...items); node.options = node.children; },
			replaceChildren(...items) { node.children = items; node.options = items; if (!items.length) node.innerHTML = ""; },
			querySelector() { return null; }, querySelectorAll() { return []; },
		};
		return node;
	};
	return {
		nodes,
		activeElement: null,
		getElementById(id) { if (!nodes.has(id)) nodes.set(id, make(id)); return nodes.get(id); },
		createElement() { return make(); },
		querySelectorAll() { return []; },
	};
}

async function run(html) {
	const script = html.slice(html.indexOf("<script>") + 8, html.lastIndexOf("</script>")).replace(/<\\\/script/g, "</script");
	const document = fakeDocument();
	const stored = new Map();
	const window = {};
	const context = vm.createContext({
		document, window, console, structuredClone, URL, Blob, setTimeout,
		localStorage: { getItem: (key) => stored.get(key) ?? null, setItem: (key, value) => stored.set(key, value) },
	});
	new vm.Script(script, { filename: "transed.html" }).runInContext(context);
	return { document, stored, transed: window.__transed };
}

test("the bundle is one self-contained file and builds the same bytes twice", async () => {
	const dir = await mkdtemp(join(tmpdir(), "transed-bundle-"));
	const first = await bundleTransEd({ out: join(dir, "a.html") });
	const second = await bundleTransEd({ out: join(dir, "b.html") });
	assert.ok(first.modules >= 15 && first.bytes < 1e6, `${first.modules} modules, ${first.bytes} bytes`);
	const html = await readFile(first.out, "utf8");
	assert.equal(html, await readFile(second.out, "utf8"), "two builds are byte-identical");
	assert.equal(first.sourceHash, second.sourceHash);
	assert.equal((html.match(/<script/g) ?? []).length, 1, "one script, nothing loaded from outside");
	assert.ok(!html.includes('type="module"') && !/src="\.\/app\.js"/.test(html), "no module loading left");
	assert.doesNotMatch(html, /https?:\/\//, "no outside reference");
});

test("the file records the SHA-256 of every source it was made from", async () => {
	const dir = await mkdtemp(join(tmpdir(), "transed-bundle-"));
	const built = await bundleTransEd({ out: join(dir, "transed.html") });
	const html = await readFile(built.out, "utf8");
	const manifest = JSON.parse(html.match(/<!-- transed-source-manifest (\{.*?\}) -->/)[1]);
	assert.deepEqual(manifest, built.sources);
	assert.equal(html.match(/<meta name="transed-source-sha256" content="([0-9a-f]{64})">/)[1], built.sourceHash);
	for (const required of ["transed/app.js", "transed/index.html", "tools/transed/bundle.mjs", "tools/axtran2/bundle.mjs", "src/domain/transition/transitionLookup.json", "src/services/transition-library/createTransitionLibraryService.js"]) {
		assert.ok(required in manifest, `${required} is in the manifest`);
	}
	for (const [file, hash] of Object.entries(manifest)) {
		assert.equal(createHash("sha256").update(await readFile(new URL(file, ROOT))).digest("hex"), hash, file);
	}
	assert.equal(createHash("sha256").update(JSON.stringify(manifest)).digest("hex"), built.sourceHash);
});

test("--check accepts the root artifact, changes nothing and rejects a stale file", async () => {
	const rootArtifact = new URL("transed.html", ROOT);
	const before = await readFile(rootArtifact, "utf8");
	const result = await bundleTransEd({ check: true });
	assert.equal(result.checked, true);
	assert.equal(await readFile(rootArtifact, "utf8"), before, "the check does not write");
	const dir = await mkdtemp(join(tmpdir(), "transed-bundle-"));
	const stale = join(dir, "transed.html");
	await writeFile(stale, before.replace("TransEd", "TransEd "));
	await assert.rejects(bundleTransEd({ out: stale, check: true }), /stale TransEd artifact/);
	await assert.rejects(bundleTransEd({ out: join(dir, "missing.html"), check: true }), /stale TransEd artifact/);
});

test("the bundled script runs all three modes on the shared service", async () => {
	const dir = await mkdtemp(join(tmpdir(), "transed-bundle-"));
	const built = await bundleTransEd({ out: join(dir, "transed.html") });
	const { document, stored, transed } = await run(await readFile(built.out, "utf8"));
	const { service, state } = transed;
	const el = (id) => document.getElementById(id);

	// mode 2 at start
	assert.equal(state.mode, "2");
	assert.equal(state.draft.ok, true);
	assert.match(el("plot").innerHTML, /data-series="k"/);
	assert.match(el("couplingPlot").innerHTML, /data-series="cant"/);
	assert.equal(el("hwIn").options.length, 28);
	assert.equal(service.listPresets().length, 33);

	// mode 0: the start function is the Bloss cubic on [0, 0.5]; save it with a halfWave
	state.mode = "0"; state.fn.draft = null;
	el("fnId").value = "MY_F"; el("fnAsHalfWave").checked = true; el("fnSource").value = "kappa"; el("fnQuantity").value = "curvature";
	el("fnSave").click();
	assert.match(el("fnSaveMessage").textContent, /MY_F, PROTO_MY_F, HW_MY_F/);
	assert.equal(el("hwIn").options.length, 29, "the new halfWave is offered in mode 2");

	// mode 1: the start term is BLOSS on [0, 0.5]; save it as a halfWave of its own
	el("hwId").value = "MY_W";
	el("hwSave").click();
	assert.match(el("hwSaveMessage").textContent, /PROTO_MY_W, HW_MY_W/);
	assert.equal(el("hwIn").options.length, 30);

	// both creations are the same curve as built-in Bloss in mode 2
	const of = (hw) => service.describeDraft({ halfWave1: hw, halfWave2: hw, normLengthPartition: [0.5, 0, 0.5], count: 11 }).samples.map((s) => s.k);
	for (const hw of ["HW_MY_F", "HW_MY_W"]) of(hw).forEach((value, index) => assert.ok(Math.abs(value - of("HW_BLOSS")[index]) < 1e-12, hw));

	const remembered = JSON.parse(stored.get("ufaim.transed.userLibrary.v1"));
	assert.deepEqual(Object.keys(remembered.halfWave), ["HW_MY_F", "HW_MY_W"]);
	assert.equal(remembered.schema.kind, "user-library");
});

test("the served page and the bundle start from the same sources", async () => {
	const page = await readFile(new URL("transed/index.html", ROOT), "utf8");
	const app = await readFile(new URL("transed/app.js", ROOT), "utf8");
	assert.ok(page.includes('<script type="module" src="./app.js"></script>'));
	assert.doesNotMatch(page, /https?:\/\//, "the page loads nothing from outside");
	assert.doesNotMatch(page, /Modellvorbehalt/, "the model is confirmed, the reservation is gone");
	assert.match(page, /id="couplingModel"[^>]*>.*\(κ \+ d″\)\/\(1 − κd\).*Von Uwe bestätigt/, "the page names the model and its exact expression");
	const specifiers = [...app.matchAll(/from\s+["']([^"']+)["']/g)].map((match) => match[1]);
	assert.deepEqual(specifiers, ["../src/domain/transition/transitionLookup.json", "../src/services/transition-library/index.js"]);
	assert.doesNotMatch(app, /fetch\(|XMLHttpRequest|WebSocket|import\(/);
});
