import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, readFile, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

// The Vorführung, run as a test: a real corpus alignment, a derived Aufmaß,
// a plan deliberately off, the track's end pose, the adapter. What it has
// to show is what a colleague would ask for: the axis back on the survey,
// the Zwangspunkt met, the files there.

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

test("the Vorführung brings a plan metres off back onto the survey, with the Zwangspunkt met", async () => {
	const file = await smallTrustedFile();
	assert.ok(file, "a small corpus file with a transition (test/samples)");
	const out = await mkdtemp(join(tmpdir(), "axtran2-demo-"));
	const demo = await runDemo({ tra: file, out, spacing: 20, maxIterations: 400 });
	assert.ok(demo.before.max > 0.2, `the plan has to be visibly off: ${demo.before.max} m`);
	assert.ok(demo.report.verdict.ok, `${demo.report.verdict.status} ${demo.report.verdict.reason ?? ""}`);
	assert.equal(demo.report.input.endPose, "given", "the end pose is the track's, not the plan's");
	assert.ok(demo.after.rms < 0.05, `rms after ${demo.after.rms} m`);
	assert.equal(demo.report.fit.outsideTolerance, 0);
	assert.ok(demo.axisMax < 0.2, `the fitted axis stays within ${demo.axisMax} m of the track`);
	const z = demo.report.points.find((p) => p.kind === "zwangspunkt");
	assert.ok(z && Math.abs(z.offset - z.target) < 1e-4, `Zwangspunkt ${z?.offset} against ${z?.target}`);
	for (const name of ["aufmass.csv", "zwangspunkte.csv", "plan.TRA", "fitted.TRA", "report.json", "residuen.csv", "summary.md"]) {
		assert.ok((await stat(join(out, name))).size > 0, `${name} written`);
	}
	const summary = await readFile(join(out, "summary.md"), "utf8");
	assert.match(summary, /kein echtes Aufmaß/, "the summary says the survey is derived");
	assert.match(summary, /--end-pose/, "the summary shows the call with the end pose");
	// the fitted TRA reads back with the track's element count
	const back = await loadTraAlignment(join(out, "fitted.TRA"));
	assert.equal(back.elements.length, (await loadTraAlignment(file)).elements.length);
});
