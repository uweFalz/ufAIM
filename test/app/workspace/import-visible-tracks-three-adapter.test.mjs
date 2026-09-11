import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { makeThreeAdapter } from "../../../app/controllers/adapters/geo/ThreeMainViewControllerAdapter.js";

test("selectable alignment primitives use the same floating origin as the track and marker", () => {
	let rendered, track, marker;
	const adapter = makeThreeAdapter({ three: {
		setAlignmentProjection(value) { rendered = value; },
		setTrackPoints(value) { track = value; },
		setMarker(value) { marker = value; },
	} });
	const a = { x: 4510600, y: 5379100 }, b = { x: 4510700, y: 5379140 };
	const bbox = { minX: a.x, minY: a.y, maxX: b.x, maxY: b.y };
	const input = {
		objectId: "local-import", crsId: null, selectedElementId: "arc-1",
		projection: {
			polyline2d: [a, b], bbox, bboxCenter: { x: 4510650, y: 5379120 },
			startPoint: a, endPoint: b, georeference: { horizontal: { status: "unresolved" } },
			segments: [{ id: "arc-1", elementId: "arc-1", kind: "arc", s0: 0, s1: 108, points2d: [a, b], startPoint: a, endPoint: b }],
			boundaries: [{ id: "arc-1:start", elementId: "arc-1", s: 0, point2d: a }],
		},
	};
	const before = structuredClone(input);
	adapter.setOriginFromBbox(bbox);
	adapter.setTrackFromWorldPolyline(input.projection.polyline2d);
	adapter.setMarkerFromWorld(a);
	adapter.setAlignmentProjection(input);
	assert.deepEqual(rendered.projection.polyline2d, track);
	assert.deepEqual(rendered.projection.segments[0].points2d, track);
	assert.deepEqual(rendered.projection.boundaries[0].point2d, marker);
	assert.deepEqual(rendered.projection.startPoint, marker);
	assert.deepEqual(rendered.projection.segments[0].startPoint, marker);
	assert.deepEqual(rendered.projection.endPoint, track[1]);
	assert.deepEqual(rendered.projection.segments[0].endPoint, track[1]);
	assert.deepEqual(rendered.projection.bbox, { minX: -50, minY: -20, maxX: 50, maxY: 20 });
	assert.deepEqual(rendered.projection.bboxCenter, { x: 0, y: 0, z: 0 });
	assert.equal(rendered.objectId, input.objectId);
	assert.equal(rendered.selectedElementId, "arc-1");
	assert.equal(rendered.projection.segments[0].s1, 108);
	assert.deepEqual(rendered.projection.georeference, input.projection.georeference);
	assert.deepEqual(input, before, "renderer conversion must not alter source geometry or CRS evidence");
	adapter.setOriginFromBbox({ minX: 4510590, maxX: 4510590, minY: 5379090, maxY: 5379090 });
	adapter.setAlignmentProjection(input);
	assert.deepEqual(rendered.projection.startPoint, { x: 10, y: 10, z: 0 });
	assert.deepEqual(input, before, "reframing must not accumulate coordinate offsets");
	adapter.setAlignmentProjection(null);
	assert.equal(rendered, null);
});

test("physical import track style reaches the Three viewer without being stripped", async () => {
	let rendered = null;
	const adapter = makeThreeAdapter({
		three: {
			setAuxTracks(tracks) { rendered = tracks; },
		},
	});
	const tracks = [{
			id: "W467-468",
			objectId: "W467-468",
			source: "import-drop",
			polyline2d: [{ x: 100, y: 200 }, { x: 160, y: 205 }],
			style: { color: 0x25d9d0, opacity: 0.96, dashed: false, zOffset: 0.16, renderOrder: 22 },
		}];
	adapter.setAuxTracksFromWorldPolylinesStyled(tracks);
	assert.equal(rendered.length, 1);
	assert.deepEqual(rendered[0].style, tracks[0].style);
	assert.deepEqual(rendered[0].pointsXY, [{ x: 100, y: 200, z: 0 }, { x: 160, y: 205, z: 0 }]);
	const auxSource = await readFile(new URL("../../../app/controllers/viewAuxTracks.js", import.meta.url), "utf8");
	assert.match(auxSource, /color: t\.source === "import-drop" \? 0x25d9d0/);
	assert.match(auxSource, /opacity: t\.source === "import-drop" \? 0\.96/);
});
