export function makeProjectModel(obj = {}) {
	// keep it as a thin wrapper for now
	return {
		meta: obj.meta ?? {},
		view: obj.view ?? {},
		transition: obj.transition ?? {},
	};
}
