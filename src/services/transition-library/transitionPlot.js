// SVG pictures of a transition for pages without a plotting library.
// Pure functions: samples in, markup out.

export const PLOT_SERIES = Object.freeze([
	Object.freeze({ key: "k", label: "κ", color: "#0F9D94", width: 3, dash: "" }),
	Object.freeze({ key: "k1", label: "κ′", color: "#D98E1F", width: 1.8, dash: "6 4" }),
	Object.freeze({ key: "k2", label: "κ″", color: "#7A6BE0", width: 1.8, dash: "2 4" }),
]);

const W = 720;
const H = 300;
const PAD = { left: 44, right: 14, top: 14, bottom: 30 };

function rangeOf(values) {
	const finite = values.filter(Number.isFinite);
	if (!finite.length) return { min: 0, max: 1 };
	return { min: Math.min(...finite), max: Math.max(...finite) };
}

function format(value) {
	const rounded = Number(Number(value).toPrecision(3));
	return Object.is(rounded, -0) ? "0" : String(rounded);
}

function frame({ yMin, yMax }) {
	const x = (u) => PAD.left + u * (W - PAD.left - PAD.right);
	const span = yMax - yMin || 1;
	const y = (v) => H - PAD.bottom - ((v - yMin) / span) * (H - PAD.top - PAD.bottom);
	return { x, y };
}

function axes({ x, y }, { yMin, yMax }) {
	const parts = [`<rect x="${PAD.left}" y="${PAD.top}" width="${W - PAD.left - PAD.right}" height="${H - PAD.top - PAD.bottom}" fill="none" stroke="var(--line, #999)"/>`];
	for (const u of [0, 0.25, 0.5, 0.75, 1]) {
		parts.push(`<line x1="${x(u)}" y1="${PAD.top}" x2="${x(u)}" y2="${H - PAD.bottom}" stroke="var(--line, #999)" stroke-opacity=".5"/>`);
		parts.push(`<text x="${x(u)}" y="${H - 10}" text-anchor="middle" font-size="12" fill="var(--muted, #666)">${u}</text>`);
	}
	for (const v of [yMin, (yMin + yMax) / 2, yMax]) {
		parts.push(`<text x="${PAD.left - 6}" y="${y(v) + 4}" text-anchor="end" font-size="12" fill="var(--muted, #666)">${format(v)}</text>`);
	}
	if (yMin < 0 && yMax > 0) parts.push(`<line x1="${PAD.left}" y1="${y(0)}" x2="${W - PAD.right}" y2="${y(0)}" stroke="var(--muted, #666)" stroke-opacity=".7"/>`);
	return parts.join("");
}

function polyline(points, { color, width, dash }, attributes = "") {
	const d = points.filter((p) => Number.isFinite(p[1])).map((p) => `${p[0].toFixed(2)},${p[1].toFixed(2)}`).join(" ");
	return `<polyline ${attributes} points="${d}" fill="none" stroke="${color}" stroke-width="${width}"${dash ? ` stroke-dasharray="${dash}"` : ""} stroke-linejoin="round"/>`;
}

/**
 * κ, κ′ and κ″ of one transition in one frame. κ keeps its own scale (the
 * frame follows its range, so a counter-swerve stays visible); κ′ and κ″ are
 * each scaled into the frame, their true ranges are returned for the legend.
 */
export function transitionPlotSvg({ samples, w1 = null, w2 = null } = {}) {
	if (!Array.isArray(samples) || samples.length < 2) return { svg: "", ranges: null };
	const ranges = Object.fromEntries(PLOT_SERIES.map(({ key }) => [key, rangeOf(samples.map((sample) => sample[key]))]));
	const yMin = Math.min(0, ranges.k.min);
	const yMax = Math.max(1, ranges.k.max);
	const scale = frame({ yMin, yMax });
	const lines = PLOT_SERIES.map((series) => {
		const { min, max } = ranges[series.key];
		const span = max - min || 1;
		const toFrame = series.key === "k" ? (v) => v : (v) => yMin + ((v - min) / span) * (yMax - yMin);
		return polyline(samples.map((sample) => [scale.x(sample.u), scale.y(toFrame(sample[series.key]))]), series, `data-series="${series.key}"`);
	});
	const cuts = [["w1", w1], ["w2", w2]].filter(([, w]) => Number.isFinite(w) && w > 0 && w < 1)
		.map(([name, w]) => `<line data-cut="${name}" x1="${scale.x(w)}" y1="${PAD.top}" x2="${scale.x(w)}" y2="${H - PAD.bottom}" stroke="var(--accent, #E36414)" stroke-width="1.5" stroke-dasharray="4 3"/>`);
	const svg = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="κ, κ′, κ″ über u">${axes(scale, { yMin, yMax })}${cuts.join("")}${lines.reverse().join("")}</svg>`;
	return { svg, ranges };
}

/** Given and derived quantity of the coupling in one frame, true scale. */
export function couplingPlotSvg({ samples, given = "curvature" } = {}) {
	if (!Array.isArray(samples) || samples.length < 2) return { svg: "" };
	const all = samples.flatMap((sample) => [sample.curvature, sample.cant]);
	const { min, max } = rangeOf(all);
	const yMin = Math.min(0, min);
	const yMax = Math.max(1, max);
	const scale = frame({ yMin, yMax });
	const series = {
		curvature: { color: "#0F9D94", width: given === "curvature" ? 3 : 2, dash: given === "curvature" ? "" : "6 4" },
		cant: { color: "#C8572A", width: given === "cant" ? 3 : 2, dash: given === "cant" ? "" : "6 4" },
	};
	const lines = ["curvature", "cant"].map((key) => polyline(samples.map((sample) => [scale.x(sample.u), scale.y(sample[key])]), series[key], `data-series="${key}"`));
	return { svg: `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Krümmung und Überhöhung über u">${axes(scale, { yMin, yMax })}${lines.join("")}</svg>` };
}

/** Normalised u of a pointer position inside the plot's viewBox width. */
export function plotParameterAt(fraction) {
	const u = (fraction * W - PAD.left) / (W - PAD.left - PAD.right);
	return Math.max(0, Math.min(1, u));
}

export function formatRange(range) {
	return range ? `${format(range.min)} … ${format(range.max)}` : "—";
}
