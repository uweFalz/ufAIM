// src/domain/coordinates/CoordinateAgent.js

export class CoordinateAgent {

	constructor() {
		this.active = null;
	}

	setActiveCRS(crs) {
		if (!crs) throw new Error("CoordinateAgent: CRS required");
		this.active = crs;
	}

	getActiveCRS() {
		return this.active;
	}

	toWorld(p) {
		if (!this.active) return p;
		return this.active.transform?.toWorld?.(p) ?? p;
	}

	fromWorld(p) {
		if (!this.active) return p;
		return this.active.transform?.fromWorld?.(p) ?? p;
	}
}
