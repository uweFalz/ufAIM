//
// src/coord/CoordContextRegistry.js
//

export function createCoordContextRegistry() {

	const contexts = new Map();

	function add(context) {
		if (!context?.id) {
			throw new Error("CoordContextRegistry.add: missing context.id");
		}

		contexts.set(context.id, context);

		return context;
	}

	function get(id) {
		return contexts.get(id) ?? null;
	}

	function list() {
		return Array.from(contexts.values());
	}

	return {
		add,
		get,
		list,
	};
}
