import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

// The single-file TransEd playground: the bundle builds, carries no outside
// reference, and its script runs against a minimal document far enough to
// compute the start picture with the same service the served page uses.

const { bundleTransEd } = await import(new URL("../../tools/transed/bundle.mjs", import.meta.url));
const ROOT = new URL("../../", import.meta.url);

function fakeDocument() {
	const nodes = new Map();
	const make = (id = "") => {
		const node = {
			id, value: "", textContent: "", innerHTML: "", dataset: {}, style: {}, files: [], checked: false, children: [], options: [],
			addEventListener() {}, setPointerCapture() {}, click() {}, append(...items) { node.children.push(...items); },
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
	};
}

test("the bundle is one self-contained file that computes the start picture", async () => {
	const dir = await mkdtemp(join(tmpdir(), "transed-bundle-"));
	const built = await bundleTransEd({ out: join(dir, "transed.html") });
	assert.ok(built.modules >= 15 && built.bytes < 1e6, `${built.modules} modules, ${built.bytes} bytes`);
	const html = await readFile(built.out, "utf8");
	assert.equal((html.match(/<script/g) ?? []).length, 1, "one script, nothing loaded from outside");
	assert.ok(!html.includes('type="module"') && !/src="\.\/app\.js"/.test(html), "no module loading left");
	assert.doesNotMatch(html, /https?:\/\//, "no outside reference");

	const script = html.slice(html.indexOf("<script>") + 8, html.lastIndexOf("</script>")).replace(/<\\\/script/g, "</script");
	const document = fakeDocument();
	const stored = new Map();
	const window = {};
	const context = vm.createContext({
		document, window, console, structuredClone, URL, Blob, setTimeout,
		localStorage: { getItem: (key) => stored.get(key) ?? null, setItem: (key, value) => stored.set(key, value) },
	});
	new vm.Script(script, { filename: "transed.html" }).runInContext(context);

	const { service, state } = window.__transed;
	assert.equal(state.halfWave1, "HW_BLOSS");
	assert.equal(state.draft.ok, true);
	assert.match(document.getElementById("plot").innerHTML, /<svg[^>]*>.*data-series="k".*<\/svg>/s);
	assert.match(document.getElementById("couplingPlot").innerHTML, /data-series="cant"/);
	assert.equal(document.getElementById("hwIn").options.length, 28);
	assert.equal(service.listPresets().length, 33);
	assert.ok(stored.has("ufaim.transed.userLibrary.v1"), "the library is remembered");
});

test("the served page and the bundle start from the same sources", async () => {
	const page = await readFile(new URL("transed/index.html", ROOT), "utf8");
	const app = await readFile(new URL("transed/app.js", ROOT), "utf8");
	assert.ok(page.includes('<script type="module" src="./app.js"></script>'));
	assert.doesNotMatch(page, /https?:\/\//, "the page loads nothing from outside");
	const specifiers = [...app.matchAll(/from\s+["']([^"']+)["']/g)].map((match) => match[1]);
	assert.deepEqual(specifiers, ["../src/domain/transition/transitionLookup.json", "../src/services/transition-library/index.js"]);
	assert.doesNotMatch(app, /fetch\(|XMLHttpRequest|WebSocket|import\(/);
});
