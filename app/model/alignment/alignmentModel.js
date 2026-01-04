// app/model/alignment/alignmentModel.js

export function makeAlignment({ start = { x: 0, y: 0, heading: 0 }, segments = [] } = {}) {
	const segs = segments.map(s => ({ ...s }));
	const totalLength = segs.reduce((a, s) => a + (s.length ?? 0), 0);

	return {
		start: { ...start },
		segments: segs,
		totalLength
	};
}
