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
