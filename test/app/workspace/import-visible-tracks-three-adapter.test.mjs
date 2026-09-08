import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { makeThreeAdapter } from "../../../app/controllers/adapters/geo/ThreeMainViewControllerAdapter.js";

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
