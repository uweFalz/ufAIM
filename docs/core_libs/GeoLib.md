# GeoLib

GeoLib contains geometric and coordinate-related utilities
used by the alignment core and visualization layers.

GeoLib umfasst geometrische und koordinatenbezogene Hilfsfunktionen,
die vom Alignment-Kern und den Darstellungsmodulen genutzt werden.

Responsibilities
	•	local metric reference frames
	•	coordinate transformations
	•	bounding boxes and extents
	•	pose and frame utilities
	•	sampling helpers

CRS Strategy

Engineering computations are performed in a local,
metric reference system.

Global CRS and GIS projections are treated as contextual layers
and must not influence numerical core logic.

Non-Goals
	•	full CRS transformation libraries
	•	GIS feature processing
	•	raster or tile management

GeoLib exists to protect numerical correctness
from visualization-driven constraints.
