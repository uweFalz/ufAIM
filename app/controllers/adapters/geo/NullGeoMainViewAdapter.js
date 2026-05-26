// app/cadapters/geo/NullGeoMainViewAdapter.js

import { GeoMainViewAdapter } from "./GeoMainViewAdapter.js";

export class NullGeoMainViewAdapter extends GeoMainViewAdapter {
	async mount(container) {
		this.container = container;
		console.info("[NullGeoMainViewAdapter] mounted");
	}

	setRenderPrimitives(primitives) {
		this.primitives = primitives;
	}

	setCursor(cursor) {
		this.cursor = cursor;
	}

	destroy() {
		this.container = null;
	}
}
