// src/projection/sampleAlignment.js
//
// Canonical sparseAlignment -> polyline2d sampler
//
// Rolle:
// - numerische Preview-Geometrie direkt aus sparseAlignment
// - kein Import-Wissen
// - kein View-Wissen
//
// @baustelle [TRANSITION-SHAPE]
// Transitionen werden hier aktuell über eine kontinuierliche
// Krümmungsinterpolation zwischen benachbarten Fix-Elementen
// gesampelt.
// Das ist der EINZIGE spätere Hook-Punkt, falls transType-spezifische
// Kappa-Funktionen direkt aus Registry/KappaFcnBuilder eingehängt werden.
//
// Wichtig:
// Dies ist trotzdem bereits der kanonische Preview-Pfad.
// Kein poseA-only-Fallback mehr als Hauptlogik.

export function sampleAlignment(sparseAlignment, opts = {}) {
	const maxStep = Number.isFinite(opts.maxStep) && opts.maxStep > 0 ? opts.maxStep : 5.0;
	const elements = Array.isArray(sparseAlignment?.sparse) ? sparseAlignment.sparse : [];
	if (!elements.length) return null;

	const out = [];

	for (let i = 0; i < elements.length; i += 1) {
		const el = elements[i];
		const poseA = readPose(el?.poseA);
		if (!poseA) continue;

		pushPointIfNew(out, poseA.p);

		const L = Number(el?.arcLength);
		if (!Number.isFinite(L) || L <= 0) continue;

		if (el.type === "fixed") {
			const k = Number.isFinite(el?.curvature) ? Number(el.curvature) : 0;
			sampleFixed(out, poseA, L, k, maxStep);
			continue;
		}

		if (el.type === "transition") {
			const kA = findPrevFixedCurvature(elements, i);
			const kB = findNextFixedCurvature(elements, i);
			sampleTransition(out, poseA, L, kA, kB, maxStep);
			continue;
		}
	}

	return out.length >= 2 ? out : null;
}

// -----------------------------------------------------------------------------
// fixed
// -----------------------------------------------------------------------------

function sampleFixed(out, poseA, arcLength, curvature, maxStep) {
	const n = Math.max(1, Math.ceil(arcLength / maxStep));
	const ds = arcLength / n;

	let state = cloneState(poseA);

	for (let i = 0; i < n; i += 1) {
		state = advanceByCurvature(state, ds, curvature);
		pushPointIfNew(out, state.p);
	}
}

// -----------------------------------------------------------------------------
// transition
// -----------------------------------------------------------------------------

function sampleTransition(out, poseA, arcLength, kA, kB, maxStep) {
	const n = Math.max(2, Math.ceil(arcLength / maxStep));
	const ds = arcLength / n;

	let state = cloneState(poseA);

	for (let i = 0; i < n; i += 1) {
		const sMid = (i + 0.5) * ds;
		const u = clamp01(sMid / arcLength);

		// kanonische Preview-Näherung:
		// kontinuierliche Krümmungsinterpolation zwischen den angrenzenden Fixzuständen
		const kMid = lerp(kA, kB, u);

		state = advanceByCurvature(state, ds, kMid);
		pushPointIfNew(out, state.p);
	}
}

// -----------------------------------------------------------------------------
// neighboring curvature
// -----------------------------------------------------------------------------

function findPrevFixedCurvature(elements, index) {
	for (let i = index - 1; i >= 0; i -= 1) {
		const el = elements[i];
		if (el?.type === "fixed" && Number.isFinite(el?.curvature)) {
			return Number(el.curvature);
		}
	}
	return 0;
}

function findNextFixedCurvature(elements, index) {
	for (let i = index + 1; i < elements.length; i += 1) {
		const el = elements[i];
		if (el?.type === "fixed" && Number.isFinite(el?.curvature)) {
			return Number(el.curvature);
		}
	}
	return 0;
}

// -----------------------------------------------------------------------------
// pose/state
// -----------------------------------------------------------------------------

function readPose(pose) {
	const p = readPoint(pose?.p ?? pose?.point ?? pose?.pnt);
	const dir = readDir(pose?.dir);
	if (!p || !dir) return null;

	return {
		p,
		dir,
	};
}

function readPoint(p) {
	if (!p) return null;

	const x = Number(p?.x ?? p?.easting ?? p?.[0]);
	const y = Number(p?.y ?? p?.northing ?? p?.[1]);

	if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
	return { x, y };
}

function readDir(dir) {
	if (!dir) return null;

	const x = Number(
		dir?.x ??
		dir?.dx ??
		dir?.cos ??
		dir?.[0]
	);
	const y = Number(
		dir?.y ??
		dir?.dy ??
		dir?.sin ??
		dir?.[1]
	);

	if (!Number.isFinite(x) || !Number.isFinite(y)) return null;

	const len = Math.hypot(x, y);
	if (!(len > 0)) return null;

	return {
		x: x / len,
		y: y / len,
	};
}

function cloneState(state) {
	return {
		p: { x: state.p.x, y: state.p.y },
		dir: { x: state.dir.x, y: state.dir.y },
	};
}

function advanceByCurvature(state, ds, curvature) {
	const theta = Math.atan2(state.dir.y, state.dir.x);
	const dTheta = curvature * ds;
	const thetaMid = theta + 0.5 * dTheta;
	const thetaNew = theta + dTheta;

	return {
		p: {
			x: state.p.x + ds * Math.cos(thetaMid),
			y: state.p.y + ds * Math.sin(thetaMid),
		},
		dir: {
			x: Math.cos(thetaNew),
			y: Math.sin(thetaNew),
		},
	};
}

// -----------------------------------------------------------------------------
// misc
// -----------------------------------------------------------------------------

function pushPointIfNew(out, p, eps = 1e-9) {
	if (!p) return;

	if (!out.length) {
		out.push({ x: p.x, y: p.y });
		return;
	}

	const last = out[out.length - 1];
	if (Math.abs(last.x - p.x) <= eps && Math.abs(last.y - p.y) <= eps) return;

	out.push({ x: p.x, y: p.y });
}

function lerp(a, b, t) {
	return a + (b - a) * t;
}

function clamp01(x) {
	if (x <= 0) return 0;
	if (x >= 1) return 1;
	return x;
}
