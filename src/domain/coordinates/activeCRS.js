// src/crs/activeCRS.js

export function createActiveCRS({
	id = "LOCAL",
	type = "local",   // local | projected | geographic
	unit = "m",
	transform = null, // { toWorld, fromWorld }
} = {}) {

	return {
		id,
		type,
		unit,

		transform: transform ?? {
			toWorld: (p) => p,
			fromWorld: (p) => p,
		},
	};
}
