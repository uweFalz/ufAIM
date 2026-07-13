// src/domain/alignment/editor/alignmentEditOps.js

export function addStraightElement(
	alignmentData,
	{ length = 100, now = new Date().toISOString() } = {}
) {
	return insertStraightElement(alignmentData, {
		index: null,
		length,
		now,
	});
}

export function insertStraightElement(
	alignmentData,
	{ index = null, length = 100, now = new Date().toISOString() } = {}
) {
	assertAlignmentData(alignmentData, "insertStraightElement");

	const resolvedLength = readPositiveLength(length, "insertStraightElement");

	const currentEditModel = alignmentData.editModel ?? {};
	const currentElements = readElements(currentEditModel);

	const insertIndex = resolveInsertIndex(index, currentElements.length);

	const straight = {
		id: makeElementId("straight"),
		type: "straight",

		parameters: {
			length: resolvedLength,
		},

		// Transitional compatibility with the current builder.
		length: resolvedLength,

		constraints: {},

		meta: {
			createdBy: "editor",
			createdAt: now,
			modifiedAt: now,
		},
	};

	return updateAlignmentEditModel(alignmentData, {
		editModel: {
			...currentEditModel,
			elements: [
				...currentElements.slice(0, insertIndex),
				straight,
				...currentElements.slice(insertIndex),
			],
		},
		now,
	});
}

export function removeElementById(
	alignmentData,
	{ elementId, now = new Date().toISOString() } = {}
) {
	assertAlignmentData(alignmentData, "removeElementById");

	const id = normalizeId(elementId);
	if (!id) {
		throw new Error("removeElementById: missing elementId");
	}

	const currentEditModel = alignmentData.editModel ?? {};
	const currentElements = readElements(currentEditModel);

	const nextElements = currentElements.filter((el) => el?.id !== id);

	if (nextElements.length === currentElements.length) {
		return alignmentData;
	}

	return updateAlignmentEditModel(alignmentData, {
		editModel: {
			...currentEditModel,
			elements: nextElements,
		},
		now,
	});
}

export function removeElementAtIndex(
	alignmentData,
	{ index, now = new Date().toISOString() } = {}
) {
	assertAlignmentData(alignmentData, "removeElementAtIndex");

	const currentEditModel = alignmentData.editModel ?? {};
	const currentElements = readElements(currentEditModel);

	const i = Number(index);

	if (!Number.isInteger(i) || i < 0 || i >= currentElements.length) {
		throw new Error("removeElementAtIndex: index out of range");
	}

	return updateAlignmentEditModel(alignmentData, {
		editModel: {
			...currentEditModel,
			elements: [
				...currentElements.slice(0, i),
				...currentElements.slice(i + 1),
			],
		},
		now,
	});
}

export function replaceElementById(
	alignmentData,
	{ elementId, nextElement, now = new Date().toISOString() } = {}
) {
	assertAlignmentData(alignmentData, "replaceElementById");

	const id = normalizeId(elementId);
	if (!id) {
		throw new Error("replaceElementById: missing elementId");
	}

	if (!isObject(nextElement)) {
		throw new Error("replaceElementById: missing nextElement");
	}

	const currentEditModel = alignmentData.editModel ?? {};
	const currentElements = readElements(currentEditModel);

	let replaced = false;

	const nextElements = currentElements.map((el) => {
		if (el?.id !== id) return el;

		replaced = true;

		return normalizeEditorElement({
			...el,
			...nextElement,
			id,
			meta: {
				...(el?.meta ?? {}),
				...(nextElement.meta ?? {}),
				modifiedAt: now,
			},
		});
	});

	if (!replaced) {
		return alignmentData;
	}

	return updateAlignmentEditModel(alignmentData, {
		editModel: {
			...currentEditModel,
			elements: nextElements,
		},
		now,
	});
}

export function updateStraightLengthById(
	alignmentData,
	{ elementId, length, now = new Date().toISOString() } = {}
) {
	assertAlignmentData(alignmentData, "updateStraightLengthById");

	const resolvedLength = readPositiveLength(length, "updateStraightLengthById");

	const element = findElementById(alignmentData, elementId);
	if (!element) {
		return alignmentData;
	}

	if (normalizeElementType(element) !== "straight") {
		throw new Error("updateStraightLengthById: element is not straight");
	}

	return replaceElementById(alignmentData, {
		elementId,
		nextElement: {
			...element,
			type: "straight",
			parameters: {
				...(element.parameters ?? {}),
				length: resolvedLength,
			},
			length: resolvedLength,
		},
		now,
	});
}

export function moveElementById(
	alignmentData,
	{ elementId, toIndex, now = new Date().toISOString() } = {}
) {
	assertAlignmentData(alignmentData, "moveElementById");

	const id = normalizeId(elementId);
	if (!id) {
		throw new Error("moveElementById: missing elementId");
	}

	const currentEditModel = alignmentData.editModel ?? {};
	const currentElements = readElements(currentEditModel);

	const fromIndex = currentElements.findIndex((el) => el?.id === id);
	if (fromIndex < 0) {
		return alignmentData;
	}

	const targetIndex = resolveInsertIndex(toIndex, currentElements.length - 1);

	if (fromIndex === targetIndex) {
		return alignmentData;
	}

	const moving = currentElements[fromIndex];
	const without = [
		...currentElements.slice(0, fromIndex),
		...currentElements.slice(fromIndex + 1),
	];

	const nextElements = [
		...without.slice(0, targetIndex),
		moving,
		...without.slice(targetIndex),
	];

	return updateAlignmentEditModel(alignmentData, {
		editModel: {
			...currentEditModel,
			elements: nextElements,
		},
		now,
	});
}

export function clearElements(
	alignmentData,
	{ now = new Date().toISOString() } = {}
) {
	assertAlignmentData(alignmentData, "clearElements");

	const currentEditModel = alignmentData.editModel ?? {};
	const currentElements = readElements(currentEditModel);

	if (currentElements.length === 0) {
		return alignmentData;
	}

	return updateAlignmentEditModel(alignmentData, {
		editModel: {
			...currentEditModel,
			elements: [],
		},
		now,
	});
}

export function findElementById(alignmentData, elementId) {
	const id = normalizeId(elementId);
	if (!id) return null;

	const elements = readElements(alignmentData?.editModel ?? {});
	return elements.find((el) => el?.id === id) ?? null;
}

export function readAlignmentElements(alignmentData) {
	return readElements(alignmentData?.editModel ?? {});
}

function updateAlignmentEditModel(
	alignmentData,
	{ editModel, now = new Date().toISOString() } = {}
) {
	return {
		...alignmentData,

		editModel,

		// Derived geometry is invalidated by every intent change.
		// The controller or a later domain service rebuilds sparseAlignment.
		sparseAlignment: null,

		meta: {
			...(alignmentData.meta ?? {}),
			dirty: true,
			modifiedAt: now,
		},
	};
}

function normalizeEditorElement(element) {
	if (!isObject(element)) return element;

	const type = normalizeElementType(element);

	if (type === "straight") {
		const length = readPositiveLength(
			element.parameters?.length ?? element.length,
			"normalizeEditorElement"
		);

		return {
			...element,
			type: "straight",
			parameters: {
				...(element.parameters ?? {}),
				length,
			},
			length,
		};
	}

	return element;
}

function normalizeElementType(element) {
	const raw =
		element?.type ??
		element?.kind ??
		element?.elementType ??
		"unknown";

	const s = String(raw).trim().toLowerCase();

	if (
		s === "straight" ||
		s === "line" ||
		s === "fixed" ||
		s === "fixedline" ||
		s === "fixed_line"
	) {
		return "straight";
	}

	return s || "unknown";
}

function readElements(editModel) {
	return Array.isArray(editModel?.elements)
		? editModel.elements
		: [];
}

function resolveInsertIndex(index, length) {
	if (index === null || index === undefined) {
		return length;
	}

	const i = Number(index);

	if (!Number.isInteger(i)) {
		throw new Error("resolveInsertIndex: index must be an integer");
	}

	return Math.max(0, Math.min(i, length));
}

function readPositiveLength(value, caller) {
	if (isObject(value) && Number.isFinite(Number(value.value))) {
		value = value.value;
	}

	const n = Number(value);

	if (!Number.isFinite(n) || n <= 0) {
		throw new Error(`${caller}: length must be a positive number`);
	}

	return n;
}

function assertAlignmentData(alignmentData, caller) {
	if (!alignmentData || alignmentData.type !== "AlignmentData") {
		throw new Error(`${caller}: missing AlignmentData`);
	}
}

function makeElementId(prefix = "element") {
	return `${prefix}_${Date.now().toString(36)}_${Math.random()
		.toString(36)
		.slice(2, 8)}`;
}

function normalizeId(value) {
	const id = String(value ?? "").trim();
	return id || null;
}

function isObject(x) {
	return !!x && typeof x === "object" && !Array.isArray(x);
}
