export function resolveGndType7TransitionId(edge) {
	if (Number(edge?.typeCode) !== 7) return null;
	if (!Number.isFinite(edge?.radiusA) || !Number.isFinite(edge?.radiusE)) return null;
	const radiusStart = Number(edge.radiusA);
	const radiusEnd = Number(edge.radiusE);
	const curvatureStart = radiusStart === 0 ? 0 : 1 / radiusStart;
	const curvatureEnd = radiusEnd === 0 ? 0 : 1 / radiusEnd;
	if (curvatureStart !== 0 && curvatureEnd !== 0 && Math.sign(curvatureStart) !== Math.sign(curvatureEnd)) return null;
	const magnitudeStart = Math.abs(curvatureStart);
	const magnitudeEnd = Math.abs(curvatureEnd);
	if (Math.abs(magnitudeStart - magnitudeEnd) <= 1e-12) return null;
	return magnitudeEnd > magnitudeStart ? "s_form_halfwave_in" : "s_form_halfwave_out";
}

export default resolveGndType7TransitionId;
