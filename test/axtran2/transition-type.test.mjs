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

test("a record taken out or put in changes what the fit starts from; the file's records keep their numbers", async () => {
	// the transition out: the straight meets the arc; the file's spans stay with the straight
	const out = (await fit({ edits: "-2" })).report;
	assert.deepEqual(out.elements.map((e) => [e.type, [...e.records]]), [["straight", [1]], ["arc", [3]], ["straight", [4]]]);
	assert.deepEqual(out.input.structure, { removed: [2], inserted: [] });
	assert.deepEqual(out.planRecords.map((r) => [r.number, r.removed, r.element]), [[1, false, "E0"], [2, true, null], [3, false, "E2"], [4, false, "E3"]]);
	assert.ok(out.verdict.ok, `${out.verdict.status} ${out.verdict.reason ?? ""}`);
	assert.equal(out.output.records, 3, "the written file has three records");
	// a straight put in after the transition, and a Bloss put in where the file has none
	const put = (await fit({ edits: "+2=G:10 -2 +1=U:30:Bloss" })).report;
	assert.deepEqual(put.elements.map((e) => [e.type, e.family ?? null, [...e.records]]), [["straight", null, [1]], ["transition", "bloss", ["1+1"]], ["straight", null, ["2+1"]], ["arc", null, [3]], ["straight", null, [4]]]);
	assert.deepEqual(put.input.structure.inserted.map((i) => [i.key, i.after, i.type, i.length, i.family, i.element]), [["1+1", 1, "transition", 30, "bloss", "I1"], ["2+1", 2, "straight", 10, null, "I2"]]);
	assert.deepEqual(put.planRecords.map((r) => r.number), [1, "1+1", 2, "2+1", 3, 4]);
	const inserted = put.planRecords.find((r) => r.number === "2+1");
	assert.deepEqual([inserted.type, inserted.length, inserted.inserted, inserted.element, inserted.fileLength, inserted.held], ["straight", 10, { after: 2, index: 1 }, "I2", null, null]);
	assert.equal(put.output.records, 5);
	// refused: the ends, a held record taken out, two transitions side by side
	for (const bad of ["-1", "-4", "+4=G:5", "+1=U:20"]) await assert.rejects(fit({ edits: bad }), (e) => e.code === "INVALID_EDIT", bad);
	await assert.rejects(fit({ edits: "-2", hold: "2L" }), (e) => e.code === "INVALID_EDIT");
});

test("the list shows a record taken out struck, a record put in under its key, and the form to put one in", async () => {
	const report = (await fit({ edits: "+2=G:10 -2 +1=U:30:Bloss" })).report;
	const model = alignmentPictureModel(report);
	const html = recordListHtml(model);
	assert.match(html, /<th>Sätze<\/th>/);
	assert.match(html, /<tr data-record="2" class="removed"><td class="num">2<\/td><td>Übergangsbogen<\/td>.*?<td>herausgenommen<\/td><td class="act"><button type="button" class="ghost tiny" data-action="restore" data-record="2"/);
	assert.match(html, /<tr data-record="1\+1" class="inserted"><td class="num">\+<\/td><td>Übergangsbogen <select data-record="1\+1" data-field="family"[^>]*>.*?<option value="bloss" selected>.*?<input type="text" inputmode="decimal" data-record="1\+1" data-field="length" value="30" class=""/);
	assert.match(html, /<tr data-record="1\+1" class="inserted">.*?<td class="hold" colspan="2"><\/td><td>eingefügt nach Satz 1<\/td><td class="act"><button type="button" class="ghost tiny" data-action="drop" data-record="1\+1"/);
	assert.match(html, /<tr data-record="2\+1" class="inserted">.*?data-field="length" value="10"/);
	// the ends and the last record's + are disabled, with the reason
	assert.match(html, /data-action="remove" data-record="1" title="Satz 1 ist der erste der Datei[^"]*" disabled/);
	assert.match(html, /data-action="remove" data-record="4" title="Satz 4 ist der letzte der Datei[^"]*" disabled/);
	assert.match(html, /data-action="insert-after" data-record="4" title="hinter dem letzten Satz geht nichts hinein" disabled/);
	assert.match(html, /data-action="insert-after" data-record="3" title="nach Satz 3 einen Satz einfügen">/);
	// the form opens under the record named
	const open = recordListHtml(model, { insertAfter: 3 });
	assert.match(open, /<tr data-record="3">.*?<\/tr><tr class="insert-form" data-after="3"><td colspan="11"><form data-insert-after="3" class="insert">.*?<select name="kind"[^>]*><option value="straight">Gerade<\/option><option value="arc">Bogen<\/option><option value="transition">Übergangsbogen<\/option><\/select>.*?<input name="len"[^>]*>.*?<input name="rad"[^>]*>.*?<select name="fam">.*?<button type="submit"/);
	assert.ok(!html.includes("insert-form"));
	// the picture: the inserted records have columns, no locks; the removed one nothing
	const svg = alignmentPictureSvg(model, { width: 1200 });
	assert.ok(/<rect data-record="1\+1"/.test(svg) && !/<g data-record="1\+1"/.test(svg) && !/data-record="2"/.test(svg));
	const probe = pictureProbe(model, 1200, 72 + (75 / model.total) * 1112);
	assert.match(pictureReadout(model, probe), /Satz 1\+1 Übergangsbogen \(Bloss\), 30,00 m, eingefügt nach Satz 1/);
});
