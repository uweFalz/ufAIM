// app/controllers/adapters/geo/createGeoMainViewAdapter.js

import { NullGeoMainViewAdapter } from "./NullGeoMainViewAdapter.js";

export async function createGeoMainViewAdapter({
	type = "null",
	options = {},
} = {}) {
	if (type === "maplibre-three") {
		const { MapLibreThreeAdapter } = await import("./MapLibreThreeAdapter.js");
		return new MapLibreThreeAdapter(options);
	}

	return new NullGeoMainViewAdapter(options);
}
