// transitionEmbed.js
import { clamp01, curvature } from "./transitionModel.js";

// Numeric integration of a 2D centerline from curvature k(s).
// We embed a single transition interval [0..L] preceded by a straight lead,
// and followed by a constant-curvature arc (k1) for arcLen.

export function sampleAlignment({
	L,
	k0,
	k1,
	lead = 60,
	arcLen = 220,
	ds = 1.5
}) {
	L = Math.max(1e-6, L);

	// state
	let x = 0, y = 0;
	let theta = 0; // heading
	let sAbs = 0;

	const pts = [];

	// helper: push point
	const push = () => pts.push({ x, y });

	// segment 0: lead straight
	const nLead = Math.max(2, Math.floor(lead / ds));
	for (let i = 0; i <= nLead; i++) {
		const t = i / nLead;
		x = lead * t;
		y = 0;
		theta = 0;
		push();
	}
	sAbs = lead;

	// segment 1: transition (u in [0,1], s in [0,L])
	const nTr = Math.max(2, Math.floor(L / ds));
	for (let i = 1; i <= nTr; i++) {
		const s0 = (i - 1) * (L / nTr);
		const s1 = i * (L / nTr);
		const sm = 0.5 * (s0 + s1);

		const u = clamp01(sm / L);
		const k = curvature(u, { k0, k1 });

		const dsLoc = (s1 - s0);
		theta += k * dsLoc;
		x += Math.cos(theta) * dsLoc;
		y += Math.sin(theta) * dsLoc;

		push();
	}
	sAbs += L;

	// segment 2: constant-curvature arc with k1
	const nArc = Math.max(2, Math.floor(arcLen / ds));
	for (let i = 1; i <= nArc; i++) {
		const dl = arcLen / nArc;
		theta += k1 * dl;
		x += Math.cos(theta) * dl;
		y += Math.sin(theta) * dl;
		push();
	}
	sAbs += arcLen;

	return { pts, totalLen: sAbs, lead, L, k0, k1, arcLen };
}

// Evaluate point + heading at absolute station (meters along polyline)
export function evalAtStation(sample, station) {
	const { pts } = sample;
	station = Math.max(0, Math.min(sample.totalLen, station));

	// convert to polyline arc-length
	let acc = 0;
	for (let i = 1; i < pts.length; i++) {
		const a = pts[i - 1];
		const b = pts[i];
		const dx = b.x - a.x;
		const dy = b.y - a.y;
		const seg = Math.hypot(dx, dy);

		if (acc + seg >= station) {
			const t = (station - acc) / Math.max(1e-9, seg);
			const x = a.x + dx * t;
			const y = a.y + dy * t;
			const yaw = Math.atan2(dy, dx);
			return { x, y, yaw };
		}
		acc += seg;
	}

	const last = pts[pts.length - 1];
	return { x: last.x, y: last.y, yaw: 0 };
}
