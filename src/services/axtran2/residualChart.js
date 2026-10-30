// src/services/axtran2/residualChart.js
//
// The residual curve: the survey points' lateral offset along the station,
// before the fit and after it, as one SVG. Before is drawn to its own
// scale (metres, the plan may be anything off), after to the tolerance
// (the tolerance is the band's height, so a point outside it is visible
// as such). Pure: a string in, a string out; the app, the bundle and a
// test draw the same picture.

const COLOURS = Object.freeze({ paper: "#FFFFFC", line: "#D9D4C7", axis: "#8A9099", before: "#C8572A", after: "#2E7D8C", band: "#2E7D8C", text: "#5B6675" });

function escapeText(text) {
	return String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function niceMax(value) {
	if (!(value > 0)) return 1;
	const power = 10 ** Math.floor(Math.log10(value));
	for (const step of [1, 2, 5, 10]) if (value <= step * power) return step * power;
	return 10 * power;
}

/**
 * @param {Array} points   the report's points: { kind, station, offsetBefore, offset, within }
 * @param {object} [options]
 * @param {number} [options.tolerance]   metres; the after-band's half height (0.15)
 * @param {number} [options.width]       px (1200)
 * @param {number} [options.height]      px per panel (180)
 * @param {string} [options.unit]        label unit for the station axis ("m")
 * @returns {string} an <svg> with two panels, before over after, or an empty string without usable points
 */
export function residualChartSvg(points, { tolerance = 0.15, width = 1200, height = 180, unit = "m" } = {}) {
	const usable = (points ?? []).filter((p) => p && p.kind === "measured" && Number.isFinite(p.station));
	if (usable.length < 2) return "";
	const sorted = [...usable].sort((a, b) => a.station - b.station);
	const s0 = sorted[0].station, s1 = sorted[sorted.length - 1].station;
	const span = s1 - s0 || 1;
	const before = sorted.filter((p) => Number.isFinite(p.offsetBefore));
	const after = sorted.filter((p) => Number.isFinite(p.offset));
	const beforeMax = niceMax(Math.max(...before.map((p) => Math.abs(p.offsetBefore)), 0));
	const afterMax = Math.max(tolerance, ...after.map((p) => Math.abs(p.offset))) * 1.05;
	const pad = { left: 72, right: 16, gap: 28 };
	const plotWidth = width - pad.left - pad.right;
	const x = (s) => pad.left + ((s - s0) / span) * plotWidth;
	const panel = (top, values, key, scale, colour) => {
		const mid = top + height / 2;
		const y = (v) => mid - (v / scale) * (height / 2 - 8);
		const path = values.map((p, i) => `${i ? "L" : "M"}${x(p.station).toFixed(1)} ${y(p[key]).toFixed(1)}`).join(" ");
		return { mid, y, path, colour };
	};
	const b = panel(0, before, "offsetBefore", beforeMax, COLOURS.before);
	const aTop = height + pad.gap;
	const a = panel(aTop, after, "offset", afterMax, COLOURS.after);
	const total = aTop + height + 28;
	const label = (text, px, py, anchor = "start") => `<text x="${px}" y="${py}" font-size="12" fill="${COLOURS.text}" text-anchor="${anchor}" font-family="sans-serif">${escapeText(text)}</text>`;
	const fmt = (v) => (Math.abs(v) >= 1 ? (Number.isInteger(v) || v >= 100 ? v.toFixed(0) : v.toFixed(1)) + " m" : (v * 100).toFixed(0) + " cm");
	const outside = after.filter((p) => p.within === false).map((p) => `<circle cx="${x(p.station).toFixed(1)}" cy="${a.y(p.offset).toFixed(1)}" r="4" fill="none" stroke="${COLOURS.before}" stroke-width="2"/>`).join("");
	return [
		`<svg viewBox="0 0 ${width} ${total}" width="100%" role="img" aria-label="Querabstand der Aufmaßpunkte entlang der Station, vorher und nachher" xmlns="http://www.w3.org/2000/svg">`,
		`<rect x="${pad.left}" y="0" width="${plotWidth}" height="${height}" fill="${COLOURS.paper}" stroke="${COLOURS.line}"/>`,
		`<line x1="${pad.left}" y1="${b.mid}" x2="${pad.left + plotWidth}" y2="${b.mid}" stroke="${COLOURS.axis}"/>`,
		`<path d="${b.path}" fill="none" stroke="${b.colour}" stroke-width="2" stroke-linejoin="round"/>`,
		label("vorher", pad.left + 6, 14), label("+" + fmt(beforeMax), pad.left - 6, 14, "end"), label("−" + fmt(beforeMax), pad.left - 6, height - 4, "end"),
		`<rect x="${pad.left}" y="${aTop}" width="${plotWidth}" height="${height}" fill="${COLOURS.paper}" stroke="${COLOURS.line}"/>`,
		`<rect x="${pad.left}" y="${a.y(tolerance).toFixed(1)}" width="${plotWidth}" height="${(a.y(-tolerance) - a.y(tolerance)).toFixed(1)}" fill="${COLOURS.band}" fill-opacity="0.10"/>`,
		`<line x1="${pad.left}" y1="${a.mid}" x2="${pad.left + plotWidth}" y2="${a.mid}" stroke="${COLOURS.axis}"/>`,
		`<path d="${a.path}" fill="none" stroke="${a.colour}" stroke-width="2" stroke-linejoin="round"/>`,
		outside,
		label("nachher, Band = Toleranz ±" + fmt(tolerance), pad.left + 6, aTop + 14), label("+" + fmt(afterMax), pad.left - 6, aTop + 14, "end"), label("−" + fmt(afterMax), pad.left - 6, aTop + height - 4, "end"),
		label(`Station ${s0.toFixed(0)} ${unit}`, pad.left, total - 8), label(`${s1.toFixed(0)} ${unit}`, pad.left + plotWidth, total - 8, "end"),
		"</svg>",
	].join("");
}
