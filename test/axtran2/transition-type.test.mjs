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
	assert.deepEqual([r2.type, r2.family, r2.fileFamily, r2.edited], ["transition", "bloss", "clothoid", { length: false, radius: false, family: true, turnout: false }]);
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
	assert.deepEqual(out.input.structure, { removed: [2], inserted: [], turnouts: [] });
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
	assert.match(open, /<tr data-record="3">.*?<\/tr><tr class="insert-form" data-after="3"><td colspan="11"><form data-insert-after="3" class="insert">.*?<select name="kind"[^>]*><option value="straight">Gerade<\/option><option value="arc">Bogen<\/option><option value="transition">Übergangsbogen<\/option><option value="turnout">Weiche<\/option><option value="crossing">Kreuzungsweiche<\/option><\/select>.*?<input name="len"[^>]*>.*?<input name="rad"[^>]*>.*?<select name="fam">.*?<select name="wshape">.*?EW 190-1:9 \(Zweig 40 km\/h\).*?<select name="wside">.*?<select name="worient">.*?<input name="wmain"[^>]*>.*?<select name="kshape">.*?DKW 190-1:9 \(Bogen 40, gerade 100 km\/h\).*?<select name="kroute">.*?<select name="kside">.*?<button type="submit"/);
	assert.ok(!html.includes("insert-form"));
	// the picture: the inserted records have columns, no locks; the removed one nothing
	const svg = alignmentPictureSvg(model, { width: 1200 });
	assert.ok(/<rect data-record="1\+1"/.test(svg) && !/<g data-record="1\+1"/.test(svg) && !/data-record="2"/.test(svg));
	const probe = pictureProbe(model, 1200, 72 + (75 / model.total) * 1112);
	assert.match(pictureReadout(model, probe), /Satz 1\+1 Übergangsbogen \(Bloss\), 30,00 m, eingefügt nach Satz 1/);
});

test("a turnout from the catalogue goes in after a record, held whole, and sets the speed the branch allows", async () => {
	// after the first straight: the branch of an EW 190-1:9 to the right, arc then end piece
	const report = (await fit({ edits: "+1=W:190-1/9:R", speedKmh: null })).report;
	assert.deepEqual(report.elements.map((e) => [e.type, [...e.records]]), [["straight", [1]], ["arc", ["1+1a"]], ["straight", ["1+1b"]], ["transition", [2]], ["arc", [3]], ["straight", [4]]]);
	const arc = report.elements[1], end = report.elements[2];
	assert.ok(Math.abs(arc.before.length - 190 * Math.atan(1 / 9)) < 1e-9 && arc.before.radius === 190, "the branch as the annex has it, R positive: a right-hand curve");
	assert.equal(arc.after.length, arc.before.length); assert.equal(arc.after.radius, 190); assert.equal(end.after.length, end.before.length);
	assert.equal(report.input.free, (await fit({})).report.input.free, "a turnout put in adds no free quantity");
	assert.deepEqual(report.input.turnouts.map((t) => [t.designation, t.held, [...t.records], t.inserted?.after ?? null]), [["EW 190-1:9", true, ["1+1a", "1+1b"], 1]]);
	assert.deepEqual([report.input.speed.basis, report.input.speed.kmh ?? report.input.speedKmh], ["turnout", 40]);
	assert.deepEqual(report.input.structure.turnouts.map((t) => [t.designation, t.side, t.orientation, t.after]), [["EW 190-1:9", "right", "WA", 1]]);
	const rows = report.planRecords.filter((r) => r.inserted);
	assert.deepEqual(rows.map((r) => [r.number, r.type, r.turnout, r.held, r.heldLength, r.heldRadius, r.inserted.part]), [["1+1a", "arc", "EW 190-1:9", "EW 190-1:9", true, true, "arc"], ["1+1b", "straight", "EW 190-1:9", "EW 190-1:9", true, false, "endPiece"]]);
	// the word Weichen may stand although the file has none: the turnout put in is held by itself
	assert.ok((await fit({ edits: "+1=W:190-1/9:R", hold: "Weichen" })).report.verdict.status);
	// the list: no fields, no boxes, shaded as held, one − for both rows; the picture: columns without locks
	const model = alignmentPictureModel(report);
	const html = recordListHtml(model);
	assert.match(html, /<tr data-record="1\+1a" class="inserted"><td class="num">\+<\/td><td>Bogen<\/td><td>EW 190-1:9<\/td><td class="num">21,02<\/td><td class="num">21,02<\/td><td class="num">190<\/td><td class="num">190<\/td><td class="hold" colspan="2"><\/td><td>eingefügt nach Satz 1, gehalten<\/td><td class="act"><button type="button" class="ghost tiny" data-action="drop" data-record="1\+1a"/);
	assert.match(html, /<tr data-record="1\+1b" class="inserted">.*?<td>eingefügt nach Satz 1, gehalten<\/td>/);
	const svg = alignmentPictureSvg(model, { width: 1200 });
	assert.ok(/<rect data-record="1\+1a"[^>]*fill="#F6E7BE"/.test(svg) && !/<g data-record="1\+1a"/.test(svg));
});

test("a crossing turnout's route and a bent turnout go in like a turnout, held, and the report knows what they are", async () => {
	const report = (await fit({ edits: "+1=K:DKW:190-1/9:L +3=W:190-1/9:R:auf400", speedKmh: null })).report;
	assert.deepEqual(report.elements.map((e) => [e.type, [...e.records]]), [["straight", [1]], ["arc", ["1+1"]], ["transition", [2]], ["arc", [3]], ["arc", ["3+1a"]], ["arc", ["3+1b"]], ["straight", [4]]]);
	assert.equal(report.input.free, (await fit({})).report.input.free, "neither adds a free quantity");
	assert.deepEqual(report.input.turnouts.map((t) => [t.designation, t.kind, t.held, [...t.records], t.inserted.route, t.inserted.bent?.kind ?? null]), [["DKW 190-1:9, Bogenfahrt", "DKW", true, ["1+1"], "curved", null], ["IBW 190-1:9 auf R 400", "IBW", true, ["3+1a", "3+1b"], null, "IBW"]]);
	assert.deepEqual([report.input.speed.basis, report.input.speed.kmh], ["turnout", 40], "the DKW's curved route sets the speed; the bent turnout has no row");
	const rows = report.planRecords.filter((r) => r.inserted);
	assert.deepEqual(rows.map((r) => [r.number, r.type, r.turnout, r.heldLength, r.heldRadius, r.inserted.part]), [["1+1", "arc", "DKW 190-1:9, Bogenfahrt", true, true, "arc"], ["3+1a", "arc", "IBW 190-1:9 auf R 400", true, true, "arc"], ["3+1b", "arc", "IBW 190-1:9 auf R 400", true, true, "endPiece"]]);
	// the arc R 400 of the file is a right-hand curve (file sign +400): the branch to the right on it is the tighter IBW
	assert.ok(Math.abs(report.elements[4].before.radius - 1 / (1 / 190 + 1 / 400)) < 1e-6, `branch radius ${report.elements[4].before.radius}`);
	assert.match(recordListHtml(alignmentPictureModel(report)), /<tr data-record="3\+1a" class="inserted">.*?<td>IBW 190-1:9 auf R 400<\/td>.*?<td>eingefügt nach Satz 3, gehalten<\/td>/);
});

test("a turnout with two branch radii goes in as two held arcs, and the report carries both", async () => {
	const report = (await fit({ edits: "+1=W:7000/6000-1/42:R", speedKmh: null })).report;
	assert.deepEqual(report.elements.map((e) => [e.type, [...e.records]]), [["straight", [1]], ["arc", ["1+1a"]], ["arc", ["1+1b"]], ["transition", [2]], ["arc", [3]], ["straight", [4]]]);
	assert.deepEqual(report.input.turnouts.map((t) => [t.designation, t.kind, t.radius, t.radiusEnd, [...t.arcs], t.held, [...t.records], t.branchSpeedKmh]), [["EW 7000/6000-1:42", "EW", 7000, 6000, ["1+1a", "1+1b"], true, ["1+1a", "1+1b"], 200]]);
	assert.deepEqual([report.input.speed.basis, report.input.speed.kmh], ["turnout", 200], "the branch of the 7000/6000 allows 200 km/h");
	const rows = report.planRecords.filter((r) => r.inserted);
	assert.deepEqual(rows.map((r) => [r.number, r.type, Number(r.length.toFixed(3)), Number(r.radius.toFixed(0)), r.heldLength, r.heldRadius, r.inserted.part]), [["1+1a", "arc", 80.001, 7000, true, true, "arc"], ["1+1b", "arc", 74.258, 6000, true, true, "arc2"]]);
	assert.match(recordListHtml(alignmentPictureModel(report), { insertAfter: 1 }), /<option value="7000\/6000-1\/42">EW 7000\/6000-1:42 \(Zweig 200 km\/h\)<\/option>/);
});

test("a plain crossing goes in as a held straight, and the report knows it as a Kr", async () => {
	const report = (await fit({ edits: "+1=K:Kr:1/9", speedKmh: null })).report;
	assert.deepEqual(report.elements.map((e) => [e.type, [...e.records]]), [["straight", [1]], ["straight", ["1+1"]], ["transition", [2]], ["arc", [3]], ["straight", [4]]]);
	assert.deepEqual(report.input.turnouts.map((t) => [t.designation, t.kind, t.radius, t.side, t.held, [...t.records], t.inserted.route, t.branchSpeedKmh]), [["Kr 1:9", "Kr", null, null, true, ["1+1"], "straight", 100]]);
	assert.deepEqual([report.input.speed.basis, report.input.speed.kmh], ["turnout", 100], "the crossing's straight allows 100 km/h");
	const rows = report.planRecords.filter((r) => r.inserted);
	assert.deepEqual(rows.map((r) => [r.number, r.type, r.length, r.turnout, r.heldLength, r.inserted.part]), [["1+1", "straight", 33.23, "Kr 1:9", true, "straight"]]);
	assert.match(recordListHtml(alignmentPictureModel(report), { insertAfter: 1 }), /<option value="Kr:1\/9">Kr 1:9 \(Kreuzung ohne Weiche, gerade 100 km\/h\)<\/option>/);
});

test("a turnout whose branch begins with a clothoid goes in as curvature holder, clothoid and arc, held; the written file reads back as the turnout", async () => {
	const { recogniseTurnouts } = await import(new URL("heldRecords.js", SERVICE));
	const report = (await fit({ edits: "+1=W:6000/3700-1/32,5:R", speedKmh: null })).report;
	assert.deepEqual(report.elements.map((e) => [e.type, [...e.records]]), [["straight", [1]], ["arc", ["1+1a"]], ["transition", ["1+1b"]], ["arc", ["1+1c"]], ["transition", [2]], ["arc", [3]], ["straight", [4]]]);
	const [holder, clothoid, arc] = report.elements.slice(1, 4);
	assert.deepEqual([holder.before.length, holder.before.radius, clothoid.family, Number(clothoid.before.length.toFixed(3)), Number(arc.before.length.toFixed(3)), arc.before.radius], [0, 6000, "clothoid", 44.001, 78.243, 3700]);
	assert.equal(report.input.free, (await fit({})).report.input.free, "the turnout adds no free quantity");
	assert.deepEqual(report.input.turnouts.map((t) => [t.designation, t.arc, [...t.arcs], t.transition, t.held, t.branchSpeedKmh]), [["EW 6000/3700-1:32.5", "1+1c", ["1+1a", "1+1c"], "1+1b", true, 160]]);
	assert.deepEqual([report.input.speed.basis, report.input.speed.kmh], ["turnout", 160]);
	assert.deepEqual(report.planRecords.filter((r) => r.inserted).map((r) => [r.number, r.type, r.inserted.part, r.heldLength]), [["1+1a", "arc", "junction", true], ["1+1b", "transition", "transition", true], ["1+1c", "arc", "arc2", true]]);
	// the written file: the holder is dropped, the clothoid carries R1 6000 and R2 3700; read back, the reader puts the
	// holder in again (a clothoid starting at a radius the straight before it does not have) and the turnout is recognised
	const result = await fit({ edits: "+1=W:6000/3700-1/32,5:R", speedKmh: null });
	const back = await traAlignmentFromBytes(result.tra, "back.TRA");
	assert.deepEqual(back.records.slice(0, 3).map((r) => [r.type, Number(r.length.toFixed(3)), r.radiusStart ?? null, r.radiusEnd ?? null]), [["straight", back.records[0].length, null, null], ["transition", 44.001, 6000, 3700], ["arc", 78.243, null, null]]);
	assert.equal(back.insertedJunctionArcs, 1);
	assert.deepEqual(back.elements.slice(0, 4).map((e) => [e.type, Number(e.length.toFixed(3)), e.type === "arc" ? Number((-1 / e.curvature).toFixed(0)) : null]), [["straight", Number(back.records[0].length.toFixed(3)), null], ["arc", 0, 6000], ["transition", 44.001, null], ["arc", 78.243, 3700]]);
	assert.deepEqual(recogniseTurnouts(back.records).map((t) => [t.designation, t.side, t.arc, t.transition, [...t.records]]), [["EW 6000/3700-1:32.5", "right", 3, 2, [2, 3]]]);
	// the picture draws the clothoid along its law between the holder's curvature and the arc's
	const model = alignmentPictureModel(report);
	const k = model.elements.find((e) => e.id === clothoid.id);
	assert.ok(Math.abs(k.k0 - 1000 / 6000) < 1e-9 && Math.abs(k.k1 - 1000 / 3700) < 1e-9, `the clothoid runs from ${k.k0} to ${k.k1}`);
	assert.match(recordListHtml(model), /<tr data-record="1\+1b" class="inserted"><td class="num">\+<\/td><td>Übergangsbogen \(Klothoide\)<\/td><td>EW 6000\/3700-1:32.5<\/td><td class="num">44,00<\/td>/);
});
