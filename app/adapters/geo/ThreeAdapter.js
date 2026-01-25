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

	// MS13.9/13.11/13.14: background tracks (multiple alignments / pins)
	function clearAuxTracks() {
		// Be robust across viewer iterations:
		// - older viewers: setAuxTrackPoints([{ key, pts }])
		// - newer viewers: setAuxTracks([{ id, pointsXY }])
		// - compat alias: setAuxTracksPoints(...)
		three.setAuxTracks?.([]);
		three.setAuxTracksPoints?.([]);
		three.setAuxTrackPoints?.([]);
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

	function setAuxTracksFromWorldPolylines(list) {
		// Accept multiple shapes (world/canonical ENU):
		// - older:   [{ key, pts:[{x,y,z?}...] }, ...]
		// - newer VC [{ id, points:[{x,y,z?}...] }, ...]
		// - viewer expects local:
		//     - newer: setAuxTracks([{ id, pointsXY:[{x,y,z?}...] }])
		//     - older: setAuxTrackPoints([{ key, pts:[...] }])
		if (!Array.isArray(list) || list.length === 0) {
			clearAuxTracks();
			return;
		}

		const outNew = []; // [{id, pointsXY}]
		const outOld = []; // [{key, pts}]

		for (const item of list) {
			const id = String(item?.id ?? item?.key ?? "");
			const ptsWorld = item?.points ?? item?.pointsXY ?? item?.pts;
			if (!id || !Array.isArray(ptsWorld) || ptsWorld.length < 2) continue;

			const local = xform.toLocalPolyline(ptsWorld).map(toThreeLocal);
			outNew.push({ id, pointsXY: local });
			outOld.push({ key: id, pts: local });
		}

		// Prefer the newer API when available
		if (three.setAuxTracks) {
			three.setAuxTracks(outNew);
			return;
		}
		if (three.setAuxTracksPoints) {
			three.setAuxTracksPoints(outNew);
			return;
		}
		three.setAuxTrackPoints?.(outOld);
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
	
	function zoomToFitWorldBboxSoft(bboxENU, opts) {
		if (!bboxENU || !three.zoomToFitBoxSoft) return;

		const o = xform.getOrigin();
		const bboxLocal = {
			minX: (Number(bboxENU.minX) || 0) - o.x,
			minY: (Number(bboxENU.minY) || 0) - o.y,
			maxX: (Number(bboxENU.maxX) || 0) - o.x,
			maxY: (Number(bboxENU.maxY) || 0) - o.y,
		};

		three.zoomToFitBoxSoft(bboxLocal, opts);
	}
	
	function zoomToFitWorldBboxSoftAnimated(bboxENU, opts) {
		if (!bboxENU || !three.zoomToFitBoxSoftAnimated) return;

		const o = xform.getOrigin();
		const bboxLocal = {
			minX: (Number(bboxENU.minX) || 0) - o.x,
			minY: (Number(bboxENU.minY) || 0) - o.y,
			maxX: (Number(bboxENU.maxX) || 0) - o.x,
			maxY: (Number(bboxENU.maxY) || 0) - o.y,
		};

		three.zoomToFitBoxSoftAnimated(bboxLocal, opts);
	}

	// MS13.5: click-to-chainage (track picking)
	function onTrackClick(handler) {
		if (!three.onTrackClick) return;
		three.onTrackClick?.((hit) => {
			const s = Number(hit?.s);
			const pLocal = hit?.point ?? null;
			const pWorld = pLocal ? xform.toWorld(pLocal) : null;
			handler?.({ s, pointLocal: pLocal, pointWorld: pWorld, event: hit?.event ?? null });
		});
	}

	return {
		transform: xform,

		setOriginFromBbox,
		zoomToFitWorldBbox,
		zoomToFitWorldBboxSoft, // ✅ MS13.2
		zoomToFitWorldBboxSoftAnimated, // ✅ MS13.2b
		onTrackClick, // ✅ MS13.5

		setTrackFromWorldPolyline,
		setAuxTracksFromWorldPolylines, // ✅ MS13.9/13.11
		setMarkerFromWorld,
		setSectionLineFromWorld,

		clearTrack,
		clearAuxTracks, // ✅ MS13.9/13.11
		clearMarker,
		clearSectionLine,
	};
}
