// app/controllers/adapters/geo/GeoMainViewAdapter.js

export class GeoMainViewAdapter {
	constructor(options = {}) {
		this.options = options;
	}

	async mount(_container) {
		throw new Error("GeoMainViewAdapter.mount() must be implemented");
	}

	setViewState(_state) {}
	setRenderPrimitives(_primitives) {}
	setCursor(_cursor) {}
	fitToContent(_options = {}) {}
	resize() {}

	destroy() {}
}
