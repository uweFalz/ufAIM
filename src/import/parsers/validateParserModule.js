// src/import/parsers/validateParserModule.js

/**
* @module validateParserModule
*
* PURPOSE
* - Validate parser module structure
* - Validate semanticMap and transTypeMap (Stage 1)
*
* @baustelle
* - [SEMANTIC-DICT] no validation against LANDXML_SEMANTIC_DICTIONARY yet
* - [LAYOUT-CHECK] no validation against layout source (e.g. VERMESN_LAYOUT_SOURCE)
* - [REGISTRY-CHECK] no validation against transition registry
*/

function isObject(v) {
	return !!v && typeof v === "object" && !Array.isArray(v);
}

function isNonEmptyString(v) {
	return typeof v === "string" && v.trim().length > 0;
}

function validateSemanticMap(id, semanticMap) {
	if (!isObject(semanticMap)) {
		throw new Error(`Parser module "${id}" semanticMap must be an object`);
	}

	if (!isNonEmptyString(semanticMap.formatId)) {
		throw new Error(`Parser module "${id}" semanticMap missing formatId`);
	}

	if (!isNonEmptyString(semanticMap.fileType)) {
		throw new Error(`Parser module "${id}" semanticMap missing fileType`);
	}

	if (!isObject(semanticMap.fieldMap)) {
		throw new Error(`Parser module "${id}" semanticMap missing fieldMap`);
	}

	if (semanticMap.defaults != null && !isObject(semanticMap.defaults)) {
		throw new Error(`Parser module "${id}" semanticMap.defaults must be an object`);
	}

	for (const [fieldId, def] of Object.entries(semanticMap.fieldMap)) {
		if (!isObject(def)) {
			throw new Error(`Parser module "${id}" semanticMap.fieldMap.${fieldId} must be an object`);
		}

		if (!isNonEmptyString(def.defaultTarget)) {
			throw new Error(`Parser module "${id}" semanticMap.fieldMap.${fieldId} missing defaultTarget`);
		}

		// @baustelle [SEMANTIC-DICT]
		// TODO: validate def.defaultTarget against LANDXML_SEMANTIC_DICTIONARY
	}

	if (semanticMap.specialCases != null) {
		if (!isObject(semanticMap.specialCases)) {
			throw new Error(`Parser module "${id}" semanticMap.specialCases must be an object`);
		}

		const { semanticOverrides, semanticAlerts } = semanticMap.specialCases;

		if (semanticOverrides != null && !Array.isArray(semanticOverrides)) {
			throw new Error(`Parser module "${id}" semanticOverrides must be an array`);
		}

		if (semanticAlerts != null && !isObject(semanticAlerts)) {
			throw new Error(`Parser module "${id}" semanticAlerts must be an object`);
		}

		for (const [i, rule] of (semanticOverrides ?? []).entries()) {
			if (!isObject(rule)) {
				throw new Error(`Parser module "${id}" semanticOverrides[${i}] must be an object`);
			}

			if (!isObject(rule.when)) {
				throw new Error(`Parser module "${id}" semanticOverrides[${i}] missing when`);
			}

			if (!isNonEmptyString(rule.when.field)) {
				throw new Error(`Parser module "${id}" semanticOverrides[${i}].when.field missing`);
			}

			if (!isObject(rule.override)) {
				throw new Error(`Parser module "${id}" semanticOverrides[${i}] missing override`);
			}

			if (!isNonEmptyString(rule.override.field)) {
				throw new Error(`Parser module "${id}" semanticOverrides[${i}].override.field missing`);
			}

			if (!isNonEmptyString(rule.override.target)) {
				throw new Error(`Parser module "${id}" semanticOverrides[${i}].override.target missing`);
			}

			// @baustelle [SEMANTIC-DICT]
			// TODO: validate override.target against LANDXML_SEMANTIC_DICTIONARY
		}
	}
}

function validateTransTypeMap(id, transTypeMap) {
	if (!isObject(transTypeMap)) {
		throw new Error(`Parser module "${id}" transTypeMap must be an object`);
	}

	for (const [rawType, mapped] of Object.entries(transTypeMap)) {
		if (!isNonEmptyString(rawType)) {
			throw new Error(`Parser module "${id}" transTypeMap contains invalid key`);
		}

		if (!isNonEmptyString(mapped)) {
			throw new Error(`Parser module "${id}" transTypeMap.${rawType} must be a non-empty string`);
		}

		// @baustelle [REGISTRY-CHECK]
		// TODO: validate mapped value against transition registry (RegistryResolver)
	}
}

export function validateParserModule(id, mod) {
	if (!mod || typeof mod !== "object") {
		throw new Error(`Parser module "${id}" is invalid`);
	}

	if (!mod.meta || typeof mod.meta !== "object") {
		throw new Error(`Parser module "${id}" missing export: meta`);
	}

	if (mod.meta.id && mod.meta.id !== id) {
		throw new Error(`Parser module "${id}" has mismatching meta.id "${mod.meta.id}"`);
	}

	if (!mod.sniff || typeof mod.sniff !== "object") {
		throw new Error(`Parser module "${id}" missing export: sniff`);
	}

	if (!Array.isArray(mod.sniff.extensions)) {
		throw new Error(`Parser module "${id}" missing sniff.extensions[]`);
	}

	if (typeof mod.parse !== "function") {
		throw new Error(`Parser module "${id}" missing export: parse()`);
	}

	if (mod.semanticMap != null) {
		validateSemanticMap(id, mod.semanticMap);
	}

	if (mod.transTypeMap != null) {
		validateTransTypeMap(id, mod.transTypeMap);
	}

	return true;
}
