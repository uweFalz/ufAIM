// src/import/parsers/validateParserModule.js

import { LANDXML_SEMANTIC_DICTIONARY } from "../semantic/landXmlSemanticDictionary.js";
import { RegistryResolver } from "../../domain/transition/registry/RegistryResolver.js";

/**
* @module validateParserModule
*
* PURPOSE
* - Validate parser module contract structure
* - Validate optional semanticMap and transTypeMap declarations
*
* NOTE
* - This validator checks static module validity only.
* - It does not execute parser logic and does not run imports.
*/

let cachedTransitionResolver = null;

function makeParserValidationError(parserId, code, message, kind = "structural") {
	const err = new Error(`[${kind}] parser "${parserId}" ${message}`);
	err.code = code;
	err.kind = kind;
	err.parserId = parserId;
	return err;
}

function throwStructural(parserId, code, message) {
	throw makeParserValidationError(parserId, code, message, "structural");
}

function throwRuntime(parserId, code, message) {
	throw makeParserValidationError(parserId, code, message, "runtime");
}

function isObject(v) {
	return !!v && typeof v === "object" && !Array.isArray(v);
}

function isNonEmptyString(v) {
	return typeof v === "string" && v.trim().length > 0;
}

function getSemanticTargetsFromDictionary() {
	const targets = LANDXML_SEMANTIC_DICTIONARY?.targets;
	if (!targets || typeof targets !== "object") return new Set();
	return new Set(Object.keys(targets));
}

function isPathLikeSemanticTarget(value) {
	if (!isNonEmptyString(value)) return false;

	// Generic contract fallback for source-near semantic path targets.
	return /^[A-Za-z_][A-Za-z0-9_]*(\[(\*|\d+)\])?(\.[A-Za-z_][A-Za-z0-9_]*(\[(\*|\d+)\])?)*$/.test(
		String(value).trim()
	);
}

function validateSemanticTarget(parserId, target, targetName, semanticTargets) {
	if (!isNonEmptyString(target)) {
		throwStructural(parserId, "PARSER_SEMANTIC_TARGET_MISSING", `${targetName} missing`);
	}

	const normalizedTarget = String(target).trim();
	if (semanticTargets.has(normalizedTarget)) return;
	if (isPathLikeSemanticTarget(normalizedTarget)) return;

	throwStructural(
		parserId,
		"PARSER_SEMANTIC_TARGET_UNKNOWN",
		`${targetName} "${normalizedTarget}" is unknown (not in semantic dictionary and not path-like)`
	);
}

function getTransitionResolver(parserId) {
	if (cachedTransitionResolver) return cachedTransitionResolver;

	try {
		cachedTransitionResolver = new RegistryResolver();
		return cachedTransitionResolver;
	} catch (err) {
		throwRuntime(
			parserId,
			"PARSER_VALIDATOR_REGISTRY_UNAVAILABLE",
			`cannot initialize transition registry resolver: ${String(err?.message ?? err)}`
		);
	}
}

function validateTransitionType(parserId, rawType, mapped) {
	const resolver = getTransitionResolver(parserId);

	try {
		resolver.resolveTransitionDescriptor(mapped);
	} catch (err) {
		throwStructural(
			parserId,
			"PARSER_TRANSITION_TYPE_UNKNOWN",
			`transTypeMap.${rawType} maps to unknown transition "${mapped}": ${String(err?.message ?? err)}`
		);
	}
}

function validateSemanticMap(id, semanticMap) {
	const semanticTargets = getSemanticTargetsFromDictionary();

	if (!isObject(semanticMap)) {
		throwStructural(id, "PARSER_SEMANTIC_MAP_INVALID", "semanticMap must be an object");
	}

	if (!isNonEmptyString(semanticMap.formatId)) {
		throwStructural(id, "PARSER_SEMANTIC_MAP_FORMAT_ID_MISSING", "semanticMap missing formatId");
	}

	if (!isNonEmptyString(semanticMap.fileType)) {
		throwStructural(id, "PARSER_SEMANTIC_MAP_FILE_TYPE_MISSING", "semanticMap missing fileType");
	}

	if (!isObject(semanticMap.fieldMap)) {
		throwStructural(id, "PARSER_SEMANTIC_MAP_FIELD_MAP_MISSING", "semanticMap missing fieldMap");
	}

	if (semanticMap.defaults != null && !isObject(semanticMap.defaults)) {
		throwStructural(id, "PARSER_SEMANTIC_MAP_DEFAULTS_INVALID", "semanticMap.defaults must be an object");
	}

	for (const [fieldId, def] of Object.entries(semanticMap.fieldMap)) {
		if (!isObject(def)) {
			throwStructural(
				id,
				"PARSER_SEMANTIC_FIELD_INVALID",
				`semanticMap.fieldMap.${fieldId} must be an object`
			);
		}

		if (!isNonEmptyString(def.defaultTarget)) {
			throwStructural(
				id,
				"PARSER_SEMANTIC_FIELD_TARGET_MISSING",
				`semanticMap.fieldMap.${fieldId} missing defaultTarget`
			);
		}

		validateSemanticTarget(
			id,
			def.defaultTarget,
			`semanticMap.fieldMap.${fieldId}.defaultTarget`,
			semanticTargets
		);
	}

	if (semanticMap.specialCases != null) {
		if (!isObject(semanticMap.specialCases)) {
			throwStructural(id, "PARSER_SEMANTIC_SPECIAL_CASES_INVALID", "semanticMap.specialCases must be an object");
		}

		const { semanticOverrides, semanticAlerts } = semanticMap.specialCases;

		if (semanticOverrides != null && !Array.isArray(semanticOverrides)) {
			throwStructural(id, "PARSER_SEMANTIC_OVERRIDES_INVALID", "semanticOverrides must be an array");
		}

		if (semanticAlerts != null && !isObject(semanticAlerts)) {
			throwStructural(id, "PARSER_SEMANTIC_ALERTS_INVALID", "semanticAlerts must be an object");
		}

		for (const [i, rule] of (semanticOverrides ?? []).entries()) {
			if (!isObject(rule)) {
				throwStructural(id, "PARSER_SEMANTIC_OVERRIDE_INVALID", `semanticOverrides[${i}] must be an object`);
			}

			if (!isObject(rule.when)) {
				throwStructural(id, "PARSER_SEMANTIC_OVERRIDE_WHEN_MISSING", `semanticOverrides[${i}] missing when`);
			}

			if (!isNonEmptyString(rule.when.field)) {
				throwStructural(id, "PARSER_SEMANTIC_OVERRIDE_WHEN_FIELD_MISSING", `semanticOverrides[${i}].when.field missing`);
			}

			if (!isObject(rule.override)) {
				throwStructural(id, "PARSER_SEMANTIC_OVERRIDE_TARGET_BLOCK_MISSING", `semanticOverrides[${i}] missing override`);
			}

			if (!isNonEmptyString(rule.override.field)) {
				throwStructural(id, "PARSER_SEMANTIC_OVERRIDE_FIELD_MISSING", `semanticOverrides[${i}].override.field missing`);
			}

			if (!isNonEmptyString(rule.override.target)) {
				throwStructural(id, "PARSER_SEMANTIC_OVERRIDE_TARGET_MISSING", `semanticOverrides[${i}].override.target missing`);
			}

			validateSemanticTarget(
				id,
				rule.override.target,
				`semanticOverrides[${i}].override.target`,
				semanticTargets
			);
		}
	}
}

function validateTransTypeMap(id, transTypeMap) {
	if (!isObject(transTypeMap)) {
		throwStructural(id, "PARSER_TRANS_TYPE_MAP_INVALID", "transTypeMap must be an object");
	}

	for (const [rawType, mapped] of Object.entries(transTypeMap)) {
		if (!isNonEmptyString(rawType)) {
			throwStructural(id, "PARSER_TRANS_TYPE_KEY_INVALID", "transTypeMap contains invalid key");
		}

		if (!isNonEmptyString(mapped)) {
			throwStructural(
				id,
				"PARSER_TRANS_TYPE_VALUE_INVALID",
				`transTypeMap.${rawType} must be a non-empty string`
			);
		}

		validateTransitionType(id, rawType, mapped);
	}
}

export function validateParserModule(id, mod) {
	if (!mod || typeof mod !== "object") {
		throwStructural(id, "PARSER_MODULE_INVALID", "module export is missing or invalid");
	}

	if (!mod.meta || typeof mod.meta !== "object") {
		throwStructural(id, "PARSER_META_MISSING", "missing export: meta");
	}

	if (!isNonEmptyString(mod.meta.id)) {
		throwStructural(id, "PARSER_META_ID_MISSING", "meta.id must be a non-empty string");
	}

	if (String(mod.meta.id).trim() !== id) {
		throwStructural(id, "PARSER_META_ID_MISMATCH", `meta.id "${mod.meta.id}" mismatches parser id "${id}"`);
	}

	if (mod.meta.label != null && !isNonEmptyString(mod.meta.label)) {
		throwStructural(id, "PARSER_META_LABEL_INVALID", "meta.label must be a non-empty string when provided");
	}

	if (mod.meta.status != null && !isNonEmptyString(mod.meta.status)) {
		throwStructural(id, "PARSER_META_STATUS_INVALID", "meta.status must be a non-empty string when provided");
	}

	if (
		isNonEmptyString(mod.meta.status) &&
		["stub", "incomplete"].includes(String(mod.meta.status).trim().toLowerCase()) &&
		!isNonEmptyString(mod.meta.stubReason)
	) {
		throwStructural(
			id,
			"PARSER_META_STUB_REASON_MISSING",
			`meta.stubReason must be provided for status "${mod.meta.status}"`
		);
	}

	if (!mod.sniff || typeof mod.sniff !== "object") {
		throwStructural(id, "PARSER_SNIFF_MISSING", "missing export: sniff");
	}

	if (!Array.isArray(mod.sniff.extensions)) {
		throwStructural(id, "PARSER_SNIFF_EXTENSIONS_MISSING", "missing sniff.extensions[]");
	}

	for (const ext of mod.sniff.extensions) {
		if (!isNonEmptyString(ext)) {
			throwStructural(id, "PARSER_SNIFF_EXTENSION_INVALID", "sniff.extensions[] must contain only non-empty strings");
		}
	}

	if (mod.sniff.looksLike != null && typeof mod.sniff.looksLike !== "function") {
		throwStructural(id, "PARSER_SNIFF_LOOKSLIKE_INVALID", "sniff.looksLike must be a function when provided");
	}

	if (mod.parse == null) {
		throwStructural(id, "PARSER_PARSE_MISSING", "missing export: parse()");
	}

	if (typeof mod.parse !== "function") {
		throwStructural(id, "PARSER_PARSE_NON_CALLABLE", "parse must be callable");
	}

	if (mod.semanticMap != null) {
		validateSemanticMap(id, mod.semanticMap);
	}

	if (mod.transTypeMap != null) {
		validateTransTypeMap(id, mod.transTypeMap);
	}

	return true;
}
