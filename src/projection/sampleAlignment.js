// src/projection/sampleAlignment.js

export function sampleAlignment(alignment, opts = {}) {
	const step = opts.step || 5; // Meter

	let p = { ...alignment.startPoint };
	let dir = normalize(alignment.startDirection);

	const pts = [ { ...p } ];

	for (const el of alignment.elements) {
		const n = Math.max(1, Math.ceil(el.length / step));
		const ds = el.length / n;

		for (let i = 0; i < n; i++) {
			if (el.type === "LINE") {
				p.x += dir.dx * ds;
				p.y += dir.dy * ds;

			} else if (el.type === "ARC") {
				const k = el.curvature; // = 1/R
				const dphi = k * ds;

				// Rotieren der Richtung
				dir = rotate(dir, dphi);

				// Schritt entlang der neuen Richtung
				p.x += dir.dx * ds;
				p.y += dir.dy * ds;
			}

			pts.push({ ...p });
		}
	}

	return pts;
}

// --- helpers ---

function normalize(v) {
	const l = Math.hypot(v.dx, v.dy) || 1;
	return { dx: v.dx / l, dy: v.dy / l };
}

function rotate(v, angle) {
	const c = Math.cos(angle);
	const s = Math.sin(angle);
	return {
		dx: v.dx * c - v.dy * s,
		dy: v.dx * s + v.dy * c
	};
}
