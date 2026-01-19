// app/adapters/geo/GeoTransform.js
//
// Canonical space: ENU meters (X=East, Y=North, Z=Up)
// Renderer space: local (floating origin) to keep numbers small.
//
// This module does NOT know about three/maplibre.
// It only provides stable coordinate transforms.

export function makeGeoTransform({ origin } = {}) {
	const o = origin && typeof origin === "object"
	? { x: Number(origin.x) || 0, y: Number(origin.y) || 0, z: Number(origin.z) || 0 }
	: { x: 0, y: 0, z: 0 };

	function setOrigin(next) {
		if (!next) return;
		o.x = Number(next.x) || 0;
		o.y = Number(next.y) || 0;
		o.z = Number(next.z) || 0;
	}

	function getOrigin() {
		return { x: o.x, y: o.y, z: o.z };
	}

	// canonical -> local
	function toLocal(p) {
		if (!p) return null;
		return {
			x: (Number(p.x) || 0) - o.x,
			y: (Number(p.y) || 0) - o.y,
			z: (Number(p.z) || 0) - o.z,
		};
	}

	// local -> canonical
	function toWorld(p) {
		if (!p) return null;
		return {
			x: (Number(p.x) || 0) + o.x,
			y: (Number(p.y) || 0) + o.y,
			z: (Number(p.z) || 0) + o.z,
		};
	}

	function toLocalPolyline(poly) {
		if (!Array.isArray(poly)) return null;
		return poly.map(toLocal);
	}

	// bbox in canonical coords: {minX,minY,maxX,maxY} (+ optional z)
	function setOriginFromBboxCenter(bbox, z = 0) {
		if (!bbox) return;
		const x = (Number(bbox.minX) + Number(bbox.maxX)) * 0.5;
		const y = (Number(bbox.minY) + Number(bbox.maxY)) * 0.5;
		if (!Number.isFinite(x) || !Number.isFinite(y)) return;
		setOrigin({ x, y, z: Number(z) || 0 });
	}

	return {
		setOrigin,
		getOrigin,
		toLocal,
		toWorld,
		toLocalPolyline,
		setOriginFromBboxCenter,
	};
}
