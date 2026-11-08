// src/services/axtran2/recordList.js
//
// The element listing a Trassierer works in: every record of the file as a
// row, type, length and radius before and after the fit, and for each
// quantity a box that holds it. The list and the picture show one hold; a
// box writes the same field a lock does.
//
// The plan's length and radius are fields: a value typed there is where the
// next fit starts (recordEdits.js); the file keeps its own, shown under
// the field. A turnout is catalogue geometry and has no field.
//
// A record is taken out or put in from here too: a button on each row, a
// struck row with a way back, an inserted row under its key ("7+1") with
// its own fields, and a small form under the row a record goes in after.
//
// Pure: a picture model in, an HTML string out, every label escaped. The
// page listens for the boxes (`data-record`, `data-quantity`), the fields
// (`data-record`, `data-field`), the buttons (`data-action`, `data-record`)
// and the form (`data-insert-after`).

import { describeHold, holdMap } from "./alignmentPicture.js";
import { parseEdits, TRANSITION_FAMILIES, INSERT_TYPES, TURNOUT_ORIENTATIONS, TURNOUT_SHAPES, CROSSING_SHAPES, CROSSING_ROUTES_WORDS } from "./recordEdits.js";

export const RECORD_LIST_VERSION = "axtran2/record-list/0.5";

const escape = (text) => String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const comma = (value, digits) => value.toFixed(digits).replace(".", ",").replace("-", "−");
const TYPE = Object.freeze({ straight: "Gerade", arc: "Bogen", transition: "Übergangsbogen", kink: "Knick" });

/**
 * @param {object} model  from alignmentPictureModel
 * @param {object} [options]
 * @param {Iterable|Map|null} [options.held]  the hold wanted where it differs from the report's (see holdMap)
 * @param {Array|Map|string|null} [options.edits]  the edits wanted where they differ from what the fit started from
 *                                          (see parseEdits): a value typed but not yet computed
 * @param {number|null} [options.insertAfter]  the record a form to put a record in after is open under
 * @returns {string} the rows of a table (<thead> and <tbody>); "" without a model
 */
export function recordListHtml(model, { held = null, edits = null, insertAfter = null } = {}) {
	if (!model) return "";
	const wanted = holdMap(model, held);
	const computed = holdMap(model, null);
	const typed = edits === null ? null : parseEdits(edits);
	const byId = new Map(model.elements.map((e) => [e.id, e]));
	const cell = (text, cls = "") => `<td${cls ? ` class="${cls}"` : ""}>${escape(text)}</td>`;
	const number = (value, digits, before) => {
		if (value === null || value === undefined || !Number.isFinite(value)) return cell("—", "num");
		const changed = Number.isFinite(before) && Math.abs(value - before) > (digits >= 2 ? 0.005 : 0.5);
		return cell(comma(value, digits), changed ? "num changed" : "num");
	};
	const trim = (value, digits) => comma(value, digits).replace(/,?0+$/, (m) => (m.startsWith(",") ? "" : m));
	// the plan's value as a field: what the fit started from, or what is typed and not yet computed
	const field = (r, name, label, unit, digits) => {
		const started = name === "length" ? r.length : r.radius;
		// an inserted record has no file value: its own start is the measure
		const file = r.inserted ? started : name === "length" ? r.fileLength : r.fileRadius;
		// an edit list given is the whole of it: a record not in it starts from the file
		const value = typed === null || r.inserted ? started : typed.get(r.number)?.[name] ?? file;
		const pending = Math.abs(value - started) > 1e-9;
		const changed = Math.abs(value - file) > 1e-9;
		const title = `${changed ? `${label} in der Datei: ${comma(file, digits)} ${unit}` : `${label} wie in der Datei`}${pending ? "; noch nicht gerechnet" : ""}`;
		const cls = [changed ? "edited" : "", pending ? "pending" : ""].filter(Boolean).join(" ");
		return `<td class="num plan"><input type="text" inputmode="decimal" data-record="${r.number}" data-field="${name}" value="${trim(value, digits)}" class="${cls}" title="${escape(title)}" aria-label="${escape(`Satz ${r.number}: ${label} Plan`)}"></td>`;
	};
	// a transition's type as a choice: what the fit started from, or what is chosen and not yet computed
	const typeCell = (r) => {
		if (r.type !== "transition" || !r.lockable || !TRANSITION_FAMILIES[r.fileFamily]) return cell(r.type === "transition" && TRANSITION_FAMILIES[r.family] ? `${TYPE.transition} (${TRANSITION_FAMILIES[r.family]})` : TYPE[r.type] ?? r.type);
		const value = typed === null ? r.family : typed.get(r.number)?.family ?? r.fileFamily;
		const pending = value !== r.family;
		const changed = value !== r.fileFamily;
		const title = `${changed ? `In der Datei: ${TRANSITION_FAMILIES[r.fileFamily]}` : "Typ wie in der Datei"}${pending ? "; noch nicht gerechnet" : ""}`;
		const cls = [changed ? "edited" : "", pending ? "pending" : ""].filter(Boolean).join(" ");
		const options = Object.entries(TRANSITION_FAMILIES).map(([key, label]) => `<option value="${key}"${key === value ? " selected" : ""}>${label}</option>`).join("");
		return `<td>${TYPE.transition} <select data-record="${r.number}" data-field="family" class="${cls}" title="${escape(title)}" aria-label="${escape(`Satz ${r.number}: Typ des Übergangsbogens`)}">${options}</select></td>`;
	};
	const box = (r, quantity, label, want, have) => {
		const pending = want !== have;
		return `<td class="hold"><label title="${escape(`Satz ${r.number}, ${label}: ${want ? "gehalten" : "frei"}${pending ? ", noch nicht gerechnet" : ""}`)}">`
			+ `<input type="checkbox" data-record="${r.number}" data-quantity="${quantity}"${want ? " checked" : ""}${pending ? ` class="pending"` : ""} aria-label="${escape(`Satz ${r.number}: ${label} halten`)}"></label></td>`;
	};
	const count = model.records.filter((r) => !r.inserted).length;
	const button = (action, record, label, title, disabled = "") => `<button type="button" class="ghost tiny" data-action="${action}" data-record="${escape(record)}" title="${escape(disabled || title)}"${disabled ? " disabled" : ""}>${label}</button>`;
	const structureCell = (r) => {
		if (r.inserted) return `<td class="act">${button("drop", r.number, "−", `Satz ${r.number} wieder herausnehmen`)}</td>`;
		if (r.removed) return `<td class="act">${button("restore", r.number, "↩", `Satz ${r.number} wieder hereinnehmen`)}</td>`;
		const end = r.number === 1 ? "der erste" : r.number === count ? "der letzte" : null;
		const noRemove = end ? `Satz ${r.number} ist ${end} der Datei: Anfang und Ende der Trasse stehen darauf` : r.turnout ? `Satz ${r.number} gehört zur Weiche ${r.turnout}` : !r.lockable ? "nichts herauszunehmen" : "";
		const noInsert = r.number === count ? "hinter dem letzten Satz geht nichts hinein" : r.element === null ? "nichts einzufügen" : "";
		return `<td class="act">${button("remove", r.number, "−", `Satz ${r.number} herausnehmen`, noRemove)} ${button("insert-after", r.number, "+", `nach Satz ${r.number} einen Satz einfügen`, noInsert)}</td>`;
	};
	const insertForm = (after) => `<tr class="insert-form" data-after="${after}"><td colspan="11"><form data-insert-after="${after}" class="insert">`
		+ `<span>Einfügen nach Satz ${after}:</span> <select name="kind" aria-label="Art">${Object.entries(INSERT_TYPES).map(([k, v]) => `<option value="${k}">${v}</option>`).join("")}</select>`
		+ ` <label data-for="straight arc transition">Länge [m] <input name="len" inputmode="decimal" value="20" size="7"></label>`
		+ ` <label data-for="arc">Radius [m] <input name="rad" inputmode="decimal" placeholder="wie in der Datei" size="9"></label>`
		+ ` <label data-for="transition">Typ <select name="fam">${Object.entries(TRANSITION_FAMILIES).map(([k, v]) => `<option value="${k}">${v}</option>`).join("")}</select></label>`
		+ ` <label data-for="turnout">Bauart <select name="wshape">${TURNOUT_SHAPES.map((s) => `<option value="${s.radius}${s.radiusEnd !== null ? `/${s.radiusEnd}` : ""}-1/${s.ratio}">${escape(s.designation)}${s.branchSpeedKmh ? ` (Zweig ${s.branchSpeedKmh} km/h)` : ""}</option>`).join("")}</select></label>`
		+ ` <label data-for="turnout">Zweig <select name="wside"><option value="right">rechts</option><option value="left">links</option></select></label>`
		+ ` <label data-for="turnout">Lage <select name="worient">${Object.entries(TURNOUT_ORIENTATIONS).map(([k, v]) => `<option value="${k}">${v}</option>`).join("")}</select></label>`
		+ ` <label data-for="turnout">auf Stammgleis R [m] <input name="wmain" inputmode="decimal" placeholder="leer: gerade Weiche" size="9" title="Radius des Stammgleises mit dem Vorzeichen der Datei: die Weiche wird darauf gebogen (Innen- oder Außenbogenweiche)"></label>`
		+ ` <label data-for="crossing">Bauart <select name="kshape">${CROSSING_SHAPES.map((s) => `<option value="${s.kind}:${s.radius}-1/${s.ratio}">${escape(s.designation)}${s.branchSpeedKmh ? ` (Bogen ${s.branchSpeedKmh}, gerade ${s.mainSpeedKmh} km/h)` : ""}</option>`).join("")}</select></label>`
		+ ` <label data-for="crossing">Fahrt <select name="kroute">${Object.entries(CROSSING_ROUTES_WORDS).map(([k, v]) => `<option value="${k}">${v}</option>`).join("")}</select></label>`
		+ ` <label data-for="crossing">kreuzendes Gleis <select name="kside"><option value="right">rechts</option><option value="left">links</option></select></label>`
		+ ` <button type="submit" class="primary tiny">Einfügen</button> <button type="button" class="ghost tiny" data-action="cancel">Abbrechen</button></form></td></tr>`;
	const rows = model.records.flatMap((r) => {
		const e = r.element ? byId.get(r.element) : null;
		if (r.removed) {
			return [`<tr data-record="${r.number}" class="removed">` + cell(r.number, "num") + cell(TYPE[r.type] ?? r.type) + cell(r.turnout ?? "")
				+ number(r.fileLength ?? r.length, 2) + cell("—", "num") + number(r.hasRadius ? r.fileRadius ?? r.radius : null, 0) + cell("—", "num")
				+ `<td class="hold" colspan="2"></td>` + cell("herausgenommen") + structureCell(r) + "</tr>"];
		}
		const want = wanted.get(r.number) ?? { length: false, radius: false };
		const have = computed.get(r.number) ?? { length: false, radius: false };
		const state = r.inserted ? `eingefügt nach Satz ${r.inserted.after}${r.turnout ? ", gehalten" : ""}` : describeHold(have, r.hasRadius);
		const lengthAfter = r.lockable && r.s0 !== null ? r.s1 - r.s0 : null;
		const radiusAfter = r.hasRadius && e ? e.radius : null;
		const editable = r.lockable && !r.turnout;
		const planLength = editable ? field(r, "length", "Länge", "m", 2) : number(r.length, 2);
		const planRadius = editable && r.hasRadius ? field(r, "radius", "Radius", "m", 0) : number(r.hasRadius ? r.radius : null, 0);
		const holds = !r.holdable ? `<td class="hold" colspan="2"></td>`
			: r.turnout ? `<td class="hold" colspan="2"><label title="${escape(`${r.turnout}: eine Weiche wird als Ganzes gehalten`)}"><input type="checkbox" data-record="${r.number}" data-quantity="both"${want.length && (want.radius || !r.hasRadius) ? " checked" : ""}${(want.length !== have.length || want.radius !== have.radius) ? ` class="pending"` : ""} aria-label="${escape(`Satz ${r.number}: Weiche halten`)}"> Weiche</label></td>`
			: box(r, "length", "Länge", want.length, have.length) + (r.hasRadius ? box(r, "radius", "Radius", want.radius, have.radius) : `<td class="hold"></td>`);
		const cls = r.inserted ? "inserted" : state === "frei" ? "" : "held";
		const row = `<tr data-record="${escape(r.number)}"${cls ? ` class="${cls}"` : ""}>`
			+ cell(r.inserted ? "+" : r.number, "num") + typeCell(r) + cell(r.turnout ?? "")
			+ planLength + number(lengthAfter, 2, r.length)
			+ planRadius + number(radiusAfter, 0, r.radius)
			+ holds + cell(state) + structureCell(r) + "</tr>";
		return insertAfter !== null && !r.inserted && Number(r.number) === Number(insertAfter) ? [row, insertForm(r.number)] : [row];
	});
	return `<thead><tr><th>Nr</th><th>Typ</th><th>Weiche</th><th class="num">Länge Plan [m]</th><th class="num">Länge Fit [m]</th><th class="num">Radius Plan [m]</th><th class="num">Radius Fit [m]</th><th>Länge halten</th><th>Radius halten</th><th>Stand</th><th>Sätze</th></tr></thead><tbody>${rows.join("")}</tbody>`;
}
