// src/modules/alignment/converters/traToSparse.js

import { SparseAlignment, makeFixElem, makeTransElem } from "../sparseAlignment.js";
import { Berlin3pcsFamily } from "../transitionFamilies/berlin3pcs.js";

export function traParsedToSparseAlignment(parsedTra, opts = {}) {
	const startPose = opts.startPose ?? inferStartPose(parsedTra);
	const id = opts.id ?? (opts.name ?? "tra-alignment");

	const elems = [];
	const src = parsedTra?.elements ?? [];

	for (const el of src) {
		const L = Number(el.arcLength);
		if (!Number.isFinite(L) || L <= 0) continue;

		const type = el.type;

		// Kz 0 = Gerade, Kz 1 = Kreis, 2.. = Übergänge etc.
		if (type === 0 || type === 1 || type === 5) {
			const curvature = curvatureFromTraElement(el);
			elems.push(makeFixElem({
				arcLength: L,
				curvature,
				meta: { sourceKind: "TRA", type, station: el.station ?? null }
			}));
		} else {
			// transition element: v0 maps to family placeholder
			// derive k0/k1 if radiusA/radiusE exist; else 0..0
			const k0 = curvatureFromRadius(el.radiusA ?? el.radiusAorBeta ?? el.radiusAorBeta);
			const k1 = curvatureFromRadius(el.radiusE2 ?? el.radiusE ?? el.radiusE);

			elems.push(makeTransElem({
				arcLength: L,
				family: Berlin3pcsFamily,
				params: { k0, k1 },
				meta: { sourceKind: "TRA", type, station: el.station ?? null }
			}));
		}
	}

	// enforce alternation minimally:
	// If TRA yields consecutive fixes (common), we can keep them for now,
	// but if you want strict alternation, you can later merge fixes.
	// v0: wrap by ensuring first/last fix — if not, add 0-length fix (or convert edge).
	const normalized = normalizeForV0(elems);

	return new SparseAlignment({
		id,
		startPose,
		elements: normalized,
		meta: { source: "VermEsn", kind: "TRA", header: parsedTra.header ?? null }
	});
}

function inferStartPose(parsedTra) {
	const first = parsedTra?.elements?.[0];
	if (!first) return { x: 0, y: 0, theta: 0 };
	// TRA stores easting/northing + directionRad at element start
	return {
		x: Number(first.easting) || 0,
		y: Number(first.northing) || 0,
		theta: Number(first.directionRad) || 0
	};
}

function curvatureFromTraElement(el) {
	// For straight: 0
	if (el.type === 0) return 0;

	// For arc: prefer signed radius if available
	const r = el.radius ?? el.radiusE ?? el.radiusA ?? el.radiusE2;
	return curvatureFromRadius(r);
}

function curvatureFromRadius(r) {
	const rr = Number(r);
	if (!Number.isFinite(rr) || rr === 0) return 0;
	// sign convention: if radius already carries sign, preserve it.
	return 1 / rr;
}

function normalizeForV0(elems) {
	const out = elems.filter(e => e && Number.isFinite(e.arcLength) && e.arcLength > 0);

	if (!out.length) return [];

	// Ensure first/last are fix elements by inserting tiny fix if needed.
	if (out[0].kind !== "fix") out.unshift({ kind: "fix", arcLength: 1e-6, curvature: 0, meta: { inserted: true } });
	if (out[out.length - 1].kind !== "fix") out.push({ kind: "fix", arcLength: 1e-6, curvature: 0, meta: { inserted: true } });

	return out;
}
