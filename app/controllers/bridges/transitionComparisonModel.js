// Pure comparison model for TransEd: two sampled transitions, all three
// curvature quantities at once. No DOM, no store, no messaging.

export const TRANSITION_COMPARISON_MODES = Object.freeze([
	Object.freeze({ id: "k", label: "κ", color: "#20d5cc" }),
	Object.freeze({ id: "k1", label: "κ′", color: "#ffb454" }),
	Object.freeze({ id: "k2", label: "κ″", color: "#a99cff" }),
]);

function finiteValues(sampled, mode) {
	return (sampled?.samples ?? []).map((sample) => Number(sample?.[mode])).filter(Number.isFinite);
}

export function summarizeTransitionSamples(sampled, mode) {
	const values = finiteValues(sampled, mode);
	if (!values.length) return null;
	return { start: values[0], end: values.at(-1), min: Math.min(...values), max: Math.max(...values) };
}

/**
 * Each quantity is scaled to the joint range of both transitions, so the two
 * curves of one quantity stay comparable while the three quantities share
 * one plot.
 */
export function buildTransitionComparison(primary, secondary, { width = 600, height = 180, pad = 10 } = {}) {
	if (!primary?.samples?.length || !secondary?.samples?.length) return null;
	const rows = TRANSITION_COMPARISON_MODES.map(({ id, label, color }) => {
		const all = [...finiteValues(primary, id), ...finiteValues(secondary, id)];
		const lo = all.length ? Math.min(...all) : 0;
		const hi = all.length ? Math.max(...all) : 1;
		const span = hi - lo || 1;
		const points = (sampled) => sampled.samples
			.filter((sample) => Number.isFinite(Number(sample?.[id])))
			.map((sample) => `${(sample.u * width).toFixed(2)},${(height - pad - ((sample[id] - lo) / span) * (height - 2 * pad)).toFixed(2)}`)
			.join(" ");
		return {
			mode: id,
			label,
			color,
			range: { min: lo, max: hi },
			primary: { summary: summarizeTransitionSamples(primary, id), points: points(primary) },
			secondary: { summary: summarizeTransitionSamples(secondary, id), points: points(secondary) },
		};
	});
	return { primaryId: primary.presetId, secondaryId: secondary.presetId, modes: rows.map((row) => row.mode), rows };
}

export function formatTransitionRange(summary) {
	if (!summary) return "—";
	const text = (value) => {
		const rounded = Number(value.toPrecision(4));
		return Object.is(rounded, -0) ? "0" : String(rounded);
	};
	return `${text(summary.min)} … ${text(summary.max)}`;
}
