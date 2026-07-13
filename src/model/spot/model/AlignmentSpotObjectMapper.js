// src/model/spot/model/AlignmentSpotObjectMapper.js
//
// AlignmentSpotObjectMapper
//
// Responsibility:
// - maps native AlignmentData to canonical Alignment SpotObjects
// - reads AlignmentData from Alignment SpotObjects
// - preserves existing SPOT identity, references and metadata during updates
//
// NOT:
// - no Alignment editing
// - no SparseAlignment derivation
// - no SPOT persistence
// - no messaging
// - no workspace focus
// - no projection
// - no rendering

import { createAlignmentSpotObject } from "./createAlignmentSpotObject.js";

export class AlignmentMapper {
	createAlignmentSpotObjectFromData(
		alignmentData,
		options = {}
	) {
		return createAlignmentSpotObjectFromData(
			alignmentData,
			options
		);
	}

	updateAlignmentSpotObjectFromData(
		previousSpotObject,
		alignmentData,
		options = {}
	) {
		return updateAlignmentSpotObjectFromData(
			previousSpotObject,
			alignmentData,
			options
		);
	}

	readAlignmentDataFromSpotObject(spotObject) {
		return readAlignmentDataFromSpotObject(spotObject);
	}

	readAlignmentKernelFromSpotObject(spotObject) {
		return readAlignmentKernelFromSpotObject(spotObject);
	}
}

/**
 * Create a new canonical Alignment SpotObject from native AlignmentData.
 *
 * An empty native Alignment is valid:
 *
 * - AlignmentData exists
 * - editModel exists
 * - sparseAlignment may be null
 * - kernel may be null
 */
export function createAlignmentSpotObjectFromData(
	alignmentData,
	{
		crsId = alignmentData?.crsId ?? null,
		crsStatus = null,
		refs = {},
		extended = {},
		meta = {},
	} = {}
) {
	assertAlignmentData(
		alignmentData,
		"createAlignmentSpotObjectFromData"
	);

	const sparseAlignment = readSparseAlignment(alignmentData);
	const name = readAlignmentName(alignmentData);

	return createAlignmentSpotObject({
		id: String(alignmentData.id),
		name,

		crsId,
		crsStatus,

		// data.kernel is the runtime-consumable geometry kernel.
		kernel: sparseAlignment,

		// AlignmentData remains the native editable engineering state.
		alignmentData,

		// Compatibility field used by existing Alignment paths.
		sparseAlignment,

		extended: isObject(extended) ? extended : {},
		refs: isObject(refs) ? refs : {},

		meta: {
			label: name,
			source: "editor",
			lifecycle: alignmentData?.meta?.lifecycle ?? "draft",
			dirty: alignmentData?.meta?.dirty ?? true,
			createdAt:
				alignmentData?.meta?.createdAt ??
				new Date().toISOString(),
			modifiedAt:
				alignmentData?.meta?.modifiedAt ??
				new Date().toISOString(),
			hasSparseAlignment: Boolean(sparseAlignment),
			hasKernel: Boolean(sparseAlignment),
			...(isObject(meta) ? meta : {}),
		},
	});
}

/**
 * Update an existing Alignment SpotObject from native AlignmentData.
 *
 * Preserves:
 *
 * - SpotObject id
 * - CRS information
 * - refs
 * - extended data
 * - existing metadata not explicitly replaced
 *
 * Updates:
 *
 * - AlignmentData
 * - SparseAlignment
 * - kernel
 * - name / label
 * - lifecycle
 * - dirty state
 * - modified timestamp
 */
export function updateAlignmentSpotObjectFromData(
	previousSpotObject,
	alignmentData,
	{
		meta = {},
	} = {}
) {
	assertAlignmentSpotObject(
		previousSpotObject,
		"updateAlignmentSpotObjectFromData"
	);

	assertAlignmentData(
		alignmentData,
		"updateAlignmentSpotObjectFromData"
	);

	const sparseAlignment = readSparseAlignment(alignmentData);
	const previousData = isObject(previousSpotObject.data)
		? previousSpotObject.data
		: {};

	const previousMeta = isObject(previousSpotObject.meta)
		? previousSpotObject.meta
		: {};

	const name =
		alignmentData.name ??
		previousData.name ??
		previousMeta.label ??
		previousSpotObject.id;

	const modifiedAt =
		alignmentData?.meta?.modifiedAt ??
		new Date().toISOString();

	return createAlignmentSpotObject({
		id: String(previousSpotObject.id),
		name,

		crsId:
			previousSpotObject.crsId ??
			alignmentData.crsId ??
			null,

		crsStatus:
			previousSpotObject.crsStatus ??
			null,

		kernel: sparseAlignment,
		alignmentData,
		sparseAlignment,

		extended: isObject(previousData.extended)
			? previousData.extended
			: {},

		refs: isObject(previousSpotObject.refs)
			? previousSpotObject.refs
			: {},

		meta: {
			...previousMeta,

			label: name,

			source:
				previousMeta.source ??
				"editor",

			lifecycle:
				alignmentData?.meta?.lifecycle ??
				previousMeta.lifecycle ??
				"draft",

			dirty:
				alignmentData?.meta?.dirty ??
				true,

			modifiedAt,

			hasSparseAlignment: Boolean(sparseAlignment),
			hasKernel: Boolean(sparseAlignment),

			...(isObject(meta) ? meta : {}),
		},
	});
}

/**
 * Read native AlignmentData from a canonical Alignment SpotObject.
 *
 * The payload fallback is retained temporarily for compatibility with
 * older application states.
 */
export function readAlignmentDataFromSpotObject(spotObject) {
	if (!isObject(spotObject)) return null;

	const alignmentData =
		spotObject?.data?.alignmentData ??
		spotObject?.payload?.alignmentData ??
		null;

	return isAlignmentData(alignmentData)
		? alignmentData
		: null;
}

/**
 * Read the geometry kernel from an Alignment SpotObject.
 *
 * Primary location:
 *
 *     data.kernel
 *
 * Compatibility fallbacks:
 *
 *     data.sparseAlignment
 *     data.alignmentData.sparseAlignment
 */
export function readAlignmentKernelFromSpotObject(spotObject) {
	if (!isObject(spotObject)) return null;

	return (
		spotObject?.data?.kernel ??
		spotObject?.data?.sparseAlignment ??
		spotObject?.data?.alignmentData?.sparseAlignment ??
		null
	);
}

function readSparseAlignment(alignmentData) {
	return alignmentData?.sparseAlignment ?? null;
}

function readAlignmentName(alignmentData) {
	return (
		alignmentData?.name ??
		alignmentData?.id ??
		"New Alignment"
	);
}

function assertAlignmentData(value, caller) {
	if (!isAlignmentData(value)) {
		throw new Error(`${caller}: missing AlignmentData`);
	}

	if (!value.id) {
		throw new Error(`${caller}: AlignmentData.id is required`);
	}
}

function assertAlignmentSpotObject(value, caller) {
	if (!isObject(value) || !value.id) {
		throw new Error(`${caller}: missing SpotObject`);
	}

	if (value.type !== "alignment") {
		throw new Error(
			`${caller}: SpotObject is not an alignment: ${value.id}`
		);
	}
}

function isAlignmentData(value) {
	return (
		isObject(value) &&
		value.type === "AlignmentData"
	);
}

function isObject(value) {
	return (
		!!value &&
		typeof value === "object" &&
		!Array.isArray(value)
	);
}

export default {
	createAlignmentSpotObjectFromData,
	updateAlignmentSpotObjectFromData,
	readAlignmentDataFromSpotObject,
	readAlignmentKernelFromSpotObject,
};
