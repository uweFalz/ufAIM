// app/controllers/adapters/geo/MapLibreThreeAdapter.js

import { GeoMainViewAdapter } from "./GeoMainViewAdapter.js";

export class MapLibreThreeAdapter extends GeoMainViewAdapter {
	async mount(container) {
		this.container = container;

		const [{ default: maplibregl }, proj4Module] = await Promise.all([
			import("maplibre-gl"),
			import("proj4"),
		]);

		this.maplibregl = maplibregl;
		this.proj4 = proj4Module.default ?? proj4Module;

		this.map = new maplibregl.Map({
			container,
			style: this.options.style ?? "https://demotiles.maplibre.org/style.json",
			center: this.options.center ?? [13.405, 52.52],
			zoom: this.options.zoom ?? 10,
		});
	}

	setRenderPrimitives(primitives) {
		this.primitives = primitives;
		// später: polyline/mesh/marker/labels rendern
	}

	setCursor(cursor) {
		this.cursor = cursor;
		// später: cursor marker / station highlight
	}

	fitToContent(options = {}) {
		// später: bbox aus primitives
	}

	resize() {
		this.map?.resize?.();
	}

	destroy() {
		this.map?.remove?.();
		this.map = null;
		this.container = null;
	}
}
