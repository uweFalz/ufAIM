// src/lib/geom/frame/pose2.js
// Minimal, mathematisch sauber: 2D Pose als Frenet-Frame (p, t) mit unit tangent.
// Konvention: n = rot90(t) = (-t.y, t.x).  kappa > 0 => Linkskurve (CCW).

const EPS = 1e-12;

export function vec(x = 0, y = 0) { return { x, y }; }

export function dot(a, b) { return a.x * b.x + a.y * b.y; }

export function len2(v) { return dot(v, v); }

export function len(v) { return Math.sqrt(len2(v)); }

export function scale(v, s) { return { x: v.x * s, y: v.y * s }; }

export function add(a, b) { return { x: a.x + b.x, y: a.y + b.y }; }

export function sub(a, b) { return { x: a.x - b.x, y: a.y - b.y }; }

export function rot90(v) { return { x: -v.y, y: v.x }; }

// Rotation um Winkel phi (rad) um Ursprung
export function rot(v, phi) {
	const c = Math.cos(phi), s = Math.sin(phi);
	return { x: c * v.x - s * v.y, y: s * v.x + c * v.y };
}

export function normalize(v, eps = EPS) {
	const l = len(v);
	if (l < eps) throw new Error("normalize(): zero-length vector");
	return { x: v.x / l, y: v.y / l };
}

// ---- Pose ----
// Kanonisch: { p:{x,y}, t:{x,y} } mit |t|=1
export function poseFromTangent(x, y, tx, ty) {
	const t = normalize({ x: tx, y: ty });
	return { p: { x, y }, t };
}

export function poseFromHeading(x, y, thetaRad) {
	return { p: { x, y }, t: { x: Math.cos(thetaRad), y: Math.sin(thetaRad) } };
}

export function poseFromTwoPoints(ax, ay, bx, by) {
	return poseFromTangent(ax, ay, bx - ax, by - ay);
}

export function point(pose) { return pose.p; }

export function tangent(pose) { return pose.t; }

export function normal(pose) { return rot90(pose.t); }

export function heading(pose) { return Math.atan2(pose.t.y, pose.t.x); }

// Weltpunkt aus lokalen Koords (u entlang t, v entlang n)
export function worldFromLocal(pose, u, v) {
	const t = pose.t;
	const n = rot90(t);
	return {
		x: pose.p.x + u * t.x + v * n.x,
		y: pose.p.y + u * t.y + v * n.y,
	};
}

// Lokale Koords (u,v) eines Weltpunkts relativ zur Pose
export function localFromWorld(pose, x, y) {
	const d = { x: x - pose.p.x, y: y - pose.p.y };
	const t = pose.t;
	const n = rot90(t);
	return { u: dot(d, t), v: dot(d, n) };
}

// Numerische Hygiene: Pose konsistent machen (t normieren)
export function sanitizePose(pose) {
	return { p: { x: pose.p.x, y: pose.p.y }, t: normalize(pose.t) };
}

// ---- Advance: exakter Schritt für Gerade / konst. Krümmung ----
// ds: Bogenlänge-Schritt (kann negativ sein)
// kappa: Krümmung (1/R), 0 => Gerade
export function advance(pose, ds, kappa = 0) {
	const p0 = pose.p;
	const t0 = pose.t;
	const n0 = rot90(t0);

	if (Math.abs(kappa) < 1e-15) {
		// Gerade
		return {
			p: { x: p0.x + ds * t0.x, y: p0.y + ds * t0.y },
			t: { x: t0.x, y: t0.y },
		};
	}

	// Kreisschritt (geschlossen)
	const dpsi = kappa * ds;
	const s = Math.sin(dpsi);
	const c = Math.cos(dpsi);

	// t1 = rot(t0, dpsi)
	const t1 = { x: c * t0.x - s * t0.y, y: s * t0.x + c * t0.y };

	// p1 = p0 + (sin dpsi)/kappa * t0 + (1 - cos dpsi)/kappa * n0
	const a = s / kappa;
	const b = (1 - c) / kappa;

	const p1 = {
		x: p0.x + a * t0.x + b * n0.x,
		y: p0.y + a * t0.y + b * n0.y,
	};

	return { p: p1, t: t1 };
}

// Compose pose with a local delta (dx,dy,dTheta) given in pose's local frame.
export function applyLocalDelta(poseA, d) {
	const c = Math.cos(poseA.theta), s = Math.sin(poseA.theta);
	const dxg = c * d.dx - s * d.dy;
	const dyg = s * d.dx + c * d.dy;
	return {
		x: poseA.x + dxg,
		y: poseA.y + dyg,
		theta: poseA.theta + (Number(d.dTheta) || 0),
	};
}
