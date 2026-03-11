// src/import/domain/landXMLNormalizers.js
//
// Light normalization helpers for landXML -> landFAT
// - parser-near
// - format-specific
// - NOT sparse/kernel normalization

export function normalizeSurveyPoint({ raw = null, values = [] } = {}) {
	const nums = Array.isArray(values) ? values : [];

	return {
		raw: raw != null ? String(raw) : null,

		// landXML / surveying convention:
		//   first  = Northing / Hochwert
		//   second = Easting  / Rechtswert
		//
		// internal convention:
		//   x = Easting
		//   y = Northing
		y: nums.length >= 1 && Number.isFinite(nums[0]) ? nums[0] : null,
		x: nums.length >= 2 && Number.isFinite(nums[1]) ? nums[1] : null,
		z: nums.length >= 3 && Number.isFinite(nums[2]) ? nums[2] : null,
	};
}

export function normalizeLandXMLRotation(rot) {
	const v = String(rot ?? "").trim().toLowerCase();
	if (!v) return null;

	if (v === "cw") return "cw";
	if (v === "ccw") return "ccw";

	// keep unknown future values visible instead of inventing semantics
	return v;
}

export function normalizeLandXMLSpiralType(spiType) {
	const v = String(spiType ?? "").trim();
	return v || null;
}

export function normalizeLandXMLDirection(value) {
	if (value == null || value === "") return null;
	const n = Number(value);
	return Number.isFinite(n) ? n : null;
}

export function normalizeLandXMLRadius(value) {
	if (value == null || value === "") return null;

	const v = String(value).trim().toUpperCase();
	if (v === "INF" || v === "+INF") return Infinity;
	if (v === "-INF") return -Infinity;

	const n = Number(value);
	return Number.isFinite(n) ? n : null;
}

export function normalizeLandXMLNumber(value) {
	if (value == null || value === "") return null;
	const n = Number(value);
	return Number.isFinite(n) ? n : null;
}

export function normalizeLandXMLBool(value) {
	if (value == null || value === "") return null;
	const v = String(value).trim().toLowerCase();
	if (v === "true") return true;
	if (v === "false") return false;
	return null;
}