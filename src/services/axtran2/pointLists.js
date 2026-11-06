// src/services/axtran2/pointLists.js
//
// Survey points and Zwangspunkte as the field hands them over: a text file,
// one point per line, columns separated by semicolon, comma, tab or spaces,
// a decimal comma allowed. With a header line the columns are found by name;
// without one they are taken in order.
//
//   points:        [name] easting northing [tolerance]
//   Zwangspunkte:  [name] easting northing distance [tolerance]
//
// Two more columns a header may name, for either kind: a station, which is
// a hint and not a measurement (the foot point is searched from there, for
// an alignment that passes a point twice), and a remark, which is carried
// through to the report and the residual list unread.
//
// Coordinates are easting then northing, which is the kernel's x then y. A
// Verm.esn listing writes Y (Rechtswert, easting) before X (Hochwert,
// northing), so a header "Y X" is read that way round; a header "X Y" is read
// as easting, northing too, because that is what x and y mean here. `axes`
// overrides both: "en" (default) or "ne".
//
// The distance of a Zwangspunkt is the lateral offset the axis has to keep
// from the point, signed in the kernel's frame: left of the direction of
// travel positive, right negative. A side letter says the same in the
// surveyor's words: "L 2.20" is +2.20, "R 2.20" is -2.20.
//
// How the distance is held is the rule ("Art"): "=" exactly (the default,
// a neighbouring track axis), "min" at least (a mast, a pier), "max" at most
// (a platform edge the axis must not drift away from). The rule may stand in
// its own column or in front of the distance, ">= L 2.20". A one-sided rule
// needs a side, so its distance must not be zero. A list that states no rule
// carries none: the default is the problem's to declare, not the file's.

const NAME_HEADERS = ["name", "nr", "punkt", "pkt", "id", "nummer", "punktnummer"];
const EAST_HEADERS = ["e", "east", "easting", "rechtswert", "rw", "y", "x"];
const NORTH_HEADERS = ["n", "north", "northing", "hochwert", "hw"];
const DISTANCE_HEADERS = ["abstand", "distance", "dist", "d", "a", "soll", "target", "q"];
const TOLERANCE_HEADERS = ["toleranz", "tolerance", "tol", "t", "sigma"];
const RULE_HEADERS = ["art", "regel", "bedingung", "relation", "rule", "kind", "typ", "type"];
const STATION_HEADERS = ["station", "stat", "st", "km", "kilometer", "chainage", "s"];
const REMARK_HEADERS = ["bemerkung", "bem", "remark", "comment", "kommentar", "note", "notiz", "text"];

/** the rule words, as the field writes them, to the kernel's enforcement */
const RULES = {
	"": "hard", "=": "hard", "==": "hard", "genau": "hard", "gleich": "hard", "exakt": "hard", "exact": "hard", "eq": "hard", "hard": "hard",
	">=": "at-least", "≥": "at-least", ">": "at-least", "min": "at-least", "mind": "at-least", "mindestens": "at-least", "least": "at-least", "at-least": "at-least", "atleast": "at-least",
	"<=": "at-most", "≤": "at-most", "<": "at-most", "max": "at-most", "höchstens": "at-most", "hoechstens": "at-most", "most": "at-most", "at-most": "at-most", "atmost": "at-most",
};
export const ZWANG_RULES = Object.freeze(["hard", "at-least", "at-most"]);

function ruleOf(cell, where) {
	const key = String(cell ?? "").trim().toLowerCase();
	const rule = RULES[key];
	if (rule === undefined) error("INVALID_RULE", `${where}: the rule "${cell}" is not one of =, min, max`);
	return rule;
}

/**
 * A Zwangspunkt's distance cell: a signed number, or a number with a side
 * letter (L left, R right) before or after it, with an optional rule in front.
 * Returns { distance, rule } with rule null where the cell names none.
 */
function parseDistance(cell, where) {
	const text = String(cell ?? "").trim();
	const m = /^(>=|<=|≥|≤|min|max)?\s*(l|r|links|rechts)?\s*([-+]?[\d.,]+)\s*(l|r|links|rechts)?$/i.exec(text);
	if (!m) {
		const plain = toNumber(text);
		if (Number.isNaN(plain)) error("INVALID_DISTANCE", `${where}: no readable distance: "${cell}"`);
		return { distance: plain, rule: null };
	}
	const value = toNumber(m[3]);
	if (Number.isNaN(value)) error("INVALID_DISTANCE", `${where}: no readable distance: "${cell}"`);
	const side = (m[2] ?? m[4] ?? "").toLowerCase();
	if (side && value < 0) error("INVALID_DISTANCE", `${where}: a distance with a side letter is not signed: "${cell}"`);
	const distance = side ? (side.startsWith("r") ? -value : value) : value;
	return { distance, rule: m[1] ? ruleOf(m[1], where) : null };
}

export class PointListError extends Error {
	constructor(code, message, detail = null) {
		super(message);
		this.name = "PointListError";
		this.code = code;
		this.detail = detail;
	}
}

const error = (code, message, detail) => { throw new PointListError(code, message, detail); };

function splitLine(line) {
	const trimmed = line.trim();
	if (trimmed.includes(";")) return trimmed.split(";").map((c) => c.trim());
	if (trimmed.includes("\t")) return trimmed.split("\t").map((c) => c.trim());
	// a comma is a separator unless the line is whitespace-separated and every
	// comma sits inside a number, as in "P2 12,5 13,7"
	const tokens = trimmed.split(/\s+/);
	if (trimmed.includes(",") && !(tokens.length >= 2 && tokens.every((t) => !t.includes(",") || /^-?\d+,\d+$/.test(t)))) {
		return trimmed.split(",").map((c) => c.trim());
	}
	return tokens;
}

function toNumber(cell) {
	if (cell === undefined || cell === null) return NaN;
	const text = String(cell).trim().replace(/\s/g, "");
	if (text === "") return NaN;
	// "1.234,56" is a German thousands/decimal pair; "1234,56" a decimal comma
	const normalised = /^-?\d{1,3}(\.\d{3})+,\d+$/.test(text) ? text.replace(/\./g, "").replace(",", ".") : text.replace(",", ".");
	const value = Number(normalised);
	return Number.isFinite(value) ? value : NaN;
}

const DISTANCE_CELL = /^(>=|<=|≥|≤|min|max)?\s*(l|r|links|rechts)?\s*[-+]?[\d.,]+\s*(l|r|links|rechts)?$/i;

function isHeader(cells) {
	// a distance with a side letter or a rule in front is a value, not a word
	return cells.length >= 2 && cells.filter((c) => Number.isNaN(toNumber(c)) && !DISTANCE_CELL.test(String(c).trim())).length >= 2;
}

function columnsFromHeader(cells, kind) {
	const lower = cells.map((c) => c.toLowerCase().replace(/[^a-zäöü_]/g, ""));
	const find = (names) => lower.findIndex((h) => names.includes(h));
	const columns = { name: find(NAME_HEADERS), tolerance: find(TOLERANCE_HEADERS), rule: kind === "zwang" ? find(RULE_HEADERS) : -1, station: find(STATION_HEADERS), remark: find(REMARK_HEADERS) };
	const yAsEast = lower.includes("y") && lower.includes("x");
	if (yAsEast) {
		// Verm.esn order: Y is the Rechtswert, X the Hochwert
		columns.east = lower.indexOf("y");
		columns.north = lower.indexOf("x");
	} else {
		columns.east = find(EAST_HEADERS.filter((h) => h !== "y"));
		columns.north = find(NORTH_HEADERS.concat(["y"]));
	}
	if (kind === "zwang") columns.distance = find(DISTANCE_HEADERS);
	if (columns.east < 0 || columns.north < 0) error("HEADER_WITHOUT_COORDINATES", `the header names no easting/northing columns: ${cells.join(" | ")}`);
	if (kind === "zwang" && columns.distance < 0) error("HEADER_WITHOUT_DISTANCE", `the Zwangspunkt header names no distance column: ${cells.join(" | ")}`);
	return columns;
}

function columnsByOrder(cells, kind) {
	const numeric = cells.map((c) => !Number.isNaN(toNumber(c)));
	const first = numeric[0] ? 0 : 1;
	const needed = kind === "zwang" ? 3 : 2;
	if (cells.length - first < needed) error("TOO_FEW_COLUMNS", `a ${kind === "zwang" ? "Zwangspunkt" : "point"} line needs ${needed} numbers: ${cells.join(" | ")}`);
	// a station or a remark needs a header to be told from a tolerance
	const columns = { name: first === 1 ? 0 : -1, east: first, north: first + 1, rule: -1, station: -1, remark: -1 };
	let next = first + 2;
	if (kind === "zwang") columns.distance = next++;
	columns.tolerance = cells.length > next ? next : -1;
	return columns;
}

/**
 * @param {string} text
 * @param {object} [options]
 * @param {"points"|"zwang"} [options.kind]
 * @param {"en"|"ne"} [options.axes]   coordinate order when no header says otherwise
 * @param {number} [options.tolerance] default per-point tolerance, metres
 */
export function parsePointList(text, { kind = "points", axes = "en", tolerance = null } = {}) {
	if (typeof text !== "string") error("INVALID_INPUT", "a point list is text");
	if (!["en", "ne"].includes(axes)) error("INVALID_AXES", `axes must be "en" or "ne", not "${axes}"`);
	const lines = text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith("#") && !l.startsWith("//"));
	if (lines.length === 0) error("EMPTY", "the point list has no lines");
	let columns = null;
	let start = 0;
	const firstCells = splitLine(lines[0]);
	if (isHeader(firstCells)) { columns = columnsFromHeader(firstCells, kind); start = 1; }
	const out = [];
	const seen = new Set();
	for (let i = start; i < lines.length; i++) {
		const cells = splitLine(lines[i]);
		const cols = columns ?? columnsByOrder(cells, kind);
		let east = toNumber(cells[cols.east]);
		let north = toNumber(cells[cols.north]);
		if (!columns && axes === "ne") [east, north] = [north, east];
		if (Number.isNaN(east) || Number.isNaN(north)) error("INVALID_COORDINATE", `line ${i + 1}: no readable coordinates: ${lines[i]}`);
		const name = cols.name >= 0 && cells[cols.name] !== undefined && cells[cols.name] !== "" ? String(cells[cols.name]) : `${kind === "zwang" ? "Z" : "P"}${out.length + 1}`;
		if (seen.has(name)) error("DUPLICATE_NAME", `line ${i + 1}: the name "${name}" occurs twice`);
		seen.add(name);
		const point = { name, x: east, y: north };
		const tol = cols.tolerance >= 0 ? toNumber(cells[cols.tolerance]) : NaN;
		point.tolerance = Number.isNaN(tol) ? tolerance : tol;
		const stationCell = cols.station >= 0 ? String(cells[cols.station] ?? "").trim() : "";
		if (stationCell !== "") {
			const station = toNumber(stationCell);
			if (Number.isNaN(station)) error("INVALID_STATION", `line ${i + 1}: the station "${stationCell}" is not a number`);
			point.station = station;
		}
		const remark = cols.remark >= 0 ? String(cells[cols.remark] ?? "").trim() : "";
		if (remark !== "") point.remark = remark;
		if (kind === "zwang") {
			const where = `line ${i + 1}, Zwangspunkt "${name}"`;
			const { distance, rule } = parseDistance(cells[cols.distance], where);
			const column = cols.rule >= 0 ? ruleOf(cells[cols.rule], where) : null;
			if (rule !== null && column !== null && rule !== column) error("INVALID_RULE", `${where}: the rule column says ${column} and the distance says ${rule}`);
			// only a list that states a rule carries one; a plain list leaves
			// the enforcement to whoever declares the problem
			const enforcement = column ?? rule;
			if (enforcement !== null && enforcement !== "hard" && distance === 0) error("INVALID_DISTANCE", `${where}: a one-sided rule needs a side, and a distance of 0 names none`);
			point.distance = distance;
			if (enforcement !== null) point.enforcement = enforcement;
		}
		out.push(Object.freeze(point));
	}
	return Object.freeze(out);
}

/** residuals as the same kind of list, one line per point */
export function formatResidualList(rows) {
	const header = "name;easting;northing;station;offset;target;residual;tolerance;within;rule;remark";
	const rule = (r) => r.enforcement === "at-least" ? ">=" : r.enforcement === "at-most" ? "<=" : r.kind === "zwangspunkt" ? "=" : "";
	const line = (r) => [r.name, r.x.toFixed(4), r.y.toFixed(4), r.station === null ? "" : r.station.toFixed(3),
		r.offset === null ? "" : r.offset.toFixed(4), r.target.toFixed(4), r.residual === null ? "" : r.residual.toFixed(4),
		r.tolerance.toFixed(4), r.within === null ? "" : (r.within ? "ja" : "nein"), rule(r), String(r.remark ?? "").replace(/;/g, ",")].join(";");
	return [header, ...rows.map(line)].join("\n") + "\n";
}
