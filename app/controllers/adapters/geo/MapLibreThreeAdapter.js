// app/controllers/adapters/geo/MapLibreThreeAdapter.js

import { GeoMainViewAdapter } from "./GeoMainViewAdapter.js";

export class MapLibreThreeAdapter extends GeoMainViewAdapter {
	async mount(container) {
		this.container = container;
		globalThis.__ufAIM_geoMapAdapter = this;

		const injected = globalThis.__ufAIM_geoE2EMapLibre ?? null;
		const mapLibreModule = injected ? null : await import("maplibregl");
		const maplibregl = injected
			?? (mapLibreModule?.default?.Map ? mapLibreModule.default : null)
			?? (mapLibreModule?.Map ? mapLibreModule : null)
			?? mapLibreModule?.maplibregl
			?? globalThis.maplibregl;
		if (!maplibregl?.Map) throw new Error("MapLibre module did not expose a Map constructor.");

		this.maplibregl = maplibregl;
		this.map = new maplibregl.Map({
			container,
			style: this.options.style ?? "https://demotiles.maplibre.org/style.json",
			center: this.options.center ?? [10.45, 51.16],
			zoom: this.options.zoom ?? 5.4,
		});
		this.debug = { mounted: true, removed: false, geojson: null, fitBounds: null };
	}

	clearRenderPrimitives() {
		this.primitives = null;
		const geojson = { type: "Feature", properties: {}, geometry: null };
		this.debug ??= {};
		this.debug.geojson = geojson;
		this.map?.getSource?.("ufaim-alignment")?.setData?.(geojson);
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
		if (!this.map) return;
		const valid = Number.isFinite(cursor?.longitude) && Number.isFinite(cursor?.latitude);
		const geojson = { type: "Feature", properties: { objectId: cursor?.objectId ?? null, s: cursor?.s ?? null }, geometry: valid ? { type: "Point", coordinates: [cursor.longitude, cursor.latitude] } : null };
		const apply = () => {
			if (this.map.getSource("ufaim-cursor")) this.map.getSource("ufaim-cursor").setData(geojson);
			else {
				this.map.addSource("ufaim-cursor", { type: "geojson", data: geojson });
				this.map.addLayer({ id: "ufaim-cursor", type: "circle", source: "ufaim-cursor", paint: { "circle-radius": 7, "circle-color": "#ffc107", "circle-stroke-color": "#101820", "circle-stroke-width": 2 } });
			}
		};
		if (this.map.loaded()) apply(); else this.map.once("load", apply);
		this.debug ??= {};
		this.debug.cursor = valid ? { ...cursor } : null;
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
