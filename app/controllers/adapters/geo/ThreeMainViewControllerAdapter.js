// app/controllers/adapters/geo/ThreeMainViewControllerAdapter.js
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
	if (!three) throw new Error("ThreeMainViewControllerAdapter: missing 'three' viewer instance");

	const xform = transform ?? makeGeoTransform();

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

	function clearAlignmentProjection() {
		three.clearAlignmentProjection?.();
	}

	function clearMarker() {
		three.setMarker?.(null);
	}

	function clearSectionLine() {
		three.setSectionLine?.(null, null);
	}

	function clearAuxTracks() {
		three.setAuxTracks?.([]);
		three.setAuxTracksPoints?.([]);
		three.setAuxTrackPoints?.([]);
	}

	function setTrackFromWorldPolyline(polylineENU) {
		if (!Array.isArray(polylineENU) || polylineENU.length < 2) {
			clearTrack();
			return;
		}

		console.log("[ThreeMainViewControllerAdapter] active track rendered", {
			pointCount: polylineENU.length,
			firstENU: polylineENU[0] ?? null,
			lastENU: polylineENU.at?.(-1) ?? polylineENU[polylineENU.length - 1] ?? null,
			hasSetTrackPoints: typeof three.setTrackPoints === "function",
		});

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
		if (!Array.isArray(list) || list.length === 0) {
			clearAuxTracks();
			return;
		}

		const outNew = [];
		const outOld = [];

		for (const item of list) {
			const id = String(item?.id ?? item?.key ?? "");
			const ptsWorld = item?.polyline2d;

			if (!id || !Array.isArray(ptsWorld) || ptsWorld.length < 2) continue;

			const local = xform.toLocalPolyline(ptsWorld).map(toThreeLocal);

			outNew.push({ id, pointsXY: local });
			outOld.push({ key: id, pts: local });
		}

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

	function setAlignmentProjection(payload) {
		three.setAlignmentProjection?.(payload);
	}

	function setAlignmentSelection(payload) {
		three.setAlignmentSelection?.(payload);
	}

	function makeLocalBbox(bboxENU) {
		if (!bboxENU) return null;

		const o = xform.getOrigin();

		return {
			minX: (Number(bboxENU.minX) || 0) - o.x,
			minY: (Number(bboxENU.minY) || 0) - o.y,
			maxX: (Number(bboxENU.maxX) || 0) - o.x,
			maxY: (Number(bboxENU.maxY) || 0) - o.y,
		};
	}

	function zoomToFitWorldBbox(bboxENU, opts) {
		const bboxLocal = makeLocalBbox(bboxENU);
		if (!bboxLocal || !three.zoomToFitBox) return;

		three.zoomToFitBox(bboxLocal, opts);
	}

	function zoomToFitWorldBboxSoft(bboxENU, opts) {
		const bboxLocal = makeLocalBbox(bboxENU);
		if (!bboxLocal || !three.zoomToFitBoxSoft) return;

		three.zoomToFitBoxSoft(bboxLocal, opts);
	}

	function zoomToFitWorldBboxSoftAnimated(bboxENU, opts) {
		const bboxLocal = makeLocalBbox(bboxENU);
		if (!bboxLocal || !three.zoomToFitBoxSoftAnimated) return;

		three.zoomToFitBoxSoftAnimated(bboxLocal, opts);
	}

	function onTrackClick(handler) {
		if (!three.onTrackClick) return;

		three.onTrackClick?.((hit) => {
			const s = Number(hit?.s);
			const pLocal = hit?.point ?? null;
			const pWorld = pLocal ? xform.toWorld(pLocal) : null;

			handler?.({
				s,
				pointLocal: pLocal,
				pointWorld: pWorld,
				event: hit?.event ?? null,
			});
		});
	}

	return {
		transform: xform,

		setOriginFromBbox,

		zoomToFitWorldBbox,
		zoomToFitWorldBboxSoft,
		zoomToFitWorldBboxSoftAnimated,

		onTrackClick,

		setTrackFromWorldPolyline,
		setAuxTracksFromWorldPolylines,
		setAlignmentProjection,
		setAlignmentSelection,

		setMarkerFromWorld,
		setSectionLineFromWorld,

		clearTrack,
		clearAlignmentProjection,
		clearAuxTracks,
		clearMarker,
		clearSectionLine,

		onAlignmentElementClick(handler) {
			three.onAlignmentElementClick?.(handler);
		},

		getDebugState() {
			return three.getDebugState?.() ?? null;
		},
	};
}
