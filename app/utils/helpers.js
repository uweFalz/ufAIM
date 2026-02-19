// app/utils/helpers.js

export function clampNumber(value, min, max) {
	const v = Number(value);
	if (!Number.isFinite(v)) return min;
	return Math.max(min, Math.min(max, v));
}

export function clamp01(x) {
  return clampNumber(x, 0, 1);
}

export function clamp01range(a, b) {
	const s0 = Number(a), s1 = Number(b);
	if (!Number.isFinite(s0) || !Number.isFinite(s1)) return null;
	const lo = Math.min(s0, s1);
	const hi = Math.max(s0, s1);
	if (!(hi > lo)) return null; // require non-zero length (you can relax this later)
	return { s0: lo, s1: hi };
}

export function clampS(s, L) {
	if (s < 0) return 0;
	if (s > L) return L;
	return s;
}

export function formatNum(v, digits = 3) {
	return Number.isFinite(v) ? v.toFixed(digits) : "—";
}

export function escapeHtml(text) {
	return String(text ?? "")
	.replace(/&/g, "&amp;")
	.replace(/</g, "&lt;")
	.replace(/>/g, "&gt;")
	.replace(/\"/g, "&quot;")
	.replace(/'/g, "&#39;");
}

export function formatPct01(x) {
	const v = Number(x);
	if (!Number.isFinite(v)) return "—";
	return `${Math.round(v * 100)}%`;
}

export function lerp(a, b, t) { return a + (b - a) * t; }
