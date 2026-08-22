export function clamp01(x) {
	const value = Number(x);
	if (!Number.isFinite(value)) return 0;
	return Math.max(0, Math.min(1, value));
}
