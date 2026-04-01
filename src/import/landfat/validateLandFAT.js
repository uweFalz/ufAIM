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

const CODES = {
	root_type: "root_type",
	root_type_value: "root_type_value",

	meta_required: "meta_required",
	units_required: "units_required",
	linear_unit_required: "linear_unit_required",
	elevation_unit_required: "elevation_unit_required",
	angular_unit_invalid: "angular_unit_invalid",

	coordinate_system_required: "coordinate_system_required",
	horizontal_crs_type: "horizontal_crs_type",
	vertical_crs_type: "vertical_crs_type",

	alignments_required: "alignments_required",
	extras_type: "extras_type",

	alignment_type: "alignment_type",
	alignment_type_value: "alignment_type_value",
	alignment_id_required: "alignment_id_required",
	alignment_name_type: "alignment_name_type",
	alignment_extras_type: "alignment_extras_type",

	coord_geom_required: "coord_geom_required",
	coord_geom_elements_required: "coord_geom_elements_required",
	coord_geom_element_type: "coord_geom_element_type",
	coord_geom_element_type_value: "coord_geom_element_type_value",

	line_extras_type: "line_extras_type",
	curve_rot_invalid: "curve_rot_invalid",
	curve_crv_type: "curve_crv_type",
	curve_extras_type: "curve_extras_type",
	spiral_rot_invalid: "spiral_rot_invalid",
	spiral_spi_type: "spiral_spi_type",
	spiral_extras_type: "spiral_extras_type",
	kink_extras_type: "kink_extras_type",

	sta_equations_type: "sta_equations_type",
	sta_equation_type: "sta_equation_type",
	sta_equation_type_value: "sta_equation_type_value",
	sta_equation_increment_invalid: "sta_equation_increment_invalid",

	profile_type: "profile_type",
	profile_type_value: "profile_type_value",
	profile_name_type: "profile_name_type",
	profile_desc_type: "profile_desc_type",
	profile_extras_type: "profile_extras_type",

	prof_align_type: "prof_align_type",
	prof_align_type_value: "prof_align_type_value",
	prof_align_name_type: "prof_align_name_type",
	prof_align_desc_type: "prof_align_desc_type",
	prof_align_pvis_type: "prof_align_pvis_type",
	prof_align_paracurves_type: "prof_align_paracurves_type",

	pvi_type: "pvi_type",
	pvi_extras_type: "pvi_extras_type",

	paracurve_type: "paracurve_type",
	paracurve_extras_type: "paracurve_extras_type",

	cant_type: "cant_type",
	cant_entry_type: "cant_entry_type",
	cant_entry_type_value: "cant_entry_type_value",
	cant_entry_type_unknown: "cant_entry_type_unknown",
	cant_station_speed_type: "cant_station_speed_type",
	cant_station_transition_type: "cant_station_transition_type",
	cant_station_curvature: "cant_station_curvature",
	cant_station_extras_type: "cant_station_extras_type",
	speed_station_speed_type: "speed_station_speed_type",
	speed_station_extras_type: "speed_station_extras_type",

	point2d_type: "point2d_type",
	point2d_easting: "point2d_easting",
	point2d_northing: "point2d_northing",

	measure_type: "measure_type",
	measure_value: "measure_value",
	measure_unit_type: "measure_unit_type",

	angle_type: "angle_type",
	angle_value: "angle_value",
	angle_unit_invalid: "angle_unit_invalid",
	angle_orientation_invalid: "angle_orientation_invalid",
	angle_origin_invalid: "angle_origin_invalid",

	radius_inf_value: "radius_inf_value",
	radius_inf_representation: "radius_inf_representation",
	radius_value_type: "radius_value_type",
};

export function validateLandFAT(doc) {
	const res = makeResult();
	validateRoot(doc, "", res);
	return res;
}

// -------------------------------------------------------------------------------------------------
// root
// -------------------------------------------------------------------------------------------------

function validateRoot(doc, path, res) {
	if (!isObject(doc)) {
		pushError(res, CODES.root_type, "landFAT root must be an object", path);
		return;
	}

	if (doc.type !== "landFAT") {
		pushError(res, CODES.root_type_value, 'root.type must be "landFAT"', joinPath(path, "type"));
	}

	if (!isObject(doc.meta)) {
		pushError(res, CODES.meta_required, "root.meta must be an object", joinPath(path, "meta"));
	}

	validateUnits(doc.units, joinPath(path, "units"), res);
	validateCoordinateSystem(doc.coordinateSystem, joinPath(path, "coordinateSystem"), res);

	if (!Array.isArray(doc.alignments)) {
		pushError(res, CODES.alignments_required, "root.alignments must be an array", joinPath(path, "alignments"));
	} else {
		doc.alignments.forEach((alignment, i) => {
			validateAlignment(alignment, `${joinPath(path, "alignments")}[${i}]`, res);
		});
	}

	if (doc.extras != null && !isObject(doc.extras)) {
		pushError(res, CODES.extras_type, "root.extras must be an object when present", joinPath(path, "extras"));
	}
}

// -------------------------------------------------------------------------------------------------
// units / coordinateSystem
// -------------------------------------------------------------------------------------------------

function validateUnits(units, path, res) {
	if (!isObject(units)) {
		pushError(res, CODES.units_required, "units must be an object", path);
		return;
	}

	if (!isNonEmptyString(units.linearUnit)) {
		pushError(res, CODES.linear_unit_required, "units.linearUnit must be a non-empty string", joinPath(path, "linearUnit"));
	}

	if (!isNonEmptyString(units.elevationUnit)) {
		pushError(res, CODES.elevation_unit_required, "units.elevationUnit must be a non-empty string", joinPath(path, "elevationUnit"));
	}

	if (units.angularUnit != null && !["radian", "gon", "degree"].includes(units.angularUnit)) {
		pushError(
			res,
			CODES.angular_unit_invalid,
			'units.angularUnit must be "radian", "gon", "degree", or null',
			joinPath(path, "angularUnit")
		);
	}
}

function validateCoordinateSystem(cs, path, res) {
	if (!isObject(cs)) {
		pushError(res, CODES.coordinate_system_required, "coordinateSystem must be an object", path);
		return;
	}

	if (cs.horizontalCoordinateSystemName != null && !isString(cs.horizontalCoordinateSystemName)) {
		pushError(
			res,
			CODES.horizontal_crs_type,
			"horizontalCoordinateSystemName must be string or null",
			joinPath(path, "horizontalCoordinateSystemName")
		);
	}

	if (cs.verticalCoordinateSystemName != null && !isString(cs.verticalCoordinateSystemName)) {
		pushError(
			res,
			CODES.vertical_crs_type,
			"verticalCoordinateSystemName must be string or null",
			joinPath(path, "verticalCoordinateSystemName")
		);
	}
}

// -------------------------------------------------------------------------------------------------
// alignment
// -------------------------------------------------------------------------------------------------

function validateAlignment(alignment, path, res) {
	if (!isObject(alignment)) {
		pushError(res, CODES.alignment_type, "alignment must be an object", path);
		return;
	}

	if (alignment.type !== "Alignment") {
		pushError(res, CODES.alignment_type_value, 'alignment.type must be "Alignment"', joinPath(path, "type"));
	}

	if (!isNonEmptyString(alignment.id)) {
		pushError(res, CODES.alignment_id_required, "alignment.id must be a non-empty string", joinPath(path, "id"));
	}

	if (alignment.name != null && !isString(alignment.name)) {
		pushError(res, CODES.alignment_name_type, "alignment.name must be string or null", joinPath(path, "name"));
	}

	validateCoordGeom(alignment.coordGeom, joinPath(path, "coordGeom"), res);

	if (alignment.staEquations != null) {
		if (!Array.isArray(alignment.staEquations)) {
			pushError(res, CODES.sta_equations_type, "alignment.staEquations must be an array or null", joinPath(path, "staEquations"));
		} else {
			alignment.staEquations.forEach((eq, i) => {
				validateStaEquation(eq, `${joinPath(path, "staEquations")}[${i}]`, res);
			});
		}
	}

	if (alignment.profile != null) {
		validateProfile(alignment.profile, joinPath(path, "profile"), res);
	}

	if (alignment.cant != null) {
		if (!Array.isArray(alignment.cant)) {
			pushError(res, CODES.cant_type, "alignment.cant must be an array or null", joinPath(path, "cant"));
		} else {
			alignment.cant.forEach((entry, i) => {
				validateCantEntry(entry, `${joinPath(path, "cant")}[${i}]`, res);
			});
		}
	}

	if (alignment.extras != null && !isObject(alignment.extras)) {
		pushError(res, CODES.alignment_extras_type, "alignment.extras must be an object when present", joinPath(path, "extras"));
	}
}

// -------------------------------------------------------------------------------------------------
// coordGeom
// -------------------------------------------------------------------------------------------------

function validateCoordGeom(coordGeom, path, res) {
	if (!isObject(coordGeom)) {
		pushError(res, CODES.coord_geom_required, "coordGeom must be an object", path);
		return;
	}

	if (!Array.isArray(coordGeom.elements)) {
		pushError(res, CODES.coord_geom_elements_required, "coordGeom.elements must be an array", joinPath(path, "elements"));
		return;
	}

	coordGeom.elements.forEach((el, i) => {
		validateCoordGeomElement(el, `${joinPath(path, "elements")}[${i}]`, res);
	});
}

function validateCoordGeomElement(el, path, res) {
	if (!isObject(el)) {
		pushError(res, CODES.coord_geom_element_type, "coordGeom element must be an object", path);
		return;
	}

	switch (el.type) {
		case "Line":
			validateLine(el, path, res);
			return;

		case "Curve":
			validateCurve(el, path, res);
			return;

		case "Spiral":
			validateSpiral(el, path, res);
			return;

		case "Kink":
			validateKink(el, path, res);
			return;

		default:
			pushError(
				res,
				CODES.coord_geom_element_type_value,
				'coordGeom element.type must be "Line", "Curve", "Spiral", or "Kink"',
				joinPath(path, "type")
			);
	}
}

// -------------------------------------------------------------------------------------------------
// line / curve / spiral / kink
// -------------------------------------------------------------------------------------------------

function validateLine(el, path, res) {
	validatePoint2D(el.start, joinPath(path, "start"), res);
	validatePoint2D(el.end, joinPath(path, "end"), res);

	if (el.staStart != null) validateMeasure(el.staStart, joinPath(path, "staStart"), res);
	if (el.length != null) validateMeasure(el.length, joinPath(path, "length"), res);
	if (el.direction != null) validateAngle(el.direction, joinPath(path, "direction"), res);

	if (el.extras != null && !isObject(el.extras)) {
		pushError(res, CODES.line_extras_type, "Line.extras must be an object when present", joinPath(path, "extras"));
	}
}

function validateCurve(el, path, res) {
	validatePoint2D(el.start, joinPath(path, "start"), res);
	validatePoint2D(el.end, joinPath(path, "end"), res);

	if (el.center != null) validatePoint2D(el.center, joinPath(path, "center"), res);

	if (el.staStart != null) validateMeasure(el.staStart, joinPath(path, "staStart"), res);
	if (el.length != null) validateMeasure(el.length, joinPath(path, "length"), res);
	if (el.radius != null) validateRadiusValue(el.radius, joinPath(path, "radius"), res);
	if (el.dirStart != null) validateAngle(el.dirStart, joinPath(path, "dirStart"), res);
	if (el.dirEnd != null) validateAngle(el.dirEnd, joinPath(path, "dirEnd"), res);

	if (el.rot != null && !["cw", "ccw"].includes(el.rot)) {
		pushError(res, CODES.curve_rot_invalid, 'Curve.rot must be "cw", "ccw", or null', joinPath(path, "rot"));
	}

	if (el.crvType != null && !isString(el.crvType)) {
		pushError(res, CODES.curve_crv_type, "Curve.crvType must be string or null", joinPath(path, "crvType"));
	}

	if (el.extras != null && !isObject(el.extras)) {
		pushError(res, CODES.curve_extras_type, "Curve.extras must be an object when present", joinPath(path, "extras"));
	}
}

function validateSpiral(el, path, res) {
	validatePoint2D(el.start, joinPath(path, "start"), res);
	validatePoint2D(el.end, joinPath(path, "end"), res);

	if (el.pi != null) validatePoint2D(el.pi, joinPath(path, "pi"), res);

	if (el.staStart != null) validateMeasure(el.staStart, joinPath(path, "staStart"), res);
	if (el.length != null) validateMeasure(el.length, joinPath(path, "length"), res);

	if (el.radiusStart != null) validateRadiusValue(el.radiusStart, joinPath(path, "radiusStart"), res);
	if (el.radiusEnd != null) validateRadiusValue(el.radiusEnd, joinPath(path, "radiusEnd"), res);

	if (el.dirStart != null) validateAngle(el.dirStart, joinPath(path, "dirStart"), res);
	if (el.dirEnd != null) validateAngle(el.dirEnd, joinPath(path, "dirEnd"), res);
	if (el.theta != null) validateAngle(el.theta, joinPath(path, "theta"), res);

	if (el.constant != null) validateMeasure(el.constant, joinPath(path, "constant"), res);
	if (el.totalX != null) validateMeasure(el.totalX, joinPath(path, "totalX"), res);
	if (el.totalY != null) validateMeasure(el.totalY, joinPath(path, "totalY"), res);
	if (el.tanLong != null) validateMeasure(el.tanLong, joinPath(path, "tanLong"), res);
	if (el.tanShort != null) validateMeasure(el.tanShort, joinPath(path, "tanShort"), res);

	if (el.rot != null && !["cw", "ccw"].includes(el.rot)) {
		pushError(res, CODES.spiral_rot_invalid, 'Spiral.rot must be "cw", "ccw", or null', joinPath(path, "rot"));
	}

	if (el.spiType != null && !isString(el.spiType)) {
		pushError(res, CODES.spiral_spi_type, "Spiral.spiType must be string or null", joinPath(path, "spiType"));
	}

	if (el.extras != null && !isObject(el.extras)) {
		pushError(res, CODES.spiral_extras_type, "Spiral.extras must be an object when present", joinPath(path, "extras"));
	}
}

function validateKink(el, path, res) {
	validatePoint2D(el.start, joinPath(path, "start"), res);

	if (el.end != null) validatePoint2D(el.end, joinPath(path, "end"), res);

	if (el.staStart != null) validateMeasure(el.staStart, joinPath(path, "staStart"), res);
	if (el.delta != null) validateAngle(el.delta, joinPath(path, "delta"), res);
	if (el.dirStart != null) validateAngle(el.dirStart, joinPath(path, "dirStart"), res);
	if (el.dirEnd != null) validateAngle(el.dirEnd, joinPath(path, "dirEnd"), res);

	if (el.length != null) {
		validateMeasure(el.length, joinPath(path, "length"), res);
	}

	if (el.extras != null && !isObject(el.extras)) {
		pushError(res, CODES.kink_extras_type, "Kink.extras must be an object when present", joinPath(path, "extras"));
	}
}

// -------------------------------------------------------------------------------------------------
// staEquation / profile / cant
// -------------------------------------------------------------------------------------------------

function validateStaEquation(eq, path, res) {
	if (!isObject(eq)) {
		pushError(res, CODES.sta_equation_type, "StaEquation must be an object", path);
		return;
	}

	if (eq.type != null && eq.type !== "StaEquation") {
		pushError(res, CODES.sta_equation_type_value, 'StaEquation.type must be "StaEquation" when present', joinPath(path, "type"));
	}

	if (eq.station != null) validateMeasure(eq.station, joinPath(path, "station"), res);
	if (eq.delta != null) validateMeasure(eq.delta, joinPath(path, "delta"), res);

	if (eq.staAhead != null) validateMeasure(eq.staAhead, joinPath(path, "staAhead"), res);
	if (eq.staBack != null) validateMeasure(eq.staBack, joinPath(path, "staBack"), res);
	if (eq.staInternal != null) validateMeasure(eq.staInternal, joinPath(path, "staInternal"), res);

	if (eq.staIncrement != null && !["increasing", "decreasing"].includes(eq.staIncrement)) {
		pushError(
			res,
			CODES.sta_equation_increment_invalid,
			'StaEquation.staIncrement must be "increasing", "decreasing", or null',
			joinPath(path, "staIncrement")
		);
	}
}

function validateProfile(profile, path, res) {
	if (!isObject(profile)) {
		pushError(res, CODES.profile_type, "profile must be an object", path);
		return;
	}

	if (profile.type != null && profile.type !== "Profile") {
		pushError(res, CODES.profile_type_value, 'profile.type must be "Profile" when present', joinPath(path, "type"));
	}

	if (profile.name != null && !isString(profile.name)) {
		pushError(res, CODES.profile_name_type, "profile.name must be string or null", joinPath(path, "name"));
	}

	if (profile.desc != null && !isString(profile.desc)) {
		pushError(res, CODES.profile_desc_type, "profile.desc must be string or null", joinPath(path, "desc"));
	}

	if (profile.profAlign != null) {
		validateProfAlign(profile.profAlign, joinPath(path, "profAlign"), res);
	}

	if (profile.extras != null && !isObject(profile.extras)) {
		pushError(res, CODES.profile_extras_type, "profile.extras must be an object when present", joinPath(path, "extras"));
	}
}

function validateProfAlign(profAlign, path, res) {
	if (!isObject(profAlign)) {
		pushError(res, CODES.prof_align_type, "profAlign must be an object", path);
		return;
	}

	if (profAlign.type != null && profAlign.type !== "ProfAlign") {
		pushError(res, CODES.prof_align_type_value, 'profAlign.type must be "ProfAlign" when present', joinPath(path, "type"));
	}

	if (profAlign.name != null && !isString(profAlign.name)) {
		pushError(res, CODES.prof_align_name_type, "profAlign.name must be string or null", joinPath(path, "name"));
	}

	if (profAlign.desc != null && !isString(profAlign.desc)) {
		pushError(res, CODES.prof_align_desc_type, "profAlign.desc must be string or null", joinPath(path, "desc"));
	}

	if (profAlign.pvis != null) {
		if (!Array.isArray(profAlign.pvis)) {
			pushError(res, CODES.prof_align_pvis_type, "profAlign.pvis must be an array when present", joinPath(path, "pvis"));
		} else {
			profAlign.pvis.forEach((pvi, i) => {
				validatePVI(pvi, `${joinPath(path, "pvis")}[${i}]`, res);
			});
		}
	}

	if (profAlign.paraCurves != null) {
		if (!Array.isArray(profAlign.paraCurves)) {
			pushError(res, CODES.prof_align_paracurves_type, "profAlign.paraCurves must be an array when present", joinPath(path, "paraCurves"));
		} else {
			profAlign.paraCurves.forEach((pc, i) => {
				validateParaCurve(pc, `${joinPath(path, "paraCurves")}[${i}]`, res);
			});
		}
	}
}

function validatePVI(pvi, path, res) {
	if (!isObject(pvi)) {
		pushError(res, CODES.pvi_type, "PVI must be an object", path);
		return;
	}

	if (pvi.station != null) validateMeasure(pvi.station, joinPath(path, "station"), res);
	if (pvi.elevation != null) validateMeasure(pvi.elevation, joinPath(path, "elevation"), res);

	if (pvi.extras != null && !isObject(pvi.extras)) {
		pushError(res, CODES.pvi_extras_type, "PVI.extras must be an object when present", joinPath(path, "extras"));
	}
}

function validateParaCurve(pc, path, res) {
	if (!isObject(pc)) {
		pushError(res, CODES.paracurve_type, "ParaCurve must be an object", path);
		return;
	}

	if (pc.length != null) validateMeasure(pc.length, joinPath(path, "length"), res);
	if (pc.station != null) validateMeasure(pc.station, joinPath(path, "station"), res);
	if (pc.elevation != null) validateMeasure(pc.elevation, joinPath(path, "elevation"), res);

	if (pc.extras != null && !isObject(pc.extras)) {
		pushError(res, CODES.paracurve_extras_type, "ParaCurve.extras must be an object when present", joinPath(path, "extras"));
	}
}

function validateCantEntry(entry, path, res) {
	if (!isObject(entry)) {
		pushError(res, CODES.cant_entry_type, "cant entry must be an object", path);
		return;
	}

	if (!isNonEmptyString(entry.type)) {
		pushError(res, CODES.cant_entry_type_value, "cant entry.type must be a non-empty string", joinPath(path, "type"));
		return;
	}

	switch (entry.type) {
		case "CantStation":
			validateCantStation(entry, path, res);
			return;

		case "SpeedStation":
			validateSpeedStation(entry, path, res);
			return;

		default:
			pushError(res, CODES.cant_entry_type_unknown, 'cant entry.type must be "CantStation" or "SpeedStation"', joinPath(path, "type"));
	}
}

function validateCantStation(entry, path, res) {
	if (entry.station != null) validateMeasure(entry.station, joinPath(path, "station"), res);
	if (entry.appliedCant != null) validateMeasure(entry.appliedCant, joinPath(path, "appliedCant"), res);

	if (entry.speed != null) {
		if (!isFiniteNumber(entry.speed) && !isObject(entry.speed)) {
			pushError(res, CODES.cant_station_speed_type, "CantStation.speed must be a finite number, measure, or null", joinPath(path, "speed"));
		} else if (isObject(entry.speed)) {
			validateMeasure(entry.speed, joinPath(path, "speed"), res);
		}
	}

	if (entry.transitionType != null && !isString(entry.transitionType)) {
		pushError(res, CODES.cant_station_transition_type, "CantStation.transitionType must be string or null", joinPath(path, "transitionType"));
	}

	if (entry.curvature != null && !["cw", "ccw"].includes(entry.curvature)) {
		pushError(res, CODES.cant_station_curvature, 'CantStation.curvature must be "cw", "ccw", or null', joinPath(path, "curvature"));
	}

	if (entry.extras != null && !isObject(entry.extras)) {
		pushError(res, CODES.cant_station_extras_type, "CantStation.extras must be an object when present", joinPath(path, "extras"));
	}
}

function validateSpeedStation(entry, path, res) {
	if (entry.station != null) validateMeasure(entry.station, joinPath(path, "station"), res);

	if (entry.speed != null) {
		if (!isFiniteNumber(entry.speed) && !isObject(entry.speed)) {
			pushError(res, CODES.speed_station_speed_type, "SpeedStation.speed must be a finite number, measure, or null", joinPath(path, "speed"));
		} else if (isObject(entry.speed)) {
			validateMeasure(entry.speed, joinPath(path, "speed"), res);
		}
	}

	if (entry.extras != null && !isObject(entry.extras)) {
		pushError(res, CODES.speed_station_extras_type, "SpeedStation.extras must be an object when present", joinPath(path, "extras"));
	}
}

// -------------------------------------------------------------------------------------------------
// atoms
// -------------------------------------------------------------------------------------------------

function validatePoint2D(point, path, res) {
	if (!isObject(point)) {
		pushError(res, CODES.point2d_type, "point must be an object", path);
		return;
	}

	if (!isFiniteNumber(point.easting)) {
		pushError(res, CODES.point2d_easting, "point.easting must be a finite number", joinPath(path, "easting"));
	}

	if (!isFiniteNumber(point.northing)) {
		pushError(res, CODES.point2d_northing, "point.northing must be a finite number", joinPath(path, "northing"));
	}
}

function validateMeasure(m, path, res) {
	if (!isObject(m)) {
		pushError(res, CODES.measure_type, "measure must be an object", path);
		return;
	}

	if (!isFiniteNumber(m.value)) {
		pushError(res, CODES.measure_value, "measure.value must be a finite number", joinPath(path, "value"));
	}

	if (m.unit != null && !isString(m.unit)) {
		pushError(res, CODES.measure_unit_type, "measure.unit must be string or null", joinPath(path, "unit"));
	}
}

function validateAngle(a, path, res) {
	if (!isObject(a)) {
		pushError(res, CODES.angle_type, "angle must be an object", path);
		return;
	}

	if (!isFiniteNumber(a.value)) {
		pushError(res, CODES.angle_value, "angle.value must be a finite number", joinPath(path, "value"));
	}

	if (!["radian", "gon", "degree"].includes(a.unit)) {
		pushError(res, CODES.angle_unit_invalid, 'angle.unit must be "radian", "gon", or "degree"', joinPath(path, "unit"));
	}

	if (!["cw", "ccw"].includes(a.orientation)) {
		pushError(res, CODES.angle_orientation_invalid, 'angle.orientation must be "cw" or "ccw"', joinPath(path, "orientation"));
	}

	if (!["north", "east", "south", "west"].includes(a.origin)) {
		pushError(res, CODES.angle_origin_invalid, 'angle.origin must be "north", "east", "south", or "west"', joinPath(path, "origin"));
	}
}

function validateRadiusValue(v, path, res) {
	if (isFiniteNumber(v)) return;

	if (isObject(v)) {
		if (v.value !== "INF") {
			pushError(res, CODES.radius_inf_value, 'radius.value must be "INF"', joinPath(path, "value"));
		}
		if (v.representation !== "infinite") {
			pushError(res, CODES.radius_inf_representation, 'radius.representation must be "infinite"', joinPath(path, "representation"));
		}
		return;
	}

	pushError(
		res,
		CODES.radius_value_type,
		'radius must be a finite number or an object like { value: "INF", representation: "infinite" }',
		path
	);
}

// -------------------------------------------------------------------------------------------------
// helpers
// -------------------------------------------------------------------------------------------------

function makeResult() {
	return {
		ok: true,
		errors: [],
		warnings: [],
	};
}

function pushError(res, code, message, path = "") {
	res.ok = false;
	res.errors.push({ path, code, message });
}

function pushWarning(res, code, message, path = "") {
	res.warnings.push({ path, code, message });
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
