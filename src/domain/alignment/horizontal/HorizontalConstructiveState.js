const {
	assertEditableHorizontalSequence,
	assertHorizontalConstructiveState,
	deriveSparseHorizontalRealization: deriveSparseHorizontalRealizationCore,
	isHorizontalConstructiveState,
} = await import(
	"../../../aim-core/alignment/aggregate/HorizontalConstructiveState.js"
);
import { buildSparseFromEditModel } from "../editor/buildSparseAlignment.js";

export {
	assertEditableHorizontalSequence,
	assertHorizontalConstructiveState,
	isHorizontalConstructiveState,
};

export function deriveSparseHorizontalRealization(value) {
	return deriveSparseHorizontalRealizationCore(value, {
		sparseBuilder: buildSparseFromEditModel,
	});
}
