function getExtensionLower(filename = "") {
	const match = /\.([a-z0-9]+)$/i.exec(String(filename));
	return match ? match[1].toLowerCase() : "";
}

function baseName(filename = "") {
	return String(filename).replace(/\.[^/.]+$/, "");
}

// Heuristic: find plausible GK/UTM coordinate pairs inside float64 stream.
// This is intentionally permissive; it just needs to make the import "visible".
function extractPlausibleXYFromFloat64(buffer) {
	const view = new DataView(buffer);
	const bytes = buffer.byteLength;

	const candidates = [];
	const step = 8; // float64
	const maxPairs = 8000; // cap for safety

	function readFloat64LE(offset) {
		return view.getFloat64(offset, true);
	}

	// Plausible ranges (Germany-ish):
	// GK: RW ~ 3e6..5e6, HW ~ 5e6..6e6
	// UTM: E  ~ 1e5..9e5, N  ~ 5e6..6.2e6
	function looksLikeXY(x, y) {
		const isFinite = Number.isFinite(x) && Number.isFinite(y);
		if (!isFinite) return false;

		const absX = Math.abs(x), absY = Math.abs(y);
		if (absX < 1e4 || absY < 1e4) return false;

		const gk = (x > 2.5e6 && x < 6.0e6 && y > 4.5e6 && y < 6.5e6);
		const utm = (x > 5.0e4 && x < 9.5e5 && y > 4.5e6 && y < 6.8e6);

		return gk || utm;
	}

	// scan sequential float64 pairs
	for (let offset = 0; offset + 16 <= bytes; offset += step) {
		const x = readFloat64LE(offset);
		const y = readFloat64LE(offset + 8);

		if (looksLikeXY(x, y)) {
			candidates.push({ x, y });
			if (candidates.length >= maxPairs) break;
		}
	}

	// de-duplicate noisy runs by simple distance threshold
	const result = [];
	const minDist2 = 0.01; // very small; only removes exact repeats
	let last = null;
	for (const p of candidates) {
		if (!last) {
			result.push(p);
			last = p;
			continue;
		}
		const dx = p.x - last.x;
		const dy = p.y - last.y;
		if (dx * dx + dy * dy > minDist2) {
			result.push(p);
			last = p;
		}
	}

	return result;
}

export async function importFileAuto(file) {
	const extension = getExtensionLower(file.name);
	const name = baseName(file.name);

	if (extension === "tra") {
		const buffer = await file.arrayBuffer();
		const polyline2d = extractPlausibleXYFromFloat64(buffer);

		return {
			kind: "TRA",
			name,
			meta: {
				bytes: buffer.byteLength,
				points: polyline2d.length,
				note: "heuristic float64 XY scan (GK/UTM-like)",
			},
			geometry: { pts: polyline2d },
			raw: { filename: file.name },
		};
	}

	if (extension === "gra") {
		// For now: just carry binary, make it visible; later parse real grade/cant.
		const buffer = await file.arrayBuffer();
		return {
			kind: "GRA",
			name,
			meta: { bytes: buffer.byteLength },
			grade: null,
			cant: null,
			raw: { filename: file.name },
		};
	}

	throw new Error(`Unsupported import: ${file.name}`);
}
