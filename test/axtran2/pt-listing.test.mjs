// test/axtran2/pt-listing.test.mjs
//
// The Verm.esn point listing (.pt) read as survey points: the template
// line says where the columns are, Y is the easting, X the northing.

import assert from "node:assert/strict";
import test from "node:test";

const SERVICE = new URL("../../src/services/axtran2/", import.meta.url);
const { isPtListing, parsePtListing, PtListingError } = await import(new URL("ptListing.js", SERVICE));
const { parsePointList } = await import(new URL("pointLists.js", SERVICE));

// an invented listing in the layout the field hands over (not customer data)
const LISTING = [
	"EB: 12345678_Gleis-7_DB_REF2016_IST-Gleislage",
	"                                       PPPPPPPPPPPPPPPP     YYYYYYYY.YYYYYY XXXXXXXX.XXXXXX     HHHH.HHHHHH DDDDDDDDDD                                FFFFFFFFFF%",
	"                                                   7100      3500000.123400  5500000.456700      112.345600 2026-03-01                                -iueb1.5-s",
	"                                              Mast 7 a      3500010.000000  5500005.000000      112.400000 2026-03-01                                -iueb-4.0-",
	"                                                   7102      3500020.500000  5500010.250000      112.500000 2026-03-01",
	"",
].join("\r\n");

test("a .pt listing is told from a CSV and read by its template's columns", () => {
	assert.ok(isPtListing(LISTING));
	assert.ok(isPtListing("\uFEFF" + LISTING) && isPtListing("ï»¿" + LISTING), "a byte-order mark, decoded or not, is not in the way");
	assert.equal(parsePtListing("ï»¿" + LISTING).points.length, 3);
	assert.ok(!isPtListing("Nr;Y;X\n1;3500000;5500000\n"));
	assert.ok(!isPtListing("4100 3476138.98 5474312.35\n"));
	const pt = parsePtListing(LISTING);
	assert.equal(pt.title, "12345678_Gleis-7_DB_REF2016_IST-Gleislage");
	assert.deepEqual([...pt.columns], ["P", "Y", "X", "H", "D", "F"]);
	assert.equal(pt.points.length, 3);
	assert.deepEqual(pt.points[0], { name: "7100", east: 3500000.1234, north: 5500000.4567, height: 112.3456, date: "2026-03-01", remark: "-iueb1.5-s" });
	assert.equal(pt.points[1].name, "Mast 7 a", "a name with spaces inside survives the template's columns");
	assert.deepEqual([pt.points[2].remark, pt.points[2].date], [null, "2026-03-01"], "no F text: no remark");
});

test("a line that does not sit in the columns is read by its words; a listing without a template too", () => {
	const shifted = LISTING.replace(/\r\n {51}7102 +3500020\.500000 +5500010\.250000 +112\.500000 2026-03-01/, "\r\n7102 3500020.5 5500010.25 112.5 2026-03-01 frei getippt");
	const pt = parsePtListing(shifted);
	assert.deepEqual(pt.points[2], { name: "7102", east: 3500020.5, north: 5500010.25, height: 112.5, date: "2026-03-01", remark: "frei getippt" });
	const bare = "EB: ohne Vorlage\n1 3500000 5500000 100 2026-01-01 Bemerkung mit Worten\n2 3500010 5500005\n";
	const byWords = parsePtListing(bare);
	assert.deepEqual(byWords.points.map((p) => [p.name, p.east, p.north, p.height, p.remark]), [["1", 3500000, 5500000, 100, "Bemerkung mit Worten"], ["2", 3500010, 5500005, null, null]]);
	assert.throws(() => parsePtListing("nur Text\n"), (e) => e instanceof PtListingError && e.code === "NOT_PT");
	assert.throws(() => parsePtListing("EB: leer\n"), (e) => e.code === "EMPTY");
	assert.throws(() => parsePtListing(LISTING + "\r\n7100 1 2"), (e) => e.code === "DUPLICATE_NAME");
	assert.throws(() => parsePtListing("EB: x\nkein Punkt hier\n"), (e) => e.code === "INVALID_COORDINATE");
});

test("the point-list reader takes a .pt as survey points: Y is x, X is y, the F text the remark", () => {
	const points = parsePointList(LISTING, { tolerance: 0.003 });
	assert.equal(points.length, 3);
	assert.deepEqual(points[0], { name: "7100", x: 3500000.1234, y: 5500000.4567, tolerance: 0.003, height: 112.3456, remark: "-iueb1.5-s" });
	assert.deepEqual(points[2], { name: "7102", x: 3500020.5, y: 5500010.25, tolerance: 0.003, height: 112.5 });
	// Zwangspunkte do not come this way
	assert.throws(() => parsePointList(LISTING, { kind: "zwang" }), (e) => e.code === "INVALID_INPUT");
	// a CSV is still a CSV
	assert.equal(parsePointList("Nr;Y;X\n1;3500000;5500000\n")[0].x, 3500000);
});
