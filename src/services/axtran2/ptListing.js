// src/services/axtran2/ptListing.js
//
// The point listing a Verm.esn job hands over as .pt: a title line "EB: …",
// a template line that marks the columns with letters, and one point per
// line in those columns.
//
//   EB: 60004278_Gleis-10_…_IST-Gleislage
//        PPPPPPPPPPPPPPPP     YYYYYYYY.YYYYYY XXXXXXXX.XXXXXX     HHHH.HHHHHH DDDDDDDDDD      FFFFFFFFFF%
//        4100      3476138.980300  5474312.353000      106.788370 2026-08-27      -iueb1.5-s
//
// P is the point's name, Y the Rechtswert (easting), X the Hochwert
// (northing), H the height, D the date, F a free text to the end of the
// line (the "%" closes the template). The template says where each column
// is, so a name with a space inside survives; where a line does not fit
// the template, its words are read in the template's order.

export const PT_LISTING_VERSION = "axtran2/pt-listing/0.1";

const LETTERS = Object.freeze({ P: "name", Y: "east", X: "north", H: "height", D: "date", F: "remark" });

export class PtListingError extends Error {
	constructor(code, message, detail = null) {
		super(message);
		this.name = "PtListingError";
		this.code = code;
		this.detail = detail;
	}
}
const error = (code, message, detail) => { throw new PtListingError(code, message, detail); };

const isTemplate = (line) => {
	const bare = line.replace(/\s+/g, "");
	return bare.length >= 6 && /^[PYXHDF.%]+$/.test(bare) && bare.includes("P") && bare.includes("Y") && bare.includes("X");
};
const toNumber = (text) => {
	const t = String(text ?? "").trim();
	return /^[-+]?(\d+(\.\d*)?|\.\d+)$/.test(t) ? Number(t) : NaN;
};

/** true for text that looks like a .pt listing: a title "EB:" or a template line near the top */
const unmarked = (text) => text.replace(/^(\uFEFF|ï»¿)/, "");

export function isPtListing(text) {
	if (typeof text !== "string") return false;
	const head = unmarked(text).split(/\r?\n/).slice(0, 6);
	return head.some((l) => /^\s*EB:/.test(l)) || head.some(isTemplate);
}

/**
 * @param {string} text
 * @returns {{title: string|null, columns: string[], points: Array<{name: string, east: number, north: number, height: number|null, date: string|null, remark: string|null}>}}
 */
export function parsePtListing(text) {
	if (typeof text !== "string") error("INVALID_INPUT", "a .pt listing is text");
	const lines = unmarked(text).split(/\r?\n/);
	let title = null;
	let template = null;
	const data = [];
	for (const line of lines) {
		if (!line.trim()) continue;
		if (title === null && /^\s*EB:/.test(line)) { title = line.replace(/^\s*EB:\s*/, "").trim(); continue; }
		if (template === null && isTemplate(line)) { template = line; continue; }
		data.push(line);
	}
	if (title === null && template === null) error("NOT_PT", "no .pt listing: neither a title line \"EB:\" nor a template line of P, Y, X columns");
	// the columns: where each letter runs in the template, F to the end of the line
	const spans = [];
	if (template !== null) {
		for (const letter of Object.keys(LETTERS)) {
			const start = template.indexOf(letter);
			if (start < 0) continue;
			const end = letter === "F" ? Infinity : template.lastIndexOf(letter) + 1;
			spans.push({ letter, field: LETTERS[letter], start, end });
		}
		spans.sort((a, b) => a.start - b.start);
		if (!spans.some((s) => s.field === "east") || !spans.some((s) => s.field === "north")) error("NOT_PT", "the template names no Y and X columns");
	} else {
		// no template: the usual order
		["P", "Y", "X", "H", "D", "F"].forEach((letter, i) => spans.push({ letter, field: LETTERS[letter], start: i, end: i + 1, byWord: true }));
	}
	const byWords = (line) => {
		const words = line.trim().split(/\s+/);
		const out = {};
		spans.forEach((s, i) => { out[s.field] = s.field === "remark" ? words.slice(i).join(" ") : words[i] ?? ""; });
		return out;
	};
	const points = [];
	const seen = new Set();
	data.forEach((line, i) => {
		let cells = template === null ? byWords(line) : Object.fromEntries(spans.map((s) => [s.field, line.slice(s.start, s.end === Infinity ? undefined : s.end).trim()]));
		let east = toNumber(cells.east), north = toNumber(cells.north);
		if (Number.isNaN(east) || Number.isNaN(north)) {
			// a line that does not sit in the template's columns: its words in the template's order
			cells = byWords(line);
			east = toNumber(cells.east); north = toNumber(cells.north);
			if (Number.isNaN(east) || Number.isNaN(north)) error("INVALID_COORDINATE", `line ${i + 1} of the points: no readable Y and X: ${line.trim()}`);
		}
		const name = cells.name && cells.name !== "" ? cells.name : `P${points.length + 1}`;
		if (seen.has(name)) error("DUPLICATE_NAME", `the point "${name}" occurs twice`);
		seen.add(name);
		const height = toNumber(cells.height);
		points.push(Object.freeze({ name, east, north, height: Number.isNaN(height) ? null : height, date: cells.date || null, remark: cells.remark?.replace(/%$/, "").trim() || null }));
	});
	if (points.length === 0) error("EMPTY", "the .pt listing has no points");
	return Object.freeze({ title, columns: Object.freeze(spans.map((s) => s.letter)), points: Object.freeze(points) });
}
