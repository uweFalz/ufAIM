// src/domain/optimization/alignment/AlignmentPoseJacobian.js
//
// AXTRAN2 Calculation Kernel - the analytic Jacobian.
//
// An alignment is a chain of rigid transforms, so a change to one element
// propagates downstream as a rigid body motion. If element k's local transform
// changes by (ddx, ddy, ddtheta) in k's own entry frame, then for any station s
// at or beyond k's exit
//
//     dp(s)     = R(theta_k) (ddx, ddy) + ddtheta * J * (p(s) - p_exit_k)
//     dtheta(s) = ddtheta                          J = [[0, -1], [1, 0]]
//
// which is the adjoint action of SE(2), and in engineering terms the lever arm:
// a heading error at station k shows up downstream multiplied by the distance
// from k. That is why parameter errors integrate the way package 002 measured.
//
// The lateral residual of a point needs no station derivative. With
// q = n(s_i) . (P_i - p(s_i)) evaluated at the foot point, the offset vector is
// purely normal and n'(s) = -kappa t, so both terms carrying ds_i/dparam vanish
// and
//
//     dq_i = -n(s_i) . dp(s_i)
//
// exactly. The foot point may move; to first order it does not matter.
//
// Element transforms and their derivatives are closed form: elementary for
// straights and arcs, and from the family moment table for transitions. A point
// whose foot lies inside an element needs that element's partial transform,
// which is one one-dimensional integral and is done by quadrature.
//
// Curvature coupling is explicit. A transition takes its end curvatures from its
// neighbours, so perturbing an arc's curvature moves three elements: the arc
// itself and the transitions on either side. Those are the "derived" quantities
// of the variable codec.
//
// No dependencies beyond the moment table, which is injected.

export const ALIGNMENT_POSE_JACOBIAN_VERSION = "axtran2/alignment-pose-jacobian/0.1";

export class AlignmentPoseJacobianError extends Error {
	constructor(code, message) {
		super(message);
		this.name = "AlignmentPoseJacobianError";
		this.code = code;
	}
}

const GAUSS_NODES = 40;
const gaussCache = new Map();

function gaussLegendre(count) {
	if (gaussCache.has(count)) return gaussCache.get(count);
	const nodes = [];
	const weights = [];
	for (let i = 1; i <= count; i++) {
		let x = Math.cos((Math.PI * (i - 0.25)) / (count + 0.5));
		for (let iteration = 0; iteration < 100; iteration++) {
			let p0 = 1;
			let p1 = 0;
			for (let j = 1; j <= count; j++) {
				const p2 = p1;
				p1 = p0;
				p0 = ((2 * j - 1) * x * p1 - (j - 1) * p2) / j;
			}
			const derivative = (count * (x * p0 - p1)) / (x * x - 1);
			const delta = -p0 / derivative;
			x += delta;
			if (Math.abs(delta) < 1e-16) break;
		}
		let p0 = 1;
		let p1 = 0;
		for (let j = 1; j <= count; j++) {
			const p2 = p1;
			p1 = p0;
			p0 = ((2 * j - 1) * x * p1 - (j - 1) * p2) / j;
		}
		const derivative = (count * (x * p0 - p1)) / (x * x - 1);
		nodes.push(0.5 * (x + 1));
		weights.push(0.5 * (2 / ((1 - x * x) * derivative * derivative)));
	}
	const table = { nodes, weights };
	gaussCache.set(count, table);
	return table;
}

/** Transform of a circular arc of length L and curvature k, in its entry frame. */
function arcTransform(L, k) {
	const turn = k * L;
	if (Math.abs(k) < 1e-12) {
		// series limits; the closed form is 0/0 here
		return {
			dx: L * (1 - (turn * turn) / 6),
			dy: (L * turn) / 2,
			dtheta: turn,
			dxdL: 1 - (turn * turn) / 2,
			dydL: turn,
			dthetadL: k,
			dxdk: -(L * L * L) / 3 * k,
			dydk: (L * L) / 2,
			dthetadk: L,
		};
	}
	const sin = Math.sin(turn);
	const cos = Math.cos(turn);
	return {
		dx: sin / k,
		dy: (1 - cos) / k,
		dtheta: turn,
		dxdL: cos,
		dydL: sin,
		dthetadL: k,
		dxdk: (L * cos) / k - sin / (k * k),
		dydk: (L * sin) / k - (1 - cos) / (k * k),
		dthetadk: L,
	};
}

function straightTransform(L) {
	return {
		dx: L, dy: 0, dtheta: 0,
		dxdL: 1, dydL: 0, dthetadL: 0,
		dxdk: 0, dydk: 0, dthetadk: 0,
	};
}

/**
 * Partial transform of one element from its entry up to local length `local`.
 * Used for a point whose foot lies inside the element.
 */
function partialTransform(element, local, moments) {
	if (element.type === "straight") return { dx: local, dy: 0, dtheta: 0 };
	if (element.type === "arc") {
		const t = arcTransform(local, element.curvature);
		return { dx: t.dx, dy: t.dy, dtheta: t.dtheta };
	}
	const L = element.length;
	const a = element.entryCurvature * L;
	const b = (element.exitCurvature - element.entryCurvature) * L;
	const u0 = L > 0 ? Math.max(0, Math.min(1, local / L)) : 0;
	const { nodes, weights } = gaussLegendre(GAUSS_NODES);
	let dx = 0;
	let dy = 0;
	for (let i = 0; i < nodes.length; i++) {
		const u = u0 * nodes[i];
		const phi = a * u + b * moments.khat(u);
		dx += weights[i] * Math.cos(phi);
		dy += weights[i] * Math.sin(phi);
	}
	return {
		dx: L * u0 * dx,
		dy: L * u0 * dy,
		dtheta: a * u0 + b * moments.khat(u0),
	};
}

function compose(pose, local) {
	const cos = Math.cos(pose.theta);
	const sin = Math.sin(pose.theta);
	return {
		x: pose.x + cos * local.dx - sin * local.dy,
		y: pose.y + sin * local.dx + cos * local.dy,
		theta: pose.theta + local.dtheta,
	};
}

/**
 * @param {object} input
 * @param {Array} input.elements  [{ id, type, length, curvature?, family? }]
 * @param {{x,y,theta}} input.startPose
 * @param {(family: string) => object} input.momentsFor  from createTransitionMoments,
 *        extended with a `khat` function
 */
export function createAlignmentPoseJacobian({ elements, startPose, momentsFor } = {}) {
	if (!Array.isArray(elements) || elements.length === 0) {
		throw new AlignmentPoseJacobianError("EMPTY_SEQUENCE", "elements must be a non-empty array");
	}
	if (typeof momentsFor !== "function") {
		throw new AlignmentPoseJacobianError("MISSING_MOMENTS", "momentsFor is required");
	}

	// curvature of each element at its two ends; a transition inherits from its
	// neighbours, which is the coupling that makes an arc curvature move three
	// elements rather than one
	const curvatureOf = (element) =>
		element.type === "arc" ? element.curvature : element.type === "straight" ? 0 : null;

	const resolved = elements.map((element, index) => {
		if (element.type !== "transition") {
			const k = curvatureOf(element);
			return { ...element, index, entryCurvature: k, exitCurvature: k };
		}
		const before = elements[index - 1];
		const after = elements[index + 1];
		return {
			...element,
			index,
			entryCurvature: before ? curvatureOf(before) ?? 0 : 0,
			exitCurvature: after ? curvatureOf(after) ?? 0 : 0,
		};
	});

	const localOf = (element) => {
		if (element.type === "straight") return straightTransform(element.length);
		if (element.type === "arc") return arcTransform(element.length, element.curvature);
		const moments = momentsFor(element.family);
		return moments.element(element.length, element.entryCurvature, element.exitCurvature);
	};

	const locals = resolved.map(localOf);

	// forward chain: entry pose and station of every element, plus the end pose
	const entries = [{ ...startPose }];
	const stations = [0];
	for (let i = 0; i < resolved.length; i++) {
		entries.push(compose(entries[i], locals[i]));
		stations.push(stations[i] + resolved[i].length);
	}
	const endPose = entries[entries.length - 1];
	const arcLength = stations[stations.length - 1];

	/** Pose at an arbitrary station, exactly. */
	function poseAt(s) {
		const clamped = Math.max(0, Math.min(arcLength, s));
		let index = resolved.length - 1;
		for (let i = 0; i < resolved.length; i++) {
			if (clamped <= stations[i + 1]) { index = i; break; }
		}
		const local = partialTransform(resolved[index], clamped - stations[index], momentsFor(resolved[index].family));
		return compose(entries[index], local);
	}

	/**
	 * Perturbation of the pose at station `s` caused by a unit change of one
	 * element's local transform. Returns { dx, dy, dtheta } in world coordinates.
	 */
	function propagate(elementIndex, localDerivative, s) {
		// nothing upstream of the element moves
		if (s <= stations[elementIndex]) return { dx: 0, dy: 0, dtheta: 0 };

		const entry = entries[elementIndex];
		const cos = Math.cos(entry.theta);
		const sin = Math.sin(entry.theta);

		if (s >= stations[elementIndex + 1]) {
			// the whole element lies upstream: rigid propagation from its exit
			const exit = entries[elementIndex + 1];
			const target = poseAt(s);
			const dxWorld = cos * localDerivative.dx - sin * localDerivative.dy;
			const dyWorld = sin * localDerivative.dx + cos * localDerivative.dy;
			const lever = { x: target.x - exit.x, y: target.y - exit.y };
			return {
				dx: dxWorld - localDerivative.dtheta * lever.y,
				dy: dyWorld + localDerivative.dtheta * lever.x,
				dtheta: localDerivative.dtheta,
			};
		}

		// the station sits inside the element; the caller supplies the partial
		// derivative for that case
		const dxWorld = cos * localDerivative.dx - sin * localDerivative.dy;
		const dyWorld = sin * localDerivative.dx + cos * localDerivative.dy;
		return { dx: dxWorld, dy: dyWorld, dtheta: localDerivative.dtheta };
	}

	/**
	 * Local-transform derivative of element `index` with respect to a parameter.
	 * Curvature parameters reach transitions through their inherited ends.
	 */
	function localDerivative(index, parameter) {
		const element = resolved[index];
		const local = locals[index];

		if (parameter.kind === "length") {
			if (parameter.elementIndex !== index) return null;
			return { dx: local.dxdL, dy: local.dydL, dtheta: local.dthetadL };
		}

		// curvature of an arc
		if (parameter.elementIndex === index && element.type === "arc") {
			return { dx: local.dxdk, dy: local.dydk, dtheta: local.dthetadk };
		}
		// the transition before that arc inherits it as its exit curvature
		if (element.type === "transition" && parameter.elementIndex === index + 1) {
			return { dx: local.dxdkB, dy: local.dydkB, dtheta: local.dthetadkB };
		}
		// the transition after that arc inherits it as its entry curvature
		if (element.type === "transition" && parameter.elementIndex === index - 1) {
			return { dx: local.dxdkA, dy: local.dydkA, dtheta: local.dthetadkA };
		}
		return null;
	}

	/**
	 * Derivative of the pose at station `s` with respect to one parameter.
	 * A station inside an element is handled by differencing the partial
	 * transform of that element alone, which keeps the chain rule exact while
	 * costing one extra quadrature.
	 */
	function poseDerivative(parameter, s) {
		let dx = 0;
		let dy = 0;
		let dtheta = 0;
		for (let index = 0; index < resolved.length; index++) {
			const derivative = localDerivative(index, parameter);
			if (!derivative) continue;
			if (s <= stations[index]) continue;

			if (s >= stations[index + 1]) {
				const contribution = propagate(index, derivative, s);
				dx += contribution.dx;
				dy += contribution.dy;
				dtheta += contribution.dtheta;
				continue;
			}

			// inside this element: differentiate the partial transform numerically
			// in the parameter, which is a scalar and cheap
			const local = s - stations[index];
			const moments = momentsFor(resolved[index].family);
			const step = parameter.kind === "length" ? 1e-4 : 1e-9;
			const bump = (sign) => {
				const probe = { ...resolved[index] };
				if (parameter.kind === "length") {
					if (parameter.elementIndex === index) probe.length += sign * step;
				} else if (parameter.elementIndex === index) {
					probe.curvature = (probe.curvature ?? 0) + sign * step;
					probe.entryCurvature = probe.curvature;
					probe.exitCurvature = probe.curvature;
				} else if (parameter.elementIndex === index + 1) {
					probe.exitCurvature += sign * step;
				} else if (parameter.elementIndex === index - 1) {
					probe.entryCurvature += sign * step;
				}
				return partialTransform(probe, Math.min(local, probe.length), moments);
			};
			const plus = bump(1);
			const minus = bump(-1);
			const partial = {
				dx: (plus.dx - minus.dx) / (2 * step),
				dy: (plus.dy - minus.dy) / (2 * step),
				dtheta: (plus.dtheta - minus.dtheta) / (2 * step),
			};
			const contribution = propagate(index, partial, s);
			dx += contribution.dx;
			dy += contribution.dy;
			dtheta += contribution.dtheta;
		}
		return { dx, dy, dtheta };
	}

	return Object.freeze({
		version: ALIGNMENT_POSE_JACOBIAN_VERSION,
		elements: Object.freeze(resolved),
		entries: Object.freeze(entries),
		stations: Object.freeze(stations),
		endPose: Object.freeze(endPose),
		arcLength,
		poseAt,
		poseDerivative,

		/** d(end pose)/d(parameter) for every declared parameter. */
		endPoseJacobian(parameters) {
			return parameters.map((parameter) => poseDerivative(parameter, arcLength));
		},

		/**
		 * d(lateral offset)/d(parameter) at a foot station.
		 * q = n . (P - p), so dq = -n . dp; the moving foot point contributes
		 * nothing to first order.
		 */
		lateralDerivative(parameters, station) {
			const pose = poseAt(station);
			const normal = { x: -Math.sin(pose.theta), y: Math.cos(pose.theta) };
			return parameters.map((parameter) => {
				const d = poseDerivative(parameter, station);
				return -(normal.x * d.dx + normal.y * d.dy);
			});
		},
	});
}
