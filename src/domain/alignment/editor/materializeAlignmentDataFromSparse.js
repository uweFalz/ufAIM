export function materializeAlignmentDataFromSparse(spotObject) {
	const kernel = spotObject?.data?.kernel ?? spotObject?.data?.sparseAlignment ?? null;
	const sparse = Array.isArray(kernel?.sparse)
		? kernel.sparse
		: (Array.isArray(kernel?.elements) ? kernel.elements : []);
	const startPose = kernel?.startPose ?? null;
	if (!startPose?.p || !startPose?.t || !sparse.length) return null;
	const elements = sparse.map((element) => {
		const kind = String(element?.kind ?? element?.meta?.sourceElementType ?? element?.type ?? "").toLowerCase();
		const length = Number(element?.arcLength ?? element?.length);
		if (kind === "straight" || element?.type === "fixed" && Number(element?.curvature) === 0) {
			return { id: String(element.id), type: "straight", length, parameters: { length } };
		}
		if (kind === "arc" || element?.type === "fixed") {
			const curvature = Number(element?.curvature);
			return { id: String(element.id), type: "arc", length, curvature, parameters: { length, curvature } };
		}
		if (kind === "transition" || element?.type === "transition") {
			const transitionType = String(element?.transType ?? element?.transitionType ?? "clothoid");
			const w1 = element?.opts?.w1;
			const w2 = element?.opts?.w2;
			return {
				id: String(element.id), type: "transition", length, transitionType,
				opts: { ...(element?.opts ?? {}) },
				parameters: { length, transitionType, ...(w1 != null ? { w1 } : {}), ...(w2 != null ? { w2 } : {}) },
			};
		}
		throw new Error(`Unsupported imported alignment element ${String(element?.id ?? "unknown")}`);
	});
	return {
		type: "AlignmentData",
		id: String(spotObject?.id ?? kernel?.id ?? "alignment"),
		name: spotObject?.data?.name ?? kernel?.name ?? spotObject?.id ?? "Alignment",
		source: {
			kind: "derived-edit-representation",
			native: false,
			derivedFrom: "sparseAlignment",
			originalImportEvidence: structuredClone(spotObject?.meta?.source ?? spotObject?.data?.meta?.source ?? null),
		},
		editModel: { startPose: { p: { ...startPose.p }, t: { ...startPose.t } }, elements },
		sparseAlignment: kernel,
	};
}

export default materializeAlignmentDataFromSparse;
