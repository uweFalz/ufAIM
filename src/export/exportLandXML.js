// src/export/exportLandXML.js

import { projectAlignmentPreview } from "@projection/AlignmentProjectionService.js";

export function exportLandXML({ alignment, meta = {}, maxStep = 5 } = {}) {
	if (!alignment) {
		throw new Error("exportLandXML: missing alignment");
	}

	const name = meta.name ?? alignment.name ?? "ufAIM_alignment";

	const geom = projectAlignmentPreview({
		sparseAlignment: alignment,
		maxStep,
	});

	const points = Array.isArray(geom?.polyline2d) ? geom.polyline2d : [];

	const coordGeom = buildCoordGeomFromPolyline(points);

	return `<?xml version="1.0" encoding="UTF-8"?>
<LandXML version="1.2">
  <Units>
    <Metric linearUnit="meter" angularUnit="radian"/>
  </Units>

  <Alignments>
    <Alignment name="${escapeXml(name)}" length="${formatNumber(coordGeom.length)}">
      <CoordGeom>
${coordGeom.xml}
      </CoordGeom>
    </Alignment>
  </Alignments>
</LandXML>`;
}

function buildCoordGeomFromPolyline(points) {
	let xml = "";
	let totalLength = 0;

	for (let i = 1; i < points.length; i += 1) {
		const a = points[i - 1];
		const b = points[i];

		const x1 = readCoord(a, "x", 0);
		const y1 = readCoord(a, "y", 0);
		const x2 = readCoord(b, "x", 0);
		const y2 = readCoord(b, "y", 0);

		const len = Math.hypot(x2 - x1, y2 - y1);
		if (!Number.isFinite(len) || len <= 0) continue;

		xml += `        <Line length="${formatNumber(len)}">
          <Start>${formatNumber(x1)} ${formatNumber(y1)}</Start>
          <End>${formatNumber(x2)} ${formatNumber(y2)}</End>
        </Line>
`;

		totalLength += len;
	}

	return {
		xml,
		length: totalLength,
	};
}

function readCoord(p, key, fallback) {
	const v = Number(p?.[key]);
	return Number.isFinite(v) ? v : fallback;
}

function formatNumber(value) {
	const n = Number(value);
	if (!Number.isFinite(n)) return "0";
	return String(Math.round(n * 1000) / 1000);
}

function escapeXml(str) {
	return String(str)
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");
}
