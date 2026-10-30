import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

// The single-file AXTRAN2: the bundle builds, the page script compiles, and
// the worker's script - the same registry of modules - computes the same fit
// as the served app, driven here by a fake worker scope in Node.

const { bundle } = await import(new URL("../../tools/axtran2/bundle.mjs", import.meta.url));
const { runDemo } = await import(new URL("../../tools/axtran2/demo.mjs", import.meta.url));
const { loadTraAlignment, listTraFiles } = await import(new URL("corpus/loadTraAlignment.mjs", import.meta.url));
const SAMPLES = new URL("../samples/", import.meta.url).pathname;

async function smallTrustedFile() {
	for (const file of await listTraFiles(SAMPLES)) {
		let a;
		try { a = await loadTraAlignment(file); } catch { continue; }
		if (a.unsupported.length === 0 && a.kinks === 0 && a.elements.length >= 9 && a.elements.length <= 20 && a.elements.some((e) => e.type === "transition")) return file;
	}
	return null;
}

test("the bundle is one file whose worker computes the fit the served app computes", async () => {
	const dir = await mkdtemp(join(tmpdir(), "axtran2-bundle-"));
	const built = await bundle({ out: join(dir, "axtran2.html") });
	assert.ok(built.modules > 50 && built.bytes < 4e6, `${built.modules} modules, ${built.bytes} bytes`);
	const html = await readFile(built.out, "utf8");
	assert.equal((html.match(/<script/g) ?? []).length, 1, "one script, nothing loaded from outside");
	assert.ok(!/src="\.\/app\.js"/.test(html) && !html.includes("<script type=\"module\""), "no module loading left");
	// the page script compiles (it needs a document to run, so it is only compiled)
	const script = html.slice(html.indexOf("<script>") + 8, html.lastIndexOf("</script>")).replace(/<\\\/script/g, "</script");
	new vm.Script(script, { filename: "axtran2.html" });
	// the worker source is carried as a string; evaluate it in a fake worker scope
	const match = script.match(/window\.__AXTRAN2_WORKER_SOURCE = (".*?");\n/s);
	assert.ok(match, "the worker source is embedded");
	const workerSource = JSON.parse(match[1]);
	const posted = [];
	const scope = { self: null, postMessage: (m) => posted.push(m), console, TextDecoder, TextEncoder, structuredClone, URL, setTimeout, clearTimeout };
	scope.self = scope;
	vm.createContext(scope);
	vm.runInContext(workerSource, scope, { filename: "worker-bundle.js" });
	assert.equal(typeof scope.onmessage, "function", "the worker installed its handler");
	// a real alignment through it: the Vorführung's plan and lists
	const file = await smallTrustedFile();
	assert.ok(file, "a small corpus file (test/samples)");
	const demo = await runDemo({ tra: file, out: join(dir, "demo"), spacing: 20, maxIterations: 400 });
	const bytes = await readFile(join(dir, "demo", "plan.TRA"));
	const points = await readFile(join(dir, "demo", "aufmass.csv"), "utf8");
	const zwang = await readFile(join(dir, "demo", "zwangspunkte.csv"), "utf8");
	const endPose = demo.report.input.endPose === "given" ? JSON.parse(await readFile(join(dir, "demo", "report.json"), "utf8")) && null : null;
	void endPose;
	// the end pose the demo used, recovered from its summary's call
	const summary = await readFile(join(dir, "demo", "summary.md"), "utf8");
	const [, e, n, t] = summary.match(/--end-pose "([^,]+),([^,]+),([^"]+)"/);
	const pose = { x: Number(e), y: Number(n), theta: Math.PI / 2 - Number(t) * (Math.PI / 200) };
	await scope.onmessage({ data: { id: "1", bytes: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), name: "plan.TRA", points, zwang, options: { tolerance: 0.15, maxIterations: 400, endPose: pose } } });
	assert.equal(posted.length, 1, "one answer");
	const answer = posted[0];
	assert.ok(answer.ok, `${answer.code}: ${answer.message}`);
	assert.ok(answer.report.verdict.ok, `${answer.report.verdict.status} ${answer.report.verdict.reason ?? ""}`);
	assert.equal(answer.report.fit.outsideTolerance, 0);
	assert.ok(answer.tra.byteLength > 78 * 3, "a TRA came back");
	// the same answer as the served calculation on the same inputs, to the digit
	const { fitTra } = await import(new URL("../../tools/axtran2/fitTra.mjs", import.meta.url));
	const served = await fitTra({ tra: join(dir, "demo", "plan.TRA"), points, zwang, tolerance: 0.15, maxIterations: 400, endPose: pose });
	assert.equal(answer.report.verdict.iterations, served.report.verdict.iterations, "the bundle iterates exactly as the modules do");
	assert.equal(answer.report.fit.rms, served.report.fit.rms, "and lands on the same rms");
	assert.equal(answer.tra.byteLength, served.tra.byteLength, "and writes the same TRA");
});
