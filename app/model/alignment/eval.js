// app/model/alignment/eval.js
import { clamp01 } from "../../transitionModel.js";
import { getTransitionFamily } from "../../transition/transitionFamily.js";

// integrate curvature -> pose, using small step RK-ish (midpoint)
function integratePose(startPose, kOfS, s0, s1, ds = 1.0) {
	const dir = s1 >= s0 ? 1 : -1;
	const step = Math.max(1e-6, Math.abs(ds)) * dir;

	let x = startPose.x, y = startPose.y, th = startPose.heading;
	let s = s0;

	while ((dir > 0 && s < s1) || (dir < 0 && s > s1)) {
		const sNext = (dir > 0) ? Math.min(s + step, s1) : Math.max(s + step, s1);
		const h = sNext - s;

		const kMid = kOfS(s + 0.5 * h);
		const thMid = th + kMid * 0.5 * h;

		x += Math.cos(thMid) * h;
		y += Math.sin(thMid) * h;
		th += kMid * h;

		s = sNext;
	}

	return { x, y, heading: th };
}

function curvatureLine() { return 0; }
function curvatureArc(k) { return () => k; }

function curvatureTransition(seg) {
	const fam = getTransitionFamily(seg.familyId) || getTransitionFamily("linear-clothoid");
	const def = fam.defaults();
	const p = {
		w1: seg.params?.w1 ?? def.w1,
		w2: seg.params?.w2 ?? def.w2,
		m:  seg.params?.m  ?? def.m ?? 1.0
	};

	// safety
	p.w1 = clamp01(p.w1);
	p.w2 = clamp01(p.w2);
	if (p.w2 < p.w1) { const t = p.w1; p.w1 = p.w2; p.w2 = t; }

	return (sLocal) => {
		const u = clamp01(sLocal / Math.max(1e-9, seg.length));
		const kap = fam.kappa(u, p);
		return seg.kA + kap * (seg.kE - seg.kA);
	};
}

/**
* Evaluate alignment at global station s (meters along alignment).
* Returns: { x,y, heading, curvature, segIndex, sLocal }
*/
export function evalAlignmentAt(alignment, s, opts = {}) {
	const ds = opts.ds ?? 1.0;

	// clamp s into [0,total]
	const S = Math.max(0, Math.min(alignment.totalLength, s));

	let pose = { ...alignment.start };
	let acc = 0;

	for (let i = 0; i < alignment.segments.length; i++) {
		const seg = alignment.segments[i];
		const L = seg.length ?? 0;

		if (S <= acc + L || i === alignment.segments.length - 1) {
			const sLocal = Math.max(0, S - acc);

			let kOfS;
			if (seg.type === "line") kOfS = curvatureLine;
			else if (seg.type === "arc") kOfS = curvatureArc(seg.curvature);
			else if (seg.type === "transition") kOfS = curvatureTransition(seg);
			else kOfS = curvatureLine;

			// integrate inside this segment only
			const poseLocal = integratePose(pose, kOfS, 0, sLocal, ds);

			// curvature at that exact point
			const kHere = kOfS(sLocal);

			return { ...poseLocal, curvature: kHere, segIndex: i, sLocal };
		}

		// advance across whole segment
		let kOfS;
		if (seg.type === "line") kOfS = curvatureLine;
		else if (seg.type === "arc") kOfS = curvatureArc(seg.curvature);
		else if (seg.type === "transition") kOfS = curvatureTransition(seg);
		else kOfS = curvatureLine;

		pose = integratePose(pose, kOfS, 0, L, ds);
		acc += L;
	}

	// fallback end
	return { ...pose, curvature: 0, segIndex: alignment.segments.length - 1, sLocal: 0 };
}
