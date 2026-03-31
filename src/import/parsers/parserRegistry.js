// src/import/parsers/parserRegistry.js

import registry from './registry.json' with { type: 'json' };

const moduleCache = new Map();

export function getParserIds() {
	return Object.keys(registry.imports || {});
}

export function getParserBasePath(id) {
	return registry.imports?.[id] || null;
}

export async function loadParserModule(id) {
	if (moduleCache.has(id)) return moduleCache.get(id);

	const basePath = getParserBasePath(id);
	if (!basePath) {
		throw new Error(`Unknown parser id: ${id}`);
	}

	const mod = await import(`${basePath}index.js`);
	moduleCache.set(id, mod);
	return mod;
}
