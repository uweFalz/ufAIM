// src/lib/geom/frame/poseAdvance2.js

import { rot90, rot, normalize } from "../vec2.js";

export function advance(pose, ds, kappa = 0) {
	const p0 = pose.p;
	const t0 = pose.t;
	const n0 = rot90(t0);

	if (Math.abs(kappa) < 1e-15) {
		return {
			p: {
				x: p0.x + ds * t0.x,
				y: p0.y + ds * t0.y,
			},
			t: { ...t0 },
		};
	}

	const dpsi = kappa * ds;

	const s = Math.sin(dpsi);
	const c = Math.cos(dpsi);

	const t1 = {
		x: c * t0.x - s * t0.y,
		y: s * t0.x + c * t0.y,
	};

	const a = s / kappa;
	const b = (1 - c) / kappa;

	const p1 = {
		x: p0.x + a * t0.x + b * n0.x,
		y: p0.y + a * t0.y + b * n0.y,
	};

	return { p: p1, t: t1 };
}
