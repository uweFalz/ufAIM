import { buildSparseFromEditModel } from "./SparseAlignmentBuilder.js";

function isObject(value) {
	return !!value && typeof value === "object" && !Array.isArray(value);
}

function isFiniteNumber(value) {
	return typeof value === "number" && Number.isFinite(value);
}

export function isHorizontalConstructiveState(value) {
	if (
		!isObject(value) ||
		value.type !== "AlignmentData" ||
		typeof value.id !== "string" ||
		!value.id.trim() ||
		!isObject(value.editModel) ||
		!isObject(value.editModel.startPose)
	) {
		return false;
	}

	const { p, t } = value.editModel.startPose;
	if (
		!isObject(p) ||
		!isObject(t) ||
		![p.x, p.y, t.x, t.y].every(isFiniteNumber) ||
		!Array.isArray(value.editModel.elements)
	) {
		return false;
	}

	const ids = new Set();
	for (const element of value.editModel.elements) {
		const id =
			typeof element?.id === "string" ? element.id.trim() : "";
		const type = String(element?.type ?? "").toLowerCase();
		if (
			!isObject(element) ||
			!id ||
			ids.has(id) ||
			!["straight", "arc", "transition"].includes(type)
		) {
			return false;
		}
		ids.add(id);
	}

	return true;
}

export function assertHorizontalConstructiveState(
	value,
	context = "HorizontalConstructiveState"
) {
	if (!isHorizontalConstructiveState(value)) {
		throw new TypeError(
			`${context}: invalid constructive horizontal Alignment state`
		);
	}
	return value;
}

export function assertEditableHorizontalSequence(value) {
	assertHorizontalConstructiveState(
		value,
		"assertEditableHorizontalSequence"
	);

	const elements = value.editModel.elements;
	const isFixed = (element) =>
		["straight", "arc"].includes(
			String(element.type).toLowerCase()
		);
	for (let index = 1; index < elements.length; index += 1) {
		const left = elements[index - 1];
		const right = elements[index];
		if (isFixed(left) && isFixed(right)) {
			throw new Error(
				"adjacent fixed alignment elements require an explicit " +
					`transition: ${left.id} -> ${right.id}`
			);
		}
	}

	return value;
}

export function deriveSparseHorizontalRealization(
	value,
	{
		sparseBuilder = buildSparseFromEditModel,
		...dependencies
	} = {}
) {
	assertHorizontalConstructiveState(
		value,
		"deriveSparseHorizontalRealization"
	);
	assertEditableHorizontalSequence(value);
	if (value.editModel.elements.length === 0) return null;
	return sparseBuilder(value, dependencies);
}
