// test/axtran2/transition-type.test.mjs
//
// Klothoide nach Bloss: a transition's type is an edit like a length. The
// fit starts from the other law, the written file carries the other Kz,
// and the picture draws the other curve. No kernel change: the registry
// knows the families, the writer their Kz.

import assert from "node:assert/strict";
import test from "node:test";

const SERVICE = new URL("../../src/services/axtran2/", import.meta.url);
const KERNEL = new URL("../../src/domain/optimization/alignment/", import.meta.url);
const { fitTraFromBytes } = await import(new URL("fitTraCore.js", SERVICE));
const { writeTra } = await import(new URL("traWriter.js", SERVICE));
const { alignmentPictureModel, alignmentPictureSvg, pictureProbe, pictureReadout } = await import(new URL("alignmentPicture.js", SERVICE));
const { recordListHtml } = await import(new URL("recordList.js", SERVICE));
const { traAlignmentFromBytes } = await import(new URL("../../src/import/parsers/technet/vermEsn/traAlignment.js", import.meta.url));
const { createAlignmentPoseJacobian } = await import(new URL("AlignmentPoseJacobian.js", KERNEL));
const { momentsFor } = await import(new URL("SolverDependencies.js", KERNEL));

const ORIGIN = { x: 3476000, y: 5474000 };
const startPose = { x: 0, y: 0, theta: 0.3 };
const track = (family, lengths = [60, 50, 80, 60]) => [
	{ id: "E0", type: "straight", length: lengths[0] },
	{ id: "E1", type: "transition", length: lengths[1], family },
	{ id: "E2", type: "arc", length: lengths[2], curvature: 1 / 400 },
	{ id: "E3", type: "straight", length: lengths[3] },
];
const world = (p) => ({ x: p.x + ORIGIN.x, y: p.y + ORIGIN.y, theta: p.theta });
const chainOf = (elements) => createAlignmentPoseJacobian({ elements, startPose, momentsFor });
const traOf = (elements) => {
	const chain = chainOf(elements);
	return writeTra({ elements, poseOfElement: (i) => world(chain.entryPose(i)), poseAtStation: (s) => world(chain.poseAt(s)), endPose: world(chain.endPose) }).bytes;
};
// the track is a Bloss; the plan says clothoid
const truth = track("bloss");
const truthChain = chainOf(truth);
const total = truth.reduce((s, e) => s + e.length, 0);
const points = [];
for (let s = 20; s < total - 20; s += 10) { const p = world(truthChain.poseAt(s)); points.push({ name: `P${points.length + 1}`, x: p.x, y: p.y }); }
const planBytes = traOf(track("clothoid", [60.4, 50, 79.6, 60]));
const fit = (input) => fitTraFromBytes({ bytes: planBytes, name: "transition.TRA", points, tolerance: 0.003, speedKmh: 80, endPose: world(truthChain.endPose), maxIterations: 300, ...input });

test("a clothoid in the file is fitted as a Bloss when the edit says so, and written back as one", async () => {
	const plan = await traAlignmentFromBytes(planBytes, "plan.TRA");
	assert.deepEqual(plan.elements.map((e) => e.family ?? null), [null, "clothoid", null, null]);
	const asClothoid = (await fit({})).report;
	const asBloss = (await fit({ edits: "2T=Bloss" })).report;
	assert.ok(asBloss.verdict.ok, `${asBloss.verdict.status} ${asBloss.verdict.reason ?? ""}`);
	assert.ok(asBloss.fit.rms < asClothoid.fit.rms, `the Bloss meets the Bloss track better: ${asBloss.fit.rms} against ${asClothoid.fit.rms}`);
	assert.deepEqual(asBloss.input.edits, [{ record: 2, element: "E1", length: null, radius: null, family: "bloss" }]);
	assert.equal(asBloss.elements[1].family, "bloss");
	const r2 = asBloss.planRecords[1];
	assert.deepEqual([r2.type, r2.family, r2.fileFamily, r2.edited], ["transition", "bloss", "clothoid", { length: false, radius: false, family: true }]);
	assert.deepEqual(asClothoid.planRecords.map((r) => [r.family, r.fileFamily]), [[null, null], ["clothoid", "clothoid"], [null, null], [null, null]]);
	// the written file: Kz 4 for the transition, read back as a Bloss
	const written = await fit({ edits: "2T=Bloss" });
	const back = await traAlignmentFromBytes(written.tra, "back.TRA");
	assert.equal(back.elements[1].family, "bloss", "the reader maps Kz 4 to the Bloss");
	assert.equal(back.records[1].type, "transition");
	// the other way and the S-Form read the same; the arc has no type to change
	assert.equal((await fit({ edits: "2T=S-Form" })).report.elements[1].family, "helmert");
	await assert.rejects(fit({ edits: "3T=Bloss" }), (e) => e.code === "INVALID_EDIT");
});

test("the picture draws the transition along its law and names the type; the list offers the choice", async () => {
	const report = (await fit({ edits: "2T=Bloss" })).report;
	const model = alignmentPictureModel(report);
	const svg = alignmentPictureSvg(model, { width: 1200 });
	// the Bloss adds its sampled points to the band where the clothoid has a line
	const clothoidSvg = alignmentPictureSvg(alignmentPictureModel((await fit({})).report), { width: 1200 });
	const segments = (s) => (s.match(/<path d="M[^"]*"/)[0].match(/L/g) || []).length;
	assert.ok(segments(svg) > segments(clothoidSvg) + 5, `${segments(svg)} against ${segments(clothoidSvg)}`);
	const width = 1200;
	const probe = pictureProbe(model, width, 72 + (85 / model.total) * (width - 88));
	assert.match(pictureReadout(model, probe), /Satz 2 Übergangsbogen \(Bloss\), 50,00 m, frei/);
	const html = recordListHtml(model);
	assert.match(html, /<tr data-record="2"><td class="num">2<\/td><td>Übergangsbogen <select data-record="2" data-field="family" class="edited" title="In der Datei: Klothoide"[^>]*><option value="clothoid">Klothoide<\/option><option value="bloss" selected>Bloss<\/option><option value="helmert">S-Form<\/option><\/select><\/td>/);
	// chosen and not yet computed: the choice shows it, dashed
	const pending = recordListHtml(model, { edits: "2T=S-Form" });
	assert.match(pending, /data-record="2" data-field="family" class="edited pending" title="In der Datei: Klothoide; noch nicht gerechnet"[^>]*>.*?<option value="helmert" selected>/);
	const back = recordListHtml(model, { edits: "" });
	assert.match(back, /data-record="2" data-field="family" class="pending" title="Typ wie in der Datei; noch nicht gerechnet"/);
});
