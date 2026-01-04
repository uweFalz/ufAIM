// app/io/importTRA_GRA.js

function extOf(name = "") {
	const m = /\.([a-z0-9]+)$/i.exec(name.trim());
	return m ? m[1].toLowerCase() : "";
}

// VERY forgiving float extraction (also accepts comma decimals)
function toNum(s) {
	if (typeof s !== "string") return NaN;
	const t = s.replace(",", ".").replace(/[^0-9eE+\-\.]/g, "");
	const v = Number(t);
	return Number.isFinite(v) ? v : NaN;
}

// Try to find XY coordinate pairs in the text.
// Supports things like: "x y", "X=... Y=...", "RW HW" style two numbers per line.
function extractXYPolyline(text) {
	const pts = [];

	const lines = text.split(/\r?\n/);
	for (const raw of lines) {
		const line = raw.trim();
		if (!line) continue;

		// Case 1: X=... Y=...
		const mx = /(?:^|[\s;,(])x\s*=\s*([+\-0-9.,eE]+)/i.exec(line);
		const my = /(?:^|[\s;,(])y\s*=\s*([+\-0-9.,eE]+)/i.exec(line);
		if (mx && my) {
			const x = toNum(mx[1]);
			const y = toNum(my[1]);
			if (Number.isFinite(x) && Number.isFinite(y)) pts.push({ x, y });
			continue;
		}

		// Case 2: two plain numbers in a line (RW/HW or x y)
		const nums = line
		.replace(/,/g, ".")
		.match(/[+\-]?\d+(?:\.\d+)?(?:e[+\-]?\d+)?/gi);

		if (nums && nums.length >= 2) {
			const x = Number(nums[0]);
			const y = Number(nums[1]);
			// Heuristic: avoid tiny “1 0” style element flags
			if (Math.abs(x) > 10 && Math.abs(y) > 10) {
				pts.push({ x, y });
			}
		}
	}

	// De-dup consecutive identical-ish points
	const cleaned = [];
	for (const p of pts) {
		const last = cleaned[cleaned.length - 1];
		if (!last || Math.hypot(p.x - last.x, p.y - last.y) > 1e-6) cleaned.push(p);
	}
	return cleaned.length >= 2 ? cleaned : [];
}

export async function importFileAuto(file) {
	const name = file?.name ?? "unnamed";
	const ext = extOf(name);
	const text = await file.text();

	if (ext === "tra") return importTRA({ name, text });
	if (ext === "gra") return importGRA({ name, text });

	return {
		kind: "unknown",
		name,
		meta: { ext },
		raw: text.slice(0, 2000)
	};
}

export function importTRA({ name, text }) {
	// Minimal: try to get a polyline out of the file
	const polyline = extractXYPolyline(text);

	return {
		kind: "TRA",
		name,
		meta: {
			bytes: text.length,
			points: polyline.length
		},
		// This is our minimal "geometry payload"
		geometry: polyline.length ? { type: "polyline", pts: polyline } : null,
		rawPreview: text.slice(0, 800)
	};
}

export function importGRA({ name, text }) {
	// Minimal: not doing profile math yet
	// Extract a few numbers as a preview signal
	const nums = (text.replace(/,/g, ".").match(/[+\-]?\d+(?:\.\d+)?/g) ?? []).slice(0, 50).map(Number);

	return {
		kind: "GRA",
		name,
		meta: {
			bytes: text.length,
			numbersPreview: nums.length
		},
		profile: null, // later: gradient points
		rawPreview: text.slice(0, 800)
	};
}
