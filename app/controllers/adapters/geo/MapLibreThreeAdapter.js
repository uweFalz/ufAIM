// app/controllers/adapters/geo/MapLibreThreeAdapter.js

import { GeoMainViewAdapter } from "./GeoMainViewAdapter.js";

export class MapLibreThreeAdapter extends GeoMainViewAdapter {
	async mount(container) {
		this.container = container;
		globalThis.__ufAIM_geoMapAdapter = this;

		const injected = globalThis.__ufAIM_geoE2EMapLibre ?? null;
		const mapLibreModule = injected ? null : await import("maplibregl");
		const maplibregl = injected ?? mapLibreModule?.default ?? mapLibreModule?.maplibregl ?? globalThis.maplibregl;
		if (!maplibregl?.Map) throw new Error("MapLibre module did not expose a Map constructor.");

		this.maplibregl = maplibregl;
		this.map = new maplibregl.Map({
			container,
			style: this.options.style ?? "https://demotiles.maplibre.org/style.json",
			center: this.options.center ?? [13.405, 52.52],
			zoom: this.options.zoom ?? 10,
		});
		this.debug = { mounted: true, removed: false, geojson: null, fitBounds: null };
	}

	setRenderPrimitives(primitives) {
		this.primitives = primitives;
		if (!this.map) return;
		const coordinates = (primitives?.polyline ?? []).map((p) => [p.longitude, p.latitude]);
		const geojson = { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates } };
		this.debug ??= {};
		this.debug.geojson = geojson;
		const apply = () => {
			if (this.map.getSource("ufaim-alignment")) this.map.getSource("ufaim-alignment").setData(geojson);
			else {
				this.map.addSource("ufaim-alignment", { type: "geojson", data: geojson });
				this.map.addLayer({ id: "ufaim-alignment", type: "line", source: "ufaim-alignment", paint: { "line-color": "#00d7ff", "line-width": 5 } });
			}
		};
		if (this.map.loaded()) apply(); else this.map.once("load", apply);
	}

	setCursor(cursor) {
		this.cursor = cursor;
		// später: cursor marker / station highlight
	}

	fitToContent(options = {}) {
		const b = this.primitives?.bbox;
		if (!b || !this.map) return;
		this.map.fitBounds([[b.west, b.south], [b.east, b.north]], { padding: options.padding ?? 48, maxZoom: options.maxZoom ?? 17 });
		this.debug ??= {};
		this.debug.fitBounds = [[b.west, b.south], [b.east, b.north]];
	}

	resize() {
		this.map?.resize?.();
	}

	destroy() {
		this.map?.remove?.();
		this.debug ??= {};
		this.debug.removed = true;
		this.map = null;
		this.container = null;
	}

	getDebugState() {
		return { ...(this.debug ?? {}), active: Boolean(this.map), primitives: this.primitives ?? null };
	}
}
