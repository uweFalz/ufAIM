// app/io/importTRA_GRA.js
//
// Verm.ESN TRA/GRA Import (binary)
// - uses sharedVermesn.decodeBinary() which returns { meta, rowsRaw }
// - current freeze: record 0 is treated as header/meta and skipped
// - produces minimal payloads for "quick render hooks":
//   TRA -> geometry.pts (2D polyline), cant1d (optional)
//   GRA -> profile1d (s,z + meta), grade (optional)
//
// NOTE: This is intentionally pragmatic. Semantics can be refined later
// once you finish VermEsn format research.

import { decodeBinary, baseMetaFromFile } from "./sharedVermesn.js";

function baseName(filename = "") {
	return String(filename).replace(/\.[^/.]+$/, "");
}

function getExtensionLower(filename = "") {
	const match = /\.([a-z0-9]+)$/i.exec(String(filename));
	return match ? match[1].toLowerCase() : "";
}

function isFiniteNum(x) {
	return Number.isFinite(x);
}

function dedupConsecutive(points2d) {
	if (!Array.isArray(points2d) || points2d.length === 0) return points2d;
	const out = [];
	let last = null;
	for (const p of points2d) {
		if (!last || p.x !== last.x || p.y !== last.y) out.push(p);
		last = p;
	}
	return out;
}

/**
* Freeze rule: first record is header/meta (record 0).
* We still keep it around for logging, but data starts at index 1.
* Optional heuristic: if record 0 looks like real coordinates, we can include it.
*/
function sliceDataRows(rowsRaw, layoutKey) {
	if (!Array.isArray(rowsRaw) || rowsRaw.length === 0) return { header: null, rows: [] };

	const header = rowsRaw[0] ?? null;
	let rows = rowsRaw.slice(1);

	// Optional heuristic fallback: include row0 if it "looks like data"
	// (disabled by default in freeze; kept here as commented “escape hatch”.)
	//
	// if (layoutKey === "TRA" && header) {
	// 	const looksLikeCoord =
	// 		isFiniteNum(header.easting) && isFiniteNum(header.northing) &&
	// 		Math.abs(header.easting) > 1e4 && Math.abs(header.northing) > 1e4;
	// 	if (looksLikeCoord) rows = rowsRaw;
	// }
	//
	// if (layoutKey === "GRA" && header) {
	// 	const looksLikeProfile =
	// 		isFiniteNum(header.station) && isFiniteNum(header.height) &&
	// 		header.station >= 0 && header.station < 1e9;
	// 	if (looksLikeProfile) rows = rowsRaw;
	// }

	return { header, rows };
}

function buildPolylineFromTRA(rows) {
	const pts = [];
	for (const r of rows) {
		const x = r.easting;
		const y = r.northing;
		if (isFiniteNum(x) && isFiniteNum(y)) pts.push({ x, y });
	}
	return dedupConsecutive(pts);
}

function buildCantFromTRA(rows) {
	// TRA: cantA/cantE in mm; station in m; arcLength in m
	// We emit a simple break-point list {s, u} with u in meters.
	const pts = [];
	for (const r of rows) {
		const s0 = r.station;
		if (!isFiniteNum(s0)) continue;

		const uA = isFiniteNum(r.cantA) ? (r.cantA / 1000) : null; // mm->m
		const uE = isFiniteNum(r.cantE) ? (r.cantE / 1000) : null;

		if (uA !== null) pts.push({ s: s0, u: uA });

		const L = isFiniteNum(r.arcLength) ? r.arcLength : null;
		if (L && uE !== null) pts.push({ s: s0 + L, u: uE });
	}

	pts.sort((a, b) => a.s - b.s);
	return pts.length >= 2 ? pts : null;
}

function buildProfileFromGRA(rows) {
	// GRA: station, height, radius, tangentL, pointNumber, pointKey
	const pts = [];
	for (const r of rows) {
		const s = r.station;
		const z = r.height;
		if (!isFiniteNum(s) || !isFiniteNum(z)) continue;

		pts.push({
			s,
			z,
			R: isFiniteNum(r.radius) ? r.radius : null,
			T: isFiniteNum(r.tangentL) ? r.tangentL : null,
			pointNumber: r.pointNumber ?? null,
			pointKey: r.pointKey ?? null,
		});
	}
	pts.sort((a, b) => a.s - b.s);
	return pts.length ? pts : null;
}

function buildGradeFromProfile(profile1d) {
	// derive slope i(s) from z(s) segments: i = dz/ds
	if (!Array.isArray(profile1d) || profile1d.length < 2) return null;

	const grade = [];
	for (let i = 0; i < profile1d.length - 1; i++) {
		const a = profile1d[i];
		const b = profile1d[i + 1];
		const ds = b.s - a.s;
		if (!isFiniteNum(ds) || ds === 0) continue;

		const slope = (b.z - a.z) / ds; // m/m
		grade.push({ s: a.s, i: slope });
	}
	// convenience: repeat last slope at end station
	if (grade.length) {
		const lastSlope = grade[grade.length - 1].i;
		const endS = profile1d[profile1d.length - 1].s;
		grade.push({ s: endS, i: lastSlope });
	}
	return grade.length ? grade : null;
}

export async function importFileAuto(file) {
	const extension = getExtensionLower(file.name);
	const name = baseName(file.name);
	const buffer = await file.arrayBuffer();

	if (extension === "tra") {
		const decoded = decodeBinary(buffer, "TRA");
		const sliced = sliceDataRows(decoded.rowsRaw, "TRA");

		const polyline2d = buildPolylineFromTRA(sliced.rows);
		const cant1d = buildCantFromTRA(sliced.rows);

		return {
			kind: "TRA",
			name,

			meta: {
				...baseMetaFromFile(file),
				...decoded.meta,
				points: polyline2d.length,
				header: sliced.header ? "present" : "none",
				dataRows: sliced.rows.length,
			},

			// payload
			geometry: { pts: polyline2d },
			cant1d,               // [{s,u}] optional
			rowsRaw: decoded.rowsRaw,
			rows: sliced.rows,
			header: sliced.header,

			raw: { filename: file.name },
		};
	}

	if (extension === "gra") {
		const decoded = decodeBinary(buffer, "GRA");
		const sliced = sliceDataRows(decoded.rowsRaw, "GRA");

		const profile1d = buildProfileFromGRA(sliced.rows); // [{s,z,...}]
		const grade = buildGradeFromProfile(profile1d);

		return {
			kind: "GRA",
			name,

			meta: {
				...baseMetaFromFile(file),
				...decoded.meta,
				profilePts: profile1d?.length ?? 0,
				header: sliced.header ? "present" : "none",
				dataRows: sliced.rows.length,
			},

			// payload
			profile1d,            // [{s,z,R,T,...}] optional
			grade,                // [{s,i}] optional
			cant1d: null,          // (reserved; some sources store ramp info in GRA)
			rowsRaw: decoded.rowsRaw,
			rows: sliced.rows,
			header: sliced.header,

			raw: { filename: file.name },
		};
	}

	throw new Error(`Unsupported import: ${file.name}`);
}














/*

import { decodeBinary, baseMetaFromFile } from "./sharedVermesn.js";

function baseName(filename = "") {
	return String(filename).replace(/\.[^/.]+$/, "");
}

function getExtensionLower(filename = "") {
	const match = /\.([a-z0-9]+)$/i.exec(String(filename));
	return match ? match[1].toLowerCase() : "";
}

// Plausibility (Germany-ish GK/UTM) — only for header detection.
function looksLikeXY(x, y) {
	if (!Number.isFinite(x) || !Number.isFinite(y)) return false;

	// GK: RW ~ 3e6..6e6, HW ~ 4.5e6..6.5e6
	const gk = x > 2.5e6 && x < 6.5e6 && y > 4.5e6 && y < 6.8e6;

	// UTM: E  ~ 1e5..9e5, N  ~ 4.5e6..6.9e6
	const utm = x > 5.0e4 && x < 9.8e5 && y > 4.5e6 && y < 6.9e6;

	return gk || utm;
}

function isIntegerish(v) {
	return Number.isFinite(v) && Math.abs(v - Math.round(v)) < 1e-6;
}

function detectDataStartIndexTRA(rowsRaw) {
	// Heuristic: header record often has non-plausible coords,
	// while the next record has plausible coords.
	if (!Array.isArray(rowsRaw) || rowsRaw.length < 2) return 0;

	const a = rowsRaw[0];
	const b = rowsRaw[1];

	const aOk = looksLikeXY(a?.easting, a?.northing);
	const bOk = looksLikeXY(b?.easting, b?.northing);

	if (!aOk && bOk) return 1;

	const aZeros =
	(!Number.isFinite(a?.easting) || Math.abs(a.easting) < 1e-9) &&
	(!Number.isFinite(a?.northing) || Math.abs(a.northing) < 1e-9);

	if (aZeros && bOk) return 1;

	return 0;
}

function detectDataStartIndexGRA(rowsRaw) {
	// Typical: record 0 is header (counts). Newer variants sometimes have 2 meta records.
	if (!Array.isArray(rowsRaw) || rowsRaw.length < 2) return 0;

	const a = rowsRaw[0];
	const b = rowsRaw[1];

	const aHeightBad = !Number.isFinite(a?.height) || Math.abs(a.height) < 1e-9;
	const bHeightOk = Number.isFinite(b?.height) && Math.abs(b.height) > 1e-3;

	const aStationCountish = isIntegerish(a?.station) && a.station >= 0 && a.station < 200000;

	const aU16Countish =
	Number.isFinite(a?.pointNumber) &&
	Number.isFinite(a?.pointKey) &&
	a.pointNumber >= 0 &&
	a.pointKey >= 0;

	const bStationOk = Number.isFinite(b?.station) && b.station >= 0;

	if (bStationOk && bHeightOk && aHeightBad && (aStationCountish || aU16Countish)) return 1;

	// Optional: two meta records (a and b), first real data in c
	if (rowsRaw.length >= 3) {
		const c = rowsRaw[2];
		const bHeightBad = !Number.isFinite(b?.height) || Math.abs(b.height) < 1e-9;
		const cHeightOk = Number.isFinite(c?.height) && Math.abs(c.height) > 1e-3;
		if (aHeightBad && bHeightBad && cHeightOk) return 2;
	}

	return 0;
}

function buildPolylineFromTRA(rows) {
	const pts = [];
	for (const r of rows) {
		const x = r?.easting;
		const y = r?.northing;
		if (Number.isFinite(x) && Number.isFinite(y)) pts.push({ x, y });
	}

	// de-dup consecutive identicals
	const out = [];
	let last = null;
	for (const p of pts) {
		if (!last || p.x !== last.x || p.y !== last.y) out.push(p);
		last = p;
	}
	return out;
}

function buildProfileFromGRA(rows) {
	const pts = [];
	for (const r of rows) {
		const s = r?.station;
		const z = r?.height;
		if (Number.isFinite(s) && Number.isFinite(z)) {
			pts.push({
				s,
				z,
				R: Number.isFinite(r?.radius) ? r.radius : null,
				T: Number.isFinite(r?.tangentL) ? r.tangentL : null,
				pointNumber: Number.isFinite(r?.pointNumber) ? r.pointNumber : null,
				pointKey: Number.isFinite(r?.pointKey) ? r.pointKey : null,
			});
		}
	}

	pts.sort((a, b) => a.s - b.s);
	return pts;
}

function buildGradeFromProfile(profile1d) {
	if (!Array.isArray(profile1d) || profile1d.length < 2) return null;

	const grade = [];
	for (let i = 0; i < profile1d.length - 1; i++) {
		const a = profile1d[i];
		const b = profile1d[i + 1];
		const ds = b.s - a.s;
		if (!Number.isFinite(ds) || Math.abs(ds) < 1e-12) continue;
		const iSlope = (b.z - a.z) / ds; // m/m
		grade.push({ s: a.s, i: iSlope });
	}

	const last = grade[grade.length - 1];
	if (last) grade.push({ s: profile1d[profile1d.length - 1].s, i: last.i });

	return grade.length ? grade : null;
}

function buildCantFromTRA(rows) {
	const pts = [];
	for (const r of rows) {
		const s = r?.station;
		if (!Number.isFinite(s)) continue;

		const uA = Number.isFinite(r?.cantA) ? r.cantA / 1000 : null; // mm -> m
		const uE = Number.isFinite(r?.cantE) ? r.cantE / 1000 : null;

		if (uA !== null) pts.push({ s, u: uA });

		const L = Number.isFinite(r?.arcLength) ? r.arcLength : null;
		if (L && uE !== null) pts.push({ s: s + L, u: uE });
	}

	pts.sort((a, b) => a.s - b.s);

	// de-dup by station (keep last)
	const out = [];
	let lastS = null;
	for (const p of pts) {
		if (lastS !== null && Math.abs(p.s - lastS) < 1e-9) {
			out[out.length - 1] = p;
		} else {
			out.push(p);
			lastS = p.s;
		}
	}

	return out.length >= 2 ? out : null;
}

export async function importFileAuto(file) {
	const extension = getExtensionLower(file.name);
	const name = baseName(file.name);
	const buffer = await file.arrayBuffer();

	if (extension === "tra") {
		const decoded = decodeBinary(buffer, "TRA");
		const rowsRaw = decoded.rowsRaw ?? [];

		const dataStart = detectDataStartIndexTRA(rowsRaw);
		const rows = rowsRaw.slice(dataStart);

		const polyline2d = buildPolylineFromTRA(rows);
		const cant = buildCantFromTRA(rows);

		return {
			kind: "TRA",
			name,
			meta: {
				...baseMetaFromFile(file),
				...(decoded.meta ?? {}),
				dataStart,
				rowsRaw: rowsRaw.length,
				rows: rows.length,
				points: polyline2d.length,
			},
			geometry: { pts: polyline2d },
			cant,
			rows,
			rowsRaw,
			raw: { filename: file.name },
		};
	}

	if (extension === "gra") {
		const decoded = decodeBinary(buffer, "GRA");
		const rowsRaw = decoded.rowsRaw ?? [];

		const dataStart = detectDataStartIndexGRA(rowsRaw);
		const rows = rowsRaw.slice(dataStart);

		const profile1d = buildProfileFromGRA(rows);
		const grade = buildGradeFromProfile(profile1d);

		return {
			kind: "GRA",
			name,
			meta: {
				...baseMetaFromFile(file),
				...(decoded.meta ?? {}),
				dataStart,
				rowsRaw: rowsRaw.length,
				rows: rows.length,
				profilePts: profile1d.length,
			},
			profile1d,
			grade,
			rows,
			rowsRaw,
			raw: { filename: file.name },
		};
	}

	throw new Error(`Unsupported import: ${file.name}`);
}
*/
