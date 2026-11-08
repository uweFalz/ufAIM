// test/axtran2/alignment-picture.test.mjs
//
// The picture of a fit: the curvature band with the file's records and
// their locks, and the points against the tolerance. The module is pure, so
// the picture is checked as numbers (the model) and as markup (the SVG).

import test from "node:test";
import assert from "node:assert/strict";
import { alignmentPictureModel, alignmentPictureSvg, pictureProbe, pictureReadout, recordGroup, holdMap, describeHold, PICTURE_HEIGHT, ALIGNMENT_PICTURE_VERSION } from "../../src/services/axtran2/alignmentPicture.js";
import { recordListHtml } from "../../src/services/axtran2/recordList.js";

const element = (id, type, records, before, after, extra = {}) => ({ id, type, family: null, held: false, fixed: false, records, before, after, ...extra });
const point = (name, station, before, after, extra = {}) => ({ name, kind: "measured", station, offsetBefore: before, offset: after, residual: after, target: 0, within: Math.abs(after) <= 0.003, remark: null, ...extra });
// a turnout, a straight, a transition into a right-hand... a left curve, and two equal arcs the fit merged
const report = (overrides = {}) => ({
	input: {
		tolerance: 0.003,
		turnouts: [{ designation: "EW 190-1:9", records: [1, 2] }],
		heldRecords: [{ record: 1, element: "E0", why: "EW 190-1:9" }, { record: 2, element: "E1", why: "EW 190-1:9" }],
	},
	elements: [
		element("E0", "arc", [1], { length: 21, radius: 190 }, { length: 21, radius: 190 }, { fixed: true }),
		element("E1", "straight", [2], { length: 6, radius: null }, { length: 6, radius: null }, { fixed: true }),
		element("E2", "straight", [3], { length: 60, radius: null }, { length: 59, radius: null }),
		element("E3", "transition", [4], { length: 30, radius: null }, { length: 30, radius: null }, { family: "clothoid" }),
		element("E4", "arc", [5], { length: 40, radius: -300 }, { length: 42, radius: -310 }),
		element("E5", "arc", [6, 7], { length: 50, radius: 500 }, { length: 55, radius: 500 }),
	],
	planRecords: [
		{ number: 1, type: "arc", length: 21, radius: 190, element: "E0", held: "EW 190-1:9", turnout: "EW 190-1:9" },
		{ number: 2, type: "straight", length: 6, radius: null, element: "E1", held: "EW 190-1:9", turnout: "EW 190-1:9" },
		{ number: 3, type: "straight", length: 60, radius: null, element: "E2", held: null, turnout: null },
		{ number: 4, type: "transition", length: 30, radius: null, element: "E3", held: null, turnout: null },
		{ number: 5, type: "arc", length: 40, radius: -300, element: "E4", held: null, turnout: null },
		{ number: 6, type: "arc", length: 30, radius: 500, element: "E5", held: null, turnout: null },
		{ number: 7, type: "arc", length: 20, radius: 500, element: "E5", held: null, turnout: null },
		{ number: 8, type: "kink", length: 0, radius: null, element: null, held: null, turnout: null },
	],
	points: [
		point("P1", 30, 0.012, 0.002, { remark: "Achse <2>" }),
		point("P2", 100, -0.02, -0.006),
		point("P3", 180, 0.004, 0.001),
		{ name: "Z1", kind: "zwangspunkt", station: 50, offset: 2.2, offsetBefore: 2.21, residual: 0, target: 2.2, within: true },
		{ name: "X1", kind: "excluded", station: null, offset: null, offsetBefore: null, residual: null, within: null },
	],
	...overrides,
});
const close = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) <= eps, `${a} is not ${b}`);

test("the model lays the elements along the station, after the fit and before it", () => {
	assert.match(ALIGNMENT_PICTURE_VERSION, /^axtran2\/alignment-picture\//);
	const m = alignmentPictureModel(report());
	close(m.lengthBefore, 207); close(m.lengthAfter, 213); close(m.total, 213);
	const e4 = m.elements[4];
	assert.deepEqual([e4.s0, e4.s1, e4.b0, e4.b1], [116, 158, 117, 157]);
	close(e4.k0, 1000 / -310); close(e4.kb0, 1000 / -300);
	// a transition runs from its neighbour's curvature to the other's
	const transition = m.elements[3];
	close(transition.k0, 0); close(transition.k1, 1000 / -310); close(transition.kb1, 1000 / -300);
	assert.ok(m.kMax >= 1000 / 190, "the band reaches the tightest radius");
});

test("every record of the file has its column, also where the fit merged it into a neighbour", () => {
	const m = alignmentPictureModel(report());
	const [r6, r7, r8] = [m.records[5], m.records[6], m.records[7]];
	// E5 grew from 50 to 55 m: its two records share it as 30 to 20
	close(r6.s0, 158); close(r6.s1, 191); close(r7.s0, 191); close(r7.s1, 213);
	assert.equal(r8.lockable, false, "a kink carries no lock");
	assert.deepEqual(m.records.filter((r) => r.fixed).map((r) => r.number), [1, 2]);
	assert.deepEqual(recordGroup(m, 2), [1, 2], "a turnout's records move as one");
	assert.deepEqual(recordGroup(m, 5), [5]);
});

test("only measured points with a foot are drawn, as residuals against their target", () => {
	const m = alignmentPictureModel(report());
	assert.deepEqual(m.points.map((p) => p.name), ["P1", "P2", "P3"]);
	assert.deepEqual(m.points.map((p) => p.within), [true, false, true]);
	assert.equal(m.showBefore, true);
	assert.ok(m.reach > 0.02 && m.reach < 0.03, `the plan's points fit into the band: ${m.reach}`);
	// a plan metres off would flatten the fit: it stays out, and the picture says so
	const far = alignmentPictureModel(report({ points: [point("P1", 30, 2.5, 0.002), point("P2", 100, -1.8, -0.006)] }));
	assert.equal(far.showBefore, false);
	assert.ok(far.reach < 0.02, `the band is scaled to the fit: ${far.reach}`);
	assert.match(alignmentPictureSvg(far), /nicht gezeichnet/);
});

test("the SVG marks every record that can be held, and draws the locks as they are", () => {
	const m = alignmentPictureModel(report());
	const svg = alignmentPictureSvg(m, { width: 1200 });
	assert.ok(svg.startsWith("<svg ") && svg.endsWith("</svg>"));
	assert.ok(!/NaN|undefined|Infinity/.test(svg), "only numbers in the picture");
	assert.match(svg, new RegExp(`viewBox="0 0 1200 ${PICTURE_HEIGHT}"`));
	const columns = [...svg.matchAll(/<rect data-record="(\d+)"/g)].map((x) => Number(x[1]));
	assert.deepEqual(columns, [1, 2, 3, 4, 5, 6, 7], "the kink has no column");
	const locksOf = (markup) => Object.fromEntries([...markup.matchAll(/<g data-record="(\d+)" data-quantity="(\w+)" data-lock="(on|off|part)"( data-pending="true")?/g)].map((x) => [`${x[1]}${x[2][0].toUpperCase()}`, [x[3], Boolean(x[4])]]));
	const locks = locksOf(svg);
	// a turnout's records and a straight carry one lock; an arc wide enough carries L and R
	assert.deepEqual(locks["1B"], ["on", false]);
	assert.deepEqual(locks["2B"], ["on", false]);
	assert.deepEqual(locks["3B"], ["off", false]);
	assert.deepEqual([locks["5L"], locks["5R"]], [["off", false], ["off", false]]);
	assert.equal(locks["5B"], undefined);
	// a lock set but not computed yet is dashed; a whole record sets both
	const pending = alignmentPictureSvg(m, { width: 1200, held: [1, 2, 5] });
	assert.deepEqual([locksOf(pending)["5L"], locksOf(pending)["5R"]], [["on", true], ["on", true]]);
	const radiusOnly = alignmentPictureSvg(m, { width: 1200, held: new Map([[1, { length: true, radius: true }], [2, { length: true, radius: true }], [5, { length: false, radius: true }]]) });
	assert.deepEqual([locksOf(radiusOnly)["5L"], locksOf(radiusOnly)["5R"]], [["off", false], ["on", true]]);
	// a picture too narrow for a record's lock still offers its column; an arc too narrow for two locks has one for both
	const narrow = alignmentPictureSvg(m, { width: 300 });
	assert.ok(!/<g data-record="2"/.test(narrow) && /<rect data-record="2"/.test(narrow));
	assert.deepEqual(locksOf(narrow)["7B"], ["off", false]);
	assert.deepEqual(locksOf(alignmentPictureSvg(m, { width: 300, held: new Map([[7, { length: false, radius: true }]]) }))["7B"], ["part", true]);
	assert.ok(/data-record="5" data-quantity="length"[^>]*>.*?<text[^>]*>L</.test(narrow), "the split lock says which quantity it is");
});

test("labels are escaped", () => {
	const r = report();
	r.planRecords[0].turnout = "EW <190> & \"co\"";
	const svg = alignmentPictureSvg(alignmentPictureModel(r));
	assert.ok(svg.includes("EW &lt;190&gt; &amp; &quot;co&quot;") && !svg.includes("EW <190>"));
});

test("a position in the picture is a station, a record and the nearest point", () => {
	const m = alignmentPictureModel(report());
	const width = 1200;
	// where P2 lies: station 100 of 213 across the plot (72 left, 16 right)
	const px = 72 + (100 / 213) * (width - 72 - 16);
	const probe = pictureProbe(m, width, px);
	close(probe.station, 100, 1e-9);
	assert.equal(probe.record.number, 4);
	assert.equal(probe.point.name, "P2");
	assert.equal(pictureProbe(m, width, px + 40).point, null, "no point within reach");
	assert.equal(pictureProbe(m, width, 10), null, "left of the plot");
	assert.equal(pictureReadout(m, probe), "Station 100,0 m · Satz 4 Übergangsbogen, 30,00 m, frei · Punkt P2: −20,0 mm → −6,0 mm, außerhalb");
	const first = pictureProbe(m, width, 72 + (30 / 213) * (width - 88));
	assert.equal(pictureReadout(m, first), "Station 30,0 m · Satz 3 Gerade, 60,00 m, frei · Punkt P1: +12,0 mm → +2,0 mm · Achse <2>");
	assert.equal(pictureReadout(m, null), "");
});

test("a hold is read from numbers, objects, a Map or the report, and said in words", () => {
	const m = alignmentPictureModel(report());
	assert.deepEqual([...holdMap(m, null)], [[1, { length: true, radius: true }], [2, { length: true, radius: true }]], "a straight held in its length is held whole");
	assert.deepEqual([...holdMap(m, [5, { record: 6, length: false, radius: true }, { number: 6, length: true, radius: false }])], [[5, { length: true, radius: true }], [6, { length: true, radius: true }]]);
	assert.deepEqual([...holdMap(m, new Map([["7", { radius: true }]]))], [[7, { length: false, radius: true }]]);
	assert.equal(describeHold({ length: true, radius: true }), "gehalten");
	assert.equal(describeHold({ length: true, radius: false }, false), "gehalten");
	assert.equal(describeHold({ length: true, radius: false }), "Länge gehalten");
	assert.equal(describeHold({ length: false, radius: true }), "Radius gehalten");
	assert.equal(describeHold(null), "frei");
	// the report says a record is held in its radius: the readout and the column say so
	const r = report();
	r.planRecords[4] = { ...r.planRecords[4], held: "named", heldLength: false, heldRadius: true };
	const held = alignmentPictureModel(r);
	assert.equal(pictureReadout(held, pictureProbe(held, 1200, 72 + (130 / 213) * 1112)), "Station 130,0 m · Satz 5 Bogen R 300, 40,00 m, Radius gehalten");
	assert.match(alignmentPictureSvg(held), /<rect data-record="5"[^>]*fill="#F6E7BE"/);
});

test("the element listing shows every record with plan and fit, and a box per quantity", () => {
	const m = alignmentPictureModel(report());
	const html = recordListHtml(m);
	assert.ok(html.startsWith("<thead>") && html.endsWith("</tbody>"));
	assert.equal((html.match(/<tr data-record=/g) || []).length, 8, "every record, the kink too");
	assert.match(html, /<tr data-record="1" class="held"><td class="num">1<\/td><td>Bogen<\/td><td>EW 190-1:9<\/td><td class="num">21,00<\/td><td class="num">21,00<\/td><td class="num">190<\/td><td class="num">190<\/td><td class="hold" colspan="2">.*?data-quantity="both" checked.*?Weiche<\/label><\/td><td>gehalten<\/td>/);
	// the merged arc: its records share the element's new length, the radius is the element's; the plan's values are fields
	assert.match(html, /<tr data-record="7"><td class="num">7<\/td><td>Bogen<\/td><td><\/td><td class="num plan"><input type="text" inputmode="decimal" data-record="7" data-field="length" value="20" class="" title="Länge wie in der Datei"[^>]*><\/td><td class="num changed">22,00<\/td><td class="num plan"><input [^>]*data-field="radius" value="500"[^>]*><\/td><td class="num">500<\/td>/);
	assert.match(html, /data-record="7" data-quantity="length"(?! checked)/);
	assert.match(html, /data-record="7" data-quantity="radius"(?! checked)/);
	// a straight has no radius box, a kink no box at all
	assert.match(html, /<tr data-record="3">.*?data-quantity="length".*?<td class="hold"><\/td><td>frei<\/td>/);
	assert.match(html, /<tr data-record="8">.*?<td class="num">—<\/td>.*?<td class="hold" colspan="2"><\/td><td>frei<\/td>/);
	// a box set but not computed yet
	const pending = recordListHtml(m, { held: new Map([[1, { length: true, radius: true }], [2, { length: true, radius: true }], [5, { length: false, radius: true }]]) });
	assert.match(pending, /data-record="5" data-quantity="radius" checked class="pending"/);
	assert.match(pending, /data-record="5" data-quantity="length"(?! checked)/);
	// a value the fit started from instead of the file's is marked, with the file's value to read
	const e = report();
	e.planRecords[4] = { ...e.planRecords[4], length: 45.25, fileLength: 40, fileRadius: -300, edited: { length: true, radius: false } };
	const edited = recordListHtml(alignmentPictureModel(e));
	assert.match(edited, /data-record="5" data-field="length" value="45,25" class="edited" title="Länge in der Datei: 40,00 m"/);
	assert.match(edited, /data-record="5" data-field="radius" value="−300" class="" title="Radius wie in der Datei"/);
	// a value typed but not yet computed
	const typed = recordListHtml(alignmentPictureModel(e), { edits: "5R=-320" });
	assert.match(typed, /data-record="5" data-field="radius" value="−320" class="edited pending" title="Radius in der Datei: −300 m; noch nicht gerechnet"/);
	assert.match(typed, /data-record="5" data-field="length" value="40" class="pending" title="Länge wie in der Datei; noch nicht gerechnet"/, "an edit list without the length means back to the file's length, not yet computed");
	// labels are escaped
	const r = report();
	r.planRecords[0].turnout = "EW <190>";
	assert.ok(recordListHtml(alignmentPictureModel(r)).includes("EW &lt;190&gt;"));
	assert.equal(recordListHtml(null), "");
});

test("a report without elements has no picture", () => {
	assert.equal(alignmentPictureModel({ elements: [] }), null);
	assert.equal(alignmentPictureModel(null), null);
	assert.equal(alignmentPictureSvg(null), "");
});
