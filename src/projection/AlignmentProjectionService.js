// src/projection/AlignmentProjectionService.js

import { sampleAlignment } from "./sampleAlignment.js";

export function _projectAlignmentToPolyline(alignment, opts = {}) {
	// TODO: sampling
	return {
		polyline: [],
		stations: [],
		meta: {}
	};
}

export function projectAlignmentToPolyline(alignment, opts = {}) {
  const pts = sampleAlignment(alignment, opts);

  return {
    polyline: pts,
    bbox: computeBBox(pts)
  };
}

function computeBBox(pts) {
  let minX = Infinity, minY = Infinity;
  let maxX = -Infinity, maxY = -Infinity;

  for (const p of pts) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }

  return { minX, minY, maxX, maxY };
}