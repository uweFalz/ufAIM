// src/services/axtran2/alignmentPicture.js
//
// The picture a Trassierer reads: the curvature band over the station, the
// plan dashed and the fit solid, and under it, on the same axis, where the
// survey points lie against the tolerance. Over the band every record of
// the file has a lock: what is held is visible, and a click says which
// record is meant.
//
// Pure: a report in, a model and an SVG string out. The page only listens
// (which record was clicked, which station the mouse is at); the app, the
// bundle and a test draw the same picture.

export const ALIGNMENT_PICTURE_VERSION = "axtran2/alignment-picture/0.1";

const COLOURS = Object.freeze({
	paper: "#FFFFFC", line: "#D9D4C7", axis: "#8A9099", text: "#5B6675", ink: "#1B2A41",
	plan: "#C8572A", fit: "#2E7D8C", fitSoft: "#DCECEF", held: "#F6E7BE", lock: "#8A5A00",
});
const PAD = Object.freeze({ left: 72, right: 16 });
const LOCK_ROWS = Object.freeze([16, 36]);
const BAND = Object.freeze({ top: 52, height: 150 });
const POINTS = Object.freeze({ top: 232, height: 170 });
export const PICTURE_HEIGHT = POINTS.top + POINTS.height + 28;

function escapeText(text) {
	return String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
const comma = (value, digits) => value.toFixed(digits).replace(".", ",").replace("-", "−");
const signed = (value, digits) => (value > 0 ? "+" : "") + comma(value, digits);

function niceStep(span, about) {
	const raw = span / about;
	if (!(raw > 0)) return 1;
	const power = 10 ** Math.floor(Math.log10(raw));
	for (const step of [1, 2, 5, 10]) if (raw <= step * power) return step * power;
	return 10 * power;
}

/**
 * What the picture shows, in numbers: every element with its station range
 * after the fit and before it, every record of the file with the column it
 * occupies, the measured points with their residual before and after.
 *
 * @param {object} report  a fit report (fitTraCore), with `elements[].records` and `planRecords`
 * @returns {object|null}  null without elements
 */
export function alignmentPictureModel(report) {
	const source = report?.elements ?? [];
	if (!source.length) return null;
	// curvature as 1000/R, the sign as the file has it; a straight is 0
	const curvature = (radius) => (Number.isFinite(radius) && radius !== 0 ? 1000 / radius : 0);
	let after = 0, before = 0;
	const elements = source.map((e) => {
		const item = {
			id: e.id, type: e.type, family: e.family ?? null, fixed: Boolean(e.fixed), records: [...(e.records ?? [])],
			s0: after, s1: after + e.after.length, b0: before, b1: before + e.before.length,
			length: e.after.length, lengthBefore: e.before.length, radius: e.after.radius ?? null, radiusBefore: e.before.radius ?? null,
			k0: curvature(e.after.radius), k1: curvature(e.after.radius), kb0: curvature(e.before.radius), kb1: curvature(e.before.radius),
		};
		after = item.s1; before = item.b1;
		return item;
	});
	// a transition runs from its one neighbour's curvature to the other's; the
	// line between them is exact for a clothoid and a sketch of the others
	elements.forEach((item, i) => {
		if (item.type !== "transition") return;
		const prev = elements[i - 1], next = elements[i + 1];
		const settled = (n) => n && n.type !== "transition";
		item.k0 = settled(prev) ? prev.k1 : 0; item.k1 = settled(next) ? next.k0 : 0;
		item.kb0 = settled(prev) ? prev.kb1 : 0; item.kb1 = settled(next) ? next.kb0 : 0;
	});

	// the file's records, each in the stretch of its element that is its share
	const byId = new Map(elements.map((e) => [e.id, e]));
	const used = new Map();
	const records = (report.planRecords ?? []).map((r) => {
		const e = byId.get(r.element);
		const base = { number: r.number, type: r.type, length: r.length, radius: r.radius ?? null, element: r.element ?? null, held: r.held ?? null, turnout: r.turnout ?? null };
		if (!e) return { ...base, fixed: false, lockable: false, s0: null, s1: null };
		const from = used.get(e.id) ?? 0;
		used.set(e.id, from + r.length);
		const scale = e.lengthBefore > 0 ? e.length / e.lengthBefore : 0;
		return { ...base, fixed: e.fixed, lockable: r.length > 0 && r.type !== "kink", s0: e.s0 + from * scale, s1: e.s0 + (from + r.length) * scale };
	});
	// what is held together: a turnout's records move as one
	const groups = (report.input?.turnouts ?? []).map((t) => [...t.records]);

	const tolerance = Number.isFinite(report.input?.tolerance) ? report.input.tolerance : 0.15;
	const points = (report.points ?? [])
		.filter((p) => p && p.kind === "measured" && Number.isFinite(p.station) && Number.isFinite(p.offset))
		.map((p) => {
			const target = Number.isFinite(p.target) ? p.target : 0;
			return {
				name: String(p.name), station: p.station, remark: p.remark ?? null, within: p.within !== false,
				after: Number.isFinite(p.residual) ? p.residual : p.offset - target,
				before: Number.isFinite(p.offsetBefore) ? p.offsetBefore - target : null,
			};
		})
		.sort((a, b) => a.station - b.station);
	const largest = (values) => values.reduce((m, v) => Math.max(m, Math.abs(v)), 0);
	const maxAfter = largest(points.map((p) => p.after));
	const maxBefore = largest(points.filter((p) => p.before !== null).map((p) => p.before));
	// the band is scaled to the fit and the tolerance. The plan's points are
	// drawn into it while they fit; a plan metres off would flatten the fit
	// to a line, so then they stay out and the picture says so
	const base = Math.max(tolerance * 1.5, maxAfter);
	const showBefore = maxBefore <= 4 * base;
	const reach = (showBefore ? Math.max(base, maxBefore) : base) * 1.12;
	const kMax = Math.max(largest(elements.flatMap((e) => [e.k0, e.k1, e.kb0, e.kb1])), 0.5) * 1.2;
	return {
		total: Math.max(after, before) || 1, lengthAfter: after, lengthBefore: before,
		elements, records, groups, points, tolerance, reach, showBefore, maxBefore, maxAfter, kMax,
	};
}

/** The records a click on `number` means: the turnout it belongs to, or itself. */
export function recordGroup(model, number) {
	return model.groups.find((g) => g.includes(number)) ?? [number];
}

const scales = (model, width) => {
	const plot = width - PAD.left - PAD.right;
	return {
		plot,
		x: (s) => PAD.left + (s / model.total) * plot,
		station: (px) => ((px - PAD.left) / plot) * model.total,
		yBand: (k) => BAND.top + BAND.height / 2 - (k / model.kMax) * (BAND.height / 2),
		yPoint: (v) => POINTS.top + POINTS.height / 2 - (v / model.reach) * (POINTS.height / 2),
	};
};

/**
 * What lies under a horizontal position of the picture.
 * @param {number} px  x in the picture's own units (its viewBox width is `width`)
 * @returns {{station: number, record: object|null, point: object|null}|null}  null outside the plot
 */
export function pictureProbe(model, width, px, { reachPx = 9 } = {}) {
	const sc = scales(model, width);
	const station = sc.station(px);
	if (!(station >= 0 && station <= model.total)) return null;
	const record = model.records.find((r) => r.s0 !== null && r.s1 > r.s0 && station >= r.s0 && station <= r.s1) ?? null;
	let point = null, distance = Infinity;
	for (const p of model.points) {
		const d = Math.abs(p.station - station);
		if (d < distance) { distance = d; point = p; }
	}
	if (point && sc.x(distance) - sc.x(0) > reachPx) point = null;
	return { station, record, point, x: sc.x(station), pointX: point ? sc.x(point.station) : null, pointY: point ? sc.yPoint(point.after) : null };
}

const describeRecord = (r) => (r.type === "arc" ? `Bogen R ${comma(Math.abs(r.radius), 0)}` : r.type === "straight" ? "Gerade" : r.type === "transition" ? "Übergangsbogen" : r.type);

/**
 * @param {object} model               from alignmentPictureModel
 * @param {object} [options]
 * @param {number} [options.width]     the picture's width in its own units; text and locks keep their size (1200)
 * @param {Iterable<number>} [options.held]  the records wanted held, where that differs from what the report computed:
 *                                     a lock set but not yet computed is drawn dashed
 * @returns {string} an <svg>; `data-record` marks what a click means
 */
export function alignmentPictureSvg(model, { width = 1200, held = null } = {}) {
	if (!model) return "";
	const sc = scales(model, width);
	const { x, yBand, yPoint } = sc;
	const f = (v) => v.toFixed(1);
	const wanted = held ? new Set(held) : new Set(model.records.filter((r) => r.held !== null).map((r) => r.number));
	const text = (label, px, py, anchor = "start", { strong = false } = {}) => `<text x="${f(px)}" y="${f(py)}" font-size="12" fill="${strong ? COLOURS.ink : COLOURS.text}"${strong ? ` font-weight="600"` : ""} text-anchor="${anchor}" font-family="sans-serif" pointer-events="none">${escapeText(label)}</text>`;
	const out = [`<svg viewBox="0 0 ${width} ${PICTURE_HEIGHT}" width="${width}" height="${PICTURE_HEIGHT}" role="img" aria-label="Krümmungsband mit den gehaltenen Sätzen und Abweichungen der Aufmaßpunkte über der Station" xmlns="http://www.w3.org/2000/svg">`];

	// the two panels
	out.push(`<rect x="${PAD.left}" y="${BAND.top}" width="${f(sc.plot)}" height="${BAND.height}" fill="${COLOURS.paper}" stroke="${COLOURS.line}"/>`);
	out.push(`<rect x="${PAD.left}" y="${POINTS.top}" width="${f(sc.plot)}" height="${POINTS.height}" fill="${COLOURS.paper}" stroke="${COLOURS.line}"/>`);

	// the records' columns: shaded where the fit held them, and the place to click
	const lockable = model.records.filter((r) => r.lockable && r.s0 !== null);
	for (const r of lockable) {
		const title = `Satz ${r.number}: ${describeRecord(r)}, ${comma(r.length, 2)} m${r.turnout ? `, ${r.turnout}` : ""}. ${r.fixed ? "Gehalten; ein Klick gibt frei." : "Frei; ein Klick hält fest."}`;
		out.push(`<rect data-record="${r.number}" x="${f(x(r.s0))}" y="${BAND.top}" width="${f(Math.max(x(r.s1) - x(r.s0), 1))}" height="${BAND.height}" fill="${r.fixed ? COLOURS.held : "transparent"}" style="cursor:pointer"><title>${escapeText(title)}</title></rect>`);
	}

	// the curvature: the plan dashed, the fit solid over a soft fill
	const band = (s0, s1, k0, k1) => {
		let d = "", last = 0;
		for (const e of model.elements) {
			if (!(e[s1] > e[s0])) continue;
			d += `${d ? "L" : "M"}${f(x(e[s0]))} ${f(yBand(last))}L${f(x(e[s0]))} ${f(yBand(e[k0]))}L${f(x(e[s1]))} ${f(yBand(e[k1]))}`;
			last = e[k1];
		}
		return d;
	};
	const closing = (end) => `L${f(x(end))} ${f(yBand(0))}`;
	const fit = band("s0", "s1", "k0", "k1");
	if (fit) out.push(`<path d="${fit}${closing(model.lengthAfter)}Z" fill="${COLOURS.fitSoft}" fill-opacity="0.7" pointer-events="none"/>`);
	out.push(`<line x1="${PAD.left}" y1="${f(yBand(0))}" x2="${f(PAD.left + sc.plot)}" y2="${f(yBand(0))}" stroke="${COLOURS.axis}" pointer-events="none"/>`);
	const plan = band("b0", "b1", "kb0", "kb1");
	if (plan) out.push(`<path d="${plan}${closing(model.lengthBefore)}" fill="none" stroke="${COLOURS.plan}" stroke-width="1.5" stroke-dasharray="5 4" pointer-events="none"/>`);
	if (fit) out.push(`<path d="${fit}${closing(model.lengthAfter)}" fill="none" stroke="${COLOURS.fit}" stroke-width="2" stroke-linejoin="round" pointer-events="none"/>`);
	for (const e of model.elements) {
		if (e.type !== "arc" || x(e.s1) - x(e.s0) < 44) continue;
		out.push(text(`R ${comma(Math.abs(e.radius), 0)}`, (x(e.s0) + x(e.s1)) / 2, yBand(e.k0) + (e.k0 > 0 ? -6 : 16), "middle", { strong: true }));
	}
	const edge = model.kMax / 1.2;
	out.push(text("1000/R", PAD.left - 6, yBand(0) + 4, "end"), text(signed(edge, 1), PAD.left - 6, yBand(edge) + 4, "end"), text(signed(-edge, 1), PAD.left - 6, yBand(-edge) + 4, "end"));

	// the locks: one per record wide enough to carry one, in two rows so that short neighbours do not collide
	let row = 0;
	for (const r of lockable) {
		if (x(r.s1) - x(r.s0) < 9) continue;
		const cx = (x(r.s0) + x(r.s1)) / 2, cy = LOCK_ROWS[row++ % 2];
		const on = wanted.has(r.number);
		const pending = on !== r.fixed;
		const colour = on ? COLOURS.lock : COLOURS.axis;
		const dash = pending ? ` stroke-dasharray="2 2"` : "";
		out.push(`<line x1="${f(cx)}" y1="${cy + 9}" x2="${f(cx)}" y2="${BAND.top}" stroke="${COLOURS.line}" pointer-events="none"/>`);
		out.push(`<g data-record="${r.number}" data-lock="${on ? "on" : "off"}"${pending ? ` data-pending="true"` : ""} transform="translate(${f(cx - 6)} ${cy - 8})" style="cursor:pointer">`
			+ `<title>${escapeText(`Satz ${r.number}${r.turnout ? ` (${r.turnout})` : ""}: ${on ? "gehalten" : "frei"}${pending ? ", noch nicht gerechnet" : ""}`)}</title>`
			+ `<rect x="-4" y="-3" width="20" height="22" fill="transparent"/>`
			+ `<path d="M3 7V${on ? 4.5 : 2.5}a3 3 0 0 1 6 0${on ? "V7" : ""}" fill="none" stroke="${colour}" stroke-width="1.6"${dash}/>`
			+ `<rect x="1" y="7" width="10" height="8" rx="1.5" fill="${on && !pending ? colour : COLOURS.paper}" stroke="${colour}" stroke-width="1.6"${dash}/></g>`);
	}

	// the points against the tolerance
	const mm = model.reach < 0.5;
	const unit = mm ? "mm" : "m";
	const shown = (v) => (mm ? v * 1000 : v);
	out.push(`<rect x="${PAD.left}" y="${f(yPoint(model.tolerance))}" width="${f(sc.plot)}" height="${f(yPoint(-model.tolerance) - yPoint(model.tolerance))}" fill="${COLOURS.fit}" fill-opacity="0.10"/>`);
	const step = niceStep(shown(model.reach) * 2, 6);
	for (let v = step; v < shown(model.reach); v += step) for (const s of [v, -v]) {
		const y = yPoint(mm ? s / 1000 : s);
		out.push(`<line x1="${PAD.left}" y1="${f(y)}" x2="${f(PAD.left + sc.plot)}" y2="${f(y)}" stroke="${COLOURS.line}" stroke-dasharray="1 5"/>`);
		out.push(text(signed(s, step < 1 ? 1 : 0), PAD.left - 6, y + 4, "end"));
	}
	out.push(`<line x1="${PAD.left}" y1="${f(yPoint(0))}" x2="${f(PAD.left + sc.plot)}" y2="${f(yPoint(0))}" stroke="${COLOURS.axis}"/>`);
	out.push(text(unit, PAD.left - 6, yPoint(0) + 4, "end"));
	out.push(text(`Punkte gegen die Toleranz ±${comma(shown(model.tolerance), mm ? 0 : 2)} ${unit}`, PAD.left + 6, POINTS.top + 14));
	if (!model.showBefore && model.points.length) out.push(text(`Der Plan liegt bis ${comma(model.maxBefore, 2)} m ab und ist hier nicht gezeichnet; siehe die Kurve darunter.`, PAD.left + sc.plot - 6, POINTS.top + 14, "end"));
	const marks = model.showBefore && model.points.length <= 2000;
	for (const p of model.points) {
		const px = x(p.station);
		if (marks && p.before !== null) {
			out.push(`<line x1="${f(px)}" y1="${f(yPoint(p.before))}" x2="${f(px)}" y2="${f(yPoint(p.after))}" stroke="${COLOURS.axis}" stroke-width="1"/>`);
			out.push(`<circle cx="${f(px)}" cy="${f(yPoint(p.before))}" r="2.2" fill="${COLOURS.paper}" stroke="${COLOURS.plan}"/>`);
		}
		out.push(`<circle cx="${f(px)}" cy="${f(yPoint(p.after))}" r="3.2" fill="${p.within ? COLOURS.fit : COLOURS.plan}"/>`);
	}

	// the station axis, from the start of the alignment
	const tick = niceStep(model.total, Math.max(4, Math.min(12, sc.plot / 110)));
	for (let s = 0; s <= model.total + 1e-9; s += tick) {
		out.push(`<line x1="${f(x(s))}" y1="${POINTS.top + POINTS.height}" x2="${f(x(s))}" y2="${POINTS.top + POINTS.height + 5}" stroke="${COLOURS.axis}"/>`);
		out.push(text(`${comma(s, 0)} m`, x(s), POINTS.top + POINTS.height + 20, "middle"));
	}

	// what the page moves while the mouse is over the picture
	out.push(`<rect data-role="highlight" x="0" y="${BAND.top}" width="0" height="${BAND.height}" fill="${COLOURS.ink}" fill-opacity="0.07" visibility="hidden" pointer-events="none"/>`);
	out.push(`<line data-role="cursor" x1="0" y1="${BAND.top}" x2="0" y2="${POINTS.top + POINTS.height}" stroke="${COLOURS.axis}" stroke-dasharray="2 3" visibility="hidden" pointer-events="none"/>`);
	out.push(`<circle data-role="point" cx="0" cy="0" r="6.5" fill="none" stroke="${COLOURS.ink}" stroke-width="1.5" visibility="hidden" pointer-events="none"/>`);
	out.push("</svg>");
	return out.join("");
}

/** One line for what pictureProbe found: station, record, point. Plain text. */
export function pictureReadout(model, probe) {
	if (!probe) return "";
	const mm = model.reach < 0.5;
	const value = (v) => (mm ? `${signed(v * 1000, 1)} mm` : `${signed(v, 3)} m`);
	const parts = [`Station ${comma(probe.station, 1)} m`];
	const r = probe.record;
	if (r) parts.push(`Satz ${r.number} ${describeRecord(r)}, ${comma(r.length, 2)} m${r.turnout ? `, ${r.turnout}` : ""}, ${r.fixed ? "gehalten" : "frei"}`);
	const p = probe.point;
	if (p) parts.push(`Punkt ${p.name}: ${p.before === null ? "" : `${value(p.before)} → `}${value(p.after)}${p.within ? "" : ", außerhalb"}${p.remark ? ` · ${p.remark}` : ""}`);
	return parts.join(" · ");
}
