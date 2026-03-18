// src/lib/geom/frame/pose2.js

import { normalize, rot90, dot } from "../vec2.js";

export function poseFromTangent(x, y, tx, ty) {
	const dir = normalize({ x: tx, y: ty });
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
	const dx = x - pose.p.x;
	const dy = y - pose.p.y;

	const t = pose.t;
	const n = rot90(t);

	return {
		u: dx * t.x + dy * t.y,
		v: dx * n.x + dy * n.y,
	};
}
