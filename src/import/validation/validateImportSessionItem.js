// src/import/validation/validateImportSessionItem.js
//
// Structural validator for ImportSessionItem.
//
// Purpose:
// - hard contract for import pipeline intermediate objects
// - no repair, no guessing
// - kind-specific payload checks only at minimal structural level
//
// Important:
// Spot-compatibility is NOT fully validated here.
// That happens later in dedicated validators / promotion gates.
//
// @baustelle [DERIVED_LAYER]
// This validator accepts machine-readable derived augmentation,
// but validates only what is structurally relevant here.
// Currently:
// - sparseAlignment is validated for alignment items
// - interpretation is checked only at a shallow structural level
//
// @baustelle [META_LAYER]
// This validator accepts light-weight comparison metadata,
// but validates only its structure, not its semantics.
// Currently checked:
// - label / roleHint / spatialRefHint / sourceGroup / objectSignature
// - stationRange { sMin, sMax }

import {
	isImportSessionItemKind,
	isImportSessionItemStage,
} from "../contracts/importSessionItem.contract.js";

import { validateSparseAlignment } from "../../model/spot/validation/validateSparseAlignment.js";

const CODES = {
	root_type: "root_type",
	missing_id: "missing_id",
	invalid_kind: "invalid_kind",
	missing_source: "missing_source",
	invalid_source: "invalid_source",
	missing_payload: "missing_payload",
	invalid_status: "invalid_status",
	invalid_annotations: "invalid_annotations",
	invalid_meta: "invalid_meta",
	invalid_derived: "invalid_derived",

	source_file_name: "source_file_name",
	source_parser_id: "source_parser_id",

	status_valid: "status_valid",
	status_promotable: "status_promotable",
	status_stage: "status_stage",

	payload_kind_mismatch: "payload_kind_mismatch",
	payload_coordgeom_shape: "payload_coordgeom_shape",

	meta_label_invalid: "meta_label_invalid",
	meta_role_hint_invalid: "meta_role_hint_invalid",
	meta_station_range_invalid: "meta_station_range_invalid",
	meta_spatial_ref_hint_invalid: "meta_spatial_ref_hint_invalid",
	meta_source_group_invalid: "meta_source_group_invalid",
	meta_object_signature_invalid: "meta_object_signature_invalid",

	derived_sparse_invalid: "derived_sparse_invalid",
	derived_sparse_kind_mismatch: "derived_sparse_kind_mismatch",
	derived_interpretation_kind_mismatch: "derived_interpretation_kind_mismatch",
	derived_interpretation_invalid: "derived_interpretation_invalid",
};

export function validateImportSessionItem(item) {
	const res = makeResult();
	validateRoot(item, "", res);
	return res;
}

export function _validateImportSessionItem(item) {
	return validateImportSessionItem(item);
}

function validateRoot(item, path, res) {
	if (!isObject(item)) {
		pushError(res, CODES.root_type, "item must be object", path);
		return;
	}

	if (!isNonEmptyString(item.id)) {
		pushError(res, CODES.missing_id, "id missing", joinPath(path, "id"));
	}

	if (!isImportSessionItemKind(item.kind)) {
		pushError(res, CODES.invalid_kind, "invalid kind", joinPath(path, "kind"));
	}

	if (!isObject(item.source)) {
		pushError(res, CODES.missing_source, "source missing or invalid", joinPath(path, "source"));
	} else {
		validateSource(item.source, joinPath(path, "source"), res);
	}

	if (!isObject(item.payload)) {
		pushError(res, CODES.missing_payload, "payload missing or invalid", joinPath(path, "payload"));
	} else {
		validatePayload(item.kind, item.payload, joinPath(path, "payload"), res);
	}

	if (!isObject(item.status)) {
		pushError(res, CODES.invalid_status, "status missing or invalid", joinPath(path, "status"));
	} else {
		validateStatus(item.status, joinPath(path, "status"), res);
	}

	if (item.annotations != null && !Array.isArray(item.annotations)) {
		pushError(res, CODES.invalid_annotations, "annotations must be array", joinPath(path, "annotations"));
	}

	if (item.meta != null && !isObject(item.meta)) {
		pushError(res, CODES.invalid_meta, "meta must be object", joinPath(path, "meta"));
	} else {
		validateMeta(item.meta, joinPath(path, "meta"), res);
	}

	if (item.derived != null && !isObject(item.derived)) {
		pushError(res, CODES.invalid_derived, "derived must be object", joinPath(path, "derived"));
	} else {
		validateDerived(item, joinPath(path, "derived"), res);
	}
}

function validateSource(source, path, res) {
	if (!isNonEmptyString(source.fileName)) {
		pushWarning(res, CODES.source_file_name, "source.fileName missing", joinPath(path, "fileName"));
	}

	if (!isNonEmptyString(source.parserId)) {
		pushWarning(res, CODES.source_parser_id, "source.parserId missing", joinPath(path, "parserId"));
	}
}

function validateStatus(status, path, res) {
	if (typeof status.valid !== "boolean") {
		pushError(res, CODES.status_valid, "status.valid must be boolean", joinPath(path, "valid"));
	}

	if (typeof status.promotable !== "boolean") {
		pushError(res, CODES.status_promotable, "status.promotable must be boolean", joinPath(path, "promotable"));
	}

	if (!isImportSessionItemStage(status.stage)) {
		pushError(res, CODES.status_stage, "invalid status.stage", joinPath(path, "stage"));
	}
}

function validatePayload(kind, payload, path, res) {
	switch (kind) {
		case "alignment":
			validateAlignmentPayload(payload, path, res);
			return;

		case "profile":
			validateProfilePayload(payload, path, res);
			return;

		case "cant":
			validateCantPayload(payload, path, res);
			return;

		case "staEq":
			validateStaEqPayload(payload, path, res);
			return;

		case "relation":
			validateRelationPayload(payload, path, res);
			return;

		default:
			pushError(res, CODES.payload_kind_mismatch, "unknown kind for payload validation", path);
	}
}

function validateAlignmentPayload(payload, path, res) {
	if (payload.kind != null && payload.kind !== "alignment") {
		pushError(res, CODES.payload_kind_mismatch, 'payload.kind must be "alignment"', joinPath(path, "kind"));
	}

	const coordGeom = payload.coordGeom;

	if (!isObject(coordGeom)) {
		pushWarning(
			res,
			CODES.payload_coordgeom_shape,
			"alignment payload should contain coordGeom object with elements[]",
			joinPath(path, "coordGeom")
		);
		return;
	}

	if (!Array.isArray(coordGeom.elements) || coordGeom.elements.length === 0) {
		pushWarning(
			res,
			CODES.payload_coordgeom_shape,
			"alignment payload should contain non-empty coordGeom.elements",
			joinPath(path, "coordGeom.elements")
		);
	}
}

function validateProfilePayload(payload, path, res) {
	if (payload.kind != null && payload.kind !== "profile") {
		pushError(res, CODES.payload_kind_mismatch, 'payload.kind must be "profile"', joinPath(path, "kind"));
	}
}

function validateCantPayload(payload, path, res) {
	if (payload.kind != null && payload.kind !== "cant") {
		pushError(res, CODES.payload_kind_mismatch, 'payload.kind must be "cant"', joinPath(path, "kind"));
	}
}

function validateStaEqPayload(payload, path, res) {
	if (payload.kind != null && payload.kind !== "staEq") {
		pushError(res, CODES.payload_kind_mismatch, 'payload.kind must be "staEq"', joinPath(path, "kind"));
	}
}

function validateRelationPayload(payload, path, res) {
	if (payload.kind != null && payload.kind !== "relation") {
		pushError(res, CODES.payload_kind_mismatch, 'payload.kind must be "relation"', joinPath(path, "kind"));
	}
}

function validateMeta(meta, path, res) {
	if (!isObject(meta)) return;

	if (meta.label != null && !isNonEmptyString(meta.label)) {
		pushError(
			res,
			CODES.meta_label_invalid,
			"meta.label must be non-empty string",
			joinPath(path, "label")
		);
	}

	if (meta.roleHint != null && !isNonEmptyString(meta.roleHint)) {
		pushError(
			res,
			CODES.meta_role_hint_invalid,
			"meta.roleHint must be non-empty string",
			joinPath(path, "roleHint")
		);
	}

	if (meta.spatialRefHint != null && !isNonEmptyString(meta.spatialRefHint)) {
		pushError(
			res,
			CODES.meta_spatial_ref_hint_invalid,
			"meta.spatialRefHint must be non-empty string",
			joinPath(path, "spatialRefHint")
		);
	}

	if (meta.sourceGroup != null && !isNonEmptyString(meta.sourceGroup)) {
		pushError(
			res,
			CODES.meta_source_group_invalid,
			"meta.sourceGroup must be non-empty string",
			joinPath(path, "sourceGroup")
		);
	}

	if (meta.objectSignature != null && !isNonEmptyString(meta.objectSignature)) {
		pushError(
			res,
			CODES.meta_object_signature_invalid,
			"meta.objectSignature must be non-empty string",
			joinPath(path, "objectSignature")
		);
	}

	if (meta.stationRange != null) {
		validateStationRange(meta.stationRange, joinPath(path, "stationRange"), res);
	}
}

function validateStationRange(range, path, res) {
	if (!isObject(range)) {
		pushError(
			res,
			CODES.meta_station_range_invalid,
			"meta.stationRange must be object",
			path
		);
		return;
	}

	const hasSMin = range.sMin != null;
	const hasSMax = range.sMax != null;

	if (!hasSMin && !hasSMax) {
		pushError(
			res,
			CODES.meta_station_range_invalid,
			"meta.stationRange must contain at least sMin or sMax",
			path
		);
		return;
	}

	if (hasSMin && !Number.isFinite(range.sMin)) {
		pushError(
			res,
			CODES.meta_station_range_invalid,
			"meta.stationRange.sMin must be finite number",
			joinPath(path, "sMin")
		);
	}

	if (hasSMax && !Number.isFinite(range.sMax)) {
		pushError(
			res,
			CODES.meta_station_range_invalid,
			"meta.stationRange.sMax must be finite number",
			joinPath(path, "sMax")
		);
	}

	if (
		Number.isFinite(range.sMin) &&
		Number.isFinite(range.sMax) &&
		range.sMin > range.sMax
	) {
		pushError(
			res,
			CODES.meta_station_range_invalid,
			"meta.stationRange requires sMin <= sMax",
			path
		);
	}
}

function validateDerived(item, path, res) {
	if (!isObject(item.derived)) return;

	if (item.derived.sparseAlignment != null) {
		if (item.kind !== "alignment") {
			pushError(
				res,
				CODES.derived_sparse_kind_mismatch,
				"derived.sparseAlignment only allowed for kind=alignment",
				joinPath(path, "sparseAlignment")
			);
			return;
		}

		const vr = validateSparseAlignment(item.derived.sparseAlignment);
		if (!vr.ok) {
			pushError(
				res,
				CODES.derived_sparse_invalid,
				"derived.sparseAlignment invalid",
				joinPath(path, "sparseAlignment")
			);
			for (const w of vr.warnings ?? []) {
				pushWarning(
					res,
					CODES.derived_sparse_invalid,
					`derived.sparseAlignment warning: ${w.message}`,
					joinPath(path, "sparseAlignment")
				);
			}
		}
	}

	if (item.derived.interpretation != null) {
		if (item.kind !== "alignment") {
			pushError(
				res,
				CODES.derived_interpretation_kind_mismatch,
				"derived.interpretation only allowed for kind=alignment",
				joinPath(path, "interpretation")
			);
			return;
		}

		validateInterpretation(item.derived.interpretation, joinPath(path, "interpretation"), res);
	}
}

function validateInterpretation(interpretation, path, res) {
	if (!isObject(interpretation)) {
		pushError(
			res,
			CODES.derived_interpretation_invalid,
			"derived.interpretation must be object",
			path
		);
		return;
	}

	if (interpretation.type != null && !isNonEmptyString(interpretation.type)) {
		pushError(
			res,
			CODES.derived_interpretation_invalid,
			"derived.interpretation.type must be non-empty string",
			joinPath(path, "type")
		);
	}

	if (interpretation.intent != null && !isNonEmptyString(interpretation.intent)) {
		pushError(
			res,
			CODES.derived_interpretation_invalid,
			"derived.interpretation.intent must be non-empty string",
			joinPath(path, "intent")
		);
	}

	if (interpretation.completeness != null && !isNonEmptyString(interpretation.completeness)) {
		pushError(
			res,
			CODES.derived_interpretation_invalid,
			"derived.interpretation.completeness must be non-empty string",
			joinPath(path, "completeness")
		);
	}

	for (const key of ["hasCoordGeom", "hasStaEq", "hasProfile", "hasCant", "sparseConvertible"]) {
		if (interpretation[key] != null && typeof interpretation[key] !== "boolean") {
			pushError(
				res,
				CODES.derived_interpretation_invalid,
				`derived.interpretation.${key} must be boolean`,
				joinPath(path, key)
			);
		}
	}

	if (
		interpretation.coordGeomElementCount != null &&
		!Number.isInteger(interpretation.coordGeomElementCount)
	) {
		pushError(
			res,
			CODES.derived_interpretation_invalid,
			"derived.interpretation.coordGeomElementCount must be integer",
			joinPath(path, "coordGeomElementCount")
		);
	}
}

function makeResult() {
	return {
		ok: true,
		errors: [],
		warnings: [],
	};
}

function pushError(res, code, message, path = "") {
	res.ok = false;
	res.errors.push({ code, message, path });
}

function pushWarning(res, code, message, path = "") {
	res.warnings.push({ code, message, path });
}

function joinPath(base, key) {
	return base ? `${base}.${key}` : key;
}

function isObject(x) {
	return !!x && typeof x === "object" && !Array.isArray(x);
}

function isNonEmptyString(x) {
	return typeof x === "string" && x.trim().length > 0;
}
