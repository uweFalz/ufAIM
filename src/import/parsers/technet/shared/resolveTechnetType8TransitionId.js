// Technet type 8 selects one existing Bloss halfwave, not a new curve law.
// Zero radius is the format's straight sentinel. Missing/non-numeric values
// must not be coerced to that sentinel. No sign or coordinate conversion here.
export function resolveTechnetType8TransitionId({ typeCode, radiusA, radiusE } = {}) {
	if (Number(typeCode) !== 8 || !Number.isFinite(radiusA) || !Number.isFinite(radiusE)) return null;
	const start = radiusA === 0 ? 0 : 1 / radiusA;
	const end = radiusE === 0 ? 0 : 1 / radiusE;
	if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
	if (start !== 0 && end !== 0 && Math.sign(start) !== Math.sign(end)) return null;
	const magnitudeStart = Math.abs(start);
	const magnitudeEnd = Math.abs(end);
	if (Math.abs(magnitudeStart - magnitudeEnd) <= 1e-12) return null;
	return magnitudeEnd > magnitudeStart ? "bloss_halfwave_in" : "bloss_halfwave_out";
}
