// app/io/import/preview/validateAlignmentPreviewArtifact.js

/**
* @baustelle [PREVIEW-CONTRACT]
* Alignment preview currently based on poseA-polyline.
* Later preview modes may include sampled geometry.
*/
export function validateAlignmentPreviewArtifact(art) {
	if (!art || typeof art !== "object") {
		throw new Error("preview artifact must be object");
	}
	if (art.domain !== "alignment2d") {
		throw new Error("preview artifact domain must be alignment2d");
	}

	const pts = art?.payload?.polyline2d;
	if (!Array.isArray(pts) || pts.length < 2) {
		throw new Error("preview artifact polyline2d invalid");
	}

	for (const [i, p] of pts.entries()) {
		if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.y)) {
			throw new Error(`preview artifact polyline2d[${i}] invalid`);
		}
	}

	return true;
}
