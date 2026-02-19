// src/lib/geom/curve/transitionRegistry.js

import { makeTransition } from "./transition2.js";

const registry = new Map();

export function registerTransition(name, factoryFn) {
	registry.set(name, factoryFn);
}

export function makeTransitionByName(name, ...args) {
	const fn = registry.get(name);
	if (!fn) throw new Error(`Unknown transition '${name}'`);
	return fn(...args);
}

// default: "lookup"
registerTransition("lookup", (L, lookup) => makeTransition(L, lookup, "lookup"));
