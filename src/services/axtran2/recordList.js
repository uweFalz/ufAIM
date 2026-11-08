// src/services/axtran2/recordList.js
//
// The element listing a Trassierer works in: every record of the file as a
// row, type, length and radius before and after the fit, and for each
// quantity a box that holds it. The list and the picture show one hold; a
// box writes the same field a lock does.
//
// Pure: a picture model in, an HTML string out, every label escaped. The
// page listens for the boxes (`data-record`, `data-quantity`).

import { describeHold, holdMap } from "./alignmentPicture.js";

export const RECORD_LIST_VERSION = "axtran2/record-list/0.1";

const escape = (text) => String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const comma = (value, digits) => value.toFixed(digits).replace(".", ",").replace("-", "−");
const TYPE = Object.freeze({ straight: "Gerade", arc: "Bogen", transition: "Übergangsbogen", kink: "Knick" });

/**
 * @param {object} model  from alignmentPictureModel
 * @param {object} [options]
 * @param {Iterable|Map|null} [options.held]  the hold wanted where it differs from the report's (see holdMap)
 * @returns {string} the rows of a table (<thead> and <tbody>); "" without a model
 */
export function recordListHtml(model, { held = null } = {}) {
	if (!model) return "";
	const wanted = holdMap(model, held);
	const computed = holdMap(model, null);
	const byId = new Map(model.elements.map((e) => [e.id, e]));
	const cell = (text, cls = "") => `<td${cls ? ` class="${cls}"` : ""}>${escape(text)}</td>`;
	const number = (value, digits, before) => {
		if (value === null || value === undefined || !Number.isFinite(value)) return cell("—", "num");
		const changed = Number.isFinite(before) && Math.abs(value - before) > (digits >= 2 ? 0.005 : 0.5);
		return cell(comma(value, digits), changed ? "num changed" : "num");
	};
	const box = (r, quantity, label, want, have) => {
		const pending = want !== have;
		return `<td class="hold"><label title="${escape(`Satz ${r.number}, ${label}: ${want ? "gehalten" : "frei"}${pending ? ", noch nicht gerechnet" : ""}`)}">`
			+ `<input type="checkbox" data-record="${r.number}" data-quantity="${quantity}"${want ? " checked" : ""}${pending ? ` class="pending"` : ""} aria-label="${escape(`Satz ${r.number}: ${label} halten`)}"></label></td>`;
	};
	const rows = model.records.map((r) => {
		const e = r.element ? byId.get(r.element) : null;
		const want = wanted.get(r.number) ?? { length: false, radius: false };
		const have = computed.get(r.number) ?? { length: false, radius: false };
		const state = describeHold(have, r.hasRadius);
		const lengthAfter = r.lockable && r.s0 !== null ? r.s1 - r.s0 : null;
		const radiusAfter = r.hasRadius && e ? e.radius : null;
		const holds = !r.lockable ? `<td class="hold" colspan="2"></td>`
			: r.turnout ? `<td class="hold" colspan="2"><label title="${escape(`${r.turnout}: eine Weiche wird als Ganzes gehalten`)}"><input type="checkbox" data-record="${r.number}" data-quantity="both"${want.length && (want.radius || !r.hasRadius) ? " checked" : ""}${(want.length !== have.length || want.radius !== have.radius) ? ` class="pending"` : ""} aria-label="${escape(`Satz ${r.number}: Weiche halten`)}"> Weiche</label></td>`
			: box(r, "length", "Länge", want.length, have.length) + (r.hasRadius ? box(r, "radius", "Radius", want.radius, have.radius) : `<td class="hold"></td>`);
		return `<tr data-record="${r.number}"${state === "frei" ? "" : ` class="held"`}>`
			+ cell(r.number, "num") + cell(TYPE[r.type] ?? r.type) + cell(r.turnout ?? "")
			+ number(r.length, 2) + number(lengthAfter, 2, r.length)
			+ number(r.hasRadius ? r.radius : null, 0) + number(radiusAfter, 0, r.radius)
			+ holds + cell(state) + "</tr>";
	});
	return `<thead><tr><th>Nr</th><th>Typ</th><th>Weiche</th><th class="num">Länge Plan [m]</th><th class="num">Länge Fit [m]</th><th class="num">Radius Plan [m]</th><th class="num">Radius Fit [m]</th><th>Länge halten</th><th>Radius halten</th><th>Stand</th></tr></thead><tbody>${rows.join("")}</tbody>`;
}
