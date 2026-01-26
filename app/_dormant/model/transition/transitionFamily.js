// app/transition/transitionFamily.js

const registry = new Map();

export function registerTransitionFamily(family) {
	if (!family?.id) {
		throw new Error("TransitionFamily must have an id");
	}
	registry.set(family.id, family);
}

export function getTransitionFamily(id) {
	return registry.get(id) || null;
}

export function listTransitionFamilies() {
	return Array.from(registry.values());
}
