// test/axtran2/track-project.test.mjs
//
// The 7L project: which file is which of the seven lines, what a file
// holds, and how the lines stand in the table.

import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

await import("./corpus/loadTraAlignment.mjs");
const SERVICE = new URL("../../src/services/axtran2/", import.meta.url);
const KERNEL = new URL("../../src/domain/optimization/alignment/", import.meta.url);
const { PROJECT_LINES, FILE_LINES, roleOfFileName, assignProjectFiles, describeTra, describeGra, projectLinesModel, projectTableHtml, fitSummary, gradientSummary } = await import(new URL("trackProject.js", SERVICE));
const { writeTra } = await import(new URL("traWriter.js", SERVICE));
const { fitTraFromBytes } = await import(new URL("fitTraCore.js", SERVICE));
const { createAlignmentPoseJacobian } = await import(new URL("AlignmentPoseJacobian.js", KERNEL));
const { momentsFor } = await import(new URL("SolverDependencies.js", KERNEL));

test("a project is seven lines; five of them are files", () => {
	assert.deepEqual(PROJECT_LINES.map((l) => l.key), ["km-TRA", "re-TRA", "li-TRA", "re-UEB", "li-UEB", "re-GRA", "li-GRA"]);
	assert.deepEqual(FILE_LINES, ["km-TRA", "re-TRA", "li-TRA", "re-GRA", "li-GRA"]);
	assert.deepEqual(PROJECT_LINES.filter((l) => l.fit).map((l) => l.key), ["km-TRA", "re-TRA", "li-TRA", "re-GRA", "li-GRA"], "the axes and the gradients are adjusted; the cant band is judged with its axis");
});

test("a file name says its kind and its track where KM, RE or LI stands as a word", () => {
	const role = (name) => { const r = roleOfFileName(name); return `${r.track ?? "?"}-${r.kind ?? "?"}`; };
	assert.deepEqual(["6100_247-289_DBREF2016_RE.TRA", "6100_247-289_DBREF2016_KM.TRA", "1234_015-020_DBREF2016_LI.TRA", "6100_247-289_DBREF2016_RE.GRA", "x/y/Gleis-li.gra", "Strecke rechts.tra", "links.GRA"].map(role),
		["re-TRA", "km-TRA", "li-TRA", "re-GRA", "li-GRA", "re-TRA", "li-GRA"]);
	// no word of its own: "plan" carries no track, nor does "Kreli" or "5632R000"
	assert.deepEqual(["plan.TRA", "Kreli.TRA", "5632R000-002.TRA", "aufmass.csv", "KM_Projekt_RE.tra"].map(role), ["?-TRA", "?-TRA", "?-TRA", "?-?", "re-TRA"]);
});

test("files go to their lines; a name without a track takes the first free line of its kind, and that is said", () => {
	const full = assignProjectFiles(["P_RE.GRA", "P_LI.TRA", "P_KM.TRA", "P_RE.TRA", "P_LI.GRA"]);
	assert.deepEqual(full.lines, { "re-GRA": "P_RE.GRA", "li-TRA": "P_LI.TRA", "km-TRA": "P_KM.TRA", "re-TRA": "P_RE.TRA", "li-GRA": "P_LI.GRA" });
	assert.deepEqual([full.assumed, full.unassigned], [[], []]);
	const loose = assignProjectFiles(["plan.TRA", "zweites.TRA", "hoehen.GRA", "P_LI.TRA"]);
	assert.deepEqual(loose.lines, { "li-TRA": "P_LI.TRA", "re-TRA": "plan.TRA", "km-TRA": "zweites.TRA", "re-GRA": "hoehen.GRA" }, "the named one first, then the free lines: re, li, km");
	assert.deepEqual(loose.assumed, [{ name: "plan.TRA", line: "re-TRA" }, { name: "zweites.TRA", line: "km-TRA" }, { name: "hoehen.GRA", line: "re-GRA" }]);
	// a line already filled by an earlier load is not given to a file without a track
	assert.deepEqual(assignProjectFiles(["plan.TRA"], { "re-TRA": "P_RE.TRA" }).lines, { "li-TRA": "plan.TRA" });
	const refused = assignProjectFiles(["A_RE.TRA", "B_RE.TRA", "P_KM.GRA", "liste.csv"]);
	assert.deepEqual(refused.lines, { "re-TRA": "A_RE.TRA" });
	assert.deepEqual(refused.unassigned.map((u) => [u.name, /schon|keine Gradiente|weder/.exec(u.why)[0]]), [["B_RE.TRA", "schon"], ["P_KM.GRA", "keine Gradiente"], ["liste.csv", "weder"]]);
});

// an invented track: straight, clothoid, arc R 400 with 100 mm of cant, straight
const ORIGIN = { x: 3476000, y: 5474000 };
const startPose = { x: 0, y: 0, theta: 0.3 };
const track = (lengths = [60, 50, 80, 60]) => [
	{ id: "E0", type: "straight", length: lengths[0] }, { id: "E1", type: "transition", length: lengths[1], family: "clothoid" },
	{ id: "E2", type: "arc", length: lengths[2], curvature: 1 / 400 }, { id: "E3", type: "straight", length: lengths[3] },
];
const world = (p) => ({ x: p.x + ORIGIN.x, y: p.y + ORIGIN.y, theta: p.theta });
const chainOf = (elements) => createAlignmentPoseJacobian({ elements, startPose, momentsFor });
const traOf = (elements, cantAt = null) => {
	const chain = chainOf(elements);
	return writeTra({ elements, poseOfElement: (i) => world(chain.entryPose(i)), poseAtStation: (s) => world(chain.poseAt(s)), endPose: world(chain.endPose), startStation: 1000, ...(cantAt ? { cantAt } : {}) }).bytes;
};

test("a TRA is described by its records, its length, its stations and its cant band", () => {
	const plain = describeTra(traOf(track()));
	assert.deepEqual(plain, { kind: "TRA", records: 4, length: 250, stationStart: 1000, stationEnd: 1250, stationEquations: 0, cant: { records: 0, maxMm: 0 } });
	// the cant the writer carries: 100 mm on the arc, ramping over the clothoid
	const canted = describeTra(traOf(track(), (s) => (s >= 110 && s < 190 ? { cantA: 100, cantE: 100 } : s >= 60 && s < 110 ? { cantA: 0, cantE: 100 } : { cantA: 0, cantE: 0 })));
	assert.deepEqual(canted.cant, { records: 2, maxMm: 100 });
	assert.throws(() => describeTra(new Uint8Array(10)));
});

test("the seven lines as they stand: empty, loaded, ready, fitted - and the lines that follow their axis", async () => {
	const empty = projectLinesModel({}, null);
	assert.deepEqual(empty.map((l) => [l.key, l.loaded, l.state, l.tone]), PROJECT_LINES.map((l) => [l.key, false, "—", "empty"]));
	const re = describeTra(traOf(track([60.4, 50, 79.6, 60]), (s) => (s >= 110 && s < 190 ? { cantA: 100, cantE: 100 } : { cantA: 0, cantE: 0 })));
	const gra = { kind: "GRA", gradeBreaks: 12, rounded: 5, stationStart: 1000, stationEnd: 1250, heightMin: 3.6, heightMax: 41.01, cantConstructions: 2 };
	const loaded = projectLinesModel({ "re-TRA": { file: "P_RE.TRA", description: re }, "re-GRA": { file: "P_RE.GRA", description: gra }, "li-TRA": { file: "kaputt_LI.TRA", error: "die TRA trägt keine Sätze" }, "km-TRA": { file: "plan.TRA", description: re, assumed: true, points: true } }, "re-TRA");
	const byKey = Object.fromEntries(loaded.map((l) => [l.key, l]));
	assert.deepEqual([byKey["re-TRA"].content, byKey["re-TRA"].state, byKey["re-TRA"].tone, byKey["re-TRA"].active], ["4 Sätze, 250,00 m, Station 1 000,000 bis 1 250,000", "geladen; das Aufmaß fehlt", "loaded", true]);
	assert.deepEqual([byKey["km-TRA"].state, byKey["km-TRA"].tone, byKey["km-TRA"].assumed], ["bereit: Aufmaß liegt vor", "ready", true]);
	assert.deepEqual([byKey["li-TRA"].state, byKey["li-TRA"].tone, byKey["li-TRA"].loaded], ["nicht lesbar: die TRA trägt keine Sätze", "error", false]);
	assert.deepEqual([byKey["re-UEB"].file, byKey["re-UEB"].content, byKey["re-UEB"].state], ["P_RE.TRA + P_RE.GRA", "1 von 4 Sätzen mit Überhöhung, bis 100 mm; 2 Rampenkonstruktionen in der GRA", "wird mit der Achse geprüft, nicht verändert"]);
	assert.deepEqual([byKey["re-GRA"].content, byKey["re-GRA"].state], ["12 Neigungswechsel, 5 ausgerundet, Station 1 000,000 bis 1 250,000, Höhe 3,60 bis 41,01 m", "geladen; noch nicht im Ausgleich"]);
	assert.deepEqual([byKey["li-UEB"].loaded, byKey["li-GRA"].loaded], [false, false], "a broken axis carries no cant band");
	const one = projectLinesModel({ "li-GRA": { file: "P_LI.GRA", description: { ...gra, cantConstructions: 1 } } }).find((l) => l.key === "li-UEB");
	assert.deepEqual([one.file, one.content], ["P_LI.GRA", "1 Rampenkonstruktion in der GRA"], "a cant band may stand in the GRA alone");

	// fitted: the axis says its fit, the cant band is judged with it, the gradient says its stations are the old ones
	const truth = chainOf(track());
	const points = [];
	for (let s = 20; s < 230; s += 10) { const p = world(truth.poseAt(s)); points.push({ name: `P${points.length + 1}`, x: p.x, y: p.y }); }
	const { report } = await fitTraFromBytes({ bytes: traOf(track([60.4, 50, 79.6, 60])), name: "P_RE.TRA", points, tolerance: 0.003, speedKmh: 80, endPose: world(truth.endPose), maxIterations: 200 });
	const fit = fitSummary(report);
	assert.deepEqual([fit.status, fit.ok, fit.points, typeof fit.rms, fit.cant.arcs, fit.cant.speedKmh], [report.verdict.status, true, 21, "number", 1, 80]);
	const fitted = Object.fromEntries(projectLinesModel({ "re-TRA": { file: "P_RE.TRA", description: re, points: true, fit }, "re-GRA": { file: "P_RE.GRA", description: gra } }, "re-TRA").map((l) => [l.key, l]));
	assert.match(fitted["re-TRA"].state, /^Fit (converged|stationary): rms 0,\d{3} m, max 0,\d{3} m, \d+ von 21 außerhalb, Länge [+−]0,\d{3} m$/);
	assert.match(fitted["re-UEB"].state, /^mit der Achse geprüft, nicht verändert: bei V 80 km\/h liegen \d von 1 Bögen über \d+ mm Fehlbetrag \(vorher \d\)$/);
	assert.match(fitted["re-GRA"].state, /^geladen; noch nicht im Ausgleich; die Achse ist nach dem Fit um 0,\d{3} m (länger|kürzer), die Stationen der Gradiente sind die vor dem Fit$/);

	// a gradient adjusted: its row says the fit, how many heights were free and which line it is stationed along
	const adjusted = gradientSummary({ verdict: { status: "converged", ok: true }, fit: { rmsBefore: 0.0312, rmsAfter: 0.0041, maxAfter: 0.0093, outsideAfter: 0 }, points: new Array(50).fill({}),
		breaks: [{ free: false }, { free: true, determined: true }, { free: true, determined: false }, { free: false }], input: { stationing: { line: "P_KM.TRA" } } });
	const graRow = projectLinesModel({ "re-GRA": { file: "P_RE.GRA", description: gra, gradient: adjusted } }).find((l) => l.key === "re-GRA");
	assert.deepEqual([graRow.state, graRow.tone], ["Ausgleich converged: rms 0,004 m (vorher 0,031 m), max 0,009 m, 0 von 50 außerhalb; 2 von 4 Höhen frei, 1 davon ohne Messung am Plan geblieben; stationiert an P_KM.TRA", "ok"]);
	assert.match(projectTableHtml(projectLinesModel({ "re-GRA": { file: "P_RE.GRA", description: gra } })), /<tr data-line="re-GRA" class="tone-loaded">.*?<button type="button" class="ghost tiny" data-gradient="re-GRA"[^>]*>ausgleichen<\/button><\/td><\/tr>/);

	// the table: seven rows, a button on a loaded axis, the active one marked, every label escaped
	const html = projectTableHtml(projectLinesModel({ "re-TRA": { file: "<b>_RE.TRA", description: re }, "km-TRA": { file: "plan.TRA", description: re, assumed: true } }, "re-TRA"));
	assert.equal((html.match(/<tr data-line=/g) ?? []).length, 7);
	assert.match(html, /<tr data-line="re-TRA" class="tone-loaded active"><td><b>re-TRA<\/b><\/td><td>Achse, rechtes Gleis<\/td><td>&lt;b&gt;_RE\.TRA<\/td>/);
	assert.match(html, /<button type="button" class="primary tiny" data-line="re-TRA"[^>]*aria-pressed="true">in Arbeit<\/button>/);
	assert.match(html, /<tr data-line="km-TRA" class="tone-loaded">.*?plan\.TRA \(angenommen\)<\/td>.*?<button type="button" class="ghost tiny" data-line="km-TRA"[^>]*>bearbeiten<\/button>/);
	assert.match(html, /<tr data-line="li-GRA" class="tone-empty"><td><b>li-GRA<\/b><\/td><td>Gradiente, linkes Gleis<\/td><td>—<\/td><td><\/td><td class="state">—<\/td><td class="act"><\/td><\/tr>/);
});

test("a corpus project: the kilometre line, the right track and its gradient are read as what they are", async (context) => {
	const dir = new URL("../samples/Billwerder/2024-11-23 Trassierungsdaten/6100_Trassierung_DBREF2016/", import.meta.url);
	const read = async (name) => new Uint8Array(await readFile(new URL(name, dir)));
	let re, km, gra;
	try { [re, km, gra] = await Promise.all(["6100_247-289_DBREF2016_RE.TRA", "6100_247-289_DBREF2016_KM.TRA", "6100_247-289_DBREF2016_RE.GRA"].map(read)); }
	catch (error) { if (error.code === "ENOENT") return context.skip("local TRA corpus unavailable"); throw error; }
	const dRe = describeTra(re), dKm = describeTra(km), dGra = await describeGra(gra, "6100_247-289_DBREF2016_RE.GRA");
	assert.deepEqual([dRe.records, dRe.cant.records, dRe.cant.maxMm, dRe.stationEquations], [238, 157, 160, 0]);
	assert.deepEqual([dKm.records, dKm.cant.records, dKm.stationEquations], [241, 0, 6], "the kilometre line carries the station equations and no cant");
	assert.deepEqual([dGra.gradeBreaks, dGra.rounded, dGra.heightMin, dGra.heightMax, dGra.kilometreJumps, dGra.cantConstructions], [143, 80, 3.6, 41.01, 6, 1], "149 records: 143 grade breaks, six of them a kilometre jump's two records");
	assert.deepEqual([dGra.stationStart, dGra.stationEnd], [246976.16652999978, 289148.79082830943]);
	const assigned = assignProjectFiles(["6100_247-289_DBREF2016_RE.TRA", "6100_247-289_DBREF2016_KM.TRA", "6100_247-289_DBREF2016_RE.GRA"]);
	assert.deepEqual(Object.keys(assigned.lines).sort(), ["km-TRA", "re-GRA", "re-TRA"]);
	await assert.rejects(describeGra(re, "x.GRA"));
});
