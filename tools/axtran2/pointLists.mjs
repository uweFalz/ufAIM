// tools/axtran2/pointLists.mjs
//
// Survey points and Zwangspunkte as the field hands them over: a text file,
// one point per line, columns separated by semicolon, comma, tab or spaces,
// a decimal comma allowed. With a header line the columns are found by name;
// without one they are taken in order.
//
//   points:        [name] easting northing [tolerance]
//   Zwangspunkte:  [name] easting northing distance [tolerance]
//
// Coordinates are easting then northing, which is the kernel's x then y. A
// Verm.esn listing writes Y (Rechtswert, easting) before X (Hochwert,
// northing), so a header "Y X" is read that way round; a header "X Y" is read
// as easting, northing too, because that is what x and y mean here. `axes`
// overrides both: "en" (default) or "ne".
//
// The distance of a Zwangspunkt is the lateral offset the axis has to keep
// from the point, signed in the kernel's frame: left of the direction of
// travel positive, right negative.

const NAME_HEADERS = ["name", "nr", "punkt", "pkt", "id", "nummer", "punktnummer"];
const EAST_HEADERS = ["e", "east", "easting", "rechtswert", "rw", "y", "x"];
const NORTH_HEADERS = ["n", "north", "northing", "hochwert", "hw"];
const DISTANCE_HEADERS = ["abstand", "distance", "dist", "d", "a", "soll", "target", "q"];
const TOLERANCE_HEADERS = ["toleranz", "tolerance", "tol", "t", "sigma"];

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

function isHeader(cells) {
	return cells.length >= 2 && cells.filter((c) => Number.isNaN(toNumber(c))).length >= 2;
}

function columnsFromHeader(cells, kind) {
	const lower = cells.map((c) => c.toLowerCase().replace(/[^a-zäöü_]/g, ""));
	const find = (names) => lower.findIndex((h) => names.includes(h));
	const columns = { name: find(NAME_HEADERS), tolerance: find(TOLERANCE_HEADERS) };
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
	const columns = { name: first === 1 ? 0 : -1, east: first, north: first + 1 };
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
		if (kind === "zwang") {
			const distance = toNumber(cells[cols.distance]);
			if (Number.isNaN(distance)) error("INVALID_DISTANCE", `line ${i + 1}: the Zwangspunkt "${name}" has no readable distance`);
			point.distance = distance;
		}
		out.push(Object.freeze(point));
	}
	return Object.freeze(out);
}

/** residuals as the same kind of list, one line per point */
export function formatResidualList(rows) {
	const header = "name;easting;northing;station;offset;target;residual;tolerance;within";
	const line = (r) => [r.name, r.x.toFixed(4), r.y.toFixed(4), r.station === null ? "" : r.station.toFixed(3),
		r.offset === null ? "" : r.offset.toFixed(4), r.target.toFixed(4), r.residual === null ? "" : r.residual.toFixed(4),
		r.tolerance.toFixed(4), r.within === null ? "" : (r.within ? "ja" : "nein")].join(";");
	return [header, ...rows.map(line)].join("\n") + "\n";
}
