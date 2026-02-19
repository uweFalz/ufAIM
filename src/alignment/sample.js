// app/model/alignment/sample.js

/**
* Sample points along alignment for rendering/plots.
* returns { pts:[{s,x,y,heading,k}], totalLength }
*/
export function sampleAlignmentModel(alignment, { ds = 2.0 } = {}) {
	const total = alignment.totalLength;
	const pts = [];

	const N = Math.max(1, Math.ceil(total / ds));
	for (let i = 0; i <= N; i++) {
		const s = (i / N) * total;
		const ev = alignment.evalAt(s);
		pts.push({ s, x: ev.x, y: ev.y, heading: ev.heading, k: ev.curvature });
	}
	return { pts, totalLength: total };
}
