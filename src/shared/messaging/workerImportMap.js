// src/shared/messaging/workerImportMap.js
//
// Pseudo-ImportMap for SharedWorker context.
// Worker cannot rely on window import maps.
// This file is the single source of truth for worker-local module paths.

export const workerImportMap = Object.freeze({
	"@app/": "/app/",

	"@shared/": "/src/shared/",
	"@spot/": "/src/model/spot/",
	"@alignment/": "/src/alignment/",
	"@transition/": "/src/transition/",
	"@kgeom/": "/src/lib/geom/",
	"@kmath/": "/src/lib/math/",
	"@kimport/": "/src/import/",
	"@projection/": "/src/domain/projection/",
});
