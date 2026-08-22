// src/aim-core/geometry/pose2.js

import { normalize, rot90, dot } from "./vec2.js";

export function poseFromTangent(x, y, tx, ty) {
	const t = normalize({ x: tx, y: ty });
	return { p: { x, y }, t };
}

export function poseFromHeading(x, y, theta) {
	return {
		p: { x, y },
		t: { x: Math.cos(theta), y: Math.sin(theta) },
	};
}

export function poseFromTwoPoints(ax, ay, bx, by) {
	return poseFromTangent(ax, ay, bx - ax, by - ay);
}

export function point(pose) {
	return pose.p;
}

export function poseX(pose) { return pose?.p?.x ?? null; }
export function poseY(pose) { return pose?.p?.y ?? null; }

export function tangent(pose) {
	return pose.t;
}

export function normal(pose) {
	return rot90(pose.t);
}

export function heading(pose) {
	return Math.atan2(pose.t.y, pose.t.x);
}

export function sanitizePose(pose) {
	return {
		p: { x: pose.p.x, y: pose.p.y },
		t: normalize(pose.t),
	};
}

export function worldFromLocal(pose, u, v) {
	const t = pose.t;
	const n = rot90(t);

	return {
		x: pose.p.x + u * t.x + v * n.x,
		y: pose.p.y + u * t.y + v * n.y,
	};
}

export function localFromWorld(pose, x, y) {
	const d = { x: x - pose.p.x, y: y - pose.p.y };

	const t = pose.t;
	const n = rot90(t);

	return {
		u: dot(d, t),
		v: dot(d, n),
	};
}

export function isPose2(pose) {
	return !!pose &&
		typeof pose === "object" &&
		!!pose.p &&
		typeof pose.p === "object" &&
		Number.isFinite(pose.p.x) &&
		Number.isFinite(pose.p.y) &&
		!!pose.t &&
		typeof pose.t === "object" &&
		Number.isFinite(pose.t.x) &&
		Number.isFinite(pose.t.y);
}

export function posePoint(pose) {
	return pose?.p ?? null;
}

export function poseTangent(pose) {
	return pose?.t ?? null;
}
