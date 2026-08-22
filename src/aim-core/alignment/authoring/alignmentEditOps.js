// src/aim-core/alignment/authoring/alignmentEditOps.js

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

export function addArcElement(
	alignmentData,
	{ length = 100, curvature, radius, now = new Date().toISOString() } = {}
) {
	return insertArcElement(alignmentData, {
		index: null,
		length,
		curvature,
		radius,
		now,
	});
}

export function insertArcElement(
	alignmentData,
	{ index = null, length = 100, curvature, radius, now = new Date().toISOString() } = {}
) {
	assertAlignmentData(alignmentData, "insertArcElement");

	const currentEditModel = alignmentData.editModel ?? {};
	const currentElements = readElements(currentEditModel);
	const insertIndex = resolveInsertIndex(index, currentElements.length);

	const arc = normalizeArcElement(
		{
			id: makeElementId("arc"),
			type: "arc",
			parameters: {
				length,
				curvature,
				radius,
			},
			constraints: {},
			meta: {
				createdBy: "editor",
				createdAt: now,
				modifiedAt: now,
			},
		},
		"insertArcElement"
	);

	return updateAlignmentEditModel(alignmentData, {
		editModel: {
			...currentEditModel,
			elements: [
				...currentElements.slice(0, insertIndex),
				arc,
				...currentElements.slice(insertIndex),
			],
		},
		now,
	});
}

export function addTransitionElement(
	alignmentData,
	{ length = 60, transitionType = "clothoid", w1 = null, w2 = null, now = new Date().toISOString() } = {}
) {
	return insertTransitionElement(alignmentData, {
		index: null,
		length,
		transitionType,
		w1,
		w2,
		now,
	});
}

export function insertTransitionElement(
	alignmentData,
	{ index = null, length = 60, transitionType = "clothoid", w1 = null, w2 = null, now = new Date().toISOString() } = {}
) {
	assertAlignmentData(alignmentData, "insertTransitionElement");

	const currentEditModel = alignmentData.editModel ?? {};
	const currentElements = readElements(currentEditModel);
	const insertIndex = resolveInsertIndex(index, currentElements.length);

	const transition = normalizeTransitionElement(
		{
			id: makeElementId("transition"),
			type: "transition",
			parameters: {
				length,
				transitionType,
				w1,
				w2,
			},
			constraints: {},
			meta: {
				createdBy: "editor",
				createdAt: now,
				modifiedAt: now,
			},
		},
		"insertTransitionElement"
	);

	return updateAlignmentEditModel(alignmentData, {
		editModel: {
			...currentEditModel,
			elements: [
				...currentElements.slice(0, insertIndex),
				transition,
				...currentElements.slice(insertIndex),
			],
		},
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

export function updateArcById(
	alignmentData,
	{ elementId, length, curvature, radius, now = new Date().toISOString() } = {}
) {
	assertAlignmentData(alignmentData, "updateArcById");

	const element = findElementById(alignmentData, elementId);
	if (!element) {
		return alignmentData;
	}

	if (normalizeElementType(element) !== "arc") {
		throw new Error("updateArcById: element is not arc");
	}

	const nextLength =
		length == null
			? (element.parameters?.length ?? element.length)
			: length;

	const nextCurvature =
		curvature == null && radius == null
			? (element.parameters?.curvature ?? element.curvature)
			: curvature;

	const nextElement = normalizeArcElement(
		{
			...element,
			type: "arc",
			parameters: {
				...(element.parameters ?? {}),
				length: nextLength,
				curvature: nextCurvature,
				radius,
			},
		},
		"updateArcById"
	);

	return replaceElementById(alignmentData, {
		elementId,
		nextElement,
		now,
	});
}

export function updateTransitionById(
	alignmentData,
	{
		elementId,
		length,
		transitionType,
		w1,
		w2,
		now = new Date().toISOString(),
	} = {}
) {
	assertAlignmentData(alignmentData, "updateTransitionById");

	const element = findElementById(alignmentData, elementId);
	if (!element) {
		return alignmentData;
	}

	if (normalizeElementType(element) !== "transition") {
		throw new Error("updateTransitionById: element is not transition");
	}

	const nextLength =
		length == null
			? (element.parameters?.length ?? element.length)
			: length;

	const nextType =
		transitionType == null
			? (element.parameters?.transitionType ?? element.transitionType ?? element.transType)
			: transitionType;

	const nextElement = normalizeTransitionElement(
		{
			...element,
			type: "transition",
			parameters: {
				...(element.parameters ?? {}),
				length: nextLength,
				transitionType: nextType,
				w1,
				w2,
			},
		},
		"updateTransitionById"
	);

	return replaceElementById(alignmentData, {
		elementId,
		nextElement,
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

	if (type === "arc") {
		return normalizeArcElement(element, "normalizeEditorElement");
	}

	if (type === "transition") {
		return normalizeTransitionElement(element, "normalizeEditorElement");
	}

	return element;
}

function normalizeArcElement(element, caller) {
	const length = readPositiveLength(
		element?.parameters?.length ?? element?.length,
		`${caller}: arc length`
	);

	const hasRadius =
		element?.parameters?.radius != null || element?.radius != null;

	const radiusRaw =
		element?.parameters?.radius ?? element?.radius ?? null;

	const curvatureRaw =
		element?.parameters?.curvature ?? element?.curvature ?? null;

	let curvature;
	let radius;

	if (hasRadius && radiusRaw != null) {
		radius = readNonZeroFiniteNumber(radiusRaw, `${caller}: arc radius`);
		curvature = 1 / radius;
	} else {
		curvature = readNonZeroFiniteNumber(curvatureRaw, `${caller}: arc curvature`);
		radius = 1 / curvature;
	}

	if (!Number.isFinite(curvature) || curvature === 0) {
		throw new Error(`${caller}: arc curvature must be finite and non-zero`);
	}

	if (!Number.isFinite(radius) || radius === 0) {
		throw new Error(`${caller}: arc radius must be finite and non-zero`);
	}

	return {
		...element,
		type: "arc",
		parameters: {
			...(element?.parameters ?? {}),
			length,
			curvature,
			radius,
		},
		length,
		arcLength: length,
		curvature,
		radius,
	};
}

function normalizeTransitionElement(element, caller) {
	const length = readPositiveLength(
		element?.parameters?.length ?? element?.length ?? element?.arcLength,
		`${caller}: transition length`
	);

	const transitionType = readNonEmptyString(
		element?.parameters?.transitionType ?? element?.transitionType ?? element?.transType,
		`${caller}: transition type`
	).toLowerCase();

	const rawW1 =
		element?.parameters?.w1 ??
		element?.opts?.w1 ??
		element?.cuts01?.w1 ??
		null;

	const rawW2 =
		element?.parameters?.w2 ??
		element?.opts?.w2 ??
		element?.cuts01?.w2 ??
		null;

	let opts = { ...(isObject(element?.opts) ? element.opts : {}) };

	if (rawW1 != null && rawW2 != null) {
		const w1 = clamp01(readFiniteNumber(rawW1, `${caller}: transition w1`));
		const w2 = clamp01(readFiniteNumber(rawW2, `${caller}: transition w2`));

		if (w2 < w1) {
			throw new Error(`${caller}: transition w2 must be >= w1`);
		}

		opts = {
			...opts,
			w1,
			w2,
		};
	}

	return {
		...element,
		type: "transition",
		parameters: {
			...(element?.parameters ?? {}),
			length,
			transitionType,
			...(opts.w1 != null && opts.w2 != null ? { w1: opts.w1, w2: opts.w2 } : {}),
		},
		length,
		arcLength: length,
		transitionType,
		transType: transitionType,
		opts,
	};
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

	if (
		s === "arc" ||
		s === "curve" ||
		s === "circular_arc" ||
		s === "circulararc"
	) {
		return "arc";
	}

	if (
		s === "transition" ||
		s === "spiral"
	) {
		return "transition";
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

function readFiniteNumber(value, caller) {
	if (isObject(value) && Number.isFinite(Number(value.value))) {
		value = value.value;
	}

	const n = Number(value);
	if (!Number.isFinite(n)) {
		throw new Error(`${caller}: value must be finite number`);
	}

	return n;
}

function readNonZeroFiniteNumber(value, caller) {
	const n = readFiniteNumber(value, caller);
	if (n === 0) {
		throw new Error(`${caller}: value must be non-zero`);
	}

	return n;
}

function readNonEmptyString(value, caller) {
	const s = String(value ?? "").trim();
	if (!s) {
		throw new Error(`${caller}: value is required`);
	}

	return s;
}

function clamp01(value) {
	const n = Number(value);
	if (!Number.isFinite(n)) return 0;
	if (n < 0) return 0;
	if (n > 1) return 1;
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
