export function createAlignmentProfileViewModel(projection) {
	if (
		!projection ||
		typeof projection !== "object" ||
		projection.status !== "projected" ||
		typeof projection.alignmentId !== "string" ||
		!projection.cursor ||
		projection.cursor.parameterKind !== "intrinsic-s" ||
		!Number.isFinite(projection.cursor.s)
	) {
		throw new TypeError(
			"createAlignmentProfileViewModel requires a synchronized profile projection"
		);
	}

	return Object.freeze({
		status: "projected",
		alignmentId: projection.alignmentId,
		revision: projection.revision,
		cursor: projection.cursor,
		profileStatePresence: projection.profileStatePresence,
		vertical: projection.vertical,
		chainage: projection.chainage,
		cant: projection.cant,
		canCreateRailPairCant:
			projection.profileStatePresence === "present" && projection.state?.cant === null,
		railPairCantState:
			projection.state?.cant?.type === "RailPairCantConstructiveState" &&
			projection.state.cant.coverage?.status === "complete" &&
			projection.state.cant.coverage?.authority === "admitted-construction"
				? projection.state.cant
				: null,
	});
}

export default createAlignmentProfileViewModel;
