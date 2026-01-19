// app/adapters/geo/ThreeAdapter.js
//
// Bridges canonical ENU geometry into threeViewer local coordinates.
//
// Policy:
// - Canonical is ENU meters.
// - We apply floating origin via GeoTransform.
// - Axis mapping is centralized here (today: identity).
//
// Later, if we ever need different axis conventions, we change ONLY here.

import { makeGeoTransform } from "./GeoTransform.js";

export function makeThreeAdapter({ three, transform } = {}) {
	if (!three) throw new Error("ThreeAdapter: missing 'three' viewer instance");

	const xform = transform ?? makeGeoTransform();

	// AxisMap (canonical ENU -> three local)
	// Today: identity: X->X, Y->Y, Z->Z.
	function toThreeLocal(pLocalENU) {
		if (!pLocalENU) return null;
		return {
			x: Number(pLocalENU.x) || 0,
			y: Number(pLocalENU.y) || 0,
			z: Number(pLocalENU.z) || 0,
		};
	}

	function setOriginFromBbox(bbox) {
		xform.setOriginFromBboxCenter(bbox, 0);
	}

	function clearTrack() {
		three.setTrackPoints?.(null);
	}

	function clearMarker() {
		three.setMarker?.(null);
	}

	function clearSectionLine() {
		three.setSectionLine?.(null, null);
	}

	function setTrackFromWorldPolyline(polylineENU) {
		if (!Array.isArray(polylineENU) || polylineENU.length < 2) {
			clearTrack();
			return;
		}
		const local = xform.toLocalPolyline(polylineENU).map(toThreeLocal);
		three.setTrackPoints?.(local);
	}

	function setMarkerFromWorld(pENU) {
		if (!pENU) {
			clearMarker();
			return;
		}
		const local = toThreeLocal(xform.toLocal(pENU));
		three.setMarker?.(local);
	}

	function setSectionLineFromWorld(p0ENU, p1ENU) {
		if (!p0ENU || !p1ENU) {
			clearSectionLine();
			return;
		}
		const p0l = toThreeLocal(xform.toLocal(p0ENU));
		const p1l = toThreeLocal(xform.toLocal(p1ENU));
		three.setSectionLine?.(p0l, p1l);
	}

	// Optional: keep using your viewer's bbox zoom helper,
	// but feed it LOCAL bbox to match local coordinates.
	function zoomToFitWorldBbox(bboxENU, opts) {
		if (!bboxENU || !three.zoomToFitBox) return;

		const o = xform.getOrigin();
		const bboxLocal = {
			minX: (Number(bboxENU.minX) || 0) - o.x,
			minY: (Number(bboxENU.minY) || 0) - o.y,
			maxX: (Number(bboxENU.maxX) || 0) - o.x,
			maxY: (Number(bboxENU.maxY) || 0) - o.y,
		};

		three.zoomToFitBox(bboxLocal, opts);
	}

	return {
		transform: xform,

		setOriginFromBbox,
		zoomToFitWorldBbox,

		setTrackFromWorldPolyline,
		setMarkerFromWorld,
		setSectionLineFromWorld,

		clearTrack,
		clearMarker,
		clearSectionLine,
	};
}
