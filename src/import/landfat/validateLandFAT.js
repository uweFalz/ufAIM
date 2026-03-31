// src/import/landfat/validateLandFAT.js
//
// LAND_FAT structural validator
//
// @baustelle [CONTRACT]
// Validator prüft ausschließlich Struktur / Typisierung des parserinternen
// Austauschformats landFAT.
//
// Er macht NICHT:
// - keine Geometrieberechnung
// - keine Richtungsumrechnung
// - keine sparse-Vorbereitung
// - keine fachliche Interpretation alter Formate
//
// Ziel:
// formatParser -> landFAT -> validateLandFAT -> buildSparseFromFAT
//
// @baustelle [STRICTNESS]
// Dieser Validator ist bewusst strukturell streng,
// aber semantisch noch nicht vollständig fachprüfend.
// Beispiel:
// - Reihenfolge von CoordGeom-Elementen wird nicht topologisch verifiziert
// - Widersprüche zwischen profile/cant/coordGeom werden noch nicht geprüft
// - 7L-Striktheit kommt erst in buildSparseFromFAT()

export function validateLandFAT(doc) {
	const errors = [];
	const warnings = [];

	validateRoot(doc, "", errors, warnings);

	return {
		ok: errors.length === 0,
		errors,
		warnings,
	};
}

// -------------------------------------------------------------------------------------------------
// root
// -------------------------------------------------------------------------------------------------

function validateRoot(doc, path, errors, warnings) {
	if (!isObject(doc)) {
		pushError(errors, path, "root_type", "landFAT root must be an object");
		return;
	}

	if (doc.type !== "landFAT") {
		pushError(errors, joinPath(path, "type"), "root_type_value", 'root.type must be "landFAT"');
	}

	if (!isObject(doc.meta)) {
		pushError(errors, joinPath(path, "meta"), "meta_required", "root.meta must be an object");
	}

	validateUnits(doc.units, joinPath(path, "units"), errors, warnings);
	validateCoordinateSystem(doc.coordinateSystem, joinPath(path, "coordinateSystem"), errors, warnings);

	if (!Array.isArray(doc.alignments)) {
		pushError(errors, joinPath(path, "alignments"), "alignments_required", "root.alignments must be an array");
	} else {
		doc.alignments.forEach((alignment, i) => {
			validateAlignment(alignment, `${joinPath(path, "alignments")}[${i}]`, errors, warnings);
		});
	}

	if (doc.extras != null && !isObject(doc.extras)) {
		pushError(errors, joinPath(path, "extras"), "extras_type", "root.extras must be an object when present");
	}
}

// -------------------------------------------------------------------------------------------------
// units / coordinateSystem
// -------------------------------------------------------------------------------------------------

function validateUnits(units, path, errors, warnings) {
	if (!isObject(units)) {
		pushError(errors, path, "units_required", "units must be an object");
		return;
	}

	if (!isNonEmptyString(units.linearUnit)) {
		pushError(errors, joinPath(path, "linearUnit"), "linear_unit_required", "units.linearUnit must be a non-empty string");
	}

	if (!isNonEmptyString(units.elevationUnit)) {
		pushError(errors, joinPath(path, "elevationUnit"), "elevation_unit_required", "units.elevationUnit must be a non-empty string");
	}

	if (units.angularUnit != null && !["radian", "gon", "degree"].includes(units.angularUnit)) {
		pushError(
			errors,
			joinPath(path, "angularUnit"),
			"angular_unit_invalid",
			'units.angularUnit must be "radian", "gon", "degree", or null'
		);
	}
}

function validateCoordinateSystem(cs, path, errors, warnings) {
	if (!isObject(cs)) {
		pushError(errors, path, "coordinate_system_required", "coordinateSystem must be an object");
		return;
	}

	if (cs.horizontalCoordinateSystemName != null && !isString(cs.horizontalCoordinateSystemName)) {
		pushError(
			errors,
			joinPath(path, "horizontalCoordinateSystemName"),
			"horizontal_crs_type",
			"horizontalCoordinateSystemName must be string or null"
		);
	}

	if (cs.verticalCoordinateSystemName != null && !isString(cs.verticalCoordinateSystemName)) {
		pushError(
			errors,
			joinPath(path, "verticalCoordinateSystemName"),
			"vertical_crs_type",
			"verticalCoordinateSystemName must be string or null"
		);
	}
}

// -------------------------------------------------------------------------------------------------
// alignment
// -------------------------------------------------------------------------------------------------

function validateAlignment(alignment, path, errors, warnings) {
	if (!isObject(alignment)) {
		pushError(errors, path, "alignment_type", "alignment must be an object");
		return;
	}

	if (alignment.type !== "Alignment") {
		pushError(errors, joinPath(path, "type"), "alignment_type_value", 'alignment.type must be "Alignment"');
	}

	if (!isNonEmptyString(alignment.id)) {
		pushError(errors, joinPath(path, "id"), "alignment_id_required", "alignment.id must be a non-empty string");
	}

	if (alignment.name != null && !isString(alignment.name)) {
		pushError(errors, joinPath(path, "name"), "alignment_name_type", "alignment.name must be string or null");
	}

	validateCoordGeom(alignment.coordGeom, joinPath(path, "coordGeom"), errors, warnings);

	if (alignment.staEquations != null) {
		if (!Array.isArray(alignment.staEquations)) {
			pushError(errors, joinPath(path, "staEquations"), "sta_equations_type", "alignment.staEquations must be an array or null");
		} else {
			alignment.staEquations.forEach((eq, i) => {
				validateStaEquation(eq, `${joinPath(path, "staEquations")}[${i}]`, errors, warnings);
			});
		}
	}

	if (alignment.profile != null) {
		validateProfile(alignment.profile, joinPath(path, "profile"), errors, warnings);
	}

	if (alignment.cant != null) {
		if (!Array.isArray(alignment.cant)) {
			pushError(errors, joinPath(path, "cant"), "cant_type", "alignment.cant must be an array or null");
		} else {
			alignment.cant.forEach((entry, i) => {
				validateCantEntry(entry, `${joinPath(path, "cant")}[${i}]`, errors, warnings);
			});
		}
	}

	if (alignment.extras != null && !isObject(alignment.extras)) {
		pushError(errors, joinPath(path, "extras"), "alignment_extras_type", "alignment.extras must be an object when present");
	}
}

// -------------------------------------------------------------------------------------------------
// coordGeom
// -------------------------------------------------------------------------------------------------

function validateCoordGeom(coordGeom, path, errors, warnings) {
	if (!isObject(coordGeom)) {
		pushError(errors, path, "coord_geom_required", "coordGeom must be an object");
		return;
	}

	if (!Array.isArray(coordGeom.elements)) {
		pushError(errors, joinPath(path, "elements"), "coord_geom_elements_required", "coordGeom.elements must be an array");
		return;
	}

	coordGeom.elements.forEach((el, i) => {
		validateCoordGeomElement(el, `${joinPath(path, "elements")}[${i}]`, errors, warnings);
	});
}

function validateCoordGeomElement(el, path, errors, warnings) {
	if (!isObject(el)) {
		pushError(errors, path, "coord_geom_element_type", "coordGeom element must be an object");
		return;
	}

	switch (el.type) {
		case "Line":
			validateLine(el, path, errors, warnings);
			return;

		case "Curve":
			validateCurve(el, path, errors, warnings);
			return;

		case "Spiral":
			validateSpiral(el, path, errors, warnings);
			return;

		case "Kink":
			validateKink(el, path, errors, warnings);
			return;

		default:
			pushError(
				errors,
				joinPath(path, "type"),
				"coord_geom_element_type_value",
				'coordGeom element.type must be "Line", "Curve", "Spiral", or "Kink"'
			);
	}
}

// -------------------------------------------------------------------------------------------------
// line / curve / spiral / kink
// -------------------------------------------------------------------------------------------------

function validateLine(el, path, errors, warnings) {
	validatePoint2D(el.start, joinPath(path, "start"), errors);
	validatePoint2D(el.end, joinPath(path, "end"), errors);

	if (el.staStart != null) validateMeasure(el.staStart, joinPath(path, "staStart"), errors);
	if (el.length != null) validateMeasure(el.length, joinPath(path, "length"), errors);
	if (el.direction != null) validateAngle(el.direction, joinPath(path, "direction"), errors);

	if (el.extras != null && !isObject(el.extras)) {
		pushError(errors, joinPath(path, "extras"), "line_extras_type", "Line.extras must be an object when present");
	}
}

function validateCurve(el, path, errors, warnings) {
	validatePoint2D(el.start, joinPath(path, "start"), errors);
	validatePoint2D(el.end, joinPath(path, "end"), errors);

	if (el.center != null) validatePoint2D(el.center, joinPath(path, "center"), errors);

	if (el.staStart != null) validateMeasure(el.staStart, joinPath(path, "staStart"), errors);
	if (el.length != null) validateMeasure(el.length, joinPath(path, "length"), errors);
	if (el.radius != null) validateRadiusValue(el.radius, joinPath(path, "radius"), errors);
	if (el.dirStart != null) validateAngle(el.dirStart, joinPath(path, "dirStart"), errors);
	if (el.dirEnd != null) validateAngle(el.dirEnd, joinPath(path, "dirEnd"), errors);

	if (el.rot != null && !["cw", "ccw"].includes(el.rot)) {
		pushError(errors, joinPath(path, "rot"), "curve_rot_invalid", 'Curve.rot must be "cw", "ccw", or null');
	}

	if (el.crvType != null && !isString(el.crvType)) {
		pushError(errors, joinPath(path, "crvType"), "curve_crv_type", "Curve.crvType must be string or null");
	}

	if (el.extras != null && !isObject(el.extras)) {
		pushError(errors, joinPath(path, "extras"), "curve_extras_type", "Curve.extras must be an object when present");
	}
}

function validateSpiral(el, path, errors, warnings) {
	validatePoint2D(el.start, joinPath(path, "start"), errors);
	validatePoint2D(el.end, joinPath(path, "end"), errors);

	if (el.pi != null) validatePoint2D(el.pi, joinPath(path, "pi"), errors);

	if (el.staStart != null) validateMeasure(el.staStart, joinPath(path, "staStart"), errors);
	if (el.length != null) validateMeasure(el.length, joinPath(path, "length"), errors);

	if (el.radiusStart != null) validateRadiusValue(el.radiusStart, joinPath(path, "radiusStart"), errors);
	if (el.radiusEnd != null) validateRadiusValue(el.radiusEnd, joinPath(path, "radiusEnd"), errors);

	if (el.dirStart != null) validateAngle(el.dirStart, joinPath(path, "dirStart"), errors);
	if (el.dirEnd != null) validateAngle(el.dirEnd, joinPath(path, "dirEnd"), errors);
	if (el.theta != null) validateAngle(el.theta, joinPath(path, "theta"), errors);

	if (el.constant != null) validateMeasure(el.constant, joinPath(path, "constant"), errors);
	if (el.totalX != null) validateMeasure(el.totalX, joinPath(path, "totalX"), errors);
	if (el.totalY != null) validateMeasure(el.totalY, joinPath(path, "totalY"), errors);
	if (el.tanLong != null) validateMeasure(el.tanLong, joinPath(path, "tanLong"), errors);
	if (el.tanShort != null) validateMeasure(el.tanShort, joinPath(path, "tanShort"), errors);

	if (el.rot != null && !["cw", "ccw"].includes(el.rot)) {
		pushError(errors, joinPath(path, "rot"), "spiral_rot_invalid", 'Spiral.rot must be "cw", "ccw", or null');
	}

	if (el.spiType != null && !isString(el.spiType)) {
		pushError(errors, joinPath(path, "spiType"), "spiral_spi_type", "Spiral.spiType must be string or null");
	}

	if (el.extras != null && !isObject(el.extras)) {
		pushError(errors, joinPath(path, "extras"), "spiral_extras_type", "Spiral.extras must be an object when present");
	}
}

function validateKink(el, path, errors, warnings) {
	validatePoint2D(el.start, joinPath(path, "start"), errors);

	if (el.end != null) validatePoint2D(el.end, joinPath(path, "end"), errors);

	if (el.staStart != null) validateMeasure(el.staStart, joinPath(path, "staStart"), errors);
	if (el.delta != null) validateAngle(el.delta, joinPath(path, "delta"), errors);
	if (el.dirStart != null) validateAngle(el.dirStart, joinPath(path, "dirStart"), errors);
	if (el.dirEnd != null) validateAngle(el.dirEnd, joinPath(path, "dirEnd"), errors);

	if (el.length != null) {
		validateMeasure(el.length, joinPath(path, "length"), errors);
	}

	if (el.extras != null && !isObject(el.extras)) {
		pushError(errors, joinPath(path, "extras"), "kink_extras_type", "Kink.extras must be an object when present");
	}
}

// -------------------------------------------------------------------------------------------------
// staEquation / profile / cant
// -------------------------------------------------------------------------------------------------

function validateStaEquation(eq, path, errors, warnings) {
	if (!isObject(eq)) {
		pushError(errors, path, "sta_equation_type", "StaEquation must be an object");
		return;
	}

	if (eq.type != null && eq.type !== "StaEquation") {
		pushError(errors, joinPath(path, "type"), "sta_equation_type_value", 'StaEquation.type must be "StaEquation" when present');
	}

	if (eq.station != null) validateMeasure(eq.station, joinPath(path, "station"), errors);
	if (eq.delta != null) validateMeasure(eq.delta, joinPath(path, "delta"), errors);

	if (eq.staAhead != null) validateMeasure(eq.staAhead, joinPath(path, "staAhead"), errors);
	if (eq.staBack != null) validateMeasure(eq.staBack, joinPath(path, "staBack"), errors);
	if (eq.staInternal != null) validateMeasure(eq.staInternal, joinPath(path, "staInternal"), errors);

	if (eq.staIncrement != null && !["increasing", "decreasing"].includes(eq.staIncrement)) {
		pushError(
			errors,
			joinPath(path, "staIncrement"),
			"sta_equation_increment_invalid",
			'StaEquation.staIncrement must be "increasing", "decreasing", or null'
		);
	}
}

function validateProfile(profile, path, errors, warnings) {
	if (!isObject(profile)) {
		pushError(errors, path, "profile_type", "profile must be an object");
		return;
	}

	if (profile.type != null && profile.type !== "Profile") {
		pushError(errors, joinPath(path, "type"), "profile_type_value", 'profile.type must be "Profile" when present');
	}

	if (profile.name != null && !isString(profile.name)) {
		pushError(errors, joinPath(path, "name"), "profile_name_type", "profile.name must be string or null");
	}

	if (profile.desc != null && !isString(profile.desc)) {
		pushError(errors, joinPath(path, "desc"), "profile_desc_type", "profile.desc must be string or null");
	}

	if (profile.profAlign != null) {
		validateProfAlign(profile.profAlign, joinPath(path, "profAlign"), errors, warnings);
	}

	if (profile.extras != null && !isObject(profile.extras)) {
		pushError(errors, joinPath(path, "extras"), "profile_extras_type", "profile.extras must be an object when present");
	}
}

function validateProfAlign(profAlign, path, errors, warnings) {
	if (!isObject(profAlign)) {
		pushError(errors, path, "prof_align_type", "profAlign must be an object");
		return;
	}

	if (profAlign.type != null && profAlign.type !== "ProfAlign") {
		pushError(errors, joinPath(path, "type"), "prof_align_type_value", 'profAlign.type must be "ProfAlign" when present');
	}

	if (profAlign.name != null && !isString(profAlign.name)) {
		pushError(errors, joinPath(path, "name"), "prof_align_name_type", "profAlign.name must be string or null");
	}

	if (profAlign.desc != null && !isString(profAlign.desc)) {
		pushError(errors, joinPath(path, "desc"), "prof_align_desc_type", "profAlign.desc must be string or null");
	}

	if (profAlign.pvis != null) {
		if (!Array.isArray(profAlign.pvis)) {
			pushError(errors, joinPath(path, "pvis"), "prof_align_pvis_type", "profAlign.pvis must be an array when present");
		} else {
			profAlign.pvis.forEach((pvi, i) => {
				validatePVI(pvi, `${joinPath(path, "pvis")}[${i}]`, errors, warnings);
			});
		}
	}

	if (profAlign.paraCurves != null) {
		if (!Array.isArray(profAlign.paraCurves)) {
			pushError(errors, joinPath(path, "paraCurves"), "prof_align_paracurves_type", "profAlign.paraCurves must be an array when present");
		} else {
			profAlign.paraCurves.forEach((pc, i) => {
				validateParaCurve(pc, `${joinPath(path, "paraCurves")}[${i}]`, errors, warnings);
			});
		}
	}
}

function validatePVI(pvi, path, errors, warnings) {
	if (!isObject(pvi)) {
		pushError(errors, path, "pvi_type", "PVI must be an object");
		return;
	}

	if (pvi.station != null) validateMeasure(pvi.station, joinPath(path, "station"), errors);
	if (pvi.elevation != null) validateMeasure(pvi.elevation, joinPath(path, "elevation"), errors);

	if (pvi.extras != null && !isObject(pvi.extras)) {
		pushError(errors, joinPath(path, "extras"), "pvi_extras_type", "PVI.extras must be an object when present");
	}
}

function validateParaCurve(pc, path, errors, warnings) {
	if (!isObject(pc)) {
		pushError(errors, path, "paracurve_type", "ParaCurve must be an object");
		return;
	}

	if (pc.length != null) validateMeasure(pc.length, joinPath(path, "length"), errors);
	if (pc.station != null) validateMeasure(pc.station, joinPath(path, "station"), errors);
	if (pc.elevation != null) validateMeasure(pc.elevation, joinPath(path, "elevation"), errors);

	if (pc.extras != null && !isObject(pc.extras)) {
		pushError(errors, joinPath(path, "extras"), "paracurve_extras_type", "ParaCurve.extras must be an object when present");
	}
}

function validateCantEntry(entry, path, errors, warnings) {
	if (!isObject(entry)) {
		pushError(errors, path, "cant_entry_type", "cant entry must be an object");
		return;
	}

	if (!isNonEmptyString(entry.type)) {
		pushError(errors, joinPath(path, "type"), "cant_entry_type_value", 'cant entry.type must be a non-empty string');
		return;
	}

	switch (entry.type) {
		case "CantStation":
			validateCantStation(entry, path, errors, warnings);
			return;

		case "SpeedStation":
			validateSpeedStation(entry, path, errors, warnings);
			return;

		default:
			pushError(errors, joinPath(path, "type"), "cant_entry_type_unknown", 'cant entry.type must be "CantStation" or "SpeedStation"');
	}
}

function validateCantStation(entry, path, errors, warnings) {
	if (entry.station != null) validateMeasure(entry.station, joinPath(path, "station"), errors);
	if (entry.appliedCant != null) validateMeasure(entry.appliedCant, joinPath(path, "appliedCant"), errors);

	if (entry.speed != null) {
		if (!isFiniteNumber(entry.speed) && !isObject(entry.speed)) {
			pushError(errors, joinPath(path, "speed"), "cant_station_speed_type", "CantStation.speed must be a finite number, measure, or null");
		} else if (isObject(entry.speed)) {
			validateMeasure(entry.speed, joinPath(path, "speed"), errors);
		}
	}

	if (entry.transitionType != null && !isString(entry.transitionType)) {
		pushError(errors, joinPath(path, "transitionType"), "cant_station_transition_type", "CantStation.transitionType must be string or null");
	}

	if (entry.curvature != null && !["cw", "ccw"].includes(entry.curvature)) {
		pushError(errors, joinPath(path, "curvature"), "cant_station_curvature", 'CantStation.curvature must be "cw", "ccw", or null');
	}

	if (entry.extras != null && !isObject(entry.extras)) {
		pushError(errors, joinPath(path, "extras"), "cant_station_extras_type", "CantStation.extras must be an object when present");
	}
}

function validateSpeedStation(entry, path, errors, warnings) {
	if (entry.station != null) validateMeasure(entry.station, joinPath(path, "station"), errors);

	if (entry.speed != null) {
		if (!isFiniteNumber(entry.speed) && !isObject(entry.speed)) {
			pushError(errors, joinPath(path, "speed"), "speed_station_speed_type", "SpeedStation.speed must be a finite number, measure, or null");
		} else if (isObject(entry.speed)) {
			validateMeasure(entry.speed, joinPath(path, "speed"), errors);
		}
	}

	if (entry.extras != null && !isObject(entry.extras)) {
		pushError(errors, joinPath(path, "extras"), "speed_station_extras_type", "SpeedStation.extras must be an object when present");
	}
}

// -------------------------------------------------------------------------------------------------
// atoms
// -------------------------------------------------------------------------------------------------

function validatePoint2D(point, path, errors) {
	if (!isObject(point)) {
		pushError(errors, path, "point2d_type", "point must be an object");
		return;
	}

	if (!isFiniteNumber(point.easting)) {
		pushError(errors, joinPath(path, "easting"), "point2d_easting", "point.easting must be a finite number");
	}

	if (!isFiniteNumber(point.northing)) {
		pushError(errors, joinPath(path, "northing"), "point2d_northing", "point.northing must be a finite number");
	}
}

function validateMeasure(m, path, errors) {
	if (!isObject(m)) {
		pushError(errors, path, "measure_type", "measure must be an object");
		return;
	}

	if (!isFiniteNumber(m.value)) {
		pushError(errors, joinPath(path, "value"), "measure_value", "measure.value must be a finite number");
	}

	if (m.unit != null && !isString(m.unit)) {
		pushError(errors, joinPath(path, "unit"), "measure_unit_type", "measure.unit must be string or null");
	}
}

function validateAngle(a, path, errors) {
	if (!isObject(a)) {
		pushError(errors, path, "angle_type", "angle must be an object");
		return;
	}

	if (!isFiniteNumber(a.value)) {
		pushError(errors, joinPath(path, "value"), "angle_value", "angle.value must be a finite number");
	}

	if (!["radian", "gon", "degree"].includes(a.unit)) {
		pushError(errors, joinPath(path, "unit"), "angle_unit_invalid", 'angle.unit must be "radian", "gon", or "degree"');
	}

	if (!["cw", "ccw"].includes(a.orientation)) {
		pushError(errors, joinPath(path, "orientation"), "angle_orientation_invalid", 'angle.orientation must be "cw" or "ccw"');
	}

	if (!["north", "east", "south", "west"].includes(a.origin)) {
		pushError(errors, joinPath(path, "origin"), "angle_origin_invalid", 'angle.origin must be "north", "east", "south", or "west"');
	}
}

function validateRadiusValue(v, path, errors) {
	if (isFiniteNumber(v)) return;

	if (isObject(v)) {
		if (v.value !== "INF") {
			pushError(errors, joinPath(path, "value"), "radius_inf_value", 'radius.value must be "INF"');
		}
		if (v.representation !== "infinite") {
			pushError(errors, joinPath(path, "representation"), "radius_inf_representation", 'radius.representation must be "infinite"');
		}
		return;
	}

	pushError(
		errors,
		path,
		"radius_value_type",
		'radius must be a finite number or an object like { value: "INF", representation: "infinite" }'
	);
}

// -------------------------------------------------------------------------------------------------
// helpers
// -------------------------------------------------------------------------------------------------

function pushError(errors, path, code, message) {
	errors.push({ path, code, message });
}

function joinPath(base, key) {
	return base ? `${base}.${key}` : key;
}

function isObject(x) {
	return !!x && typeof x === "object" && !Array.isArray(x);
}

function isString(x) {
	return typeof x === "string";
}

function isNonEmptyString(x) {
	return typeof x === "string" && x.trim() !== "";
}

function isFiniteNumber(x) {
	return Number.isFinite(x);
}
