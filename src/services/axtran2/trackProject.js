// src/services/axtran2/trackProject.js
//
// The 7L project: a line is not one alignment but up to seven lines that
// belong together - the kilometre line, and for the right and the left
// track each the axis, the cant band and the gradient:
//
//     km-TRA   re-TRA   li-TRA   re-UEB   li-UEB   re-GRA   li-GRA
//
// Verm.esn carries them in five files: KM.TRA, RE.TRA, LI.TRA, RE.GRA and
// LI.GRA. The cant band has no file of its own; it is the U columns of the
// track's TRA and the ramp constructions in its GRA.
//
// This module knows which file is which line, what a file holds, and how
// the seven lines stand after the fits - as a model and as the rows of a
// table. It fits nothing: the axes go through fitTraCore one by one, the
// cant band is judged with its axis, and the gradient is carried and shown
// (stage one, 2026-11-10; see docs/app/architecture/AXTRAN2_7L_PROJECT_2026-11-10.md).
//
// Pure but for the two describe functions, which read bytes with the
// production parsers. Every label of the table is escaped.

import { parseTraGraAuto } from "../../import/parsers/technet/vermEsn/parseTRA_GRA.js";
import { decodeBinary } from "../../import/parsers/technet/vermEsn/sharedVermesn.js";

export const TRACK_PROJECT_VERSION = "axtran2/track-project/0.1";

/** the seven lines, in the order a project names them; `fit` where stage one optimises */
export const PROJECT_LINES = Object.freeze([
	{ key: "km-TRA", track: "km", kind: "TRA", words: "Kilometrierungslinie", fit: true },
	{ key: "re-TRA", track: "re", kind: "TRA", words: "Achse, rechtes Gleis", fit: true },
	{ key: "li-TRA", track: "li", kind: "TRA", words: "Achse, linkes Gleis", fit: true },
	{ key: "re-UEB", track: "re", kind: "UEB", words: "Überhöhung, rechtes Gleis", fit: false },
	{ key: "li-UEB", track: "li", kind: "UEB", words: "Überhöhung, linkes Gleis", fit: false },
	{ key: "re-GRA", track: "re", kind: "GRA", words: "Gradiente, rechtes Gleis", fit: false },
	{ key: "li-GRA", track: "li", kind: "GRA", words: "Gradiente, linkes Gleis", fit: false },
].map(Object.freeze));

/** the lines a file can be: the TRA and GRA ones; the UEB lines are read off them */
export const FILE_LINES = Object.freeze(PROJECT_LINES.filter((l) => l.kind !== "UEB").map((l) => l.key));
const lineOf = (key) => PROJECT_LINES.find((l) => l.key === key) ?? null;

/**
 * What a file name says: the kind by its extension, the track by KM, RE or
 * LI standing as a word of its own ("6100_247-289_DBREF2016_RE.TRA",
 * "Gleis-li.gra", "rechts", "links"); null where it does not say.
 * @returns {{ kind: "TRA"|"GRA"|null, track: "km"|"re"|"li"|null }}
 */
export function roleOfFileName(name) {
	const base = String(name ?? "").split(/[\\/]/).pop();
	const dot = base.lastIndexOf(".");
	const extension = dot >= 0 ? base.slice(dot + 1).toUpperCase() : "";
	const kind = extension === "TRA" || extension === "GRA" ? extension : null;
	const words = (dot >= 0 ? base.slice(0, dot) : base).split(/[^A-Za-zÄÖÜäöü]+/).filter(Boolean).map((w) => w.toLowerCase());
	const tracks = words.map((w) => (w === "km" ? "km" : w === "re" || w === "rechts" ? "re" : w === "li" || w === "links" ? "li" : null)).filter(Boolean);
	// the last word that names a track: "..._KM_RE" is the right track of a km-named project
	return { kind, track: tracks.length ? tracks[tracks.length - 1] : null };
}

/**
 * Files to lines. A name that says its track takes that line; one that
 * does not takes the first free line of its kind (re, li, then km for a
 * TRA) and the result says so - an assumption shown, to be changed by
 * giving the file its line. Two files for one line: the first keeps it.
 *
 * @param {string[]} names           the files' names, in the order given
 * @param {Object<string,string>} [taken]  line key -> name of a file already there (replaced by one named for the line)
 * @returns {{ lines: Object<string,string>, assumed: Array<{name, line}>, unassigned: Array<{name, why}> }}
 */
export function assignProjectFiles(names, taken = {}) {
	const lines = {};
	const assumed = [];
	const unassigned = [];
	const pending = [];
	for (const name of names) {
		const { kind, track } = roleOfFileName(name);
		if (!kind) { unassigned.push({ name, why: "weder .TRA noch .GRA" }); continue; }
		if (!track) { pending.push({ name, kind }); continue; }
		const key = `${track}-${kind}`;
		if (!lineOf(key)) { unassigned.push({ name, why: "die Kilometrierungslinie hat keine Gradiente" }); continue; }
		if (lines[key]) { unassigned.push({ name, why: `${key} ist schon ${lines[key]}` }); continue; }
		lines[key] = name;
	}
	for (const { name, kind } of pending) {
		const free = (kind === "TRA" ? ["re-TRA", "li-TRA", "km-TRA"] : ["re-GRA", "li-GRA"]).find((key) => !lines[key] && !taken[key]);
		if (!free) { unassigned.push({ name, why: `kein freier Platz für eine weitere ${kind}; der Name nennt weder KM noch RE noch LI` }); continue; }
		lines[free] = name;
		assumed.push({ name, line: free });
	}
	return { lines, assumed, unassigned };
}

const toBuffer = (bytes) => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);

/**
 * What a TRA holds, read off its records: how many, how long, from which
 * station to which, and its cant band (the U columns).
 * @param {Uint8Array} bytes
 * @returns {{ kind: "TRA", records, length, stationStart, stationEnd, stationEquations, cant: { records, maxMm } }}
 */
export function describeTra(bytes) {
	const rows = decodeBinary(toBuffer(bytes), "TRA").rowsRaw.slice(1);
	if (rows.length === 0) throw new Error("die TRA trägt keine Sätze");
	const elements = rows.filter((r) => r.kindCode !== 6);
	const cants = elements.map((r) => Math.max(Math.abs(Number(r.cantA) || 0), Math.abs(Number(r.cantE) || 0)));
	return Object.freeze({
		kind: "TRA",
		// the last row is the end point, not an element
		records: Math.max(0, elements.length - 1),
		length: elements.slice(0, -1).reduce((sum, r) => sum + (Number.isFinite(r.arcLength) ? r.arcLength : 0), 0),
		stationStart: rows[0].station, stationEnd: rows[rows.length - 1].station,
		stationEquations: rows.length - elements.length,
		cant: Object.freeze({ records: cants.filter((c) => c > 0).length, maxMm: cants.length ? Math.max(...cants) : 0 }),
	});
}

/**
 * What a GRA holds: its grade breaks, how many are rounded, the stations
 * and heights it spans, and the cant ramp constructions it carries.
 * @param {Uint8Array} bytes
 * @param {string} [name]
 * @returns {Promise<{ kind: "GRA", gradeBreaks, rounded, stationStart, stationEnd, heightMin, heightMax, cantConstructions }>}
 */
export async function describeGra(bytes, name = "gradient.GRA") {
	const document = await parseTraGraAuto({ name, arrayBuffer: async () => toBuffer(bytes) });
	const alignment = document.alignments?.[0];
	const pvis = alignment?.profile?.profAlign?.pvis ?? [];
	if (pvis.length === 0) throw new Error("die GRA trägt keine Neigungswechsel");
	const value = (m) => (m && typeof m === "object" ? Number(m.value) : Number(m));
	const stations = pvis.map((p) => value(p.station)).filter(Number.isFinite);
	const heights = pvis.map((p) => value(p.elevation)).filter(Number.isFinite);
	return Object.freeze({
		kind: "GRA",
		gradeBreaks: pvis.length,
		rounded: pvis.filter((p) => Math.abs(Number(p.extras?.sourceSemantics?.radius) || 0) > 0).length,
		stationStart: Math.min(...stations), stationEnd: Math.max(...stations),
		heightMin: Math.min(...heights), heightMax: Math.max(...heights),
		cantConstructions: (alignment?.extras?.coupledCantGradientConstructions ?? []).length,
	});
}

const comma = (value, digits) => value.toFixed(digits).replace(".", ",").replace(/\B(?=(\d{3})+(?!\d))/g, " ").replace("-", "−");
const escape = (text) => String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/**
 * The seven lines as they stand.
 *
 * @param {Object<string, object>} state  line key (a TRA or GRA line) -> {
 *     file?: string, description?: object (describeTra / describeGra), error?: string,
 *     points?: boolean (an Aufmaß is there), fit?: { status, ok, rms, max, outside, points, lengthChange,
 *     cant?: { arcs, exceededBefore, exceededAfter, maximumDeficiencyMm, speedKmh } }, assumed?: boolean }
 * @param {string|null} [active]  the line the form below works on
 * @returns {Array<{ key, kind, track, words, file, content, state, tone, fit, active, loaded }>}
 *          tone: "empty", "loaded", "ready", "ok", "warn" or "error"
 */
export function projectLinesModel(state = {}, active = null) {
	return PROJECT_LINES.map((line) => {
		const own = state[line.key] ?? {};
		const tra = state[`${line.track}-TRA`] ?? {};
		const gra = state[`${line.track}-GRA`] ?? {};
		const base = { key: line.key, kind: line.kind, track: line.track, words: line.words, fit: line.fit, active: line.key === active };
		if (line.kind === "TRA") {
			const d = own.description;
			if (!own.file) return { ...base, file: null, loaded: false, content: "", state: "—", tone: "empty" };
			if (own.error) return { ...base, file: own.file, loaded: false, content: "", state: `nicht lesbar: ${own.error}`, tone: "error" };
			const content = `${d.records} Sätze, ${comma(d.length, 2)} m, Station ${comma(d.stationStart, 3)} bis ${comma(d.stationEnd, 3)}${d.stationEquations ? `, ${d.stationEquations} Kilometersprünge` : ""}`;
			const f = own.fit;
			const fitWords = f ? `Fit ${f.status}: rms ${comma(f.rms, 3)} m, max ${comma(f.max, 3)} m, ${f.outside} von ${f.points} außerhalb, Länge ${f.lengthChange >= 0 ? "+" : "−"}${comma(Math.abs(f.lengthChange), 3)} m` : null;
			return { ...base, file: own.file, assumed: Boolean(own.assumed), loaded: true, content,
				state: fitWords ?? (own.points ? "bereit: Aufmaß liegt vor" : "geladen; das Aufmaß fehlt"),
				tone: f ? (f.ok && f.outside === 0 ? "ok" : "warn") : own.points ? "ready" : "loaded" };
		}
		if (line.kind === "UEB") {
			// no file of its own: the U columns of the track's TRA, the ramp constructions of its GRA
			const fromTra = tra.description?.cant ?? null;
			const fromGra = gra.description?.cantConstructions ?? null;
			if (!fromTra && fromGra === null) return { ...base, file: null, loaded: false, content: "", state: "—", tone: "empty" };
			const parts = [
				fromTra ? (fromTra.records ? `${fromTra.records} von ${tra.description.records} Sätzen mit Überhöhung, bis ${comma(fromTra.maxMm, 0)} mm` : "die TRA trägt keine Überhöhung") : null,
				fromGra === null ? null : `${fromGra} ${fromGra === 1 ? "Rampenkonstruktion" : "Rampenkonstruktionen"} in der GRA`,
			].filter(Boolean);
			const c = tra.fit?.cant ?? null;
			return { ...base, file: [tra.file, gra.file].filter(Boolean).join(" + "), loaded: true, content: parts.join("; "),
				state: c ? `mit der Achse geprüft, nicht verändert: bei V ${c.speedKmh} km/h liegen ${c.exceededAfter} von ${c.arcs} Bögen über ${comma(c.maximumDeficiencyMm, 0)} mm Fehlbetrag (vorher ${c.exceededBefore})`
					: "wird mit der Achse geprüft, nicht verändert",
				tone: c ? (c.exceededAfter > c.exceededBefore ? "warn" : "ok") : "loaded" };
		}
		const d = own.description;
		if (!own.file) return { ...base, file: null, loaded: false, content: "", state: "—", tone: "empty" };
		if (own.error) return { ...base, file: own.file, loaded: false, content: "", state: `nicht lesbar: ${own.error}`, tone: "error" };
		const moved = tra.fit ? `; die Achse ist nach dem Fit um ${comma(Math.abs(tra.fit.lengthChange), 3)} m ${tra.fit.lengthChange >= 0 ? "länger" : "kürzer"}, die Stationen der Gradiente sind die vor dem Fit` : "";
		return { ...base, file: own.file, assumed: Boolean(own.assumed), loaded: true,
			content: `${d.gradeBreaks} Neigungswechsel, ${d.rounded} ausgerundet, Station ${comma(d.stationStart, 3)} bis ${comma(d.stationEnd, 3)}, Höhe ${comma(d.heightMin, 2)} bis ${comma(d.heightMax, 2)} m`,
			state: `geladen; noch nicht im Ausgleich${moved}`, tone: tra.fit && Math.abs(tra.fit.lengthChange) > 5e-4 ? "warn" : "loaded" };
	});
}

/**
 * The seven lines as the rows of a table (<thead> and <tbody>). An axis
 * that is loaded carries a button to work on it (`data-line`); the active
 * one is marked. Every label is escaped.
 */
export function projectTableHtml(model) {
	const rows = model.map((line) => {
		const pick = line.kind === "TRA" && line.loaded
			? `<button type="button" class="${line.active ? "primary" : "ghost"} tiny" data-line="${line.key}" title="${escape(line.active ? `${line.key} ist die Linie, an der unten gearbeitet wird` : `an ${line.key} arbeiten: Aufmaß, Vorgaben und Ergebnis dieser Linie`)}"${line.active ? ` aria-pressed="true"` : ""}>${line.active ? "in Arbeit" : "bearbeiten"}</button>`
			: "";
		return `<tr data-line="${line.key}" class="${[`tone-${line.tone}`, line.active ? "active" : ""].filter(Boolean).join(" ")}">`
			+ `<td><b>${escape(line.key)}</b></td><td>${escape(line.words)}</td>`
			+ `<td${line.assumed ? ` title="${escape("Der Dateiname nennt weder KM noch RE noch LI: als diese Linie genommen")}"` : ""}>${escape(line.file ?? "—")}${line.assumed ? " (angenommen)" : ""}</td>`
			+ `<td>${escape(line.content)}</td><td class="state">${escape(line.state)}</td><td class="act">${pick}</td></tr>`;
	});
	return `<thead><tr><th>Linie</th><th>was</th><th>Datei</th><th>Inhalt</th><th>Stand</th><th></th></tr></thead><tbody>${rows.join("")}</tbody>`;
}

/** what the page keeps of a fit for the project table, from fitTraCore's report */
export function fitSummary(report) {
	const measured = report.points.filter((p) => p.kind === "measured");
	const after = measured.map((p) => p.offset).filter(Number.isFinite);
	const c = report.cant;
	return Object.freeze({
		status: report.verdict.status, ok: Boolean(report.verdict.ok),
		rms: after.length ? Math.sqrt(after.reduce((sum, v) => sum + v * v, 0) / after.length) : NaN,
		max: after.length ? Math.max(...after.map(Math.abs)) : NaN,
		outside: report.fit.outsideTolerance, points: measured.length, lengthChange: report.fit.lengthChange,
		cant: c ? Object.freeze({ arcs: c.arcs.length, exceededBefore: c.exceededBefore, exceededAfter: c.exceededAfter, maximumDeficiencyMm: c.maximumDeficiencyMm, speedKmh: c.speedKmh }) : null,
	});
}
